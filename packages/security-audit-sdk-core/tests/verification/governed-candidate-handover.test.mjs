import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-governed-candidate-"));
const caseRoot = resolve(suiteRoot, "control");
const casePackage = resolve(caseRoot, "packages/security-audit-sdk-core");
const protectedCapability = "openspec/specs/security-audit-event-contract/spec.md";

prepareCase();
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function prepareCase() {
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, caseRoot]);
  cpSync(packageRoot, casePackage, {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output"]
      .includes(basename(source)),
  });
  git(caseRoot, ["add", "-A"]);
  git(caseRoot, ["commit", "--allow-empty", "-m", "test: isolated governed-candidate handover control"]);
}

test("SDK_CORE_PROTECTED_PATH_CONTROLS rejects a protected capability change outside the exact handover", () => {
  const target = resolve(caseRoot, protectedCapability);
  writeFileSync(target, `${readFileSync(target, "utf8")}\n`, "utf8");
  const result = spawnSync(process.execPath, ["scripts/check-changed-paths.mjs"], {
    cwd: casePackage,
    encoding: "utf8",
    timeout: 60000,
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "auto",
      SDK_VERIFICATION_CHANGE: "remediate-security-audit-sdk-adversarial-review",
    },
  });
  assert.notEqual(result.status, 0, "a protected capability write outside the exact handover must fail");
  assert.match(`${result.stdout}\n${result.stderr}`,
    new RegExp(`${protectedCapability}.*contract governance drift`));
});
