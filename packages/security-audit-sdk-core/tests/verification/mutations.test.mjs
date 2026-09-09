import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, relative, resolve } from "node:path";
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
const fixtureArchiveRoot = "openspec/changes/archive";
const archiveCompletionTaskIds = ["12.8", "12.9", "12.10"];
const requiredArchivedEvidencePaths = [
  ".openspec.yaml",
  "implementation-authorization.md",
  "design.md",
  "proposal.md",
  "specs/security-audit-sdk-core/spec.md",
  "tasks.md",
  "technical-review-packet.md",
  "adversarial-review-traceability.md",
];
let restoredArchiveEvidence;
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
  if (restoredArchiveEvidence) {
    assert.deepEqual(
      treeIdentity(restoredArchiveEvidence.sourceArchive),
      restoredArchiveEvidence.sourceIdentity,
      "source archive bytes changed after archived fixture restoration controls",
    );
  }
  removeDisposableDirectory(suiteRoot);
});

test("structured capability comparison accepts legitimate cumulative growth without mutating historical archive bytes", () => {
  const { root } = archivedCaseRepository("capability-cumulative-growth");
  const originalArchiveRoot = resolve(root, originalArchive);
  const before = treeIdentity(originalArchiveRoot);
  append(root, canonicalCapability, [
    "\n### Requirement: Separately approved cumulative capability growth",
    "A separately approved capability SHALL coexist without weakening historical preservation.",
    "",
    "#### Scenario: Cumulative capability remains valid",
    "- **WHEN** an independently approved requirement is synchronized",
    "- **THEN** historical and remediation requirements remain structurally equivalent",
    "",
  ].join("\n"));
  succeeds(root, "scripts/check-coherence.mjs", ["--mode", "archived"]);
  assert.deepEqual(treeIdentity(originalArchiveRoot), before, "historical archive bytes changed during cumulative comparison");
});

test("structured capability comparison rejects a missing original requirement", () => {
  const { root } = archivedCaseRepository("capability-original-missing");
  const heading = requirementBlocks(readFileSync(resolve(root, `${originalArchive}/specs/security-audit-sdk-core/spec.md`), "utf8"))[0].heading;
  removeRequirement(root, canonicalCapability, heading);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "original-capability-requirement-missing");
});

test("structured capability comparison rejects a modified original requirement", () => {
  const { root } = archivedCaseRepository("capability-original-modified");
  const heading = requirementBlocks(readFileSync(resolve(root, `${originalArchive}/specs/security-audit-sdk-core/spec.md`), "utf8"))[0].heading;
  modifyRequirementBody(root, canonicalCapability, heading);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "original-capability-requirement-modified");
});

test("structured capability comparison rejects a duplicated original requirement", () => {
  const { root } = archivedCaseRepository("capability-original-duplicate");
  const heading = requirementBlocks(readFileSync(resolve(root, `${originalArchive}/specs/security-audit-sdk-core/spec.md`), "utf8"))[0].heading;
  append(root, canonicalCapability, `\n${requirementBlockAt(root, canonicalCapability, heading)}\n`);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "original-capability-requirement-duplicate");
});

test("structured capability comparison rejects a missing remediation requirement", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("capability-remediation-missing");
  const heading = requirementBlocks(readFileSync(resolve(root, archiveRelativePath, "specs/security-audit-sdk-core/spec.md"), "utf8"))[0].heading;
  removeRequirement(root, canonicalCapability, heading);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "archived-remediation-capability-requirement-missing");
});

test("structured capability comparison rejects a modified remediation requirement", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("capability-remediation-modified");
  const heading = requirementBlocks(readFileSync(resolve(root, archiveRelativePath, "specs/security-audit-sdk-core/spec.md"), "utf8"))[0].heading;
  modifyRequirementBody(root, canonicalCapability, heading);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "archived-remediation-capability-requirement-modified");
});

test("structured capability comparison rejects a duplicated remediation requirement", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("capability-remediation-duplicate");
  const heading = requirementBlocks(readFileSync(resolve(root, archiveRelativePath, "specs/security-audit-sdk-core/spec.md"), "utf8"))[0].heading;
  append(root, canonicalCapability, `\n${requirementBlockAt(root, canonicalCapability, heading)}\n`);
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "archived-remediation-capability-requirement-duplicate");
});

test("raw substring evidence inside a fenced appendix cannot satisfy structured capability preservation", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("capability-raw-substring");
  const heading = requirementBlocks(readFileSync(resolve(root, archiveRelativePath, "specs/security-audit-sdk-core/spec.md"), "utf8"))[0].heading;
  const block = removeRequirement(root, canonicalCapability, heading);
  append(root, canonicalCapability, `\n## Non-normative appendix\n\n\`\`\`\`markdown\n${block}\n\`\`\`\`\n`);
  assert.ok(readFileSync(resolve(root, canonicalCapability), "utf8").includes(block), "raw substring control must retain the exact block bytes");
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "archived-remediation-capability-requirement-missing");
});

test("malformed requirement structure is rejected with its structural diagnostic", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("capability-malformed");
  const heading = requirementBlocks(readFileSync(resolve(root, archiveRelativePath, "specs/security-audit-sdk-core/spec.md"), "utf8"))[0].heading;
  const path = resolve(root, canonicalCapability);
  const text = readFileSync(path, "utf8");
  const block = requirementBlockAt(root, canonicalCapability, heading);
  const malformed = block.replace("#### Scenario:", "#### Scenario -");
  assert.notEqual(malformed, block, "malformed structure control did not alter a scenario heading");
  writeFileSync(path, text.replace(block, malformed));
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "canonical-capability-requirement-structure");
});

test("empty canonical requirement sets are rejected", () => {
  const { root } = archivedCaseRepository("capability-empty");
  writeFileSync(resolve(root, canonicalCapability), "# security-audit-sdk-core Specification\n\n## Requirements\n");
  fails(root, "scripts/check-coherence.mjs", ["--mode", "archived"], "canonical-capability-requirement-set");
});

test("exact complete active-to-archive movement passes", () => {
  const { root } = archivedCaseRepository("archive-movement-complete");
  succeeds(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"]);
});

test("archive movement rejects unmatched deletion and partial movement", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-unmatched-deletion");
  rmSync(resolve(root, archiveRelativePath, "design.md"));
  const result = fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-unmatched-deletion");
  assert.match(`${result.stdout}\n${result.stderr}`, /archive-movement-partial/);
});

test("archive movement rejects unmatched additions", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-unmatched-addition");
  write(root, `${archiveRelativePath}/unmatched.md`, "unmatched archive addition\n");
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-unmatched-addition");
});

test("archive movement rejects a wrong relative destination path", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-wrong-relative-path");
  renameSync(resolve(root, archiveRelativePath, "design.md"), resolve(root, archiveRelativePath, "design-renamed.md"));
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-wrong-path");
});

test("archive movement rejects mode substitution", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-mode-substitution");
  chmodSync(resolve(root, archiveRelativePath, "proposal.md"), 0o755);
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-mode-mismatch");
});

test("archive movement rejects byte substitution", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-byte-substitution");
  append(root, `${archiveRelativePath}/proposal.md`, "\nsubstituted archive bytes\n");
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-byte-substitution");
});

test("archive movement permits only exact 12.8-12.10 task reconciliation", () => {
  for (const [name, mutate] of [
    ["earlier-checkbox", (root, path) => replace(root, path, "- [x] 12.7 ", "- [ ] 12.7 ")],
    ["task-prose", (root, path) => append(root, path, "\nunauthorized archive task prose\n")],
  ]) {
    const { root, archiveRelativePath } = archivedCaseRepository(`archive-movement-task-${name}`);
    const taskPath = `${archiveRelativePath}/tasks.md`;
    mutate(root, taskPath);
    fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-unauthorized-task-difference");
  }
});

test("archive movement rejects active remnants as a partial movement", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-active-remnant");
  mkdirSync(resolve(root, activeChange), { recursive: true });
  cpSync(resolve(root, archiveRelativePath, "proposal.md"), resolve(root, activeChange, "proposal.md"));
  const result = fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-retained-active-file");
  assert.match(`${result.stdout}\n${result.stderr}`, /archive-movement-partial/);
});

test("archive movement rejects an unrelated archive addition", () => {
  const { root } = archivedCaseRepository("archive-movement-unrelated-archive");
  write(root, `${fixtureArchiveRoot}/2099-01-02-unrelated-change/rogue.md`, "unrelated archive\n");
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-unrelated-archive-addition");
});

test("archive movement rejects multiple remediation archive destinations", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-multiple-destinations");
  cpSync(resolve(root, archiveRelativePath), resolve(root, `${fixtureArchiveRoot}/2099-01-03-${remediation.name}`), { recursive: true });
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-multiple-destinations");
});

test("archive movement rejects a destination outside the exact archive pattern", () => {
  const { root, archiveRelativePath } = archivedCaseRepository("archive-movement-wrong-archive-path");
  renameSync(resolve(root, archiveRelativePath), resolve(root, `${fixtureArchiveRoot}/2099-01-02-wrong-${remediation.name}`));
  fails(root, "scripts/check-changed-paths.mjs", ["--mode", "archived"], "archive-movement-wrong-archive-path");
});

test("archived fixture restoration accepts exactly one archive and preserves source bytes", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-one");
  const sourceArchive = resolve(fixture.sourceRoot, fixtureArchiveRoot, `2099-01-02-${remediation.name}`);
  const before = treeIdentity(sourceArchive);
  restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
  });
  const tasks = readFileSync(resolve(fixture.destinationRoot, activeChange, "tasks.md"), "utf8");
  for (const id of archiveCompletionTaskIds) assert.match(tasks, new RegExp(`^- \\[ \\] ${escapeRegex(id)} `, "m"));
  for (const id of taskGroups.flatMap(groupTaskIds).filter((id) => !archiveCompletionTaskIds.includes(id))) {
    assert.match(tasks, new RegExp(`^- \\[x\\] ${escapeRegex(id)} `, "m"));
  }
  assert.deepEqual(treeIdentity(sourceArchive), before, "source archive changed during exact restoration");
  removeDisposableDirectory(fixture.destinationRoot);
  removeDisposableDirectory(fixture.sourceRoot);
  assert.equal(existsSync(fixture.destinationRoot), false, "restored control cleanup did not complete");
});

test("archived fixture restoration rejects zero archive matches", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-zero", []);
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
  }), /fixture-restore-archive-cardinality/);
});

test("archived fixture restoration rejects multiple archive matches", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-multiple", ["2099-01-02", "2099-01-03"]);
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
  }), /fixture-restore-archive-cardinality/);
});

test("archived fixture restoration rejects a wrong change ID", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-wrong-change");
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: "wrong-change-id",
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
  }), /fixture-restore-wrong-change-id/);
});

test("archived fixture restoration rejects a wrong active relative path", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-wrong-relative");
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: `${remediation.active}-wrong`,
  }), /fixture-restore-wrong-relative-path/);
});

test("archived fixture restoration rejects missing evidence", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-missing-evidence");
  rmSync(resolve(fixture.sourceRoot, fixtureArchiveRoot, `2099-01-02-${remediation.name}`, "technical-review-packet.md"));
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
  }), /fixture-restore-missing-evidence/);
});

test("archived fixture restoration rejects a malformed task ledger", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-malformed-ledger");
  const taskPath = resolve(fixture.sourceRoot, fixtureArchiveRoot, `2099-01-02-${remediation.name}`, "tasks.md");
  writeFileSync(taskPath, readFileSync(taskPath, "utf8").replace(/^- \[x\] 2\.1 .+\n/m, ""));
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
  }), /fixture-restore-task-ledger/);
});

test("archived fixture restoration rejects an unexpected unchecked task", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-unexpected-task");
  const archivePath = `${fixtureArchiveRoot}/2099-01-02-${remediation.name}/tasks.md`;
  replace(fixture.sourceRoot, archivePath, "- [x] 12.7 ", "- [ ] 12.7 ");
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
  }), /fixture-restore-task-state/);
});

test("archived fixture restoration detects source-byte mutation", () => {
  const fixture = fixtureRestorationRepository("fixture-restore-source-mutation");
  assert.throws(() => restoreActiveFixtureFromArchive({
    sourceRoot: fixture.sourceRoot,
    controlRoot: fixture.destinationRoot,
    changeId: remediation.name,
    archivePattern: remediation.archivePattern,
    activeRelativePath: remediation.active,
    afterCopy: ({ sourceArchive }) => writeFileSync(resolve(sourceArchive, "proposal.md"), "mutated source bytes\n"),
  }), /fixture-restore-source-mutation/);
});

test("archived fixture cleanup failures are explicit and successful cleanup is deterministic", () => {
  const root = resolve(suiteRoot, "fixture-cleanup-control");
  mkdirSync(root, { recursive: true });
  assert.throws(
    () => removeDisposableDirectory(root, () => { throw new Error("injected cleanup refusal"); }),
    /fixture-cleanup-failure/,
  );
  assert.equal(existsSync(root), true, "injected cleanup failure unexpectedly removed its control");
  removeDisposableDirectory(root);
  assert.equal(existsSync(root), false, "deterministic cleanup did not remove its control");
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
  // Explicitly remove the Final technical commit binding so the test does not
  // depend on the active packet's formatting or binding state.
  const packetPath = `${activeChange}/technical-review-packet.md`;
  const packetText = readFileSync(resolve(root, packetPath), "utf8");
  const bindingLine = packetText.match(/^.*Final technical commit:.*$/m)?.[0];
  assert.ok(bindingLine, "control fixture must contain a Final technical commit line to remove");
  replace(root, packetPath, bindingLine, "Final technical commit: binding intentionally removed for negative control");
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

test("scope matcher retains filename and platform-coupling runtime-dependency controls", () => {
  const contentRoot = caseRepository("scope-forbidden-content");
  write(contentRoot, "packages/security-audit-sdk-core/src/network-probe.ts", "fetch('https://example.invalid');\n");
  fails(contentRoot, "scripts/check-scope.mjs", [], "[platform-coupling:");

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
  replace(root, "packages/security-audit-sdk-core/package.json", '"version": "0.2.0"', '"version": "9.0.0"');
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

test("governed repository local Git configuration assertion ignores concurrent branch tracking keys", () => {
  const current = governedLocalConfig();
  git(repositoryRoot, ["config", "--local", "branch.temporary-test-concurrent-write.remote", "origin"]);
  git(repositoryRoot, ["config", "--local", "branch.temporary-test-concurrent-write.merge", "refs/heads/main"]);
  try {
    assert.equal(governedLocalConfig(), current, "branch keys should be excluded from governedLocalConfig");
  } finally {
    git(repositoryRoot, ["config", "--local", "--unset-all", "branch.temporary-test-concurrent-write.remote"]);
    git(repositoryRoot, ["config", "--local", "--unset-all", "branch.temporary-test-concurrent-write.merge"]);
  }
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
  if (existsSync(resolve(repositoryRoot, activeChange))) {
    cpSync(resolve(repositoryRoot, activeChange), resolve(controlRoot, activeChange), { recursive: true, force: true });
  } else {
    restoredArchiveEvidence = restoreActiveFixtureFromArchive({
      sourceRoot: repositoryRoot,
      controlRoot,
      changeId: remediation.name,
      archivePattern: remediation.archivePattern,
      activeRelativePath: remediation.active,
    });
    restorePreArchiveControlState(controlRoot, restoredArchiveEvidence.archiveRelativePath);
  }
  git(controlRoot, ["add", "-A"]);
  git(controlRoot, ["add", "-f", "packages/security-audit-sdk-core/dist"]);
  git(controlRoot, ["commit", "-m", "test: isolated verification control"]);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(controlRoot, "packages/security-audit-sdk-core/node_modules"), "dir");
  succeeds(controlRoot, "scripts/check-changed-paths.mjs", ["--mode", "active"]);
  succeeds(controlRoot, "scripts/check-coherence.mjs", ["--mode", "active"]);
}

function restoreActiveFixtureFromArchive({
  sourceRoot,
  controlRoot: destinationRoot,
  changeId,
  archivePattern,
  activeRelativePath,
  afterCopy,
}) {
  if (changeId !== remediation.name) {
    fixtureFailure("fixture-restore-wrong-change-id", `expected ${remediation.name}, got ${changeId}`);
  }
  const expectedActivePath = `openspec/changes/${changeId}`;
  if (activeRelativePath !== expectedActivePath || activeRelativePath !== remediation.active) {
    fixtureFailure("fixture-restore-wrong-relative-path", `expected ${expectedActivePath}, got ${activeRelativePath}`);
  }

  let policy;
  try {
    policy = new RegExp(archivePattern);
  } catch (error) {
    fixtureFailure("fixture-restore-wrong-archive-path", `invalid archive policy ${archivePattern}: ${error.message}`);
  }
  const archiveParent = resolve(sourceRoot, fixtureArchiveRoot);
  const matches = existsSync(archiveParent)
    ? readdirSync(archiveParent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${fixtureArchiveRoot}/${entry.name}`)
      .filter((path) => policy.test(path))
      .sort()
    : [];
  if (matches.length !== 1) {
    fixtureFailure("fixture-restore-archive-cardinality", `expected exactly one dated archive for ${changeId}, found ${matches.length}: ${matches.join(", ") || "none"}`);
  }

  const archiveRelativePath = matches[0];
  const archiveName = basename(archiveRelativePath);
  if (!/^\d{4}-\d{2}-\d{2}-/.test(archiveName) || !archiveName.endsWith(`-${changeId}`) || !policy.test(archiveRelativePath)) {
    fixtureFailure("fixture-restore-wrong-archive-path", `${archiveRelativePath} does not encode the exact policy date and change ID`);
  }
  const sourceArchive = resolve(sourceRoot, archiveRelativePath);
  for (const requiredPath of requiredArchivedEvidencePaths) {
    const absolute = resolve(sourceArchive, requiredPath);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) {
      fixtureFailure("fixture-restore-missing-evidence", `${archiveRelativePath}/${requiredPath} is absent or not a regular file`);
    }
  }

  const sourceIdentity = treeIdentity(sourceArchive);
  const sourceTasks = readFileSync(resolve(sourceArchive, "tasks.md"), "utf8");
  const restoredTasks = restoreArchivedTaskLedger(sourceTasks);
  const destination = resolve(destinationRoot, activeRelativePath);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(resolve(destination, ".."), { recursive: true });
  cpSync(sourceArchive, destination, { recursive: true, force: true, preserveTimestamps: true });
  if (!sameIdentity(treeIdentity(destination), sourceIdentity)) {
    fixtureFailure("fixture-restore-copy-identity", "archive copy differs before task reconciliation");
  }
  afterCopy?.({ sourceArchive, destination });
  writeFileSync(resolve(destination, "tasks.md"), restoredTasks);

  const restoredIdentity = treeIdentity(destination);
  for (const sourceEntry of sourceIdentity) {
    const restoredEntry = restoredIdentity.find((entry) => entry.path === sourceEntry.path);
    if (!restoredEntry) fixtureFailure("fixture-restore-copy-identity", `restored active fixture is missing ${sourceEntry.path}`);
    if (sourceEntry.path !== "tasks.md" && !sameIdentity([sourceEntry], [restoredEntry])) {
      fixtureFailure("fixture-restore-copy-identity", `restoration modified ${sourceEntry.path}`);
    }
  }
  if (readFileSync(resolve(destination, "tasks.md"), "utf8") !== restoredTasks) {
    fixtureFailure("fixture-restore-task-ledger", "restored task ledger does not equal the exact three-checkbox reconciliation");
  }
  if (!sameIdentity(treeIdentity(sourceArchive), sourceIdentity)) {
    fixtureFailure("fixture-restore-source-mutation", `${archiveRelativePath} changed while constructing the disposable control`);
  }

  return Object.freeze({
    archiveRelativePath,
    sourceArchive,
    sourceIdentity: Object.freeze(sourceIdentity),
  });
}

function restoreArchivedTaskLedger(text) {
  const entries = [...text.matchAll(/^- \[([ x])\] (\d+\.\d+) (.+)$/gm)].map((match) => ({
    done: match[1] === "x",
    id: match[2],
  }));
  const expectedIds = taskGroups.flatMap(groupTaskIds);
  const actualIds = entries.map((entry) => entry.id);
  if (entries.length !== remediation.taskCount
    || new Set(actualIds).size !== entries.length
    || expectedIds.some((id) => !actualIds.includes(id))) {
    fixtureFailure("fixture-restore-task-ledger", `archived task ledger must contain exactly ${remediation.taskCount} unique governed tasks`);
  }
  const unexpected = entries.find((entry) => !entry.done);
  if (unexpected) {
    fixtureFailure("fixture-restore-task-state", `archived task ${unexpected.id} is unexpectedly unchecked`);
  }

  let restored = text;
  for (const id of archiveCompletionTaskIds) {
    const pattern = new RegExp(`^- \\[x\\] ${escapeRegex(id)} `, "gm");
    const matches = [...restored.matchAll(pattern)];
    if (matches.length !== 1) {
      fixtureFailure("fixture-restore-task-ledger", `archive completion task ${id} must occur exactly once and be checked`);
    }
    restored = restored.replace(pattern, `- [ ] ${id} `);
  }
  return restored;
}

function restorePreArchiveControlState(root, archiveRelativePath) {
  const headActive = git(root, ["ls-tree", "-r", "--name-only", "HEAD", "--", activeChange]).stdout.trim();
  if (headActive === "") {
    const commits = git(root, ["log", "--format=%H", "--diff-filter=A", "--", `${archiveRelativePath}/`]).stdout
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const candidates = [];
    for (const commit of commits) {
      const parent = git(root, ["show", "-s", "--format=%P", commit]).stdout.trim().split(" ")[0];
      if (!parent) continue;
      const activeFiles = git(root, ["ls-tree", "-r", "--name-only", parent, "--", activeChange]).stdout.trim();
      if (activeFiles !== "") candidates.push({ commit, parent });
    }
    if (candidates.length !== 1) {
      fixtureFailure("fixture-restore-missing-evidence", `unable to derive one pre-archive parent; found ${candidates.length}`);
    }
    const canonical = git(root, ["show", `${candidates[0].parent}:${canonicalCapability}`]).stdout;
    writeFileSync(resolve(root, canonicalCapability), canonical);
  }
  rmSync(resolve(root, archiveRelativePath), { recursive: true, force: true });
}

function treeIdentity(root) {
  const records = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const stat = lstatSync(absolute);
      const bytes = readFileSync(absolute);
      records.push(Object.freeze({
        path: relative(root, absolute).replaceAll("\\", "/"),
        mode: entry.isSymbolicLink() ? "120000" : (stat.mode & 0o111) === 0 ? "100644" : "100755",
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }));
    }
  }
  walk(root);
  return records;
}

function sameIdentity(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function removeDisposableDirectory(path, remove = rmSync) {
  try {
    remove(path, { recursive: true, force: true });
  } catch (error) {
    fixtureFailure("fixture-cleanup-failure", `${path} could not be removed: ${error.message}`);
  }
  if (existsSync(path)) fixtureFailure("fixture-cleanup-failure", `${path} still exists after cleanup`);
}

function fixtureFailure(id, message) {
  throw new Error(`[${id}] ${message}`);
}

function caseRepository(name) {
  const root = resolve(suiteRoot, name);
  git(suiteRoot, ["clone", "--quiet", "--no-hardlinks", controlRoot, root]);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(root, "packages/security-audit-sdk-core/node_modules"), "dir");
  return root;
}

function archivedCaseRepository(name) {
  const root = caseRepository(name);
  const governedTasks = governedTaskIdsThrough("owner-governance");
  assert.equal(governedTasks.length, 88, "archive movement source must be exactly 88/91 before merge and archive reconciliation");
  setCheckedTasks(root, governedTasks);
  git(root, ["add", `${activeChange}/tasks.md`]);
  const staged = runDisposableGit(root, ["diff", "--cached", "--quiet"]);
  assert.ok([0, 1].includes(staged.status), `unable to inspect staged archive-source task state: ${staged.stderr}`);
  if (staged.status === 1) git(root, ["commit", "-m", "test: synthetic governed archive source"]);

  const archiveRelativePath = `${fixtureArchiveRoot}/2099-01-02-${remediation.name}`;
  const deltaPath = resolve(root, activeChange, "specs/security-audit-sdk-core/spec.md");
  const delta = readFileSync(deltaPath, "utf8");
  cpSync(resolve(root, activeChange), resolve(root, archiveRelativePath), { recursive: true, force: true, preserveTimestamps: true });
  const archiveTasksPath = resolve(root, archiveRelativePath, "tasks.md");
  let archiveTasks = readFileSync(archiveTasksPath, "utf8");
  for (const id of archiveCompletionTaskIds) {
    const pattern = new RegExp(`^- \\[ \\] ${escapeRegex(id)} `, "gm");
    const matches = [...archiveTasks.matchAll(pattern)];
    assert.equal(matches.length, 1, `archive source task ${id} must be exactly once and unchecked`);
    archiveTasks = archiveTasks.replace(pattern, `- [x] ${id} `);
  }
  writeFileSync(archiveTasksPath, archiveTasks);
  rmSync(resolve(root, activeChange), { recursive: true, force: true });
  synchronizeCanonicalCapability(root, delta);
  return Object.freeze({ root, archiveRelativePath });
}

function synchronizeCanonicalCapability(root, delta) {
  const requirementStart = delta.indexOf("### Requirement:");
  assert.notEqual(requirementStart, -1, "remediation delta contains no requirement blocks");
  const requirements = delta.slice(requirementStart).trimEnd();
  const path = resolve(root, canonicalCapability);
  const canonical = readFileSync(path, "utf8").trimEnd();
  writeFileSync(path, `${canonical}\n\n${requirements}\n`);
}

function requirementBlocks(text) {
  const matches = [...text.matchAll(/^### Requirement:\s*(.+?)\s*$/gm)];
  return matches.map((match, index) => ({
    heading: match[1].trim().replace(/[ \t]+/g, " "),
    block: text.slice(match.index, matches[index + 1]?.index ?? text.length).trimEnd(),
  }));
}

function requirementBlockAt(root, sourcePath, heading) {
  const text = readFileSync(resolve(root, sourcePath), "utf8");
  const records = requirementBlocks(text).filter((record) => record.heading === heading);
  assert.equal(records.length, 1, `expected one requirement ${heading} in ${sourcePath}, found ${records.length}`);
  return records[0].block;
}

function removeRequirement(root, sourcePath, heading) {
  const path = resolve(root, sourcePath);
  const text = readFileSync(path, "utf8");
  const block = requirementBlockAt(root, sourcePath, heading);
  assert.equal(text.split(block).length - 1, 1, `requirement ${heading} must occur as one exact block`);
  writeFileSync(path, text.replace(block, ""));
  return block;
}

function modifyRequirementBody(root, sourcePath, heading) {
  const path = resolve(root, sourcePath);
  const text = readFileSync(path, "utf8");
  const block = requirementBlockAt(root, sourcePath, heading);
  const modified = block.replace(/\bSHALL\b/, "SHALL NOT");
  assert.notEqual(modified, block, `requirement ${heading} has no SHALL token to modify`);
  writeFileSync(path, text.replace(block, modified));
}

function fixtureRestorationRepository(name, dates = ["2099-01-02"]) {
  const sourceRoot = resolve(suiteRoot, `${name}-fixture-source`);
  const destinationRoot = resolve(suiteRoot, `${name}-fixture-control`);
  mkdirSync(resolve(sourceRoot, fixtureArchiveRoot), { recursive: true });
  mkdirSync(destinationRoot, { recursive: true });
  const template = resolve(controlRoot, activeChange);
  for (const date of dates) {
    const archive = resolve(sourceRoot, fixtureArchiveRoot, `${date}-${remediation.name}`);
    cpSync(template, archive, { recursive: true, force: true, preserveTimestamps: true });
    const tasksPath = resolve(archive, "tasks.md");
    const tasks = readFileSync(tasksPath, "utf8");
    const completed = tasks.replace(/^- \[[ x]\] (\d+\.\d+) /gm, "- [x] $1 ");
    assert.equal([...completed.matchAll(/^- \[x\] \d+\.\d+ /gm)].length, remediation.taskCount);
    writeFileSync(tasksPath, completed);
  }
  return Object.freeze({ sourceRoot, destinationRoot });
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
  return result.stdout
    .split("\0")
    .filter((entry) => entry && !entry.split("\n")[0].startsWith("branch."))
    .sort()
    .join("\0");
}
