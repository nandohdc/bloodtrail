import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

// These controls commit files and mutate checker source, so they must never touch
// the live tree: sibling verification files snapshot the live package with cpSync
// and node --test runs test files in parallel processes.
const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-local-instruction-"));
const controlRoot = resolve(suiteRoot, "control");
const checkerPath = "packages/security-audit-sdk-core/scripts/check-changed-paths.mjs";
const localInstructionBucket = "local-instruction-unrelated";
// Deliberately not the repository root CLAUDE.md. The control repository is a
// clone of the live repository, where that path may already be tracked, and a
// control that overwrote it would be measuring a modification rather than the
// file it introduced.
const localInstructionPath = "research/verification-local-instruction/CLAUDE.md";
const classificationRule = `${String.raw`  if (path === "CLAUDE.md" || /(?:^|\/)CLAUDE\.md$/.test(path)) return "local-instruction-unrelated";`}\n`;

prepareControl();
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

test("an ignored local CLAUDE.md is excluded by standard Git semantics", () => {
  const root = caseRepository("ignored-instruction");
  append(root, ".git/info/exclude", "\nCLAUDE.md\n");
  assertLocalInstructionDelta(root, 0, () => write(root, localInstructionPath, "local ignored instructions\n"));
});

test("a tracked local CLAUDE.md is reported as unrelated and does not fail verification", () => {
  const root = caseRepository("tracked-instruction");
  assertLocalInstructionDelta(root, 1, () => trackLocalInstruction(root));
});

// The two controls above are only as strong as their ability to fail. Without the
// mutations below, a delta that is always zero and a classification that no longer
// exists are indistinguishable from a control that holds.
test("a local CLAUDE.md Git no longer ignores fails the exclusion control", () => {
  const root = caseRepository("ignore-regression-instruction");
  append(root, ".git/info/exclude", "\nCLAUDE.md\n");
  assert.throws(
    () => assertLocalInstructionDelta(root, 0, () => trackLocalInstruction(root)),
    /changed local-instruction-unrelated records by 1, expected 0/,
  );
});

test("removing the local-instruction classification fails the tracked control", () => {
  const root = caseRepository("instruction-classification-removed");
  const absolute = resolve(root, checkerPath);
  const source = readFileSync(absolute, "utf8");
  assert.ok(source.includes(classificationRule), "classification rule absent from the checker under mutation");
  writeFileSync(absolute, source.replace(classificationRule, ""));
  assert.throws(
    () => assertLocalInstructionDelta(root, 1, () => trackLocalInstruction(root)),
    /changed local-instruction-unrelated records by 0, expected 1/,
  );
});

// The checker reports aggregate classification counts rather than paths, so a
// control states its claim as the contribution of the file under test: the count
// before that file exists, against the count after. An absolute assertion is not
// available here — the control repository is a clone of the live repository, so
// any tracked local instruction file raises the count before a control acts.
function classificationCount(stdout, bucket) {
  const summary = /^changed-path policy passed in \S+ mode for \S+: \d+ visible records; (\{.*\}); ignored files excluded by standard Git semantics$/m.exec(stdout);
  assert.ok(summary, `changed-path summary line is unparseable:\n${stdout}`);
  return JSON.parse(summary[1])[bucket] ?? 0;
}

function assertLocalInstructionDelta(root, expected, introduce) {
  assert.equal(existsSync(resolve(root, localInstructionPath)), false, `${localInstructionPath} must be absent before the control introduces it`);
  const before = classificationCount(runChecker(root), localInstructionBucket);
  introduce();
  const after = classificationCount(runChecker(root), localInstructionBucket);
  assert.equal(after - before, expected, `${localInstructionPath} changed ${localInstructionBucket} records by ${after - before}, expected ${expected}`);
}

function trackLocalInstruction(root) {
  write(root, localInstructionPath, "tracked local instructions\n");
  // -f because .gitignore excludes CLAUDE.md at any depth. A tracked file stays
  // tracked regardless of ignore rules, which is the state under test.
  git(root, ["add", "-f", localInstructionPath]);
  git(root, ["commit", "-m", "test: tracked local instruction file"]);
}

function runChecker(root) {
  const result = spawnSync(process.execPath, ["scripts/check-changed-paths.mjs"], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "auto",
      SDK_VERIFICATION_CHANGE: "remediate-security-audit-sdk-adversarial-review",
    },
  });
  assert.equal(result.status, 0, `check-changed-paths unexpectedly failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function prepareControl() {
  // Full history: the checker requires the proposal baseline to be an ancestor of HEAD.
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, controlRoot]);
  cpSync(packageRoot, resolve(controlRoot, "packages/security-audit-sdk-core"), {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  git(controlRoot, ["add", "-A"]);
  // --allow-empty: on a clean tree the overlay is byte-identical to HEAD.
  git(controlRoot, ["commit", "--allow-empty", "-m", "test: isolated local-instruction control"]);
  runChecker(controlRoot);
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

function append(root, path, content) {
  const absolute = resolve(root, path);
  writeFileSync(absolute, readFileSync(absolute, "utf8") + content);
}
