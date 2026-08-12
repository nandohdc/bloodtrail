// Differential controls for the history anchor behind every declared archive
// movement attestation.
//
// These are separate from archive-attestation.test.mjs, which covers the two-path
// baseline inside check-changed-paths.mjs. That gate compares an archive against
// the active change it replaced; this one compares both the archive *and* the
// attestation against the commit history shows introduced the archive, which is
// the only party to that comparison neither of them can restate.
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { lifecycleMetadata } from "../../scripts/lifecycle-policy.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

const REMEDIATION_ARCHIVE = "openspec/changes/archive/2026-08-11-remediate-security-audit-sdk-adversarial-review";
// The attestation that validateArchiveMovement never read: it is keyed to the
// change named by remediationChange, and this is not that change.
const MOVEMENT_ARCHIVE = "openspec/changes/archive/2026-08-11-attest-archive-movement";
const PENDING_ARCHIVE = "openspec/changes/archive/2099-01-01-pending-change";
const LIFECYCLE = "packages/security-audit-sdk-core/verification-lifecycle.json";
// Syntactically valid, absent from the object database: what a squash merge
// leaves behind in place of the attested source revision.
const UNREACHABLE_REVISION = "0123456789abcdef0123456789abcdef01234567";
// Resolves in a local clone but is not an ancestor of HEAD; orphaned by the
// squash merge that landed the adversarial remediation.
const NON_ANCESTOR_COMMIT = "a7ac317725389d7df2b32d939bc0824feb49668e";

const declared = (lifecycleMetadata.movementAttestations ?? []).map((entry) => entry.archive);
for (const archive of [REMEDIATION_ARCHIVE, MOVEMENT_ARCHIVE]) {
  assert.ok(declared.includes(archive), `a movement attestation must declare ${archive}`);
}

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-archive-anchor-"));
const controlRoot = resolve(suiteRoot, "control");
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

prepareControl();

test("A-00 unmutated control anchors every declared attestation", () => {
  const root = caseRepository("control-pass");
  const result = succeeds(root);
  assert.match(result.stdout, /archive attestations passed: 2 declared/);
  assert.match(result.stdout, /2 anchored/);
  // Discovery is the point: both archives must be named, including the one no
  // gate previously read.
  for (const archive of [REMEDIATION_ARCHIVE, MOVEMENT_ARCHIVE]) {
    assert.match(result.stdout, new RegExp(archive.replaceAll(".", "\\.")));
  }
});

test("M-AA-A an archived file rewritten together with its recorded object is rejected", () => {
  const root = caseRepository("coordinated-rewrite");
  tamper(root, REMEDIATION_ARCHIVE, "proposal.md");
  reattest(root, REMEDIATION_ARCHIVE);
  unreachableSource(root, REMEDIATION_ARCHIVE);
  // The hole this gate closes: with the attested source revision unavailable,
  // the archive and the attestation agree with each other, so the movement gate
  // has nothing left to disagree with.
  assert.equal(changedPaths(root).status, 0, "the movement gate is expected to accept a coordinated rewrite");
  const result = fails(root, "archive-attestation-anchor-mismatch");
  assert.match(result.stderr, /\[archive-attestation-drift\]/);
  assert.match(result.stderr, /proposal\.md/);
});

test("M-AA-B the previously unenforced attestation is discovered and checked", () => {
  const root = caseRepository("previously-unenforced");
  tamper(root, MOVEMENT_ARCHIVE, "proposal.md");
  assert.equal(changedPaths(root).status, 0, "the movement gate is expected not to read this attestation");
  const result = fails(root, "archive-attestation-anchor-mismatch");
  assert.match(result.stderr, new RegExp(`${MOVEMENT_ARCHIVE}/proposal\\.md`));
});

test("M-AA-C a recorded object that drifts from history is rejected with the archive untouched", () => {
  const root = caseRepository("attestation-drift");
  mutateAttestation(root, REMEDIATION_ARCHIVE, (attestation) => {
    attestation.files["proposal.md"].oid = "1111111111111111111111111111111111111111";
  });
  const result = fails(root, "archive-attestation-drift");
  assert.match(result.stderr, /proposal\.md/);
});

test("M-AA-D two attestations recording one archive are rejected as ambiguous", () => {
  const root = caseRepository("attestation-ambiguous");
  mutateLifecycle(root, (metadata) => {
    metadata.movementAttestations.push({ ...metadata.movementAttestations[0] });
  });
  fails(root, "archive-attestation-ambiguous");
});

test("M-AA-E a malformed archive path is rejected", () => {
  for (const archive of ["../outside-the-archive-root", "/absolute", "openspec/changes/right-size", "openspec/changes/archive/x/"]) {
    const root = caseRepository(`archive-path-${Buffer.from(archive).toString("hex")}`);
    mutateLifecycle(root, (metadata) => {
      metadata.movementAttestations[0].archive = archive;
    });
    fails(root, "archive-attestation-path-invalid");
  }
});

test("M-AA-F a malformed inventory entry is rejected", () => {
  for (const [field, value] of [["mode", "64"], ["oid", "not-an-object-id"]]) {
    const root = caseRepository(`inventory-entry-${field}`);
    mutateAttestation(root, REMEDIATION_ARCHIVE, (attestation) => {
      attestation.files["proposal.md"][field] = value;
    });
    fails(root, "archive-attestation-entry-invalid");
  }
});

test("M-AA-G an empty inventory is rejected rather than vacuously anchored", () => {
  const root = caseRepository("inventory-empty");
  mutateAttestation(root, REMEDIATION_ARCHIVE, (attestation) => {
    attestation.files = {};
  });
  fails(root, "archive-attestation-inventory-empty");
});

test("M-AA-H an anchoring commit that did not introduce the archive is rejected", () => {
  const root = caseRepository("anchor-declaration-wrong");
  const head = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  mutateAttestation(root, REMEDIATION_ARCHIVE, (attestation) => {
    attestation.anchorCommit = head;
  });
  const result = fails(root, "archive-attestation-anchor-declaration");
  assert.match(result.stderr, new RegExp(head));
});

test("M-AA-I an anchoring commit that is not an ancestor of HEAD is rejected", () => {
  const root = caseRepository("anchor-non-ancestor");
  assert.equal(git(root, ["cat-file", "-t", NON_ANCESTOR_COMMIT]).stdout.trim(), "commit", "control requires the orphaned commit to resolve");
  mutateAttestation(root, REMEDIATION_ARCHIVE, (attestation) => {
    attestation.anchorCommit = NON_ANCESTOR_COMMIT;
  });
  fails(root, "archive-attestation-anchor-unreachable");
});

test("M-AA-J an archive absent from both history and the working tree is rejected", () => {
  const root = caseRepository("archive-absent");
  declarePending(root, { oid: blobOid(root, "irrelevant\n") });
  rmSync(resolve(root, PENDING_ARCHIVE), { recursive: true, force: true });
  fails(root, "archive-attestation-archive-absent");
});

test("M-AA-K an archive not yet in history is pending, and its inventory is still enforced", () => {
  const matching = caseRepository("pending-matching");
  declarePending(matching, {});
  const result = succeeds(matching);
  assert.match(result.stdout, /1 pending/);
  assert.match(result.stdout, new RegExp(`${PENDING_ARCHIVE}`));

  const mismatched = caseRepository("pending-mismatched");
  declarePending(mismatched, { oid: "2222222222222222222222222222222222222222" });
  fails(mismatched, "archive-attestation-pending-mismatch");
});

// Enforcement rests on the derived anchor, never on the declaration — a movement
// commit cannot name the commit that introduces its own archive, so an
// undeclared anchor is reported rather than rejected.
test("M-AA-M an undeclared anchoring commit is derived from history and reported", () => {
  const root = caseRepository("anchor-undeclared");
  mutateAttestation(root, REMEDIATION_ARCHIVE, (attestation) => {
    delete attestation.anchorCommit;
  });
  const result = succeeds(root);
  assert.match(result.stdout, /anchor derived but not declared/);
  assert.match(result.stdout, /2 anchored/);

  // Still anchored, so the coordinated rewrite is still caught without it.
  const tampered = caseRepository("anchor-undeclared-tampered");
  mutateAttestation(tampered, REMEDIATION_ARCHIVE, (attestation) => {
    delete attestation.anchorCommit;
  });
  tamper(tampered, REMEDIATION_ARCHIVE, "proposal.md");
  reattest(tampered, REMEDIATION_ARCHIVE);
  unreachableSource(tampered, REMEDIATION_ARCHIVE);
  fails(tampered, "archive-attestation-anchor-mismatch");
});

// Non-vacuity: the rejection in M-AA-A must come from the anchor, not from any
// incidental property of a tampered archive. Removing both halves of the anchor —
// the comparison against the introducing commit and the declaration that names it
// — leaves exactly the pre-fix behaviour: the attestation is compared only against
// the working tree it was rewritten to match, and the rewrite passes.
test("M-AA-L removing the anchor lets the coordinated rewrite pass", () => {
  const root = caseRepository("anchor-comparison-removed");
  tamper(root, REMEDIATION_ARCHIVE, "proposal.md");
  reattest(root, REMEDIATION_ARCHIVE);
  unreachableSource(root, REMEDIATION_ARCHIVE);
  fails(root, "archive-attestation-anchor-mismatch");
  mutateChecker(root, 'anchor.kind === "anchored"', "false");
  mutateChecker(root, "if (attestation.anchorCommit !== undefined) {", "if (false) {");
  succeeds(root);
});

function prepareControl() {
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, controlRoot]);
  overlayControl(controlRoot);
  git(controlRoot, ["add", "-A"]);
  // --allow-empty: on a clean tree the overlay is byte-identical to HEAD.
  git(controlRoot, ["commit", "--allow-empty", "-m", "test: archive attestation anchor control"]);
  const result = runChecker(controlRoot);
  assert.equal(result.status, 0, `control repository must satisfy the gate before any mutation:\n${result.stdout}\n${result.stderr}`);
}

function caseRepository(name) {
  const root = resolve(suiteRoot, name);
  git(suiteRoot, ["clone", "--quiet", "--no-hardlinks", controlRoot, root]);
  return root;
}

// Overlay exactly what the gate reads: its own scripts and the lifecycle
// manifest. Copying the whole package would also copy src/, which races with the
// verification-policy suite materializing a transient source file while
// node --test runs these files concurrently.
function overlayControl(root) {
  const destination = resolve(root, "packages/security-audit-sdk-core");
  cpSync(resolve(packageRoot, "scripts"), resolve(destination, "scripts"), { recursive: true, force: true });
  for (const file of ["verification-lifecycle.json", "package.json"]) {
    cpSync(resolve(packageRoot, file), resolve(destination, file), { force: true });
  }
}

function runChecker(root) {
  return spawnSync(process.execPath, ["scripts/check-archive-attestations.mjs"], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
  });
}

/** The movement gate, for the controls that document what it does not catch. */
function changedPaths(root) {
  return spawnSync(process.execPath, ["scripts/check-changed-paths.mjs", "--mode", "archived"], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "archived",
      SDK_VERIFICATION_CHANGE: lifecycleMetadata.remediationChange.name,
    },
  });
}

function succeeds(root) {
  const result = runChecker(root);
  assert.equal(result.status, 0, `check-archive-attestations.mjs unexpectedly failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function fails(root, expectedId) {
  const result = runChecker(root);
  assert.notEqual(result.status, 0, `check-archive-attestations.mjs unexpectedly passed mutation ${expectedId}:\n${result.stdout}`);
  assert.match(result.stderr, new RegExp(`\\[${expectedId}\\]`), `expected diagnostic ${expectedId}, got:\n${result.stderr}`);
  return result;
}

function tamper(root, archive, relativePath) {
  const path = resolve(root, archive, relativePath);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nsynthetic archive mutation\n`);
}

/** Rewrites the recorded objects to match the tampered working tree. */
function reattest(root, archive) {
  mutateAttestation(root, archive, (attestation) => {
    for (const relativePath of Object.keys(attestation.files)) {
      attestation.files[relativePath].oid = git(root, ["hash-object", "--no-filters", "--", `${archive}/${relativePath}`]).stdout.trim();
    }
  });
}

function unreachableSource(root, archive) {
  mutateAttestation(root, archive, (attestation) => {
    attestation.sourceRevision = UNREACHABLE_REVISION;
  });
}

function declarePending(root, { oid }) {
  const body = "# A movement whose commit has not been made yet\n";
  const path = resolve(root, PENDING_ARCHIVE, "proposal.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  mutateLifecycle(root, (metadata) => {
    metadata.movementAttestations.push({
      archive: PENDING_ARCHIVE,
      sourceRevision: git(root, ["rev-parse", "HEAD"]).stdout.trim(),
      attestedAt: "2099-01-01",
      policy: "Synthetic pending movement.",
      files: { "proposal.md": { mode: "100644", oid: oid ?? blobOid(root, body) } },
    });
  });
}

function blobOid(root, body) {
  const path = resolve(root, "pending-blob-source");
  writeFileSync(path, body);
  const oid = git(root, ["hash-object", "--no-filters", "--", "pending-blob-source"]).stdout.trim();
  rmSync(path);
  return oid;
}

function mutateAttestation(root, archive, apply) {
  mutateLifecycle(root, (metadata) => {
    const attestation = metadata.movementAttestations.find((entry) => entry.archive === archive);
    assert.ok(attestation, `control manifest must declare an attestation for ${archive}`);
    apply(attestation);
  });
}

function mutateLifecycle(root, apply) {
  const path = resolve(root, LIFECYCLE);
  const metadata = JSON.parse(readFileSync(path, "utf8"));
  assert.ok(Array.isArray(metadata.movementAttestations), "control manifest must declare movementAttestations");
  apply(metadata);
  writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

function mutateChecker(root, oldText, newText) {
  const path = resolve(root, "packages/security-audit-sdk-core/scripts/check-archive-attestations.mjs");
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText), "utf8");
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}
