import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-node-compat-mutations-"));
const caseRoot = resolve(suiteRoot, "control");
const casePackage = resolve(caseRoot, "packages/security-audit-sdk-core");

prepareCase();
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

function prepareCase() {
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, caseRoot]);
  cpSync(packageRoot, casePackage, {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  if (existsSync(resolve(repositoryRoot, ".github/workflows/ci.yml"))) {
    cpSync(resolve(repositoryRoot, ".github/workflows/ci.yml"), resolve(caseRoot, ".github/workflows/ci.yml"), { force: true });
  }
  git(caseRoot, ["add", "-A"]);
  git(caseRoot, ["add", "-f", "packages/security-audit-sdk-core/dist"]);
  git(caseRoot, ["commit", "--allow-empty", "-m", "test: isolated node-compat control"]);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(casePackage, "node_modules"), "dir");
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function runScript(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: casePackage,
    encoding: "utf8",
    timeout: 60000,
    env: {
      ...disposableGitEnvironment(),
    },
  });
}

function fails(scriptPath, args, expectedPattern) {
  const result = runScript(scriptPath, args);
  assert.notEqual(result.status, 0, `${scriptPath} unexpectedly passed mutation expecting ${expectedPattern}`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(expectedPattern, "i"));
}

function replaceInFile(relativePath, oldText, newText) {
  const target = resolve(caseRoot, relativePath);
  const content = readFileSync(target, "utf8");
  assert.ok(content.includes(oldText), `pattern ${oldText} missing from ${relativePath}`);
  writeFileSync(target, content.replace(oldText, newText), "utf8");
}

function replaceAllInFile(relativePath, oldText, newText) {
  const target = resolve(caseRoot, relativePath);
  const content = readFileSync(target, "utf8");
  const updated = content.replaceAll(oldText, newText);
  assert.notEqual(updated, content, `pattern ${oldText} missing from ${relativePath}`);
  writeFileSync(target, updated, "utf8");
}

describe("Node compatibility and CI version pinning mutations", () => {
  it("rejects dropping Node 24 from compatibility policy", () => {
    replaceInFile("packages/security-audit-sdk-core/compatibility.json", '"supportedMajors": [24, 26]', '"supportedMajors": [26]');
    try {
      fails("scripts/check-coherence.mjs", ["--mode", "archived"], "compat-node");
      fails("scripts/check-compatibility.mjs", [], "supported Node majors must be exactly 24 and 26");
    } finally {
      git(caseRoot, ["checkout", "--", "packages/security-audit-sdk-core/compatibility.json"]);
    }
  });

  it("rejects dropping Node 24 from package engines", () => {
    replaceInFile("packages/security-audit-sdk-core/package.json", '"node": ">=24 <25 || >=26 <27"', '"node": ">=26 <27"');
    try {
      fails("scripts/check-coherence.mjs", ["--mode", "archived"], "node-engines");
      fails("scripts/check-compatibility.mjs", [], "package engines must exclude unverified odd/future majors");
    } finally {
      git(caseRoot, ["checkout", "--", "packages/security-audit-sdk-core/package.json"]);
    }
  });

  it("rejects CI workflow omitting declared Node 24 leg", () => {
    replaceAllInFile(".github/workflows/ci.yml", 'node-version: "24.2.0"', 'node-version: "26.5.0"');
    try {
      fails("scripts/check-coherence.mjs", ["--mode", "archived"], "ci-node-24-executed");
    } finally {
      git(caseRoot, ["checkout", "--", ".github/workflows/ci.yml"]);
    }
  });

  it("rejects CI workflow using floating Node 26 tag", () => {
    replaceInFile(".github/workflows/ci.yml", 'node-version: "26.5.0"', 'node-version: "26"');
    try {
      fails("scripts/check-coherence.mjs", ["--mode", "archived"], "ci-node-no-floating-major");
    } finally {
      git(caseRoot, ["checkout", "--", ".github/workflows/ci.yml"]);
    }
  });

  it("rejects a floating Node 22 tag that the former literal rule allowed", () => {
    const sonarSetup = 'node-version: "24.2.0"\n\n      # Same defect class on the download side';
    replaceInFile(".github/workflows/ci.yml", sonarSetup, sonarSetup.replace('"24.2.0"', '"22"'));
    try {
      fails("scripts/check-coherence.mjs", ["--mode", "archived"], "ci-node-no-floating-major");
      replaceInFile(
        "packages/security-audit-sdk-core/scripts/check-coherence.mjs",
        '!/node-version:\\s*["\']\\d+["\']/.test(ciWorkflow)',
        '!/node-version:\\s*["\']26["\']/.test(ciWorkflow)',
      );
      const formerRule = runScript("scripts/check-coherence.mjs", ["--mode", "archived"]);
      assert.equal(formerRule.status, 0, `former literal rule unexpectedly rejected the floating Node 22 tag:\n${formerRule.stdout}\n${formerRule.stderr}`);
    } finally {
      git(caseRoot, ["checkout", "--", ".github/workflows/ci.yml", "packages/security-audit-sdk-core/scripts/check-coherence.mjs"]);
    }
  });
});
