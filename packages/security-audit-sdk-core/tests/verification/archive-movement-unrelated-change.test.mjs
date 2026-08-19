import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { lifecycleMetadata } from "../../scripts/lifecycle-policy.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

// These controls commit files inside disposable clones, so they must never touch
// the live tree: sibling verification files snapshot the live package with cpSync
// and node --test runs test files in parallel processes.
const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-archive-movement-unrelated-"));
const controlRoot = resolve(suiteRoot, "control");
const remediation = lifecycleMetadata.remediationChange;
const fixtureArchiveRoot = "openspec/changes/archive";
const archiveDestination = `${fixtureArchiveRoot}/2099-01-02-${remediation.name}`;
const syntheticChange = "openspec/changes/synthetic-unrelated-active-change";
const diagnostic = "archive-movement-unrelated-change-deletion";

prepareControl();
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

test("archive movement rejects deletion from an unrelated active change", () => {
  const root = archiveInProgressRepository("unrelated-deletion");
  rmSync(resolve(root, syntheticChange, "proposal.md"));
  const run = runChecker(root);
  assert.notEqual(run.status, 0, "the checker accepted a deletion from an unrelated active change");
  assert.match(run.text, new RegExp(diagnostic));
});

test("the same fixture left intact raises no unrelated-change deletion", () => {
  const root = archiveInProgressRepository("unrelated-intact");
  assert.doesNotMatch(runChecker(root).text, new RegExp(diagnostic),
    "the diagnostic is not attributable to the deletion");
});

function archiveInProgressRepository(name) {
  const root = caseRepository(name);
  seedSyntheticUnrelatedChange(root);
  // Working tree only: the active directory must stay in HEAD, or the checker
  // leaves the re-derived path and the unrelated-change scan never runs.
  cpSync(resolve(root, remediation.active), resolve(root, archiveDestination), { recursive: true, force: true });
  rmSync(resolve(root, remediation.active), { recursive: true, force: true });
  return root;
}

function seedSyntheticUnrelatedChange(root) {
  write(root, `${syntheticChange}/proposal.md`, "## Why\n\nSynthetic fixture: an unrelated active change no real archive can remove.\n");
  git(root, ["add", syntheticChange]);
  git(root, ["commit", "-m", "test: synthetic unrelated active change"]);
  // Load-bearing: only a tracked file can produce the "D" record the rule matches.
  git(root, ["ls-files", "--error-unmatch", `${syntheticChange}/proposal.md`]);
}

function runChecker(root) {
  const result = spawnSync(process.execPath, ["scripts/check-changed-paths.mjs", "--mode", "archived"], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "auto",
      SDK_VERIFICATION_CHANGE: remediation.name,
    },
  });
  return { status: result.status, text: `${result.stdout}\n${result.stderr}` };
}

function prepareControl() {
  // Full history: the checker requires the proposal baseline to be an ancestor of HEAD.
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, controlRoot]);
  cpSync(packageRoot, resolve(controlRoot, "packages/security-audit-sdk-core"), {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  // The live repository holds the remediation change archived; the unrelated-change
  // scan only runs on the re-derived path, which needs the active directory in HEAD.
  restoreActiveRemediation(controlRoot);
  git(controlRoot, ["add", "-A"]);
  git(controlRoot, ["commit", "--allow-empty", "-m", "test: isolated archive movement control"]);
}

function restoreActiveRemediation(root) {
  const entries = readdirSync(resolve(root, fixtureArchiveRoot), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${fixtureArchiveRoot}/${entry.name}`)
    .filter((path) => new RegExp(remediation.archivePattern).test(path));
  assert.equal(entries.length, 1, "expected exactly one dated remediation archive to seed the control");
  cpSync(resolve(root, entries[0]), resolve(root, remediation.active), { recursive: true, force: true });
  rmSync(resolve(root, entries[0]), { recursive: true, force: true });
}

function caseRepository(name) {
  const root = resolve(suiteRoot, name);
  git(suiteRoot, ["clone", "--quiet", "--no-hardlinks", controlRoot, root]);
  return root;
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function write(root, path, content) {
  const absolute = resolve(root, path);
  mkdirSync(resolve(absolute, ".."), { recursive: true });
  writeFileSync(absolute, content);
}
