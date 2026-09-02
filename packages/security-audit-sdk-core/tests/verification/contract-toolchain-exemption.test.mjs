import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

// Drives its negative cases by writing intentionally-invalid lifecycle metadata, so
// it must never touch the live tree: sibling verification files snapshot the live
// package with cpSync and node --test runs test files in parallel processes.
const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-toolchain-exemption-"));
const caseRoot = resolve(suiteRoot, "control");
const casePackage = resolve(caseRoot, "packages/security-audit-sdk-core");
const lifecyclePath = resolve(casePackage, "verification-lifecycle.json");
const exemptPath = "contracts/security-audit/package-lock.json";
const unexemptPath = "contracts/security-audit/README.md";

prepareCase();
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const pristineLifecycle = readFileSync(lifecyclePath, "utf8");

function prepareCase() {
  // Full history: the checker requires the proposal baseline to be an ancestor of HEAD.
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, caseRoot]);
  cpSync(packageRoot, casePackage, {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  git(caseRoot, ["add", "-A"]);
  git(caseRoot, ["commit", "--allow-empty", "-m", "test: isolated toolchain-exemption control"]);
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function runChecker() {
  const result = spawnSync(process.execPath, ["scripts/check-changed-paths.mjs"], {
    cwd: casePackage, encoding: "utf8", timeout: 60000,
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "auto",
      SDK_VERIFICATION_CHANGE: "remediate-security-audit-sdk-adversarial-review",
    },
  });
  if (result.status === 0) return { passed: true, output: result.stdout };
  return { passed: false, output: `${result.stdout}\n${result.stderr}` };
}

function setExemptions(entries) {
  const meta = JSON.parse(pristineLifecycle);
  meta.contract.toolchainExemptions = entries;
  writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

function touch(relativePath) {
  const target = resolve(caseRoot, relativePath);
  writeFileSync(target, `${readFileSync(target, "utf8")}\n`, "utf8");
}

function restoreTree() {
  git(caseRoot, ["checkout", "--", "contracts/security-audit"]);
}

describe("contract build-toolchain exemptions", () => {
  beforeEach(() => {
    writeFileSync(lifecyclePath, pristineLifecycle, "utf8");
    restoreTree();
  });

  it("lets an exempted toolchain file change, and still classifies it", () => {
    setExemptions([exemptPath]);
    touch(exemptPath);
    const result = runChecker();
    assert.equal(result.passed, true, `expected the exempted path to pass:\n${result.output}`);
    assert.match(result.output, /"event-contract":\s*1/,
      "the exempted path must stay classified rather than disappear from the record set");
  });

  it("still fails on a contract path that is not exempted", () => {
    setExemptions([exemptPath]);
    touch(unexemptPath);
    const result = runChecker();
    assert.equal(result.passed, false, "an unexempted contract path must still fail");
    assert.match(result.output, new RegExp(`${unexemptPath}.*contract governance drift`));
  });

  it("rejects an exemption naming declared contract content", () => {
    setExemptions(["contracts/security-audit/source/contract.source.json"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /declared contract content and may never be exempt/);
  });

  it("rejects an exemption beneath a declared contract directory", () => {
    setExemptions(["contracts/security-audit/policies/anything.json"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /declared contract content and may never be exempt/);
  });

  for (const [label, entry] of [
    ["a directory", "contracts/security-audit/"],
    ["a glob", "contracts/security-audit/*.json"],
    ["path traversal", "contracts/security-audit/../../etc/passwd"],
    ["an absolute path", "/etc/passwd"],
  ]) {
    it(`rejects ${label}`, () => {
      setExemptions([entry]);
      const result = runChecker();
      assert.equal(result.passed, false, `expected ${label} to be rejected`);
      assert.match(result.output, /toolchainExemptions entry/);
    });
  }

  it("rejects an exemption outside every protected prefix", () => {
    setExemptions(["packages/security-audit-sdk-core/src/sdk.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /outside every protected contract prefix/);
  });
});
