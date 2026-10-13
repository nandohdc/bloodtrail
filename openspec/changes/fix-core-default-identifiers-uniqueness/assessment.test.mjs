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
const requiredSdkPaths = [
  "src/providers.ts",
  "scripts/platform-coupling-policy.mjs",
  "scripts/check-scope.mjs",
  "tests/verification/platform-coupling-mutations.test.mjs",
  "tests/cross-process-identifiers.test.ts",
  "API.md",
  "adr/013-default-identifier-cryptographic-uniqueness.md",
  "scripts/check-coherence.mjs",
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

function assertInvariants(value, taskText) {
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

const requiredSpecTexts = [
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

test("cross-process orchestration stays below 35 body lines without branches or an inline program", () => {
  const source = parseSource(new URL("tests/cross-process-identifiers.test.ts", packageRoot));
  const call = descendants(source).find((node) => ts.isCallExpression(node)
    && node.arguments[0]?.text === "default SDK event and operation identifiers are unique across concurrent fresh processes");
  const body = call.arguments[1].body;
  const lines = body.getText(source).slice(1, -1).split("\n").length - 2;
  assert.ok(lines < 35, `${lines} physical interior lines`);
  assertStraightLine(body);
  assert.equal(descendants(body).some(ts.isTemplateExpression), false);
  assert.ok(source.statements.some((node) => node.name?.text === "parseAndValidateChildResult"));
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
