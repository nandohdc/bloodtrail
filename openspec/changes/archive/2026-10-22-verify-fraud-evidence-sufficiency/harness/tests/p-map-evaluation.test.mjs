import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { validateExpectations } from "../p-map/expectations-validate.mjs";
import { EMISSION_ORACLE, evaluationFixture } from "./p-map-evaluation-fixtures.mjs";
import { SIGNAL_ORACLE } from "./p-map-evaluation-oracle.mjs";
import { assertOracle } from "./p-map-lm-oracle.mjs";

const fixture = await evaluationFixture();
function row(result, id) { return result.evaluations.find((entry) => entry.case_id === id); }
function verdict(result, id) { return result.verdicts.find((entry) => entry.case_id === id); }
function record(input, id) { return input.observations.flatMap((process) => process.records).find((entry) => entry?.step_id === id); }

export { fixture, row, verdict, record };

test("P-map total evaluator matches a hand-written complete fixture plan and independent per-family oracles", () => {
  assert.doesNotThrow(() => validateExpectations(fixture.expectations));
  const result = evaluateProbe(fixture);
  assert.deepEqual(result.notes, []);
  assert.equal(result.evaluations.length, 39);
  for (const entry of result.evaluations) assert.equal(entry.matched, true, `${entry.case_id}: ${entry.mismatches}`);
  for (const oracle of EMISSION_ORACLE) assertOracle(record(fixture, oracle.step_id), oracle);
  for (const family of ["L", "M", "C", "K", "U", "R"]) {
    const ids = new Set(EMISSION_ORACLE.filter((entry) => entry.step_id.startsWith(family)).map((entry) => entry.step_id.split("/")[0]));
    assert(ids.size >= 2, `${family}: independently cited cases`);
  }
  for (const expected of SIGNAL_ORACLE) {
    const actual = verdict(result, expected.id);
    assert.equal(actual.verdict, expected.verdict, expected.clause);
    assert.equal(actual.rubric_basis, "#804 comment 6137646538 rubric");
    assert.equal(typeof actual.rubric_clause, "string");
    assert.deepEqual(actual.components.map((part) => part.best_candidate), expected.best);
    assert.equal(actual.findings.observed[expected.finding[0]], expected.finding[1]);
    for (const part of actual.components) for (const candidate of part.candidates) assert(candidate.basis.length > 0);
  }
  assert.equal(verdict(result, "S-CRIT2").verdict, "PASS");
  assert.equal(verdict(result, "S-CRIT2").conditional, true);
});

const MUTATIONS = [
  { id: "L1/not-applicable", field: "signal", key: "actor_matches_subject", value: false, affected: "S-LOGOUT" },
  { id: "M1/tenantless", field: "signal", key: "subject_present", value: true, affected: "S-MFA" },
  { id: "C1/email", field: "signal", key: "resource_type", value: "security_configuration", affected: "S-CONTACT" },
  { id: "X1/spread", field: "diagnostic", key: "code", value: "DUPLICATE_AUTHORITY" },
  { id: "K2a/policy", field: "signal", key: "authorization_decision", value: "deny", affected: "S-LOCK" },
  { id: "U1/administrator", field: "occurrence", key: "commit_state", value: "compensated", affected: "S-UNLOCK" },
  { id: "R2/pair-completed", field: "causality", key: "causation_matches_original", value: false, affected: "S-ROTATE" },
];
for (const mutation of MUTATIONS) test(`P-map negative ${mutation.id} remains local and cannot support an honest fit`, () => {
  const input = structuredClone(fixture);
  record(input, mutation.id)[mutation.field][mutation.key] = mutation.value;
  const result = evaluateProbe(input);
  const actual = row(result, mutation.id.split("/")[0]);
  assert.equal(actual.matched, false);
  assert(actual.raw.some((entry) => entry.step_id === mutation.id));
  const unaffected = SIGNAL_ORACLE.filter((entry) => entry.id !== mutation.affected);
  for (const expected of unaffected) assert.equal(verdict(result, expected.id).verdict, expected.verdict);
  if (mutation.affected !== undefined) assert.equal(verdict(result, mutation.affected).verdict, null);
});

test("P-map inconclusive C5 affects contact and rotation only, not unrelated signals", () => {
  const input = structuredClone(fixture);
  record(input, "C5/enrolled").replacement.shared_transaction_id = false;
  const result = evaluateProbe(input);
  for (const id of ["S-CONTACT", "S-ROTATE"]) assert.equal(verdict(result, id).verdict, null);
  for (const expected of SIGNAL_ORACLE.filter((entry) => !["S-CONTACT", "S-ROTATE"].includes(entry.id))) {
    assert.equal(verdict(result, expected.id).verdict, expected.verdict);
  }
});

test("P-map accepted semantic negatives never become FITS and unrelated construction mismatch does not null verdicts", () => {
  const input = structuredClone(fixture);
  record(input, "L5a/denied-no-handle").diagnostic.path = "/event/commit_state";
  const result = evaluateProbe(input);
  assert.equal(row(result, "L5a").matched, false);
  assert.equal(verdict(result, "S-CRIT2").verdict, "PASS");
  for (const id of ["L4", "M2", "M3", "C3", "C4", "K1", "K2b", "K3", "K4", "U2", "R3", "R5b"]) {
    assert.equal(row(result, id).candidate_verdict, "MISREPRESENTS");
  }
});

test("P-map derived finding mismatch is local to its aggregate", () => {
  const input = structuredClone(fixture);
  const plan = input.expectations.cases.find((entry) => entry.case_id === "S-MFA");
  plan.expected.assertions.find((rule) => rule.path === "findings.observed.subject_present").value = true;
  const result = evaluateProbe(input);
  assert.equal(row(result, "S-MFA").matched, false);
  assert.equal(row(result, "S-LOGOUT").matched, true);
  assert.equal(row(result, "S-CRIT2").matched, true);
  assert.equal(verdict(result, "S-MFA").verdict, "FITS");
});
