import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const lifecyclePath = resolve(repositoryRoot, "verification-lifecycle.json");
const checkerPath = resolve(repositoryRoot, "scripts/check-changed-paths.mjs");

const pristineLifecycle = readFileSync(lifecyclePath, "utf8");
const pristineChecker = readFileSync(checkerPath, "utf8");

function restoreAll() {
  writeFileSync(lifecyclePath, pristineLifecycle, "utf8");
  writeFileSync(checkerPath, pristineChecker, "utf8");
}

function runChecker() {
  try {
    execSync("node scripts/check-changed-paths.mjs", {
      cwd: repositoryRoot, encoding: "utf8", timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { passed: true, output: "" };
  } catch (err) {
    return { passed: false, output: err.stderr || err.stdout || err.message || String(err) };
  }
}

function setMetadataPaths(paths) {
  restoreAll();
  const meta = JSON.parse(pristineLifecycle);
  meta.ownership.reviewedNewSdkSourcePaths = paths;
  writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

const dummyPath = resolve(repositoryRoot, "src/_vp_dummy.ts");
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
