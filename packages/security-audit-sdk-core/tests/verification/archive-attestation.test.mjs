// Differential controls for the attested archive-movement baseline.
//
// These live apart from mutations.test.mjs deliberately. Its fixture restores
// the active change so its controls exercise re-derivation; these need the
// active change absent, which is the repository's own post-archive state, so
// they need none of that restoration machinery.
import assert from "node:assert/strict";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { lifecycleMetadata } from "../../scripts/lifecycle-policy.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-archive-attestation-"));
const remediation = lifecycleMetadata.remediationChange;
const attestations = lifecycleMetadata.movementAttestations ?? [];
const archiveRelativePath = attestations[0]?.archive;
const lifecyclePath = "packages/security-audit-sdk-core/verification-lifecycle.json";
// Syntactically valid and deliberately absent from the object database, which is
// what a squash merge leaves behind: an attested revision that no longer resolves.
const UNREACHABLE_REVISION = "0123456789abcdef0123456789abcdef01234567";

assert.ok(archiveRelativePath, "a movement attestation must exist for the archived remediation");

test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

test("attested baseline is used when the source revision is unreachable", () => {
  const root = attestedCase("attested-pass");
  const result = succeeds(root);
  assert.match(result.stdout, /archive movement baseline: attested/);
});

test("attested baseline rejects archive mutation", () => {
  const cases = [
    ["tampered file", (root) => appendTo(root, "proposal.md"), "archive-movement-byte-substitution"],
    ["tampered task ledger", (root) => appendTo(root, "tasks.md"), "archive-movement-byte-substitution"],
    ["mode change", (root) => chmodSync(archived(root, "proposal.md"), 0o755), "archive-movement-mode-mismatch"],
    ["added path", (root) => writeFileSync(archived(root, "unexpected.md"), "unexpected\n"), "archive-movement-unmatched-addition"],
    ["removed path", (root) => rmSync(archived(root, "proposal.md")), "archive-movement-unmatched-deletion"],
  ];
  for (const [name, mutate, expected] of cases) {
    const root = attestedCase(`attested-${expected}-${name.replaceAll(" ", "-")}`);
    mutate(root);
    fails(root, expected);
  }
});

test("archive movement fails when no attestation records the archive", () => {
  const root = attestedCase("attestation-missing", { attestations: [] });
  fails(root, "archive-movement-attestation-missing");
});

test("archive movement fails when two attestations record the same archive", () => {
  const root = attestedCase("attestation-ambiguous", { duplicate: true });
  fails(root, "archive-movement-attestation-ambiguous");
});

// A committed movement must not block later archives. The unrelated-change check
// is bounded to the working tree against HEAD; once the source is historical it
// would otherwise treat every subsequently created archive as an unrelated
// addition, making the remediation's own archive permanently block all others.
test("a committed movement does not reject archives created afterwards", () => {
  for (const options of [{}, { reachableSource: true }]) {
    const root = attestedCase(`later-archive-${options.reachableSource ? "rederived" : "attested"}`, options);
    const later = resolve(root, "openspec/changes/archive/2099-03-04-some-later-change");
    mkdirSync(later, { recursive: true });
    writeFileSync(resolve(later, "proposal.md"), "# A later, unrelated archive\n");
    succeeds(root);
  }
});

// The decisive control for the fallback rule. The archive is tampered AND the
// attestation is rewritten to match it, so an implementation that fell back on a
// content mismatch would pass. A reachable source revision must still be used,
// and must still reject.
test("a reachable source revision is used even when the attestation matches a tampered archive", () => {
  const root = attestedCase("no-fallback", { reachableSource: true });
  appendTo(root, "proposal.md");
  reattestFromWorkingTree(root);
  const result = fails(root, "archive-movement-byte-substitution");
  assert.match(result.stdout, /archive movement baseline: re-derived from attested revision/);
});

/**
 * Clones the repository, which already carries the archive and no active change,
 * then rewrites the attestation for the case under test. `reachableSource` binds
 * it to a commit that still carries the active change, selecting re-derivation.
 */
function attestedCase(name, options = {}) {
  const root = resolve(suiteRoot, name);
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, root]);
  cpSync(packageRoot, resolve(root, "packages/security-audit-sdk-core"), {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(root, "packages/security-audit-sdk-core/node_modules"), "dir");
  git(root, ["add", "-A"]);
  git(root, ["add", "-f", "packages/security-audit-sdk-core/dist"]);
  git(root, ["commit", "-m", "test: archive attestation control"]);

  assert.equal(
    git(root, ["ls-tree", "-r", "HEAD", "--", remediation.active]).stdout.trim(),
    "",
    "attested controls require the active change to be absent from HEAD",
  );

  if (options.attestations) {
    writeAttestations(root, options.attestations);
    return root;
  }
  const attestation = {
    archive: archiveRelativePath,
    sourceRevision: options.reachableSource ? reachableSourceRevision(root) : UNREACHABLE_REVISION,
    attestedAt: "2099-01-02",
    files: inventoryFromHead(root),
  };
  writeAttestations(root, options.duplicate ? [attestation, { ...attestation }] : [attestation]);
  return root;
}

/** A commit that still carries the active change, so re-derivation applies. */
function reachableSourceRevision(root) {
  const revision = attestations[0].sourceRevision;
  const carried = runDisposableGit(root, ["ls-tree", "-r", revision, "--", remediation.active]);
  assert.equal(carried.status, 0, "attested source revision must resolve in the clone");
  assert.notEqual(carried.stdout.trim(), "", "attested source revision must still carry the active change");
  return revision;
}

function inventoryFromHead(root) {
  const listed = git(root, ["ls-tree", "-r", "HEAD", "--", archiveRelativePath]).stdout.trim();
  const files = {};
  for (const line of listed.split("\n").filter(Boolean)) {
    const [meta, path] = line.split("\t");
    const [mode, , oid] = meta.split(" ");
    files[path.slice(archiveRelativePath.length + 1)] = { mode, oid };
  }
  assert.ok(Object.keys(files).length > 0, "attested inventory must not be empty");
  return files;
}

function writeAttestations(root, entries) {
  const path = resolve(root, lifecyclePath);
  const metadata = JSON.parse(readFileSync(path, "utf8"));
  metadata.movementAttestations = entries;
  writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`);
}

/** Rewrites the attestation to match the current working-tree archive. */
function reattestFromWorkingTree(root) {
  const path = resolve(root, lifecyclePath);
  const metadata = JSON.parse(readFileSync(path, "utf8"));
  const attestation = metadata.movementAttestations[0];
  for (const relativePath of Object.keys(attestation.files)) {
    const oid = git(root, ["hash-object", "--no-filters", "--", `${archiveRelativePath}/${relativePath}`]).stdout.trim();
    attestation.files[relativePath] = { ...attestation.files[relativePath], oid };
  }
  writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`);
}

function archived(root, relativePath) {
  return resolve(root, archiveRelativePath, relativePath);
}

function appendTo(root, relativePath) {
  const path = archived(root, relativePath);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nsynthetic archive mutation\n`);
}

function script(root) {
  return spawnSync(process.execPath, ["scripts/check-changed-paths.mjs", "--mode", "archived"], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "archived",
      SDK_VERIFICATION_CHANGE: remediation.name,
    },
  });
}

function succeeds(root) {
  const result = script(root);
  assert.equal(result.status, 0, `check-changed-paths unexpectedly failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function fails(root, expected) {
  const result = script(root);
  assert.notEqual(result.status, 0, `check-changed-paths unexpectedly passed ${expected}`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(expected.replaceAll("-", "\\-"), "i"));
  return result;
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}
