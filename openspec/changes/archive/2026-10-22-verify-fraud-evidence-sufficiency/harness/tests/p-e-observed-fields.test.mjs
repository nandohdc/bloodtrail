// G4: explicit observations, never omitted fields. Only the duplicate call
// overlaps a live delivery; d1 covers its whole pipeline, third is settled,
// and the 6b/6c calls are sequentially awaited. No kit/SDK imports or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { concurrencyWorkload } from "../p-e/concurrency-workload.mjs";
import { evaluateProbe } from "../p-e/evaluate.mjs";
import { validateExpectations } from "../p-e/expectations-validate.mjs";
import { COUNTERS, OBSERVED_NOT_FROZEN } from "../p-e/shape.mjs";
import { concurrencyState } from "./p-e-concurrency-fixtures.mjs";

const PLAN = JSON.parse(readFileSync(new URL("../expectations/p-e.v1.json", import.meta.url), "utf8"));
const ALLOWED = ["counters", "callback_order", "exchange"];
const FORBIDDEN = ["step_id", "result", "assertions"];
const CASE_IDS = ["P-E-6", "P-E-6b", "P-E-6c"];
const ABNORMAL_FIELDS = [
  { name: "partial counter marker", change: (step) => { step.counters.gate = OBSERVED_NOT_FROZEN; } },
  { name: "unknown counter marker", change: (step) => { step.counters = "unfrozen"; } },
  { name: "unknown callback marker", change: (step) => { step.callback_order = "unfrozen"; } },
  { name: "unknown exchange marker", change: (step) => { step.exchange = "unfrozen"; } },
  { name: "partial exchange marker", change: (step) => {
    step.exchange = { count: OBSERVED_NOT_FROZEN, request_attempt: 0, method: "POST", path: "/v1/security-audit" };
  } },
];

function duplicateStep(plan) {
  return plan.cases.find((entry) => entry.case_id === "P-E-6").expected.find((step) => step.step_id === "P-E-6/d2");
}

function concurrencyPlan() {
  const plan = structuredClone(PLAN);
  plan.cases = plan.cases.filter((entry) => CASE_IDS.includes(entry.case_id));
  return plan;
}

async function fixture(options) {
  const state = concurrencyState(options);
  await concurrencyWorkload(state);
  const plan = structuredClone(PLAN);
  assert.equal(validateExpectations(plan), plan);
  return { state, plan };
}

function evaluated({ state, plan }) {
  // Validate the full frozen budget, then select only the family exercised by
  // this offline fixture. Unobserved families are not part of these assertions.
  const result = evaluateProbe({ expectations: plan,
    observations: [{ records: state.records, accounting: state.accounting, public_calls: state.calls }] });
  result.evaluations = result.evaluations.filter((row) => CASE_IDS.includes(row.case_id));
  return result;
}

function assertMatching(result) {
  assert.deepEqual(result.notes, []);
  assert.equal(result.evaluations.length, 3);
  assert.deepEqual(result.evaluations.filter((row) => !row.matched), []);
}

for (const field of ALLOWED) {
  test(`the validator accepts the explicit marker on step.${field}`, () => {
    const plan = structuredClone(PLAN);
    // Use a normally frozen step to exercise each field independently.
    plan.cases[0].expected[0][field] = OBSERVED_NOT_FROZEN;
    assert.equal(validateExpectations(plan), plan);
  });
}

for (const field of FORBIDDEN) {
  test(`the validator refuses the marker on step.${field}`, () => {
    const plan = structuredClone(PLAN);
    duplicateStep(plan)[field] = OBSERVED_NOT_FROZEN;
    assert.throws(() => validateExpectations(plan), /^Error: malformed P-E expectations:/);
  });
}

for (const mutation of ABNORMAL_FIELDS) {
  test(`the validator refuses a ${mutation.name}`, () => {
    const plan = structuredClone(PLAN);
    mutation.change(plan.cases[0].expected[0]);
    assert.throws(() => validateExpectations(plan), /malformed P-E expectations:/);
  });
}

test("the concurrency audit marks only interleaving-dependent fields and retains stable deltas/orders", () => {
  const cases = concurrencyPlan().cases;
  const marked = cases.flatMap((entry) => entry.expected
    .filter((step) => step.counters === OBSERVED_NOT_FROZEN));
  assert.deepEqual(marked.map((step) => step.step_id), ["P-E-6/d2"]);
  assert.equal(marked[0].callback_order, OBSERVED_NOT_FROZEN);
  assert.equal(marked[0].exchange, OBSERVED_NOT_FROZEN);
  assert.deepEqual(marked[0].result, { variant: "refused", code: "duplicate_transaction_delivery" });
  assert(marked[0].assertions.some((rule) => rule.path === "after_d1_start.probe" && rule.value === 1));
  for (const entry of cases) {
    assert.equal(entry.corrected_from, undefined, "no outcome changed");
    const totals = entry.summary.assertions.filter((rule) => rule.path.startsWith("actual."));
    assert.deepEqual(totals.map((rule) => rule.path), COUNTERS.map((key) => `actual.${key}`));
    assert(totals.every((rule) => Number.isSafeInteger(rule.value)));
    for (const step of entry.expected.filter((step) => step !== marked[0])) {
      assert.equal(typeof step.counters, "object", `${step.step_id}: stable delta remains frozen`);
      if (step.callback_order !== undefined) assert(Array.isArray(step.callback_order));
      if (step.exchange !== undefined) assert.equal(typeof step.exchange, "object");
    }
  }
  const parkingRules = cases[0].summary.assertions.filter((rule) => rule.path.startsWith("parking."));
  assert.deepEqual(parkingRules, [{ path: "parking.released", op: "equal", value: true }]);
  const revision = PLAN.revisions.find((entry) => entry.source === "orchestrator review of bcac37c");
  assert.deepEqual(revision.step_ids, ["P-E-6/d2"]);
  assert.match(revision.reason, /Timing-dependent per-step counters/);
  assert.match(revision.reason, /No outcome changed/);
  assert.match(revision.reason, /P-E-6 summary no longer asserts parking\.exchange_entered_after_release/);
  assert.match(revision.reason, /same scheduling reason/);
});

test("d2 gate count differing from the old frozen 1 and changed callback order still match", async () => {
  const input = await fixture();
  assertMatching(evaluated(input));
  const record = input.state.records.find((step) => step.step_id === "P-E-6/d2");
  record.counters.gate = 0;
  record.callback_order = [];
  const before = structuredClone(record);
  const result = evaluated(input);
  assertMatching(result);
  assert.equal(result.evaluations[0].raw.find((step) => step.step_id === record.step_id), record);
  assert.deepEqual(record, before, "marked fields remain in raw observations");
});

function delayDuplicateResolution(binding) {
  return { ...binding, deliver: async (...args) => {
    const result = await binding.deliver(...args);
    if (result.code === "duplicate_transaction_delivery") {
      for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
    }
    return result;
  } };
}

test("delayed d2 resolution observes d1's exchange without freezing overlapping metadata", async () => {
  const input = await fixture({ transformBinding: delayDuplicateResolution });
  const record = input.state.records.find((step) => step.step_id === "P-E-6/d2");
  assert.equal(record.raw.code, "duplicate_transaction_delivery");
  assert.equal(record.counters.exchange, 1, "d1 enters exchange before d2 settles");
  assert.deepEqual(record.callback_order, ["gate", "exchange"]);
  assert.equal(record.exchange_attempts.length, 1);
  assert.equal(record.after_d1_start.probe, 1, "immediate synchronous probe remains frozen");
  const before = structuredClone(record);
  const result = evaluated(input);
  assertMatching(result);
  assert.equal(result.evaluations[0].raw.find((step) => step.step_id === record.step_id), record);
  assert.deepEqual(record, before, "exchange attempts remain raw observations");
});

test("explicit assertions cannot refreeze marked counters or callback_order", async () => {
  const input = await fixture();
  duplicateStep(input.plan).assertions.push(
    { path: "counters.gate", op: "equal", value: 99 },
    { path: "callback_order", op: "equal", value: ["not-observed"] });
  assertMatching(evaluated(input));
});

test("a wrong d2 result remains a mismatch while marked fields are ignored", async () => {
  const input = await fixture();
  input.state.records.find((step) => step.step_id === "P-E-6/d2").raw.code = "transaction_id_required";
  const result = evaluated(input);
  assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), ["P-E-6"]);
  assert(result.evaluations[0].mismatches.some((issue) => issue.includes("P-E-6/d2:")));
});

for (const caseId of CASE_IDS) {
  for (const counter of COUNTERS) {
    test(`${caseId} final ${counter} total is still frozen`, async () => {
      const input = await fixture();
      input.state.accounting.find((entry) => entry.case_id === caseId).actual[counter] += 1;
      const result = evaluated(input);
      assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), [caseId]);
      const row = result.evaluations.find((entry) => entry.case_id === caseId);
      assert(row.mismatches.some((issue) => issue.includes(`assertion actual.${counter} equal failed`)));
    });
  }
}
