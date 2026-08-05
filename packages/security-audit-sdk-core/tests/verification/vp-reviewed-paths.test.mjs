import test, { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

// This suite drives its negative cases by writing intentionally-invalid policy
// metadata and mutated checker source. It must never do that in the live tree:
// the other verification files snapshot the live package with cpSync, and
// node --test runs test files in parallel processes.
const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-vp-reviewed-paths-"));
const caseRoot = resolve(suiteRoot, "control");
const casePackage = resolve(caseRoot, "packages/security-audit-sdk-core");
const lifecyclePath = resolve(casePackage, "verification-lifecycle.json");
const checkerPath = resolve(casePackage, "scripts/check-changed-paths.mjs");
const dummyPath = resolve(casePackage, "src/_vp_dummy.ts");

prepareCase();
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const pristineLifecycle = readFileSync(lifecyclePath, "utf8");
const pristineChecker = readFileSync(checkerPath, "utf8");

function prepareCase() {
  // Full history: the checker requires the proposal baseline to be an ancestor of HEAD.
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, caseRoot]);
  cpSync(packageRoot, casePackage, {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  removeDummy();
  git(caseRoot, ["add", "-A"]);
  // --allow-empty: on a clean tree the overlay is byte-identical to HEAD.
  git(caseRoot, ["commit", "--allow-empty", "-m", "test: isolated reviewed-paths control"]);
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function restoreAll() {
  writeFileSync(lifecyclePath, pristineLifecycle, "utf8");
  writeFileSync(checkerPath, pristineChecker, "utf8");
}

function runChecker() {
  const result = spawnSync(process.execPath, ["scripts/check-changed-paths.mjs"], {
    cwd: casePackage, encoding: "utf8", timeout: 30000,
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "auto",
      SDK_VERIFICATION_CHANGE: "remediate-security-audit-sdk-adversarial-review",
    },
  });
  if (result.status === 0) return { passed: true, output: "" };
  return { passed: false, output: `${result.stdout}\n${result.stderr}` };
}

function setMetadataPaths(paths) {
  restoreAll();
  const meta = JSON.parse(pristineLifecycle);
  meta.ownership.reviewedNewSdkSourcePaths = paths;
  writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

function ensureDummy() {
  if (!existsSync(dummyPath)) writeFileSync(dummyPath, "// VP dummy\n", "utf8");
}
function removeDummy() {
  try { unlinkSync(dummyPath); } catch {}
}

// ============================================================
// Focused policy tests
// ============================================================
describe("VP — reviewed new SDK source paths", () => {
  beforeEach(() => { restoreAll(); ensureDummy(); });
  after(() => { restoreAll(); removeDummy(); });

  it("VP-01 declared untracked SDK source passes (no untracked files)", () => {
    removeDummy();
    const result = runChecker();
    assert.equal(result.passed, true, `expected pass: ${result.output}`);
  });

  it("VP-02 undeclared untracked SDK source fails", () => {
    setMetadataPaths([]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /untracked SDK source is not an expected reviewed target/);
  });

  it("VP-03 sibling filename fails when not declared", () => {
    setMetadataPaths(["packages/security-audit-sdk-core/src/other.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /_vp_dummy\.ts/);
  });

  it("VP-04 directory declaration fails", () => {
    setMetadataPaths(["packages/security-audit-sdk-core/src/"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /must be a file path/);
  });

  it("VP-05 glob declaration fails", () => {
    setMetadataPaths(["packages/security-audit-sdk-core/src/*.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /glob/);
  });

  it("VP-06 absolute path fails", () => {
    setMetadataPaths(["/packages/security-audit-sdk-core/src/bounded-fifo.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /absolute/);
  });

  it("VP-07 path traversal fails", () => {
    setMetadataPaths(["packages/../security-audit-sdk-core/src/bounded-fifo.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /path traversal/);
  });

  it("VP-08 backslash variant fails", () => {
    setMetadataPaths(["packages\\security-audit-sdk-core\\src\\bounded-fifo.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /forward slashes/);
  });

  it("VP-09 duplicate declarations fail", () => {
    setMetadataPaths([
      "packages/security-audit-sdk-core/src/bounded-fifo.ts",
      "packages/security-audit-sdk-core/src/bounded-fifo.ts",
    ]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /duplicate/);
  });

  it("VP-10 outside SDK source prefixes fails", () => {
    setMetadataPaths(["packages/security-audit-sdk-core/tests/some.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /outside configured SDK source prefixes/);
  });

  it("VP-11 non-array fails closed", () => {
    restoreAll();
    const meta = JSON.parse(pristineLifecycle);
    meta.ownership.reviewedNewSdkSourcePaths = "not-an-array";
    writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /must be an array/);
  });

  it("VP-12 empty string fails", () => {
    setMetadataPaths([""]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /non-empty string/);
  });

  it("VP-13 non-string fails", () => {
    restoreAll();
    const meta = JSON.parse(pristineLifecycle);
    meta.ownership.reviewedNewSdkSourcePaths = [42];
    writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /non-empty string/);
  });

  it("VP-14 tracked modified sources retain old behavior", () => {
    removeDummy();
    const result = runChecker();
    assert.equal(result.passed, true, `expected pass: ${result.output}`);
  });

  it("VP-15 absent key works", () => {
    restoreAll();
    const meta = JSON.parse(pristineLifecycle);
    delete meta.ownership.reviewedNewSdkSourcePaths;
    writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /untracked SDK source is not an expected reviewed target/);
  });

  it("VP-16 empty array fails", () => {
    setMetadataPaths([]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /untracked SDK source is not an expected reviewed target/);
  });

  it("VP-17 embedded NUL byte fails as a null byte", () => {
    // \u0000 is the NUL character, which JSON round-trips, so the checker sees
    // a real NUL. Before the fix this path passed every guard and was accepted.
    setMetadataPaths(["packages/security-audit-sdk-core/src/a\u0000b.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /contains null byte/);
  });

  it("VP-18 literal backslash-zero fails on the forward-slash rule", () => {
    setMetadataPaths([String.raw`packages/security-audit-sdk-core/src/a\0b.ts`]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /must use forward slashes/);
  });
});

// ============================================================
// Differential mutation tests
// ============================================================
describe("M-VP — reviewed-paths policy mutations", () => {
  beforeEach(() => { restoreAll(); ensureDummy(); });
  after(() => { restoreAll(); removeDummy(); });

  it("M-VP-01 remove exact declaration → untracked source fails", () => {
    setMetadataPaths([]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /untracked SDK source is not an expected reviewed target/);
  });

  it("M-VP-02 directory prefix → metadata validation fails", () => {
    setMetadataPaths(["packages/security-audit-sdk-core/src/"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /must be a file path/);
  });

  it("M-VP-03 prefix-match authorization → unauthorized suffix still rejected", {
    timeout: 30000,
  }, () => {
    restoreAll();
    let mutated = pristineChecker.replace(
      "if (reviewedNewPaths.has(path)) {",
      "if ([...reviewedNewPaths].some((p) => path.startsWith(p))) {"
    );
    writeFileSync(checkerPath, mutated, "utf8");
    // Set exact path in metadata — prefix match should NOT authorize unrelated dummy
    const meta = JSON.parse(pristineLifecycle);
    meta.ownership.reviewedNewSdkSourcePaths = ["packages/security-audit-sdk-core/src/bounded-fifo.ts"];
    writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    const result = runChecker();
    // dummy path does NOT start with "bounded-fifo.ts", so should still be rejected
    assert.equal(result.passed, false, "prefix match should not authorize unrelated path");
    assert.match(result.output, /_vp_dummy\.ts/);
  });

  it("M-VP-04 remove untracked check → undeclared source passes (mutation detected)", () => {
    restoreAll();
    let mutated = pristineChecker.replace(
      /violations\.push\(\`\? \$\{path\} \(untracked SDK source is not an expected reviewed target\)\`\);/,
      "// mutated: check removed"
    );
    writeFileSync(checkerPath, mutated, "utf8");
    const meta = JSON.parse(pristineLifecycle);
    meta.ownership.reviewedNewSdkSourcePaths = [];
    writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    const result = runChecker();
    assert.equal(result.passed, true, "mutation should cause pass — detected");
  });

  it("M-VP-05 task state alone → undeclared source remains rejected", () => {
    setMetadataPaths([]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /untracked SDK source is not an expected reviewed target/);
  });

  it("M-VP-06 Git-state enforcement preserved", () => {
    removeDummy();
    const result = runChecker();
    assert.equal(result.passed, true, `expected pass: ${result.output}`);
  });
});
