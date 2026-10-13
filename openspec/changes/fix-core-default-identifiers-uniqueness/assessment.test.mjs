// Planning and documentation regression controls for issue #796; no SDK behavior is implemented here.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
  assert.ok(value.candidate_approaches.some((candidate) => candidate.kind === "direct_implementation"));
  assert.ok(value.candidate_approaches.some((candidate) => candidate.kind === "alternative"));
  assert.ok(value.rejected_alternative_ids.length > 0);
  for (const candidate of value.candidate_approaches) {
    for (const force of candidate.forces_addressed) assert.ok(value.forces.includes(force));
  }
  for (const id of value.rejected_alternative_ids) {
    assert.notEqual(id, value.selected_approach_id);
    assert.ok(value.candidate_approaches.some((candidate) => candidate.id === id));
    const rejection = value.rejection_reasons[id];
    assert.ok(rejection.reason.length >= 40);
    for (const force of rejection.forces) assert.ok(value.forces.includes(force));
  }
  for (const path of requiredSdkPaths) assert.ok(value.owned_paths.includes(path), path);
  for (const path of value.owned_paths) {
    assert.ok(path.startsWith(changeRoot) || requiredSdkPaths.includes(path), path);
  }
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

test("planning controls reject an absent verification task or default-failure scenario", () => {
  assert.throws(() => assertPlanningContract(assessment, tasks.replace(/- \[.\] 2\.2 /, "- omitted "), spec));
  assert.throws(() => assertPlanningContract(assessment, tasks, spec.replace(
    "#### Scenario: Explicit system default rejects non-function randomUUID", "#### Scenario: omitted",
  )));
});
