import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { runDisposableGit } from "./disposable-git.mjs";

// Real history, not fixtures. Each of these is the exact defect class the gate
// exists for, and the remediation packet asserted the first two in prose while
// both were false.
const SQUASHED_COMMIT = "71dbd9535201501605e000afe14069a2a0be46ec"; // one parent; the packet called it a merge
const UNREACHABLE_COMMIT = "a7ac317725389d7df2b32d939bc0824feb49668e"; // resolves, orphaned by a squash merge
const MISSING_COMMIT = "0123456789abcdef0123456789abcdef01234567"; // syntactically valid, never existed
const GOVERNED_RECORD = "right-size-change-governance";
// Reviewed subtrees the signing commit does not touch, so their objects survive
// the merge. The package root is deliberately not one of them: it contains the
// record itself.
const REVIEWED_PATH = "packages/security-audit-sdk-core/scripts";
const SECOND_REVIEWED_PATH = "packages/security-audit-sdk-core/tests/verification";

// Totals are derived from the manifest the control overlays, not written as
// literals. Signing a governance record is routine work; a hardcoded total makes
// every new record fail tests that are about the binding checks and have nothing
// to say about how many records exist.
const CONTROL_RECORDS = JSON.parse(
  readFileSync(resolve(packageRoot, "verification-lifecycle.json"), "utf8"),
).governanceRecords;
const RECORD_COUNT = CONTROL_RECORDS.length;
// sign() replaces the governed record's binding with exactly two entries and one
// candidate root, so every other record contributes whatever it already declares.
const SIGNED_ENTRIES = 2;
const OTHER_RECORDS = CONTROL_RECORDS.filter((record) => record.change !== GOVERNED_RECORD);
const BOUND_CONTENT_OBJECTS = SIGNED_ENTRIES
  + OTHER_RECORDS.reduce((total, record) => total + (record.reviewedContent?.entries?.length ?? 0), 0);
const OTHER_CANDIDATE_ROOTS = OTHER_RECORDS
  .filter((record) => typeof record.reviewedContent?.candidateRoot === "string").length;

// The independent expected inventory. Deliberately NOT derived from the manifest:
// the aggregate counts above recompute from whatever the manifest currently
// holds, so removing a record or narrowing a binding can normalize the expected
// result. This inventory is what the mutation suite independently requires to
// exist, and it only changes through an explicit, reviewed edit to this file.
const EXPECTED_RECORD_IDS = Object.freeze([
  "bundle-validator-runtime-helpers",
  "implement-security-audit-sdk-core",
  "right-size-change-governance",
  "establish-design-pattern-governance",
  "ratify-contract-version-support-policy",
  "fix-generated-required-context-reason",
]);
const MINIMUM_REVIEWED_PATHS = Object.freeze({
  "bundle-validator-runtime-helpers": Object.freeze([
    "packages/security-audit-sdk-core/scripts",
    "packages/security-audit-sdk-core/vendor",
    "packages/security-audit-sdk-core/src/generated",
    "packages/security-audit-sdk-core/tests/verification",
    "openspec/changes/bundle-validator-runtime-helpers",
  ]),
  "right-size-change-governance": Object.freeze([
    "packages/security-audit-sdk-core/scripts",
    "packages/security-audit-sdk-core/tests/verification",
  ]),
  "establish-design-pattern-governance": Object.freeze([
    "openspec/changes/establish-design-pattern-governance",
    "openspec/governance",
    "openspec/scripts",
    "openspec/tests/design-pattern-governance",
  ]),
  "ratify-contract-version-support-policy": Object.freeze([
    "openspec/changes/ratify-contract-version-support-policy",
    "openspec/specs/security-audit-sdk-core",
    "packages/security-audit-sdk-core/adr",
    "packages/security-audit-sdk-core/tests/verification",
  ]),
  // The pre-archive change path, because that is what resolves under the
  // candidate root the record names. The archive relocation was byte-identical,
  // so the object here is the object the archive carries.
  "fix-generated-required-context-reason": Object.freeze([
    "openspec/changes/fix-generated-required-context-reason",
    "packages/security-audit-sdk-core/scripts",
    "packages/security-audit-sdk-core/src/generated",
    "packages/security-audit-sdk-core/tests/types",
  ]),
});

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-governance-history-"));
const controlRoot = resolve(suiteRoot, "control");
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

prepareControl();

test("G-00 unmutated control passes and reports what it verified", () => {
  assertInventory(controlRoot);
  const root = caseRepository("control-pass");
  const result = succeeds(root);
  assert.match(result.stdout, new RegExp(`governance history passed: ${RECORD_COUNT} record\\(s\\)`));
  assert.match(result.stdout, /bound commit\(s\) are ancestors of HEAD/);
  assert.match(result.stdout, /declared merge commit\(s\) have their expected parent count/);
});

test("G-01 removing a whole governance record keeps the gate green but violates the independent inventory", () => {
  const root = caseRepository("record-removed-bypass");
  mutateLifecycle(root, (lifecycle) => {
    lifecycle.governanceRecords = lifecycle.governanceRecords
      .filter((record) => record.change !== "establish-design-pattern-governance");
  });
  // The bypass this control documents: the gate's expectations derive from the
  // manifest it overlays, so deleting the record normalizes the expected result
  // instead of failing it.
  succeeds(root);
  // The independent inventory is what actually rejects the removal.
  assert.throws(() => assertInventory(root), /establish-design-pattern-governance/,
    "removing the establish-design-pattern-governance record must violate the independent inventory");
});

test("G-02 narrowing a reviewed-content binding keeps the gate green but violates the independent inventory", () => {
  const root = caseRepository("binding-narrowed-bypass");
  mutateLifecycle(root, (lifecycle) => {
    const record = lifecycle.governanceRecords
      .find((entry) => entry.change === "establish-design-pattern-governance");
    assert.ok(record?.reviewedContent?.entries?.length > 0, "control record must carry reviewed content");
    record.reviewedContent.entries.pop();
  });
  // Same bypass shape: every remaining declared entry is valid, so the gate
  // stays green while the binding it is supposed to protect has shrunk.
  succeeds(root);
  assert.throws(() => assertInventory(root), /openspec\/tests\/design-pattern-governance/,
    "dropping a minimum reviewed path must violate the independent inventory");
});

test("M-GH-A a squash declared as a two-parent merge is rejected with the actual count", () => {
  const root = caseRepository("squash-declared-as-merge");
  declareMerge(root, SQUASHED_COMMIT, 2);
  const result = fails(root, "governance-merge-parent-count");
  assert.match(result.stderr, new RegExp(`${SQUASHED_COMMIT}: expected 2 parents, found 1`));
});

test("M-GH-B a bound commit that is not an ancestor of HEAD is rejected", () => {
  const root = caseRepository("bound-non-ancestor");
  mutate(root, (record) => record.boundCommits.push(UNREACHABLE_COMMIT));
  const result = fails(root, "governance-commit-not-ancestor");
  assert.match(result.stderr, new RegExp(`${UNREACHABLE_COMMIT} is not an ancestor of HEAD`));
});

test("M-GH-C an unresolvable governed commit is rejected", () => {
  const root = caseRepository("unresolvable-governed");
  mutate(root, (record) => record.governedCommits.push(MISSING_COMMIT));
  const result = fails(root, "governance-commit-unresolvable");
  assert.match(result.stderr, new RegExp(`${MISSING_COMMIT} does not resolve`));
});

test("M-GH-D a removed manifest is rejected rather than vacuously passing", () => {
  const root = caseRepository("manifest-removed");
  mutateLifecycle(root, (lifecycle) => {
    delete lifecycle.governanceRecords;
  });
  fails(root, "governance-manifest-missing");
});

// The binding is removed explicitly rather than assumed absent. This control used
// to rely on the governed record being unsigned, so it silently stopped testing
// anything the moment that record was signed with a real binding.
test("M-GH-E a signed record with no content-object binding is rejected", () => {
  const root = caseRepository("signed-without-content-object");
  mutate(root, (record) => {
    record.signed = true;
    record.reviewer = { name: "Synthetic Verification Reviewer", signedAt: "2099-01-02" };
    delete record.reviewedContent;
    delete record.legacyCommitBinding;
  });
  fails(root, "governance-content-binding-missing");
});

test("M-GH-F a signed record naming a blob as its reviewed content object is rejected", () => {
  const root = caseRepository("content-object-not-tree");
  const blob = git(root, ["rev-parse", "HEAD:README.md"]).stdout.trim();
  assert.match(blob, /^[0-9a-f]{40}$/, "control requires a resolvable blob object");
  sign(root, { object: blob });
  const result = fails(root, "governance-content-object-not-tree");
  assert.match(result.stderr, /expected object type tree, found blob/);
});

test("M-GH-G an unresolvable reviewed content object is rejected", () => {
  const root = caseRepository("content-object-unresolvable");
  sign(root, { object: MISSING_COMMIT });
  fails(root, "governance-content-object-unresolvable");
});

// The binding defect. Every mutation below was accepted while the gate checked
// only that the declared object resolved to *a* tree, so a record could name one
// reviewed path and supply the content of another.
test("M-GH-L a reviewed object belonging to a different path is rejected", () => {
  const root = caseRepository("content-object-mismatch");
  const unrelated = treeOf(root, ".github");
  sign(root, { object: unrelated });
  const result = fails(root, "governance-content-object-mismatch");
  assert.match(result.stderr, new RegExp(`${REVIEWED_PATH}`));
  assert.match(result.stderr, new RegExp(`expected ${treeOf(root, REVIEWED_PATH)}, found ${unrelated}`));
});

test("M-GH-M an exact candidate root, path, and subtree relationship passes", () => {
  const root = caseRepository("content-binding-exact");
  sign(root, {});
  const result = succeeds(root);
  assert.match(result.stdout, new RegExp(`${BOUND_CONTENT_OBJECTS} reviewed content object\\(s\\) bound to their declared path`));
  assert.match(result.stdout, new RegExp(`${OTHER_CANDIDATE_ROOTS + 1} candidate root tree\\(s\\) resolve`));
});

test("M-GH-N a malformed reviewed path is rejected", () => {
  for (const path of ["../etc", "/etc/passwd", "packages\\security-audit-sdk-core", "packages/", "packages/*", ""]) {
    const root = caseRepository(`content-path-invalid-${Buffer.from(path).toString("hex")}`);
    sign(root, { path });
    fails(root, "governance-content-path-invalid");
  }
});

test("M-GH-O a reviewed path that does not resolve under the candidate root is rejected", () => {
  const root = caseRepository("content-path-unresolved");
  sign(root, { path: "packages/security-audit-sdk-core/absent-subtree" });
  const result = fails(root, "governance-content-path-unresolved");
  assert.match(result.stderr, /absent-subtree/);
});

test("M-GH-P a candidate root that is not a tree is rejected", () => {
  const root = caseRepository("content-root-not-tree");
  const blob = git(root, ["rev-parse", "HEAD:README.md"]).stdout.trim();
  sign(root, { candidateRoot: blob });
  const result = fails(root, "governance-content-root-not-tree");
  assert.match(result.stderr, /expected object type tree, found blob/);
});

// Signing a record stored inside the reviewed path changes the reviewed content,
// so the binding could never survive the merge that carries it.
test("M-GH-Q a reviewed path containing the governance record is rejected", () => {
  const root = caseRepository("content-self-referential");
  sign(root, { path: "packages/security-audit-sdk-core" });
  const result = fails(root, "governance-content-self-referential");
  assert.match(result.stderr, /verification-lifecycle\.json/);
});

// The durable half of the binding, which is what survives a squash merge: the
// object must be carried at that path by history, with no candidate root to
// resolve against.
test("M-GH-S a reviewed object no reachable commit carries at that path is rejected", () => {
  const root = caseRepository("content-object-unreachable");
  sign(root, { object: treeOf(root, ".github"), candidateRoot: null });
  const result = fails(root, "governance-content-object-unreachable");
  assert.match(result.stderr, new RegExp(REVIEWED_PATH));
});

// The post-squash state, from the other side: the candidate root tree is gone,
// and the path-to-object bindings must still be enforced rather than skipped.
test("M-GH-U an absent candidate root is reported while the path bindings remain enforced", () => {
  const absent = caseRepository("candidate-root-absent");
  sign(absent, { candidateRoot: MISSING_COMMIT });
  const result = succeeds(absent);
  assert.match(result.stdout, new RegExp(`candidate root ${MISSING_COMMIT} for ${GOVERNED_RECORD} is absent`));
  assert.match(result.stdout, new RegExp(`${BOUND_CONTENT_OBJECTS} reviewed content object\\(s\\) bound to their declared path`));
  assert.match(result.stdout, new RegExp(`${OTHER_CANDIDATE_ROOTS} candidate root tree\\(s\\) resolve`));

  const substituted = caseRepository("candidate-root-absent-substituted");
  sign(substituted, { candidateRoot: MISSING_COMMIT, object: treeOf(substituted, ".github") });
  fails(substituted, "governance-content-object-unreachable");
});

test("M-GH-T removing the path/object comparison lets the substituted tree pass", () => {
  const root = caseRepository("content-comparison-removed");
  sign(root, { object: treeOf(root, ".github") });
  fails(root, "governance-content-object-mismatch");
  // Both halves must go: the candidate-root comparison and the history binding.
  mutateChecker(root, "resolved !== entry.object", "false");
  mutateChecker(root, "!carriedAtPath(entry.path, entry.object)", "false");
  succeeds(root);
});

test("M-GH-H a record withholding nothing is rejected", () => {
  const root = caseRepository("authorizations-empty");
  mutate(root, (record) => {
    record.authorizations.withheld = [];
  });
  fails(root, "governance-authorization-missing");
});

// The controls above only prove the gate is red on bad input. These prove the
// redness comes from the specific check named, by deleting that check and
// showing the same input then passes.
test("M-GH-I removing the ancestor check lets the non-ancestor binding pass", () => {
  const root = caseRepository("ancestor-check-removed");
  mutate(root, (record) => record.boundCommits.push(UNREACHABLE_COMMIT));
  fails(root, "governance-commit-not-ancestor");
  mutateChecker(root, "requireAncestor && !isAncestorOfHead(commit)", "false");
  succeeds(root);
});

test("M-GH-J removing the parent-count comparison lets the squash pass as a merge", () => {
  const root = caseRepository("parent-count-check-removed");
  declareMerge(root, SQUASHED_COMMIT, 2);
  fails(root, "governance-merge-parent-count");
  mutateChecker(root, "actualParents !== entry.expectedParents", "false");
  succeeds(root);
});

test("M-GH-K removing the resolution check lets the unresolvable commit pass", () => {
  const root = caseRepository("resolution-check-removed");
  mutate(root, (record) => record.governedCommits.push(MISSING_COMMIT));
  fails(root, "governance-commit-unresolvable");
  mutateChecker(root, "!commitResolves(commit)", "false");
  succeeds(root);
});

/**
 * The independent expected inventory. Asserts what must exist regardless of
 * what the gate's own dynamic totals are willing to normalize away: the exact
 * current record set, exactly one record per expected change, every minimum
 * reviewed path per record, and no duplicate reviewed path within a record.
 */
function assertInventory(root) {
  const manifestPath = resolve(root, "packages/security-audit-sdk-core/verification-lifecycle.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.ok(Array.isArray(manifest.governanceRecords), "the control manifest must declare governanceRecords");
  const records = manifest.governanceRecords;

  const actualIds = records.map((record) => record.change).sort();
  assert.deepEqual(actualIds, [...EXPECTED_RECORD_IDS].sort(),
    "the exact expected record set must be present");

  const byChange = new Map();
  for (const record of records) {
    const current = byChange.get(record.change) ?? [];
    byChange.set(record.change, [...current, record]);
  }
  for (const [change, entries] of byChange) {
    assert.equal(entries.length, 1, `exactly one governance record must exist for ${change}`);
  }

  for (const record of records) {
    const paths = record.reviewedContent?.entries?.map((entry) => entry.path) ?? [];
    const unique = new Set(paths);
    assert.equal(unique.size, paths.length,
      `the ${record.change} record must not bind the same reviewed path twice`);
    const minimum = MINIMUM_REVIEWED_PATHS[record.change] ?? [];
    for (const path of minimum) {
      assert.ok(unique.has(path),
        `the ${record.change} record must continue to bind the reviewed path ${path}`);
    }
  }
}

function prepareControl() {
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, controlRoot]);
  overlayControl(controlRoot);
  git(controlRoot, ["add", "-A"]);
  // --allow-empty: on a clean tree the overlay is byte-identical to HEAD.
  git(controlRoot, ["commit", "--allow-empty", "-m", "test: governance history control"]);
  const result = runChecker(controlRoot);
  assert.equal(result.status, 0, `control repository must satisfy the gate before any mutation:\n${result.stdout}\n${result.stderr}`);
}

function caseRepository(name) {
  const root = resolve(suiteRoot, name);
  git(suiteRoot, ["clone", "--quiet", "--no-hardlinks", controlRoot, root]);
  return root;
}

// The gate has no runtime dependencies, so a case repository needs no
// node_modules symlink; it runs straight from the cloned sources.
function runChecker(root) {
  return spawnSync(process.execPath, ["scripts/check-governance-history.mjs"], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
  });
}

function succeeds(root) {
  const result = runChecker(root);
  assert.equal(result.status, 0, `check-governance-history.mjs unexpectedly failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function fails(root, expectedId) {
  const result = runChecker(root);
  assert.notEqual(result.status, 0, `check-governance-history.mjs unexpectedly passed mutation ${expectedId}:\n${result.stdout}`);
  assert.match(result.stderr, new RegExp(`\\[${expectedId}\\]`), `expected diagnostic ${expectedId}, got:\n${result.stderr}`);
  return result;
}

function declareMerge(root, commit, expectedParents) {
  mutate(root, (record) => {
    assert.equal(record.mergeCommits.length, 0, "control record must declare no merge commit before this mutation");
    record.mergeCommits.push({ commit, expectedParents });
  });
}

/**
 * Signs the governed record with a content binding. By default the binding is
 * exact: the candidate root is HEAD's tree and each entry carries the object
 * that path actually resolves to. Overrides substitute one part at a time so a
 * control isolates a single defect; `candidateRoot: null` omits it, which is the
 * state a squash merge leaves behind.
 */
function sign(root, overrides = {}) {
  const path = overrides.path ?? REVIEWED_PATH;
  const object = overrides.object ?? resolvableTreeOf(root, path);
  const candidateRoot = "candidateRoot" in overrides
    ? overrides.candidateRoot
    : git(root, ["rev-parse", "HEAD^{tree}"]).stdout.trim();
  mutate(root, (record) => {
    record.signed = true;
    record.reviewer = { name: "Synthetic Verification Reviewer", signedAt: "2099-01-02" };
    record.reviewedContent = {
      kind: "tree",
      ...(candidateRoot === null ? {} : { candidateRoot }),
      entries: [
        { path, object },
        { path: SECOND_REVIEWED_PATH, object: treeOf(root, SECOND_REVIEWED_PATH) },
      ],
    };
  });
}

function treeOf(root, path) {
  const result = git(root, ["rev-parse", `HEAD:${path}`]);
  return result.stdout.trim();
}

/** Keeps a malformed or absent path from also failing as an unresolvable object. */
function resolvableTreeOf(root, path) {
  const result = runDisposableGit(root, ["rev-parse", "--verify", "--quiet", `HEAD:${path}`]);
  if (result.status === 0 && /^[0-9a-f]{40}$/.test(result.stdout.trim())) return result.stdout.trim();
  return treeOf(root, REVIEWED_PATH);
}

function mutate(root, apply) {
  mutateLifecycle(root, (lifecycle) => {
    const record = lifecycle.governanceRecords.find((entry) => entry.change === GOVERNED_RECORD);
    assert.ok(record, `control manifest must contain the ${GOVERNED_RECORD} record`);
    apply(record);
  });
}

function mutateLifecycle(root, apply) {
  const path = resolve(root, "packages/security-audit-sdk-core/verification-lifecycle.json");
  const lifecycle = JSON.parse(readFileSync(path, "utf8"));
  assert.ok(Array.isArray(lifecycle.governanceRecords), "control manifest must declare governanceRecords");
  apply(lifecycle);
  writeFileSync(path, `${JSON.stringify(lifecycle, null, 2)}\n`, "utf8");
}

function mutateChecker(root, oldText, newText) {
  const path = resolve(root, "packages/security-audit-sdk-core/scripts/check-governance-history.mjs");
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText), "utf8");
}

// Overlay exactly what the gate under test reads: its own scripts and the
// lifecycle manifest that carries the governance records. Copying the whole
// package would also copy src/, which races with the verification-policy suite
// materializing a transient src/_vp_dummy.ts while node --test runs these files
// concurrently.
function overlayControl(root) {
  const destination = resolve(root, "packages/security-audit-sdk-core");
  cpSync(resolve(packageRoot, "scripts"), resolve(destination, "scripts"), { recursive: true, force: true });
  for (const file of ["verification-lifecycle.json", "package.json"]) {
    cpSync(resolve(packageRoot, file), resolve(destination, file), { force: true });
  }
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}
