import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { lifecycleMetadata } from "../../scripts/lifecycle-policy.mjs";
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
const remediation = lifecycleMetadata.remediationChange;
const taskGroups = remediation.taskGroups;
const fixtureTechnicalCommit = "1111111111111111111111111111111111111111";
const fixtureEvidenceCommit = "2222222222222222222222222222222222222222";
const fixtureOwnerBinding = [
  "Project-owner decision: APPROVED_FOR_MERGE",
  "Owner-reviewed technical commit: `" + fixtureTechnicalCommit + "`",
  "Owner-reviewed technical-review evidence commit: `" + fixtureEvidenceCommit + "`",
].join("\n");
const governedLocalConfigBefore = governedLocalConfig();

prepareControl();
test.after(() => {
  assert.equal(governedLocalConfig(), governedLocalConfigBefore, "governed repository local Git configuration changed");
  rmSync(suiteRoot, { recursive: true, force: true });
});

test("unmodified active control passes", () => {
  const root = caseRepository("control-pass");
  setCheckedTasks(root, groupTaskIds(taskGroups[0]));
  succeeds(root, "scripts/check-changed-paths.mjs", ["--mode", "active"]);
  const result = succeeds(root, "scripts/check-coherence.mjs", ["--mode", "active"]);
  assert.match(result.stdout, /8\/91 tasks complete, completed groups: F-04, next group: F-01/);
});

test("active mode accepts partial F-01 after complete F-04", () => {
  const root = caseRepository("f01-partial");
  setCheckedTasks(root, [...groupTaskIds(taskGroups[0]), ...groupTaskIds(taskGroups[1]).slice(0, 3)]);
  const result = succeeds(root, "scripts/check-coherence.mjs", ["--mode", "active"]);
  assert.match(result.stdout, /11\/91 tasks complete, completed groups: F-04, next group: F-01/);
});

test("active mode accepts complete F-04 and F-01 at 16/91", () => {
  const root = caseRepository("f01-complete");
  setCheckedTasks(root, [...groupTaskIds(taskGroups[0]), ...groupTaskIds(taskGroups[1])]);
  const result = succeeds(root, "scripts/check-coherence.mjs", ["--mode", "active"]);
  assert.match(result.stdout, /16\/91 tasks complete, completed groups: F-04, F-01, next group: F-02/);
});

test("active mode rejects F-01 before F-04 completes", () => {
  const root = caseRepository("f01-before-f04");
  setCheckedTasks(root, [groupTaskIds(taskGroups[1])[0]]);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-task-order");
});

test("active mode rejects F-02 before F-01 starts or completes", () => {
  const root = caseRepository("f02-before-f01");
  setCheckedTasks(root, [...groupTaskIds(taskGroups[0]), groupTaskIds(taskGroups[2])[0]]);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-task-order");
});

test("active mode rejects F-02 while F-01 is partial", () => {
  const root = caseRepository("f02-during-f01");
  setCheckedTasks(root, [...groupTaskIds(taskGroups[0]), groupTaskIds(taskGroups[1])[0], groupTaskIds(taskGroups[2])[0]]);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-task-order");
});

test("every later implementation group rejects progress past a partial predecessor", () => {
  const implementationGroups = taskGroups.filter((group) => group.phase === "implementation");
  for (let index = 2; index < implementationGroups.length; index += 1) {
    const root = caseRepository(`order-${implementationGroups[index].id.replaceAll("/", "-")}`);
    const completedPrefix = implementationGroups.slice(0, index - 1).flatMap(groupTaskIds);
    setCheckedTasks(root, [
      ...completedPrefix,
      groupTaskIds(implementationGroups[index - 1])[0],
      groupTaskIds(implementationGroups[index])[0],
    ]);
    fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-task-order");
  }
});

test("active mode rejects a checked unknown task with a consistent total", () => {
  const root = caseRepository("unknown-checked-task");
  setCheckedTasks(root, groupTaskIds(taskGroups[0]));
  replace(root, `${activeChange}/tasks.md`, "- [ ] 2.1 ", "- [x] 99.1 ");
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-task-unmapped");
});

test("active mode rejects premature technical review", () => {
  const root = caseRepository("premature-technical-review");
  setCheckedTasks(root, [...groupTaskIds(taskGroups[0]), groupTaskIds(taskGroups.find((group) => group.phase === "technical-review"))[0]]);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-technical-review-premature");
});

test("active mode rejects owner decision without exact-commit review evidence", () => {
  const root = caseRepository("premature-owner-decision");
  const ownerIndex = taskGroups.findIndex((group) => group.phase === "owner-governance");
  setCheckedTasks(root, [
    ...taskGroups.slice(0, ownerIndex).flatMap(groupTaskIds),
    groupTaskIds(taskGroups[ownerIndex])[0],
  ]);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-owner-evidence");
});

test("active mode rejects premature merge and archive tasks", () => {
  for (const [name, id] of [["merge", "12.8"], ["archive", "12.10"]]) {
    const root = caseRepository(`premature-${name}`);
    setCheckedTasks(root, [...groupTaskIds(taskGroups[0]), id]);
    fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-merge-archive-pending");
  }
});

test("active mode rejects an incorrect task total", () => {
  const root = caseRepository("incorrect-task-total");
  const taskPath = resolve(root, activeChange, "tasks.md");
  const text = readFileSync(taskPath, "utf8");
  writeFileSync(taskPath, text.replace(/^- \[[ x]\] 2\.1 .+\n/m, ""));
  fails(root, "scripts/check-coherence.mjs", ["--mode", "active"], "active-task-total");
});

test("governed mode rejects an explicit valid pre-owner fixture", () => {
  const root = caseRepository("governed-explicit-pre-owner");
  const checkedIds = governedTaskIdsThrough("technical-review");
  assert.equal(checkedIds.length, 85, "pre-owner fixture must complete exactly through technical review");
  setCheckedTasks(root, checkedIds);
  setGovernanceFixture(root, { ownerApproved: false });
  const result = fails(root, "scripts/check-coherence.mjs", ["--mode", "governed"], "governed-owner-decision");
  assert.doesNotMatch(
    `${result.stdout}\n${result.stderr}`,
    /\[(?:governed-technical-binding|governed-production-restriction|governed-group-[^\]]+|governed-task-[^\]]+)\]/,
    "valid pre-owner fixture failed a technical, restriction, merge, or archive guard",
  );
});

test("governed mode accepts an explicit valid post-owner fixture", () => {
  const root = caseRepository("governed-explicit-post-owner");
  const checkedIds = governedTaskIdsThrough("owner-governance");
  assert.equal(checkedIds.length, 88, "post-owner fixture must complete exactly through owner governance");
  setCheckedTasks(root, checkedIds);
  setGovernanceFixture(root, { ownerApproved: true });
  const result = succeeds(root, "scripts/check-coherence.mjs", ["--mode", "governed"]);
  assert.match(result.stdout, /88\/91 current-change tasks complete/);
});

test("governed mode rejects a post-owner fixture with the exact owner binding removed", () => {
  const root = caseRepository("governed-owner-binding-removed");
  setCheckedTasks(root, governedTaskIdsThrough("owner-governance"));
  setGovernanceFixture(root, { ownerApproved: true });
  replace(
    root,
    `${activeChange}/technical-review-packet.md`,
    fixtureOwnerBinding,
    "Project-owner decision: PENDING\nOwner/evidence binding: REMOVED",
  );
  const result = fails(root, "scripts/check-coherence.mjs", ["--mode", "governed"], "governed-owner-decision");
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /\[governed-technical-binding\]/);
});

test("governed mode rejects production authorization introduced into the valid post-owner fixture", () => {
  const root = caseRepository("governed-production-authorization");
  setCheckedTasks(root, governedTaskIdsThrough("owner-governance"));
  setGovernanceFixture(root, { ownerApproved: true });
  replace(
    root,
    `${activeChange}/technical-review-packet.md`,
    "Production deployment approved | `NO — NOT AUTHORIZED`",
    "Production deployment approved | `YES — AUTHORIZED`",
  );
  fails(root, "scripts/check-coherence.mjs", ["--mode", "governed"], "governed-production-restriction");
});

test("governed mode rejects publication authorization introduced into the valid post-owner fixture", () => {
  const root = caseRepository("governed-publication-authorization");
  setCheckedTasks(root, governedTaskIdsThrough("owner-governance"));
  setGovernanceFixture(root, { ownerApproved: true });
  replace(
    root,
    `${activeChange}/technical-review-packet.md`,
    "Package publication/release approved | `NO — NOT AUTHORIZED`",
    "Package publication/release approved | `YES — AUTHORIZED`",
  );
  fails(root, "scripts/check-coherence.mjs", ["--mode", "governed"], "governed-production-restriction");
});

test("governed mode rejects a premature merge claim in the valid post-owner fixture", () => {
  const root = caseRepository("governed-premature-merge");
  setCheckedTasks(root, [...governedTaskIdsThrough("owner-governance"), "12.8"]);
  setGovernanceFixture(root, { ownerApproved: true });
  fails(root, "scripts/check-coherence.mjs", ["--mode", "governed"], "governed-task-12.8-pending");
});

test("governed mode rejects a premature archive claim in the valid post-owner fixture", () => {
  const root = caseRepository("governed-premature-archive");
  setCheckedTasks(root, [...governedTaskIdsThrough("owner-governance"), "12.9"]);
  setGovernanceFixture(root, { ownerApproved: true });
  fails(root, "scripts/check-coherence.mjs", ["--mode", "governed"], "governed-task-12.9-pending");
});

test("explicit archived original SDK mode remains valid", () => {
  const root = caseRepository("original-archived-control");
  succeeds(root, "scripts/check-coherence.mjs", ["--mode", "archived", "--change", "implement-security-audit-sdk-core"]);
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

test("scope matcher rejects forbidden tokens at every filesystem and punctuation boundary", () => {
  const paths = [
    "src/transport.ts",
    "src/browser.ts",
    "src/telemetry.ts",
    "src/collector.ts",
    "src/exporter.ts",
    "src/siem.ts",
    "src/analytics.ts",
    "src/internal/transport.ts",
    "src/transport/client.ts",
    "src/internal/browser/client.ts",
    "src/my-transport.ts",
    "src/a.telemetry.ts",
    "src/my_collector.ts",
  ];
  for (const [index, path] of paths.entries()) {
    const root = caseRepository(`scope-boundary-${index}`);
    write(root, `packages/security-audit-sdk-core/${path}`, "export {};\n");
    const result = script(root, "scripts/check-scope.mjs", []);
    assert.notEqual(result.status, 0, `${path} unexpectedly passed the production-scope filename guard`);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.match(output, new RegExp(`${escapeRegex(path)}: forbidden production integration filename`));
    const diagnostic = output.match(/Error: production-scope violations:\n([\s\S]*?)\n\s+at /)?.[1];
    assert.ok(diagnostic, "scope failure did not expose a stable violation diagnostic");
    assert.doesNotMatch(diagnostic, new RegExp(escapeRegex(root)), "scope violation diagnostic leaked an absolute fixture path");
  }
});

test("scope matcher permits boundary-free benign substrings", () => {
  const root = caseRepository("scope-benign-substrings");
  for (const path of [
    "src/transportation.ts",
    "src/browserify.ts",
    "src/collection.ts",
    "src/analytical.ts",
    "src/exportable.ts",
  ]) write(root, `packages/security-audit-sdk-core/${path}`, "export {};\n");
  succeeds(root, "scripts/check-scope.mjs", []);
});

test("scope matcher retains source-content and runtime-dependency controls", () => {
  const contentRoot = caseRepository("scope-forbidden-content");
  write(contentRoot, "packages/security-audit-sdk-core/src/network-probe.ts", "fetch('https://example.invalid');\n");
  fails(contentRoot, "scripts/check-scope.mjs", [], "fetch");

  const dependencyRoot = caseRepository("scope-runtime-dependency");
  replace(dependencyRoot, "packages/security-audit-sdk-core/package.json", '"dependencies": {}', '"dependencies": { "left-pad": "1.0.0" }');
  fails(dependencyRoot, "scripts/check-scope.mjs", [], "dependencies must remain empty");
});

test("concrete SDK uses compiler-enforced interface conformance without a factory assertion", () => {
  const source = readFileSync(resolve(packageRoot, "src/sdk.ts"), "utf8");
  assert.match(source, /class SecurityAuditSdkImpl implements SecurityAuditSdk/);
  assert.doesNotMatch(source, /as SecurityAuditSdk/);
  assert.match(source, /return Object\.freeze\(new SecurityAuditSdkImpl\(/);
});

test("deleting or renaming a required named method fails source typecheck", () => {
  const method = `  tenantContextViolationDetected(input: WithOperationHandle<NamedAuditEventInputMap["tenantContextViolationDetected"]>): Promise<AuditResult<AuditDeliveryResult>> {\n    return this.#emitNamed("tenantContextViolationDetected", input);\n  }\n\n`;
  const deletedRoot = caseRepository("sdk-method-deleted");
  replace(deletedRoot, "packages/security-audit-sdk-core/src/sdk.ts", method, "");
  typecheckFails(deletedRoot, "tenantContextViolationDetected");

  const renamedRoot = caseRepository("sdk-method-renamed");
  replace(
    renamedRoot,
    "packages/security-audit-sdk-core/src/sdk.ts",
    "  tenantContextViolationDetected(input:",
    "  renamedTenantContextViolationDetected(input:",
  );
  typecheckFails(renamedRoot, "tenantContextViolationDetected");
});

test("generated-surface verification rejects a descriptor naming a missing method", () => {
  const root = caseRepository("generated-method-missing");
  replace(root, "packages/security-audit-sdk-core/dist/generated/contract.generated.js", '"method": "accountRegistrationAttempted"', '"method": "missingGeneratedMethod"');
  fails(root, "scripts/check-compatibility.mjs", [], "generated SDK method missingGeneratedMethod is missing or non-callable");
});

test("generated-surface verification rejects a duplicate generated method name", () => {
  const root = caseRepository("generated-method-duplicate");
  replace(root, "packages/security-audit-sdk-core/dist/generated/contract.generated.js", '"method": "accountRegistrationCompleted"', '"method": "accountRegistrationAttempted"');
  fails(root, "scripts/check-compatibility.mjs", [], "duplicate generated event method: accountRegistrationAttempted");
});

test("generated-surface verification rejects a non-callable concrete method", () => {
  const root = caseRepository("concrete-method-non-callable");
  replace(
    root,
    "packages/security-audit-sdk-core/dist/sdk.js",
    "    return Object.freeze(new SecurityAuditSdkImpl(normalizeConfiguration(configuration)));",
    "    const instance = new SecurityAuditSdkImpl(normalizeConfiguration(configuration));\n    Object.defineProperty(instance, \"accountRegistrationAttempted\", { value: undefined });\n    return Object.freeze(instance);",
  );
  fails(root, "scripts/check-compatibility.mjs", [], "generated SDK method accountRegistrationAttempted is missing or non-callable");
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

function governedTaskIdsThrough(phase) {
  const index = taskGroups.findIndex((group) => group.phase === phase);
  assert.notEqual(index, -1, `unknown governed fixture phase ${phase}`);
  return taskGroups.slice(0, index + 1).flatMap(groupTaskIds);
}

function setGovernanceFixture(root, { ownerApproved }) {
  const packet = [
    "# Synthetic governed lifecycle fixture",
    "",
    "This controlled packet exists only inside a disposable verifier mutation repository.",
    "Final technical commit: `" + fixtureTechnicalCommit + "`",
    "Reviewed technical commit: `" + fixtureTechnicalCommit + "`",
    "Technical-review evidence commit: `" + fixtureEvidenceCommit + "`",
    "Technical review status: PASS",
    "Package publication/release approved | `NO — NOT AUTHORIZED`",
    "Production deployment approved | `NO — NOT AUTHORIZED`",
    ownerApproved ? fixtureOwnerBinding : "Project-owner decision: PENDING",
    "Merge lifecycle: PENDING",
    "Archive lifecycle: PENDING",
    "",
  ].join("\n");
  write(root, `${activeChange}/technical-review-packet.md`, packet);
}

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
  return result;
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

function typecheckFails(root, expected) {
  const packagePath = resolve(root, "packages/security-audit-sdk-core");
  const compiler = resolve(packageRoot, "node_modules/typescript/bin/tsc");
  const result = spawnSync(process.execPath, [compiler, "-p", "tsconfig.json", "--noEmit"], { cwd: packagePath, encoding: "utf8" });
  assert.notEqual(result.status, 0, "source typecheck unexpectedly passed an incomplete concrete SDK mutation");
  assert.match(`${result.stdout}\n${result.stderr}`, /incorrectly implements (?:type|interface) 'SecurityAuditSdk'/);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(escapeRegex(expected)));
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

function groupTaskIds(group) {
  const [section, start] = group.taskRange.start.split(".").map(Number);
  const [, end] = group.taskRange.end.split(".").map(Number);
  return Array.from({ length: end - start + 1 }, (_, index) => `${section}.${start + index}`);
}

function setCheckedTasks(root, checkedIds) {
  const checked = new Set(checkedIds);
  const path = resolve(root, activeChange, "tasks.md");
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace(/^- \[[ x]\] (\d+\.\d+) /mg, (line, id) => `- [${checked.has(id) ? "x" : " "}] ${id} `));
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
