import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import {
  DISPOSABLE_GIT_IDENTITY,
  disposableGitEnvironment,
  runDisposableGit,
} from "./disposable-git.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-verification-mutations-"));
const controlRoot = resolve(suiteRoot, "control");
const activeChange = "openspec/changes/remediate-security-audit-sdk-adversarial-review";
const originalArchive = "openspec/changes/archive/2026-07-31-implement-security-audit-sdk-core";
const canonicalCapability = "openspec/specs/security-audit-sdk-core/spec.md";
const governedLocalConfigBefore = governedLocalConfig();

prepareControl();
test.after(() => {
  assert.equal(governedLocalConfig(), governedLocalConfigBefore, "governed repository local Git configuration changed");
  rmSync(suiteRoot, { recursive: true, force: true });
});

test("unmodified active control passes", () => {
  const root = caseRepository("control-pass");
  succeeds(root, "scripts/check-changed-paths.mjs", ["--mode", "active"]);
  succeeds(root, "scripts/check-coherence.mjs", ["--mode", "active"]);
});

test("missing canonical SDK capability is rejected", () => {
  const root = caseRepository("missing-capability");
  rmSync(resolve(root, canonicalCapability));
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "canonical-sdk-capability");
});

test("active mode rejects an absent active remediation", () => {
  const root = caseRepository("active-absent");
  renameSync(resolve(root, activeChange), resolve(root, `${activeChange}-misplaced`));
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "ACTIVE_CHANGE_MISSING");
});

test("archived remediation mode rejects an active change", () => {
  const root = caseRepository("archived-still-active");
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "ARCHIVED_CHANGE_ACTIVE");
});

test("incomplete archived original task state is rejected", () => {
  const root = caseRepository("archive-task-incomplete");
  replace(root, `${originalArchive}/tasks.md`, "- [x] 1.1", "- [ ] 1.1");
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "original-archive-tasks-complete");
});

test("removed normative technical commit binding is rejected", () => {
  const root = caseRepository("technical-binding-removed");
  replace(root, `${originalArchive}/technical-review-packet.md`, "21c5c98503205257be87cb977b131b4a81ac430a", "REMOVED_TECHNICAL_BINDING", true);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "original-technical-binding");
});

test("introduced production authorization is rejected", () => {
  const root = caseRepository("production-authorized");
  replace(root, `${originalArchive}/technical-review-packet.md`, "Production deployment approved | `NO — NOT AUTHORIZED`", "Production deployment approved | `YES — AUTHORIZED`");
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "original-production-unauthorized");
});

test("SDK drift outside an expected review target is rejected", () => {
  const root = caseRepository("review-target-drift");
  const target = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  append(root, "packages/security-audit-sdk-core/src/internal.ts", "\n// isolated mutation\n");
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "active"], "expected reviewed target", {
    SDK_VERIFICATION_REVIEW_TARGET: target,
  });
});

test("canonical event-contract drift is rejected", () => {
  const root = caseRepository("contract-drift");
  append(root, "contracts/security-audit/source/contract.source.json", " \n");
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "active"], "canonical event contract");
});

test("unauthorized transport source is rejected", () => {
  const root = caseRepository("transport-source");
  write(root, "packages/security-audit-sdk-core/src/transport.ts", "export {};\n");
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "active"], "forbidden production integration");
});

test("missing generated public named API is rejected", () => {
  const root = caseRepository("named-api-missing");
  const path = "packages/security-audit-sdk-core/dist/generated/contract.generated.js";
  const absolute = resolve(root, path);
  const text = readFileSync(absolute, "utf8");
  const mutated = text.replace(/(export const EVENT_METHODS = \[\n)\s*\{[\s\S]*?\n\s*\},/, "$1");
  assert.notEqual(mutated, text, "named API mutation must alter generated runtime metadata");
  writeFileSync(absolute, mutated);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "named-api-count");
});

test("untracked non-ignored SDK source remains visible and is rejected", () => {
  const root = caseRepository("untracked-sdk-source");
  write(root, "packages/security-audit-sdk-core/src/verification-probe.ts", "export {};\n");
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "active"], "untracked SDK source");
});

test("incorrect original SDK archive path is rejected", () => {
  const root = caseRepository("incorrect-archive-path");
  renameSync(resolve(root, originalArchive), resolve(root, `${originalArchive}-incorrect`));
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived", "--change", "implement-security-audit-sdk-core"], "ORIGINAL_ARCHIVE_MISSING");
});

test("incompatible package metadata is rejected", () => {
  const root = caseRepository("package-metadata");
  replace(root, "packages/security-audit-sdk-core/package.json", '"version": "0.1.0"', '"version": "9.0.0"');
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "package-version");
});

test("unrelated repository history outside owned roots is accepted", () => {
  const root = caseRepository("unrelated-history");
  write(root, "research/unrelated-history.txt", "unrelated merged evidence\n");
  git(root, ["add", "research/unrelated-history.txt"]);
  git(root, ["commit", "-m", "test: unrelated history"]);
  const result = succeeds(root, "scripts/check-changed-paths.mjs", ["--mode", "active"]);
  assert.match(result.stdout, /changed-path policy passed/);
});

test("disposable commits use bounded identity and ignore ambient signing and hooks", () => {
  const root = caseRepository("bounded-commit-helper");
  git(root, ["config", "commit.gpgsign", "true"]);
  const hook = resolve(root, ".git/hooks/commit-msg");
  writeFileSync(hook, "#!/bin/sh\nexit 97\n", { mode: 0o755 });
  write(root, "research/bounded-identity.txt", "synthetic verification identity\n");
  git(root, ["add", "research/bounded-identity.txt"]);
  git(root, ["commit", "-m", "test: bounded disposable identity"]);
  const identity = git(root, ["log", "-1", "--format=%an%x00%ae%x00%cn%x00%ce"]).stdout.trim().split("\0");
  assert.deepEqual(identity, [
    DISPOSABLE_GIT_IDENTITY.name,
    DISPOSABLE_GIT_IDENTITY.email,
    DISPOSABLE_GIT_IDENTITY.name,
    DISPOSABLE_GIT_IDENTITY.email,
  ]);
  assert.equal(git(root, ["config", "--local", "--get", "commit.gpgsign"]).stdout.trim(), "true");
  assert.equal(disposableGitEnvironment().GIT_CONFIG_GLOBAL, "/dev/null");
  assert.equal(disposableGitEnvironment().GIT_CONFIG_SYSTEM, "/dev/null");
});

test("an ignored local CLAUDE.md is excluded by standard Git semantics", () => {
  const root = caseRepository("ignored-instruction");
  append(root, ".git/info/exclude", "\nCLAUDE.md\n");
  write(root, "CLAUDE.md", "local ignored instructions\n");
  const result = succeeds(root, "scripts/check-changed-paths.mjs", ["--mode", "active"]);
  assert.doesNotMatch(result.stdout, /local-instruction-unrelated/);
});

function prepareControl() {
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, controlRoot]);
  cpSync(packageRoot, resolve(controlRoot, "packages/security-audit-sdk-core"), {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  cpSync(resolve(repositoryRoot, activeChange), resolve(controlRoot, activeChange), { recursive: true, force: true });
  git(controlRoot, ["add", "-A"]);
  git(controlRoot, ["add", "-f", "packages/security-audit-sdk-core/dist"]);
  git(controlRoot, ["commit", "-m", "test: isolated verification control"]);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(controlRoot, "packages/security-audit-sdk-core/node_modules"), "dir");
  succeeds(controlRoot, "scripts/check-changed-paths.mjs", ["--mode", "active"]);
  succeeds(controlRoot, "scripts/check-coherence.mjs", ["--mode", "active"]);
}

function caseRepository(name) {
  const root = resolve(suiteRoot, name);
  git(suiteRoot, ["clone", "--quiet", "--no-hardlinks", controlRoot, root]);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(root, "packages/security-audit-sdk-core/node_modules"), "dir");
  return root;
}

function script(root, scriptPath, args, extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
    env: {
      ...process.env,
      SDK_VERIFICATION_MODE: "auto",
      SDK_VERIFICATION_CHANGE: "remediate-security-audit-sdk-adversarial-review",
      ...extraEnv,
    },
  });
}

function succeeds(root, scriptPath, args, extraEnv = {}) {
  const result = script(root, scriptPath, args, extraEnv);
  assert.equal(result.status, 0, `${scriptPath} unexpectedly failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function fails(root, scriptPath, args, expected, extraEnv = {}) {
  const result = script(root, scriptPath, args, extraEnv);
  assert.notEqual(result.status, 0, `${scriptPath} unexpectedly passed mutation ${expected}`);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(escapeRegex(expected), "i"));
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function command(cwd, executable, args) {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${executable} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function replace(root, path, oldText, newText, replaceAll = false) {
  const absolute = resolve(root, path);
  const text = readFileSync(absolute, "utf8");
  assert.ok(text.includes(oldText), `mutation input absent from ${path}`);
  writeFileSync(absolute, replaceAll ? text.split(oldText).join(newText) : text.replace(oldText, newText));
}

function append(root, path, content) {
  const absolute = resolve(root, path);
  writeFileSync(absolute, readFileSync(absolute, "utf8") + content);
}

function write(root, path, content) {
  const absolute = resolve(root, path);
  mkdirSync(resolve(absolute, ".."), { recursive: true });
  writeFileSync(absolute, content);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function governedLocalConfig() {
  const result = spawnSync("git", ["config", "--local", "--null", "--list"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `unable to read governed repository local Git configuration: ${result.stderr}`);
  return result.stdout;
}
