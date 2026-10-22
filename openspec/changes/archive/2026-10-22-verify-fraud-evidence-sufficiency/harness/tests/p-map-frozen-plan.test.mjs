// Offline freeze audit: source-cited independent boundary tables, never SDK or
// entrypoint imports. The JSON is a hypothesis, not a P-map run result.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateExpectations } from "../p-map/expectations-validate.mjs";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { measure } from "../p-map/workload.mjs";
import { evaluationPlan, EMISSION_ORACLE } from "./p-map-evaluation-fixtures.mjs";
import { SIGNAL_ORACLE, ALTERNATIVE_ORACLE } from "./p-map-evaluation-oracle.mjs";
import { processFixture } from "./p-map-process-fixtures.mjs";

const PLAN = JSON.parse(readFileSync(new URL("../expectations/p-map.v1.json", import.meta.url), "utf8"));
const ORDER = ["S-LOGOUT", "S-MFA", "S-CONTACT", "S-LOCK", "S-UNLOCK", "S-ROTATE", "S-CRIT2",
  "L1", "L2", "L3", "L4", "L5a", "L5b", "L5c", "M1", "M2", "M3", "M4", "C1", "C2a", "C2b", "C3", "C4", "C5", "C6", "X1",
  "K1", "K2a", "K2b", "K3", "K4", "U1", "U2", "R1", "R2", "R3", "R4", "R5a", "R5b"];
const CASE = (id, plan = PLAN) => plan.cases.find((entry) => entry.case_id === id);
const BOUNDARY = new Set(["kind", "accepted", "sink_count"]);
const NEGATIVES = ["L5a/denied-no-handle", "M4/transactional", "C2b/items-17", "X1/spread", "K4/tenantless", "U2/foreign", "R1/unlinked"];
const observed = await measure(processFixture());

function assertOracleStep(oracle) {
  const id = oracle.step_id.split("/")[0];
  const step = CASE(id).expected.find((entry) => entry.step_id === oracle.step_id);
  assert(step, oracle.step_id);
  assert(oracle.basis.length > 0, "independently source-cited");
  for (const [path, value] of Object.entries(oracle.fields)) {
    if (BOUNDARY.has(path)) assert.deepEqual(step[path], value, `${oracle.step_id}: ${path}`);
    else assert(step.assertions.some((rule) => rule.path === path && rule.op === "equal"
      && JSON.stringify(rule.value) === JSON.stringify(value)), `${oracle.step_id}: missing independent assertion ${path}`);
  }
}

function assertHygiene(step) {
  const text = JSON.stringify(step);
  assert.doesNotMatch(text, /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i);
  assert.doesNotMatch(text, /"[a-f0-9]{64}"|\d{4}-\d\d-\d\dT\d\d:/);
  assert.doesNotMatch(text, /@|BEGIN PRIVATE KEY|Bearer\s/);
}

test("frozen P-map v1 validates all 39 ordered headings, all steps and per-row aggregates", () => {
  assert.equal(validateExpectations(PLAN), PLAN);
  assert.deepEqual(PLAN.cases.map((entry) => entry.case_id), ORDER);
  const fixture = evaluationPlan();
  for (const entry of PLAN.cases) assert.deepEqual(entry.expected, CASE(entry.case_id, fixture).expected);
  assert.equal(PLAN.predicted_total, 623);
  assert.deepEqual(PLAN.planned_occurrence_budget, { predicted_total: 623, processes: { sequential: 1246 }, total: 1246, limit: 5000 });
  assert.equal(PLAN.cases.reduce((sum, row) => sum + row.predicted_calls, 0), 601);
  assert.equal(PLAN.baseline_plan.reduce((sum, row) => sum + row.predicted_calls, 0), 22);
});

test("all 59 emissions agree with independent source tables, at least two distinct cases per L/M/C/K/U/R family", () => {
  assert.equal(EMISSION_ORACLE.length, 59);
  for (const family of ["L", "M", "C", "K", "U", "R"]) {
    const cases = new Set(EMISSION_ORACLE.filter((row) => row.step_id.startsWith(family)).map((row) => row.step_id.split("/")[0]));
    assert(cases.size >= 2, family);
  }
  EMISSION_ORACLE.forEach(assertOracleStep);
});

test("the complete composed offline fixture matches frozen concrete, baseline and computed S rows", () => {
  const result = evaluateProbe({ expectations: PLAN, observations: [observed] });
  assert.deepEqual(result.notes, []);
  assert.equal(result.evaluations.length, 39);
  for (const row of [...result.baseline_evaluations, ...result.evaluations]) {
    assert.equal(row.matched, true, `${row.case_id}: ${JSON.stringify(row.mismatches)}`);
  }
  for (const oracle of SIGNAL_ORACLE) assert.equal(result.verdicts.find((row) => row.case_id === oracle.id).verdict, oracle.verdict);
  assert.equal(result.verdicts.find((row) => row.case_id === "S-CRIT2").verdict, "PASS");
});

for (const stepId of NEGATIVES) {
  test(`frozen ${stepId[0]} family negative transcription is caught locally`, () => {
    const plan = structuredClone(PLAN);
    const id = stepId.split("/")[0];
    const step = CASE(id, plan).expected.find((row) => row.step_id === stepId);
    step.accepted = !step.accepted;
    const result = evaluateProbe({ expectations: plan, observations: [observed] });
    assert.equal(result.evaluations.find((row) => row.case_id === id).matched, false);
    assert.equal(result.evaluations.find((row) => row.case_id === "R5b").matched, true);
  });
}

for (const [id, signal] of [["K2a", "S-LOCK"], ["R2", "S-ROTATE"]]) {
  test(`frozen ${id} reports both owner-review readings and conditional criterion failure`, () => {
    const result = evaluateProbe({ expectations: PLAN, observations: [observed] });
    const row = result.evaluations.find((entry) => entry.case_id === id);
    assert.equal(row.owner_review_required, true);
    assert.equal(row.default_verdict, "STRAINED");
    assert.deepEqual(row.alternative_verdict, ALTERNATIVE_ORACLE[id]);
    const alternate = evaluateProbe({ expectations: PLAN, observations: [observed], readings: { [id]: "alternative" } });
    assert.equal(alternate.verdicts.find((entry) => entry.case_id === signal).verdict, "MISREPRESENTS");
    const criterion = alternate.verdicts.find((entry) => entry.case_id === "S-CRIT2");
    assert.equal(criterion.verdict, "FAIL");
    assert.deepEqual(criterion.misfits, [signal]);
  });
}

test("only actual outcome changes use corrected_from; #812-sensitive constructions retain their diagnostics", () => {
  assert.deepEqual(PLAN.cases.filter((row) => row.corrected_from !== undefined).map((row) => row.case_id), ["L5a"]);
  assert.match(CASE("L5a").corrected_from.old_text, /Accepted.*committed/);
  assert.match(CASE("L5a").corrected_from.reason, /#797/);
  const step = CASE("L5a").expected[0];
  assert.equal(step.accepted, false);
  assert.equal(step.sink_count, 0);
  assert(step.assertions.some((rule) => rule.path === "diagnostic.code" && rule.value === "PREMATURE_SUCCESS"));
  assert(step.assertions.some((rule) => rule.path === "diagnostic.path" && rule.value === "/operation/state"));
  for (const id of ["L5b", "L5c", "M4", "U2", "R1", "R2", "R3"]) assert.equal(CASE(id).corrected_from, undefined);
});

test("frozen assertions use structural identities, not runtime digests, clocks or scheduling", () => {
  for (const entry of PLAN.cases) assertHygiene(entry.expected);
  assert.equal(PLAN.observation_policy.scheduling, "Sequential awaited work; no scheduling-dependent value is frozen");
  assert.equal(PLAN.observation_policy.runtime_identifiers, "Structural comparisons/computed booleans only");
});

test("header pins G36, labelled defaults, alternatives, rubric and required findings without defining policy", () => {
  assert.equal(PLAN.drafted_from.commit, "5d931ad");
  assert.match(PLAN.drafted_from.comment, /6137646538$/);
  assert.equal(PLAN.corrected_at, "8e6cdf781445574c67883a465eb37581ca14b5ab");
  assert.equal(PLAN.decisions.find((row) => row.id === "G36").source, "owner decision");
  for (const row of PLAN.implementer_defaults) assert.equal(row.source, "implementer default");
  assert.deepEqual(Object.keys(PLAN.rubric), ["FITS", "STRAINED", "MISREPRESENTS"]);
  assert.deepEqual(PLAN.findings.map((row) => row.id), ["criterion_2", "free_form_categories", "g36_attribution", "host_linkage_preserved",
    "tenantless_asymmetry", "logout_distinction", "containment_fail_closed", "lazy_expiry", "no_handle_audit", "draft_rederivation"]);
});
