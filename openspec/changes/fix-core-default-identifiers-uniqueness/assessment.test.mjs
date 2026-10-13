// Planning and documentation regression controls for issue #796; no SDK behavior is implemented here.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const changeId = "fix-core-default-identifiers-uniqueness";
const changeRoot = `openspec/changes/${changeId}/`;
const baseline = "5d931ad695fb10db3fe51e6b151352447e21d822";
const assessment = JSON.parse(readFileSync(new URL("./assessment.json", import.meta.url), "utf8"));
const tasks = readFileSync(new URL("./tasks.md", import.meta.url), "utf8");
const spec = readFileSync(new URL("./specs/security-audit-sdk-core/spec.md", import.meta.url), "utf8");
const proposal = readFileSync(new URL("./proposal.md", import.meta.url), "utf8");
const design = readFileSync(new URL("./design.md", import.meta.url), "utf8");
const ownerSource = "owner decision, 2026-10-13, via grilling in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E";
const committedControl = "tests/cross-process-identifiers-negative-control.test.ts: old seeded identifier provider repeats event and operation sequences across concurrent fresh processes";
const processRequirement = "Default identifier remediation preserves frozen and governance boundaries";
const processScenario = "Remediation verification retains all protected boundaries";
const followUpTasks = ["6.1", "6.2", "6.3", "6.4"];
const requiredSdkPaths = [
  "src/providers.ts",
  "scripts/platform-coupling-policy.mjs",
  "scripts/check-scope.mjs",
  "tests/verification/platform-coupling-mutations.test.mjs",
  "tests/cross-process-identifiers.test.ts",
  "API.md",
  "adr/013-default-identifier-cryptographic-uniqueness.md",
  "scripts/check-coherence.mjs",
  "MIGRATION.md",
  "CONTEXT.md",
  "tests/cross-process-identifiers-negative-control.test.ts",
  "tests/cross-process-harness.ts",
].map((path) => `packages/security-audit-sdk-core/${path}`);
const invariantIds = [
  "implementation-host-uuid-generation",
  "implementation-default-fail-closed",
  "implementation-custom-provider-independence",
  "implementation-provider-local-coupling",
  "implementation-preserved-boundaries",
];

function assertPlanningContract(value, taskText, specText) {
  assert.equal(value.schema_version, "1.1");
  assert.equal(value.change_id, changeId);
  assert.equal(value.assessment_level, "full");
  assert.equal(value.security_sensitive, true);
  assert.equal(value.decision, "direct_implementation");
  assert.deepEqual(value.selected_pattern_ids, []);
  assert.equal(value.catalog_binding, undefined);
  assert.equal(value.ordering.proposal_baseline_commit, baseline);
  assert.deepEqual(value.applicability.capabilities, ["security-audit-sdk-core"]);
  assert.equal(value.applicability.material_capability_modification, true);
  assert.ok(value.applicability.triggers_matched.includes("security_sensitive_behavior"));
  assert.ok(value.applicability.triggers_matched.includes("canonical_capability_requirement"));
  assertCandidateApproaches(value);
  assertAlternativeRejections(value);
  assertOwnedPaths(value);
  assertInvariants(value, taskText);
  assertScenarios(specText);
}

function assertCandidateApproaches(value) {
  assert.ok(value.candidate_approaches.some((candidate) => candidate.kind === "direct_implementation"));
  assert.ok(value.candidate_approaches.some((candidate) => candidate.kind === "alternative"));
  for (const candidate of value.candidate_approaches) {
    for (const force of candidate.forces_addressed) assert.ok(value.forces.includes(force));
  }
}

function assertAlternativeRejections(value) {
  assert.ok(value.rejected_alternative_ids.length > 0);
  for (const id of value.rejected_alternative_ids) {
    assert.notEqual(id, value.selected_approach_id);
    assert.ok(value.candidate_approaches.some((candidate) => candidate.id === id));
    const rejection = value.rejection_reasons[id];
    assert.ok(rejection.reason.length >= 40);
    for (const force of rejection.forces) assert.ok(value.forces.includes(force));
  }
}

function assertOwnedPaths(value) {
  for (const path of requiredSdkPaths) assert.ok(value.owned_paths.includes(path), path);
  for (const path of value.owned_paths) {
    assert.ok(path.startsWith(changeRoot) || requiredSdkPaths.includes(path), path);
  }
}

const requiredInvariantTasks = {
  "implementation-host-uuid-generation": ["2.1", "2.2", "3.1", "3.2", "6.1", "6.2", "6.4"],
  "implementation-default-fail-closed": ["2.1", "2.2"],
  "implementation-custom-provider-independence": ["2.1", "2.2"],
  "implementation-provider-local-coupling": ["2.3"],
  "implementation-preserved-boundaries": ["4.1", "4.2", "4.3", "6.1", "6.3", "6.4"],
};
const requiredVerificationTasks = [
  "1.1", "1.2", "1.3", "2.2", "2.3", "3.1", "3.2", "4.1", "4.2", "4.3", ...followUpTasks,
];

function assertFollowUpRelations(value, taskText) {
  for (const [id, taskIds] of Object.entries(requiredInvariantTasks)) {
    for (const taskId of taskIds) assert.ok(value.invariant_evidence[id].task_ids.includes(taskId), `${id}: ${taskId}`);
  }
  for (const taskId of requiredVerificationTasks) assert.ok(value.verification_task_ids.includes(taskId), taskId);
  const hostEvidence = value.invariant_evidence["implementation-host-uuid-generation"].evidence_ids;
  assert.ok(hostEvidence.includes(committedControl));
  assert.equal(hostEvidence.some((text) => text.includes("disposable-copy")), false);
  assertTaskGroupOrder(taskText);
  assertFollowUpTaskOrder(taskText);
}

const closureHeading = "### Owner-decision follow-up — US-004 closure";
const closureEvidenceId = "tasks.md: Owner-decision follow-up — US-004 closure; shared findRepeatedIdentifiers vacuous-helper mutation fails at collision detection, exact-byte restoration and focused reruns pass";
const closureControlTexts = [
  "Run `5b30972f-9782-45a2-9972-16a4426f7151`",
  "old seeded identifier provider repeats event and operation sequences across concurrent fresh processes",
  "`findRepeatedIdentifiers`", "`tests/cross-process-harness.ts`", "`return [];`", "`finally`",
  "Mutation compilation:", "Expected-failure command:", "exit 1, 1 test failed, 0 passed",
  "AssertionError [ERR_ASSERTION]: old seeded provider must expose collisions through the shared collision finder",
  "Successful child exit/format/PID/count/sequence validations precede that assertion",
  "frozen-contract event.id matches", "Exact-byte equality PASS", "Restored compilation:",
  "Restored focused rerun of both files", "No uncommitted mutation or staged build artifacts remain",
];

function assertClosureEvidence(taskText, value) {
  const section = taskText.split(closureHeading)[1];
  assert.ok(section, "missing current-run closure section");
  for (const phrase of closureControlTexts) assert.ok(section.includes(phrase), phrase);
  const before = section.match(/Restoration SHA-256 before: `([a-f0-9]{64})`/);
  const after = section.match(/Restoration SHA-256 after: `([a-f0-9]{64})`/);
  assert.ok(before, "missing pre-mutation hash");
  assert.ok(after, "missing restoration hash");
  assert.equal(after[1], before[1], "restoration hashes differ");
  assert.ok(value.invariant_evidence["implementation-host-uuid-generation"].evidence_ids.includes(closureEvidenceId));
}

test("closure records committed seeded-control mutation sensitivity and exact restoration", () => {
  assertClosureEvidence(tasks, assessment);
});
for (const phrase of [closureHeading, ...closureControlTexts]) {
  test(`closure rejects missing current-run evidence ${phrase}`, () => {
    assert.throws(() => assertClosureEvidence(tasks.replaceAll(phrase, "omitted"), assessment));
  });
}
test("closure rejects historical evidence substituted for current seeded control", () => {
  const section = tasks.slice(tasks.indexOf(closureHeading)).replaceAll(closureControlTexts[1], "disposable-copy old-seed control");
  assert.throws(() => assertClosureEvidence(section, assessment));
});
test("closure rejects absent or mismatched restoration hashes", () => {
  const section = tasks.slice(tasks.indexOf(closureHeading));
  for (const label of ["before", "after"]) {
    assert.throws(() => assertClosureEvidence(section.replace(`Restoration SHA-256 ${label}:`, "omitted:"), assessment));
  }
  const mismatched = section.replace(/(Restoration SHA-256 after: `)[a-f0-9]{64}/, `$1${"0".repeat(64)}`);
  assert.throws(() => assertClosureEvidence(mismatched, assessment));
});
const closureGateCommands = [
  "npm run check:generated --prefix packages/security-audit-sdk-core",
  "npm run test:matrix --prefix packages/security-audit-sdk-core",
  "npm run test:coherence --prefix packages/security-audit-sdk-core",
  "npm run validate --prefix contracts/security-audit",
  "node --test openspec/changes/fix-core-default-identifiers-uniqueness/assessment.test.mjs",
  "node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main",
  "node packages/security-audit-sdk-core/scripts/check-git-state.mjs", "make test",
  "npm run typecheck --prefix packages/security-audit-sdk-core",
  "npx --yes @fission-ai/openspec@latest validate fix-core-default-identifiers-uniqueness --strict",
  "git diff --check",
];

function assertCompletedClosure(taskText, value) {
  assertClosureEvidence(taskText, value);
  assertFollowUpTaskOrder(taskText);
  assert.match(taskText, /^- \[x\] 6\.4 /m);
  const gates = taskText.split(closureHeading)[1].split("#### Final gate outcomes (pre-commit)")[1];
  assert.ok(gates, "missing final gate outcomes");
  for (const command of closureGateCommands) assert.ok(gates.includes(`\`${command}\`: exit 0`), command);
}

test("completed closure records all required current-run gates without reopening predecessors", () => {
  assertCompletedClosure(tasks, assessment);
});
for (const command of closureGateCommands) {
  test(`completed closure rejects missing final gate ${command}`, () => {
    const prefix = tasks.slice(0, tasks.indexOf(closureHeading));
    const current = tasks.slice(tasks.indexOf(closureHeading)).replaceAll(command, "omitted");
    assert.throws(() => assertCompletedClosure(prefix + current, assessment));
  });
}
test("completed closure rejects absent gate section and unchecked final task", () => {
  assert.throws(() => assertCompletedClosure(tasks.replace("#### Final gate outcomes (pre-commit)", "omitted"), assessment));
  assert.throws(() => assertCompletedClosure(tasks.replace("[x] 6.4", "[ ] 6.4"), assessment));
});

test("closure rejects unmapped executed sensitivity evidence", () => {
  const mutated = structuredClone(assessment);
  const evidence = mutated.invariant_evidence["implementation-host-uuid-generation"];
  evidence.evidence_ids = evidence.evidence_ids.filter((text) => text !== closureEvidenceId);
  assert.throws(() => assertClosureEvidence(tasks, mutated));
});

function assertFollowUpTaskOrder(taskText) {
  let pending = false;
  for (const taskId of followUpTasks) {
    const match = taskText.match(new RegExp(`^- \\[([ x])\\] ${taskId.replace(".", "\\.")} `, "m"));
    assert.ok(match, taskId);
    const complete = match[1] === "x";
    assert.equal(pending && complete, false, `${taskId} completed before its predecessor`);
    pending ||= !complete;
  }
}

function assertTaskGroupOrder(taskText) {
  let previous = -1;
  for (const group of [1, 2, 3, 4, 5, 6]) {
    const position = taskText.indexOf(`## ${group}. `);
    assert.ok(position > previous, `missing or unordered group ${group}`);
    previous = position;
  }
  assert.ok(taskText.includes("## 6. Owner-decision gap closure (#796 follow-up)"));
  const originalGroups = taskText.slice(0, taskText.indexOf("## 6. "));
  assert.doesNotMatch(originalGroups, /^- \[ \] [1-5]\.\d+ /m);
}

function assertInvariants(value, taskText) {
  assertFollowUpRelations(value, taskText);
  assert.deepEqual(value.implementation_invariant_ids, invariantIds);
  for (const id of invariantIds) {
    const evidence = value.invariant_evidence[id];
    assert.ok(evidence.task_ids.length > 0);
    assert.ok(evidence.evidence_ids.length > 0);
    for (const task of evidence.task_ids) {
      assert.match(taskText, new RegExp(`^- \\[.\\] ${task.replace(".", "\\.")} `, "m"));
    }
  }
  for (const task of value.verification_task_ids) {
    assert.match(taskText, new RegExp(`^- \\[.\\] ${task.replace(".", "\\.")} `, "m"));
  }
}

function assertScenarios(specText) {
  for (const method of ["eventId", "operationId", "correlationId", "causationId", "requestId", "messageId", "transactionId"]) {
    assert.ok(specText.includes(method), method);
  }
  for (const mode of ["Implicit", "Explicit system"]) {
    for (const absence of ["absent crypto", "missing randomUUID", "non-function randomUUID"]) {
      assert.ok(specText.includes(`#### Scenario: ${mode} default rejects ${absence}`));
    }
  }
  assert.ok(specText.includes("#### Scenario: Concurrent fresh processes do not repeat a default sequence"));
  assert.ok(specText.includes("#### Scenario: Deterministic custom provider works without crypto"));
  assertBehavioralScope(specText);
}

test("issue #796 planning owns the full security-sensitive scope and every task/evidence relation", () => {
  assertPlanningContract(assessment, tasks, spec);
});

test("planning controls reject weakened classification, missing ownership and missing evidence", () => {
  for (const mutate of [
    (value) => { value.assessment_level = "abbreviated"; },
    (value) => { value.security_sensitive = false; },
    (value) => { value.owned_paths = value.owned_paths.filter((path) => !path.endsWith("src/providers.ts")); },
    (value) => { value.owned_paths = value.owned_paths.filter((path) => !path.endsWith("scripts/check-scope.mjs")); },
    (value) => { value.ordering.proposal_baseline_commit = "0".repeat(40); },
    (value) => { delete value.invariant_evidence["implementation-custom-provider-independence"]; },
  ]) {
    const mutated = structuredClone(assessment);
    mutate(mutated);
    assert.throws(() => assertPlanningContract(mutated, tasks, spec));
  }
});

const planningMutations = [
  ["candidate approaches", assertCandidateApproaches, [
    ["missing direct implementation", (value) => { value.candidate_approaches = value.candidate_approaches.filter((candidate) => candidate.kind !== "direct_implementation"); }],
    ["missing alternative", (value) => { value.candidate_approaches = value.candidate_approaches.filter((candidate) => candidate.kind !== "alternative"); }],
    ["unknown candidate force", (value) => { value.candidate_approaches[0].forces_addressed.push("unknown force"); }],
  ]],
  ["alternative rejections", assertAlternativeRejections, [
    ["no rejected alternatives", (value) => { value.rejected_alternative_ids = []; }],
    ["selected approach rejected", (value) => { value.rejected_alternative_ids.push(value.selected_approach_id); }],
    ["unknown rejected candidate", (value) => { value.rejected_alternative_ids.push("unknown candidate"); }],
    ["missing rejection evidence", (value) => { delete value.rejection_reasons[value.rejected_alternative_ids[0]]; }],
    ["short rejection reason", (value) => { value.rejection_reasons[value.rejected_alternative_ids[0]].reason = "too short"; }],
    ["unknown rejection force", (value) => { value.rejection_reasons[value.rejected_alternative_ids[0]].forces.push("unknown force"); }],
  ]],
  ["owned paths", assertOwnedPaths, [
    ...requiredSdkPaths.map((path) => [`missing ${path}`, (value) => { value.owned_paths = value.owned_paths.filter((owned) => owned !== path); }]),
    ["out-of-scope SDK path", (value) => { value.owned_paths.push("packages/security-audit-sdk-core/src/index.ts"); }],
    ["another change's path", (value) => { value.owned_paths.push("openspec/changes/unowned/tasks.md"); }],
  ]],
  ["invariants", (value) => assertInvariants(value, tasks), [
    ["missing invariant ID", (value) => { value.implementation_invariant_ids.pop(); }],
    ["missing invariant evidence", (value) => { delete value.invariant_evidence[invariantIds[0]]; }],
    ["absent task relation", (value) => { value.invariant_evidence[invariantIds[0]].task_ids = []; }],
    ["absent evidence relation", (value) => { value.invariant_evidence[invariantIds[0]].evidence_ids = []; }],
    ["unknown invariant task", (value) => { value.invariant_evidence[invariantIds[0]].task_ids.push("9.9"); }],
    ["unknown verification task", (value) => { value.verification_task_ids.push("9.9"); }],
  ]],
];

for (const [group, validate, mutations] of planningMutations) {
  test(`${group} accepts the owning assessment`, () => validate(assessment));
  for (const [name, mutate] of mutations) {
    test(`${group} rejects ${name}`, () => {
      const mutated = structuredClone(assessment);
      mutate(mutated);
      assert.throws(() => validate(mutated));
      assert.throws(() => assertPlanningContract(mutated, tasks, spec));
    });
  }
}

for (const id of invariantIds) {
  test(`invariants reject an absent task/evidence relation for ${id}`, () => {
    const mutated = structuredClone(assessment);
    mutated.invariant_evidence[id].evidence_ids = [];
    assert.throws(() => assertInvariants(mutated, tasks));
    const taskId = assessment.invariant_evidence[id].task_ids[0];
    const missingTask = tasks.replace(`] ${taskId} `, "] omitted ");
    assert.throws(() => assertInvariants(assessment, missingTask));
  });
}

const preservedBehaviorTexts = [
  "### Requirement: System default identifiers use host cryptographic UUID v4 randomness",
  "### Requirement: System identifier construction fails closed without cryptographic UUID support",
  "### Requirement: Custom identifiers remain host-independent and caller-owned",
  "### Requirement: Platform capabilities are mediated by provider SPIs",
  "#### Scenario: All seven system methods generate cryptographic identifiers",
  "#### Scenario: Collision resistance is not absolute lifetime-global uniqueness",
  "#### Scenario: Custom platform provider supplies IDs and clock",
  "#### Scenario: Byte length SPI measures payload bounds without Node Buffer",
  "#### Scenario: Timer SPI manages shutdown timeouts with optional unref capability",
  "#### Scenario: Schema runtime SPI validates canonical event structures",
  "#### Scenario: Host crypto is admitted only in providers",
  "#### Scenario: Crypto outside the provider boundary remains forbidden",
  "uniqueness remains probabilistic rather than absolute",
  "only through a providers-only coupling-policy declaration",
];

function assertBehavioralScope(specText) {
  assert.equal(specText.includes(processRequirement), false);
  assert.equal(specText.includes(processScenario), false);
  for (const text of preservedBehaviorTexts) assert.ok(specText.includes(text), text);
}

const requiredSpecTexts = [
  ...preservedBehaviorTexts,
  "eventId", "operationId", "correlationId", "causationId", "requestId", "messageId", "transactionId",
  ...["Implicit", "Explicit system"].flatMap((mode) =>
    ["absent crypto", "missing randomUUID", "non-function randomUUID"].map((absence) =>
      `#### Scenario: ${mode} default rejects ${absence}`)),
  "#### Scenario: Concurrent fresh processes do not repeat a default sequence",
  "#### Scenario: Deterministic custom provider works without crypto",
];

test("scenarios accept the owning specification", () => assertScenarios(spec));
for (const text of requiredSpecTexts) {
  test(`scenarios reject missing ${text}`, () => {
    const missingText = spec.replaceAll(text, "omitted");
    assert.throws(() => assertScenarios(missingText));
    assert.throws(() => assertPlanningContract(assessment, tasks, missingText));
  });
}

const ownerDecisionRows = [
  "| A | Keep a secure DEFAULT identifier provider. Do not make an explicit provider mandatory. |",
  "| B | Source is host Web Crypto `crypto.randomUUID()`, with a coupling declared for `src/providers.ts` only. Rejected alternatives: a `node:crypto` import, `crypto.getRandomValues` with hand formatting, and Math.random, time, PID or any seeded fallback. |",
  "| C | Fail closed at construction for both the implicit default and an explicit `systemAuditIdentifiers`, with `SDK_INVALID_CONFIGURATION` / `configuration` / `/identifiers`. The check never invokes an identifier method. Custom providers stay host-independent. Rejected: failing lazily at the first ID. |",
  "| D | Classify as `fix(sdk-core)`, non-breaking. API.md and MIGRATION.md record the host requirement and the injection alternative. |",
  "| E | The guarantee is probabilistic collision resistance: 122 CSPRNG bits per UUID v4. Never claim absolute uniqueness. |",
  "| G | Commit a re-runnable negative control. A prose record of a one-off disposable-copy run is not evidence. |",
];
const proposalScopeTexts = [
  processRequirement, processScenario, "`test:changed-paths`", "`test:scope`",
  "`test:contract-immutability`", "the governance gate", "`test:coherence`",
  "`MIGRATION.md`", "`CONTEXT.md`", "`tests/cross-process-harness.ts`",
  "`tests/cross-process-identifiers-negative-control.test.ts`", "13", "001 through 013",
];
const designControlTexts = [
  "The assessment is technical design evidence, not owner authorization or signed review.",
  "`tests/cross-process-harness.ts`", "`tests/cross-process-identifiers-negative-control.test.ts`",
  "old seeded identifier provider repeats event and operation sequences across concurrent fresh processes",
  "`findRepeatedIdentifiers(results)`", "`0x9e3779b9`", "Mulberry32",
  "`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`", "frozen-contract event.id",
  "negative control must FAIL", "Restore exact source bytes", "never\ncommit the mutation",
  "historical disposable evidence is not a substitute",
];

function assertOwnerDecisions(text) {
  assert.ok(text.includes(ownerSource));
  for (const row of ownerDecisionRows) assert.ok(text.includes(row), row);
  assert.doesNotMatch(text, /^\| F \|/m);
  assert.match(text, /"Approved desired behavior" predated any\s+owner decision/);
}

function assertProposalScope(text) {
  assertOwnerDecisions(text);
  const scope = text.split("## Scope and Non-goals\n")[1].split("## Owner decisions\n")[0];
  for (const phrase of proposalScopeTexts.slice(0, 7)) assert.ok(scope.includes(phrase), phrase);
  for (const phrase of proposalScopeTexts) assert.ok(text.includes(phrase), phrase);
}

function assertFollowUpDesign(text) {
  assertOwnerDecisions(text);
  for (const phrase of designControlTexts) assert.ok(text.includes(phrase), phrase);
}

const ownerDocumentControls = [
  ["proposal", proposal, assertProposalScope, [ownerSource, ...ownerDecisionRows, ...proposalScopeTexts]],
  ["design", design, assertFollowUpDesign, [ownerSource, ...ownerDecisionRows, ...designControlTexts]],
];
for (const [name, text, validate, phrases] of ownerDocumentControls) {
  test(`${name} preserves owner provenance, decisions and follow-up scope`, () => validate(text));
  for (const phrase of phrases) {
    test(`${name} rejects missing ${phrase}`, () => {
      assert.throws(() => validate(text.replaceAll(phrase, "omitted")));
    });
  }
  test(`${name} rejects invented decision F and misattributed earlier brief`, () => {
    assert.throws(() => validate(`${text}\n| F | invented |\n`));
    assert.throws(() => validate(text.replace("predated any", "recorded an")));
  });
}

for (const [id, taskIds] of Object.entries(requiredInvariantTasks)) {
  for (const taskId of taskIds) {
    test(`invariants reject missing ${id} task ${taskId}`, () => {
      const mutated = structuredClone(assessment);
      const evidence = mutated.invariant_evidence[id];
      evidence.task_ids = evidence.task_ids.filter((task) => task !== taskId);
      assert.throws(() => assertPlanningContract(mutated, tasks, spec));
    });
  }
}
for (const taskId of requiredVerificationTasks) {
  test(`verification rejects missing task ${taskId}`, () => {
    const mutated = structuredClone(assessment);
    mutated.verification_task_ids = mutated.verification_task_ids.filter((task) => task !== taskId);
    assert.throws(() => assertPlanningContract(mutated, tasks, spec));
  });
}
const controlEvidenceMutations = [
  ["missing committed control", (evidence) => evidence.filter((text) => text !== committedControl)],
  ["disposable-only control", (evidence) => evidence.map((text) => text === committedControl ? "disposable-copy old-seed control" : text)],
  ["additional disposable control", (evidence) => [...evidence, "disposable-copy old-seed control"]],
];
for (const [name, mutate] of controlEvidenceMutations) {
  test(`host UUID evidence rejects ${name}`, () => {
    const mutated = structuredClone(assessment);
    const evidence = mutated.invariant_evidence["implementation-host-uuid-generation"];
    evidence.evidence_ids = mutate(evidence.evidence_ids);
    assert.throws(() => assertPlanningContract(mutated, tasks, spec));
  });
}
for (const text of [processRequirement, processScenario]) {
  test(`spec rejects reintroduced ${text}`, () => {
    assert.throws(() => assertPlanningContract(assessment, tasks, `${spec}\n### Requirement: ${text}\n`));
  });
}
for (const taskId of followUpTasks) {
  test(`follow-up tasks reject missing task text ${taskId}`, () => {
    assert.throws(() => assertPlanningContract(assessment, tasks.replace(`] ${taskId} `, "] omitted "), spec));
  });
}
test("follow-up completion rejects skipping an unfinished predecessor", () => {
  const skipped = tasks.replace(/\[[ x]\] 6\.2 /, "[ ] 6.2 ").replace(/\[[ x]\] 6\.3 /, "[x] 6.3 ");
  assert.throws(() => assertPlanningContract(assessment, skipped, spec));
});

test("task groups reject missing, out-of-order or reopened historical groups", () => {
  assert.throws(() => assertTaskGroupOrder(tasks.replace("## 6. Owner-decision gap closure (#796 follow-up)", "## omitted")));
  assert.throws(() => assertTaskGroupOrder(tasks.replace("## 5. ", "## 6. ").replace("## 6. Owner-decision", "## 5. Owner-decision")));
  assert.throws(() => assertTaskGroupOrder(tasks.replace("[x] 5.1", "[ ] 5.1")));
});

test("ADR coherence accepts exactly 001 through 013 and rejects missing, duplicate or extra entries", () => {
  const packageRoot = new URL("../../../packages/security-audit-sdk-core/", import.meta.url);
  const gate = readFileSync(new URL("scripts/check-coherence.mjs", packageRoot), "utf8");
  const rules = gate.split("\n").filter((line) => /^rule\("adr-(count|sequence)"/.test(line));
  assert.equal(rules.length, 2);
  for (const rule of rules) assert.ok(rule.includes("ADR-SDK-013"), "diagnostic must name the final ADR");
  // Execute the actual two gate rules in isolation, without copying or mutating the repository.
  const evaluate = new Function("adrFiles", "rule", "same", rules.join("\n"));
  const files = readdirSync(new URL("adr/", packageRoot)).filter((name) => /^\d{3}-.+\.md$/.test(name)).sort();
  function failures(entries) {
    const failed = [];
    evaluate(entries, (id, _file, condition) => { if (!condition) failed.push(id); },
      (left, right) => JSON.stringify(left) === JSON.stringify(right));
    return failed;
  }
  assert.deepEqual(failures(files), []);
  assert.deepEqual(failures(files.slice(0, -1)), ["adr-count", "adr-sequence"]);
  assert.deepEqual(failures([...files.slice(0, -1), "012-duplicate.md"]), ["adr-sequence"]);
  assert.deepEqual(failures([...files, "014-extra.md"]), ["adr-count", "adr-sequence"]);
});

function assertIdentifierDocumentation(api, adr) {
  assert.match(adr, /^# ADR-SDK-013:/);
  assert.ok(adr.includes("Status: Accepted for SDK-core implementation"));
  for (const text of [api, adr]) {
    for (const method of ["eventId", "operationId", "correlationId", "causationId", "requestId", "messageId", "transactionId"]) {
      assert.ok(text.includes(`\`${method}\``), method);
    }
    for (const phrase of ["crypto.randomUUID", "lowercase RFC 4122 UUID v4", "collision", "probabilistic", "lifetime-global", "SDK_INVALID_CONFIGURATION", "configuration", "/identifiers", "custom", "receiver"]) {
      assert.ok(text.toLowerCase().includes(phrase.toLowerCase()), phrase);
    }
  }
  assert.ok(api.includes("explicitly passing `systemAuditIdentifiers`"));
  assert.ok(api.includes("custom injected provider requires no host crypto capability"));
  assert.ok(api.includes("Construction checks availability but generates no identifiers"));
  assert.ok(api.includes("bounded reuse detection"));
  assert.ok(adr.includes("runtime dependencies remain zero"));
  assert.ok(adr.includes("Insecure fallbacks are forbidden"));
}

test("API and accepted ADR describe cryptographic defaults without an absolute uniqueness guarantee", () => {
  const packageRoot = new URL("../../../packages/security-audit-sdk-core/", import.meta.url);
  const api = readFileSync(new URL("API.md", packageRoot), "utf8");
  const adr = readFileSync(new URL("adr/013-default-identifier-cryptographic-uniqueness.md", packageRoot), "utf8");
  assertIdentifierDocumentation(api, adr);
  for (const phrase of ["/identifiers", "probabilistic", "explicitly passing `systemAuditIdentifiers`", "custom injected provider requires no host crypto capability"]) {
    assert.throws(() => assertIdentifierDocumentation(api.replaceAll(phrase, "omitted"), adr));
  }
  assert.throws(() => assertIdentifierDocumentation(api, adr.replace("Status: Accepted for SDK-core implementation", "Status: Proposed")));
});

const packageRoot = new URL("../../../packages/security-audit-sdk-core/", import.meta.url);
const migration = readFileSync(new URL("MIGRATION.md", packageRoot), "utf8");
const glossary = readFileSync(new URL("CONTEXT.md", packageRoot), "utf8");
const identifierAdr = readFileSync(new URL("adr/013-default-identifier-cryptographic-uniqueness.md", packageRoot), "utf8");
const migrationPhrases = [
  "non-breaking `fix(sdk-core)`", "the secure default remains available",
  "an explicit provider is not mandatory", "same sequence in every process",
  "host Web Crypto `crypto.randomUUID()`", "122 CSPRNG bits", "probabilistic collision resistance",
  "across producers, processes, restarts and identifier kinds", "not absolute uniqueness",
  "`identifiers` is omitted or `systemAuditIdentifiers` is explicitly passed",
  "callable `crypto.randomUUID` at construction", "retain it for subsequent generation",
  "construction throws `SecurityAuditSdkError`", "code `SDK_INVALID_CONFIGURATION`",
  "category `configuration`", "path `/identifiers`", "before readiness or sink emission",
  "without invoking any identifier method", "Both supported Node majors, 24 and 26, supply this capability",
  "inject an `AuditIdentifierProvider` at initialization", "Custom providers remain host-independent",
  "construction neither probes host crypto nor invokes their methods", "no insecure fallback",
];
const glossaryEntries = [
  ["Default identifier provider", ["`systemAuditIdentifiers`", "used when `identifiers` is omitted"]],
  ["Host cryptographic capability", ["host Web Crypto `crypto.randomUUID`", "a Declared coupling",
    "admitted only to `src/providers.ts`", "by the platform-coupling policy", "never a `node:` import"]],
  ["Collision resistance", ["probabilistic", "122 CSPRNG bits per UUID v4",
    "across producers, processes, restarts and identifier kinds", "not absolute uniqueness",
    "not authentication", "not a fraud signal"]],
];
const adrFollowUpPhrases = [
  ownerSource, "Status: Accepted for SDK-core implementation", "122 CSPRNG bits per UUID v4",
  "Importing `node:crypto` was rejected", "violating the portable-core host import policy",
  "mandatory injection", "unnecessary consumer burden despite the secure default",
  "`crypto.getRandomValues` with hand formatting was rejected",
  "unnecessary custom UUID implementation when `crypto.randomUUID` exists",
  "Failing lazily at the first ID was rejected", "too late versus construction fail-closed",
  "`tests/cross-process-identifiers-negative-control.test.ts`",
  "old seeded identifier provider repeats event and operation sequences across concurrent fresh processes",
  "test-only old-seed replica as a custom provider", "`tests/cross-process-harness.ts`",
  "`findRepeatedIdentifiers(results)`", "frozen event.id pattern", "identical fresh-process sequences",
  "requires detected collisions", "shared finder return `[]`", "must fail at its non-empty collision assertion",
  "exact source bytes must be restored and both suites rerun", "never commit the mutation",
  "Historical disposable-copy results alone do not prove this committed control's sensitivity",
];

function assertRequiredPhrases(text, phrases) {
  for (const phrase of phrases) assert.ok(text.includes(phrase), phrase);
}

function assertIdentifierMigration(text) {
  const entry = text.split("## Default identifier correctness fix\n")[1];
  assert.ok(entry, "bounded default-identifier migration entry required");
  const section = entry.split("\n## ")[0];
  assertRequiredPhrases(section, migrationPhrases);
  const versions = section.match(/\b\d+\.\d+\.\d+\b/g) ?? [];
  for (const version of versions) assert.equal(version, "2.1.0", "no obsolete contract version in new entry");
}

function assertIdentifierGlossary(text) {
  const lines = text.split("\n");
  for (const [term, phrases] of glossaryEntries) {
    const prefix = `- **${term}:** `;
    const entries = lines.filter((line) => line.startsWith(prefix));
    assert.equal(entries.length, 1, `exactly one glossary bullet for ${term}`);
    assertRequiredPhrases(entries[0], phrases);
  }
}

function assertIdentifierAdrFollowUp(text) {
  assert.match(text, /^# ADR-SDK-013:/);
  assertRequiredPhrases(text, adrFollowUpPhrases);
  assert.doesNotMatch(text, /A disposable old-seed negative control reaches and fails/);
}

const glossaryPhrases = glossaryEntries.flatMap(([term, phrases]) => [`- **${term}:** `, ...phrases]);
const consumerDocumentControls = [
  ["migration", migration, assertIdentifierMigration, ["## Default identifier correctness fix\n", ...migrationPhrases]],
  ["glossary", glossary, assertIdentifierGlossary, glossaryPhrases],
  ["ADR follow-up", identifierAdr, assertIdentifierAdrFollowUp, ["# ADR-SDK-013:", ...adrFollowUpPhrases]],
];
for (const [name, text, validate, phrases] of consumerDocumentControls) {
  test(`${name} preserves host capability, probabilistic guarantee and owner-decision migration`, () => validate(text));
  for (const phrase of new Set(phrases)) {
    test(`${name} rejects omitted ${phrase}`, () => {
      assert.throws(() => validate(text.replaceAll(phrase, "omitted")));
    });
  }
}

test("migration rejects obsolete contract versions and guarantees moved outside its bounded entry", () => {
  assert.throws(() => assertIdentifierMigration(migration.replace("## Default identifier correctness fix\n",
    "## Default identifier correctness fix\n\nContract `1.0.0`.\n")));
  assert.throws(() => assertIdentifierMigration(migration.replace("no insecure fallback", "omitted")
    + "\nno insecure fallback\n"));
});

test("glossary rejects duplicate entries, other bullet styles and cross-entry phrase substitution", () => {
  assert.throws(() => assertIdentifierGlossary(`${glossary}\n- **Default identifier provider:** duplicate\n`));
  assert.throws(() => assertIdentifierGlossary(glossary.replace("- **Host cryptographic capability:**", "* **Host cryptographic capability:**")));
  assert.throws(() => assertIdentifierGlossary(glossary.replace("never a `node:` import", "omitted")
    + "\nnever a `node:` import\n"));
});

test("ADR follow-up rejects disposable-only current verification", () => {
  assert.throws(() => assertIdentifierAdrFollowUp(`${identifierAdr}\nA disposable old-seed negative control reaches and fails the collision assertion.\n`));
});

const ts = createRequire(new URL("package.json", packageRoot))("typescript");
const branchKinds = new Set([
  ts.SyntaxKind.IfStatement, ts.SyntaxKind.SwitchStatement, ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement, ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CatchClause, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function descendants(node) {
  const nodes = [node];
  ts.forEachChild(node, (child) => { nodes.push(...descendants(child)); });
  return nodes;
}

function parseSource(url) {
  return ts.createSourceFile(url.pathname, readFileSync(url, "utf8"), ts.ScriptTarget.Latest, true);
}

function assertStraightLine(body) {
  assert.deepEqual(descendants(body).filter((node) => branchKinds.has(node.kind)), []);
}

test("planning orchestration stays branch-free with all five private delegations", () => {
  const source = parseSource(new URL("./assessment.test.mjs", import.meta.url));
  const planning = source.statements.find((node) => node.name?.text === "assertPlanningContract");
  assertStraightLine(planning.body);
  const calls = descendants(planning.body).filter(ts.isCallExpression).map((node) => node.expression.getText(source));
  for (const name of ["assertCandidateApproaches", "assertAlternativeRejections", "assertOwnedPaths", "assertInvariants", "assertScenarios"]) {
    assert.ok(calls.includes(name), name);
  }
});

const positiveTestName = "default SDK event and operation identifiers are unique across concurrent fresh processes";
const negativeTestName = "old seeded identifier provider repeats event and operation sequences across concurrent fresh processes";
const sharedHarnessFunctions = [
  "runConcurrentChild", "buildIdentifierSamplingScript", "parseChildRecord",
  "validateIdentifierSamples", "parseAndValidateChildResult", "findRepeatedIdentifiers",
];
const orchestrationFunctions = [
  "runConcurrentChild", "buildIdentifierSamplingScript", "parseAndValidateChildResult", "findRepeatedIdentifiers",
];

function parseTestText(text) {
  return ts.createSourceFile("control.ts", text, ts.ScriptTarget.Latest, true);
}

function assertSharedHarnessImport(source) {
  const imports = source.statements.filter(ts.isImportDeclaration);
  const shared = imports.find((node) => node.moduleSpecifier.text === "./cross-process-harness.js");
  assert.ok(shared, "shared harness import required");
  const names = shared.importClause.namedBindings.elements.map((node) => node.name.text);
  for (const name of orchestrationFunctions) assert.ok(names.includes(name), name);
  const declarations = source.statements.filter(ts.isFunctionDeclaration).map((node) => node.name.text);
  for (const name of sharedHarnessFunctions) assert.ok(!declarations.includes(name), `duplicate ${name}`);
}

function assertCrossProcessOrchestration(source, name) {
  assertSharedHarnessImport(source);
  const call = descendants(source).find((node) => ts.isCallExpression(node)
    && node.arguments[0]?.text === name);
  assert.ok(call, name);
  const body = call.arguments[1].body;
  const lines = body.getText(source).slice(1, -1).split("\n").length - 2;
  assert.ok(lines < 35, `${lines} physical interior lines`);
  assertStraightLine(body);
  assert.equal(descendants(body).some(ts.isTemplateExpression), false);
  const calls = descendants(body).filter(ts.isCallExpression).map((node) => node.expression.getText(source));
  for (const helper of [...orchestrationFunctions, "Promise.allSettled"]) assert.ok(calls.includes(helper), helper);
}

function assertExportedHarnessFunctions(source) {
  for (const name of sharedHarnessFunctions) {
    const declaration = source.statements.find((node) => node.name?.text === name);
    assert.ok(declaration, name);
    assert.ok(declaration.modifiers.some((node) => node.kind === ts.SyntaxKind.ExportKeyword), name);
    const lines = declaration.getText(source).split("\n").length;
    assert.ok(lines <= 70, `${name}: ${lines} physical lines`);
  }
}

const crossProcessStructures = [
  ["tests/cross-process-identifiers.test.ts", positiveTestName],
  ["tests/cross-process-identifiers-negative-control.test.ts", negativeTestName],
];

for (const [path, name] of crossProcessStructures) {
  test(`${path} orchestration stays below 35 body lines without branches or an inline program`, () => {
    assertCrossProcessOrchestration(parseSource(new URL(path, packageRoot)), name);
  });
  test(`${path} structural controls reject absent shared imports, collision calls and branchful orchestration`, () => {
    const text = readFileSync(new URL(path, packageRoot), "utf8");
    assert.throws(() => assertCrossProcessOrchestration(parseTestText(text.replace("./cross-process-harness.js", "./different.js")), name));
    assert.throws(() => assertCrossProcessOrchestration(parseTestText(text.replace("findRepeatedIdentifiers(results)", "[]")), name));
    assert.throws(() => assertCrossProcessOrchestration(parseTestText(text.replace("const sampleCount = 128;", "if (true) work();")), name));
    assert.throws(() => assertCrossProcessOrchestration(parseTestText(text.replace("const sampleCount = 128;", "const program = `inline ${value}`;")), name));
    assert.throws(() => assertCrossProcessOrchestration(parseTestText(text.replace("const sampleCount = 128;", "\n".repeat(35))), name));
    assert.throws(() => assertCrossProcessOrchestration(parseTestText(`${text}\nfunction parseAndValidateChildResult() {}`), name));
  });
}

test("shared harness exports all moved helpers within 70 physical lines and rejects missing/private declarations", () => {
  const text = readFileSync(new URL("tests/cross-process-harness.ts", packageRoot), "utf8");
  assertExportedHarnessFunctions(parseTestText(text));
  for (const name of sharedHarnessFunctions) {
    assert.throws(() => assertExportedHarnessFunctions(parseTestText(text.replace(`export function ${name}`, `function ${name}`))));
    assert.throws(() => assertExportedHarnessFunctions(parseTestText(text.replace(`export function ${name}`, `export function omitted${name}`))));
  }
  assert.throws(() => assertExportedHarnessFunctions(parseTestText(text.replace("const seen =", `${"\n".repeat(70)}const seen =`))));
});

test("provider capability remains private and resolveProviders delegates its host check", () => {
  const source = parseSource(new URL("src/providers.ts", packageRoot));
  const predicate = source.statements.find((node) => node.name?.text === "hasCryptographicUuidSupport");
  assert.ok(predicate);
  assert.equal(predicate.modifiers?.some((node) => node.kind === ts.SyntaxKind.ExportKeyword) ?? false, false);
  const resolver = source.statements.find((node) => node.name?.text === "resolveProviders");
  assert.ok(descendants(resolver).some((node) => ts.isIfStatement(node)
    && node.expression.getText(source) === "!hasCryptographicUuidSupport()"));
  assert.equal(descendants(resolver).some((node) => ts.isIdentifier(node) && node.text === "crypto"), false);
});

test("straight-line structural control rejects branches, loops and logical conditions", () => {
  for (const text of ["if (x) work();", "for (;;) work();", "x ? work() : stop();", "x && work();", "x || work();"]) {
    const source = ts.createSourceFile("control.ts", text, ts.ScriptTarget.Latest, true);
    assert.throws(() => assertStraightLine(source));
  }
});

test("planning controls reject an absent verification task or default-failure scenario", () => {
  assert.throws(() => assertPlanningContract(assessment, tasks.replace(/- \[.\] 2\.2 /, "- omitted "), spec));
  assert.throws(() => assertPlanningContract(assessment, tasks, spec.replace(
    "#### Scenario: Explicit system default rejects non-function randomUUID", "#### Scenario: omitted",
  )));
});
