import assert from "node:assert/strict";
import test from "node:test";
import { validateExpectations } from "../p-map/expectations-validate.mjs";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { evaluationPlan, evaluationFixture } from "./p-map-evaluation-fixtures.mjs";
import { equal } from "./p-map-evaluation-oracle.mjs";

function concrete(plan) { return plan.cases.find((row) => row.case_id === "L1"); }
const MALFORMED = [
  ["truncated cases", (plan) => { plan.cases.pop(); }],
  ["wrong case order", (plan) => { plan.cases.reverse(); }],
  ["truncated steps", (plan) => { concrete(plan).expected.pop(); }],
  ["duplicate steps", (plan) => { concrete(plan).expected.push(concrete(plan).expected[0]); }],
  ["wrong step owner", (plan) => { concrete(plan).expected[0].step_id = "M1/wrong"; }],
  ["invalid surface", (plan) => { concrete(plan).expected[0].kind = "binding"; }],
  ["nonboolean acceptance", (plan) => { concrete(plan).expected[0].accepted = 1; }],
  ["negative sink count", (plan) => { concrete(plan).expected[0].sink_count = -1; }],
  ["empty assertion", (plan) => { concrete(plan).expected[0].assertions = []; }],
  ["malformed assertion", (plan) => { concrete(plan).expected[0].assertions = [null]; }],
  ["dangling peer", (plan) => { concrete(plan).expected[0].assertions = [{ path: "raw.ok", op: "same", peer: { step_id: "L1/missing", path: "raw.ok" } }]; }],
  ["runtime UUID literal", (plan) => { concrete(plan).expected[0].assertions = [equal("raw.value.operationId", "00000000-0000-4000-8000-000000000001")]; }],
  ["runtime timestamp literal", (plan) => { concrete(plan).expected[0].assertions = [equal("capture.time", "2026-10-01T10:00:00.000Z")]; }],
  ["runtime digest literal", (plan) => { concrete(plan).expected[0].assertions = [equal("capture.digest", "a".repeat(64))]; }],
  ["aggregate reference", (plan) => { plan.cases[0].dependencies = ["L5a"]; }],
  ["aggregate dangling peer", (plan) => { plan.cases[0].expected.assertions.push({ path: "verdict", op: "same", peer: { step_id: "L1/missing", path: "raw.ok" } }); }],
  ["refusal missing diagnostic", (plan) => { plan.cases.find((row) => row.case_id === "L5a").expected[0].assertions = [equal("raw.ok", false)]; }],
  ["aggregate missing findings", (plan) => { plan.cases[0].expected.assertions = [equal("verdict", "FITS")]; }],
  ["aggregate invalid verdict", (plan) => { plan.cases[0].verdict = "accepted"; }],
  ["empty rubric reasons", (plan) => { plan.cases[0].rubric_reasons = []; }],
  ["criterion reference", (plan) => { plan.cases[6].dependencies.push("X1"); }],
  ["missing owner review", (plan) => { plan.cases.find((row) => row.case_id === "K2a").owner_review_required = false; }],
  ["missing alternate condition", (plan) => { delete plan.cases.find((row) => row.case_id === "R2").alternative_verdict.condition; }],
  ["missing signal alternatives", (plan) => { plan.cases[3].alternative_verdicts = []; }],
  ["missing criterion consequence", (plan) => { plan.cases[6].alternative_verdicts[0].criterion_2 = "PASS"; }],
  ["incorrect prediction", (plan) => { concrete(plan).predicted_calls += 1; }],
];
for (const [name, mutate] of MALFORMED) test(`P-map preclaim plan validation rejects ${name}`, () => {
  const plan = evaluationPlan();
  mutate(plan);
  assert.throws(() => validateExpectations(plan), /malformed P-map expectations/);
});

const fixture = await evaluationFixture();
for (const observed of [false, true]) test(`P-map explicitly observed_not_frozen scheduling fact matches ${observed} and preserves raw direction`, () => {
  const input = structuredClone(fixture);
  const step = concrete(input.expectations).expected[2];
  // Fixture-only scheduling field. P-map's present sequential workloads freeze
  // no scheduler-dependent ordering; this proves the plan marker in both directions.
  step.observed_not_frozen = ["scheduling.completed_before_peer"];
  const record = input.observations[0].records.find((row) => row.step_id === step.step_id);
  record.scheduling = { completed_before_peer: observed };
  assert.doesNotThrow(() => validateExpectations(input.expectations));
  const actual = evaluateProbe(input).evaluations.find((row) => row.case_id === "L1");
  assert.equal(actual.matched, true);
  assert.equal(actual.raw.find((row) => row.step_id === step.step_id).scheduling.completed_before_peer, observed);
  step.assertions.push(equal("scheduling.completed_before_peer", !observed));
  assert.throws(() => validateExpectations(input.expectations), /unfrozen field also has a frozen assertion/);
  delete step.observed_not_frozen;
  assert.equal(evaluateProbe(input).evaluations.find((row) => row.case_id === "L1").matched, false);
});
