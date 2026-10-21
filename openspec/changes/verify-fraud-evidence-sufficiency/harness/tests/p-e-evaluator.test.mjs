import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCases, evaluateProbe } from "../p-e/evaluate.mjs";
import { validateCase, validateExpectations } from "../p-e/expectations-validate.mjs";
import { validateReferences } from "../p-e/step-validation.mjs";
import { oraclePlan } from "./p-e-evaluator-oracle.mjs";
import { fixtureObservations } from "./p-e-evaluator-records.mjs";

const MUTATIONS = [
  { family: "construction", owner: "P-E-1b", step: "P-E-1b/emit", change: (record) => { record.raw.ok = true; } },
  { family: "ordering", owner: "P-E-2", step: "P-E-2/deliver", change: (record) => { record.callback_order.reverse(); } },
  { family: "redelivery", owner: "P-E-5", step: "P-E-5/retry-3", change: (record) => { record.exchange_attempts[0].body_sha256 = "b".repeat(64); } },
  { family: "concurrency", owner: "P-E-6", step: "P-E-6/d2", change: (record) => { record.raw.transaction_id = "pe-txn-extra"; } },
  { family: "outbox", owner: "P-E-9c", step: "P-E-9c/rollback:emit", change: (record) => { record.database.counts.outbox = 0; } },
  { family: "guarantees", owner: "P-E-g", step: "P-E-g/read", change: (record) => { record.raw.public_keys.push("flush"); } },
];
const NON_ABORT_MARKERS = [
  { step_id: "P-E-5/aborted", variant: "observation" },
  { step_id: "P-E-5/extra", variant: "case_aborted" },
];
const BROKEN_PLANS = [
  (plan) => { plan.cases[0] = null; },
  (plan) => { plan.cases[0].expected[0] = null; },
  (plan) => { plan.cases[0].expected[0].assertions = null; },
  (plan) => { plan.cases[0].expected[0].assertions = [null]; },
  (plan) => { plan.cases[0].expected[0].result = null; },
  (plan) => { plan.cases[0].expected[0].step_id = "P-E-2/stolen"; },
];

function evaluated(observations, expectations = oraclePlan()) {
  return evaluateProbe({ observations, expectations });
}
function assertMatched(result) {
  assert.deepEqual(result.evaluations.filter((row) => !row.matched), []);
}

// No fixture imports a workload, kit, package, frozen expectations or network.
test("independent source-cited oracle validates rows separately from production's frozen budget", () => {
  const plan = oraclePlan();
  // Partial-oracle validation is test-only, never a production budget bypass.
  for (const entry of plan.cases) assert.equal(validateCase(entry), entry);
  validateReferences({ cases: plan.cases,
    stepIds: new Set(plan.cases.flatMap((entry) => entry.expected.map((step) => step.step_id))) });
  assert.throws(() => validateExpectations(plan), /malformed P-E expectations: planned_occurrence_budget/);
  for (const family of MUTATIONS.map((row) => row.family)) assert.equal(plan.cases.filter((row) => row.family === family).length, 2);
  const observations = fixtureObservations();
  const before = structuredClone(observations);
  const result = evaluated(observations, plan);
  assertMatched(result);
  assert.equal(result.notes.length, 1);
  assert.match(result.notes[0], /malformed P-E expectations: planned_occurrence_budget/);
  assert.equal(result.observations, observations);
  assert.deepEqual(observations, before);
  assert.equal(result.evaluations[0].raw[0], observations[0].records[0]);
});

for (const mutation of MUTATIONS) {
  test(`negative ${mutation.family} mutation mismatches only its owning row`, () => {
    const observations = fixtureObservations();
    mutation.change(observations[0].records.find((row) => row.step_id === mutation.step));
    const result = evaluated(observations);
    assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), [mutation.owner]);
    assert(result.evaluations.find((row) => row.case_id === mutation.owner).mismatches.length > 0);
  });
}

for (const damage of BROKEN_PLANS) {
  test(`direct malformed planned row remains total: ${BROKEN_PLANS.indexOf(damage)}`, () => {
    const plan = oraclePlan();
    damage(plan);
    const result = evaluated(fixtureObservations(), plan);
    assert.equal(result.evaluations[0].matched, false);
    assert(result.evaluations.slice(1, 12).every((row) => row.matched));
    assert(result.notes[0].startsWith("malformed P-E expectations:"));
  });
}

test("missing and duplicate observations, unknown and unplanned-owned steps retain every record", () => {
  const observations = fixtureObservations();
  const records = observations[0].records;
  records.splice(records.findIndex((row) => row.step_id === "P-E-1b/emit"), 1);
  records.push(structuredClone(records.find((row) => row.step_id === "P-E-1f/emit")));
  records.push({ step_id: "P-E-6/extra", raw: null }, { step_id: "outside/extra", raw: null }, null);
  const result = evaluated(observations);
  assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id),
    ["P-E-1b", "P-E-1f", "P-E-6", "outside/extra", undefined]);
  const owned = result.evaluations.find((row) => row.case_id === "P-E-6");
  assert(owned.mismatches.some((issue) => issue.includes("unplanned owned step")));
  assert(!owned.mismatches.some((issue) => issue.includes("unknown step")));
  assert.equal(result.observations, observations);
});

test("owned abort takes precedence over normal comparisons and retains raw/accounting/aggregates", () => {
  const observations = fixtureObservations();
  const before = evaluated(observations).evaluations.find((row) => row.case_id === "P-E-5");
  const abort = { step_id: "P-E-5/aborted", variant: "case_aborted", message: "synthetic refusal", current: "P-E-5" };
  observations[0].records.push(abort);
  observations[0].case_aborts = ["P-E-5"];
  const result = evaluated(observations);
  const row = result.evaluations.find((entry) => entry.case_id === "P-E-5");
  assert.deepEqual(result.evaluations.filter((entry) => !entry.matched).map((entry) => entry.case_id), ["P-E-5"]);
  assert.deepEqual(row.mismatches, ["case aborted: synthetic refusal"], "no planned step is missing");
  assert.equal(row.raw.at(-1), abort);
  assert.deepEqual(row.raw.slice(0, -1), before.raw);
  assert.deepEqual(row.accounting, before.accounting);
  assert.deepEqual(row.aggregates, before.aggregates);
  assert.deepEqual(observations[0].invalidations, []);
  assert.equal(result.observations, observations);
});

for (const marker of NON_ABORT_MARKERS) {
  test(`non-abort marker ${JSON.stringify(marker)} remains an unplanned owned step`, () => {
    const observations = fixtureObservations();
    observations[0].records.push(marker);
    const result = evaluated(observations);
    const row = result.evaluations.find((entry) => entry.case_id === "P-E-5");
    assert.deepEqual(row.mismatches, [`unplanned owned step ${marker.step_id}`]);
    assert.equal(row.matched, false);
    assert.equal(result.evaluations.length, oraclePlan().cases.length, "no unknown-record noise");
  });
}

test("bad peer references and malformed result fields yield local issues, not exceptions", () => {
  const plan = oraclePlan();
  plan.cases[2].expected[0].assertions[2].peer.step_id = "P-E-99/absent";
  const result = evaluated(fixtureObservations(), plan);
  assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), ["P-E-2"]);
  assert(result.evaluations[2].mismatches.some((issue) => issue.includes("relation peer")));
  const records = fixtureObservations()[0].records;
  records[0].raw = null;
  assert.equal(evaluateCases({ records, expectations: oraclePlan() })[0].matched, false);
});

test("random ids and digests compare structurally or by peer, never frozen literals", () => {
  const observations = fixtureObservations();
  for (const record of observations[0].records) {
    if (record.raw.event_id !== undefined) record.raw.event_id = "pe-event-other-run";
    for (const attempt of record.exchange_attempts ?? []) {
      attempt.event_id = "pe-event-other-run";
      attempt.body_sha256 = "c".repeat(64);
    }
  }
  assertMatched(evaluated(observations));
  observations[0].records[2].exchange_attempts[0].body_sha256 = "malformed";
  assert.equal(evaluated(observations).evaluations[2].matched, false);
});

test("call prediction deviation under allowance is only a note", () => {
  const observations = fixtureObservations();
  observations[0].public_calls.push({ label: "P-E-1b:mfaRemoved", ordinal: 1 });
  const result = evaluated(observations);
  assertMatched(result);
  assert.match(result.evaluations[0].notes[0], /prediction 10; observed 1; deviation is a note/);
  assert.deepEqual(observations[0].invalidations, []);
});

test("one inconclusive guarantee row leaves other per-row aggregates and raw evidence intact", () => {
  const observations = fixtureObservations();
  observations[0].records.find((row) => row.step_id === "P-E-5/quiet").raw = null;
  const result = evaluated(observations);
  assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), ["P-E-5"]);
  assert.equal(result.verdict.guarantees.find((row) => row.step_id === "P-E-5/quiet").status, "inconclusive");
  assert.equal(result.verdict.guarantees.find((row) => row.step_id === "P-E-g/read").status, "observed");
  assert.equal(result.observations, observations);
});

test("null, malformed observations and missing input never throw", () => {
  for (const input of [null, undefined, {}, { observations: [null, { records: [null], accounting: [null] }], expectations: { cases: [null] } }]) {
    assert.doesNotThrow(() => evaluateProbe(input));
  }
});
