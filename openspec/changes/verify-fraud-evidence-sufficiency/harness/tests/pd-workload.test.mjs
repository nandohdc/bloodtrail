import assert from "node:assert/strict";
import { test } from "node:test";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { CASES, PLANNED_TOTAL } from "../p-d/cases.mjs";
import { createState, step } from "../p-d/runtime.mjs";
import { executeCases, measure } from "../p-d/workload.mjs";
import { EXPECTATIONS } from "./pd-fixtures.mjs";
import { publicDoubles, FixtureSdkError } from "./pd-public-doubles.mjs";

function fixture() {
  const doubles = publicDoubles();
  const state = createState({ ...doubles, ledger: occurrenceLedger({ budget: 5000 }) });
  doubles.attach(state);
  return { doubles, state };
}

test("P-D descriptors consume exactly every planned public call with public-shape doubles", async () => {
  const { state, doubles } = fixture();
  const observed = await measure({ state });
  assert.deepEqual(observed.invalidations, []);
  const counts = Object.fromEntries(CASES.map((entry) => [entry.case_id, observed.ledger.calls.filter((call) => call.label.startsWith(entry.case_id + ":")).length]));
  assert.deepEqual(counts, Object.fromEntries(CASES.map((entry) => [entry.case_id, entry.calls])));
  assert.equal(observed.ledger.occurrence_count, PLANNED_TOTAL);
  assert.equal(new Set(observed.records.map((record) => record.step_id.split("/")[0])).size, 66);
  assert.deepEqual(observed.records.map((record) => record.step_id), EXPECTATIONS.cases.flatMap((entry) => entry.expected.map((planned) => planned.step_id)));
  assert.equal(new Set(observed.public_calls.map((call) => call.step_id)).size, observed.public_calls.length);
  const retried = doubles.received.find((call) => call.input.retry?.retry_attempt === 1);
  assert.equal(retried.input.operation, state.completed);
  assert.equal(state.completed, doubles.issued[0].handle);
  assert.equal(doubles.received.filter((call) => call.input.operation === state.completed).length, 4);
  const framed = doubles.received.find((call) => call.frame?.actor === state.af.actor && call.input.actor === undefined);
  assert(framed);
});

const BASELINE_IDS = ["PD-00", "PD-01"];
for (const id of BASELINE_IDS) {
  test(`${id} refusal stops before dependent cases without baseline repair`, async () => {
    const { state } = fixture();
    const visited = [];
    const cases = BASELINE_IDS.map((case_id) => ({ case_id, run: async (s) => {
      visited.push(case_id);
      s.records.push({ step_id: `${case_id}/main`, surface: case_id === id ? "returned-refusal" : "accepted", sink_count: case_id === id ? 0 : 1 });
    } }));
    cases.push({ case_id: "PD-A1", run: () => { visited.push("forbidden"); } });
    await executeCases({ state, cases });
    assert.equal(visited.includes("forbidden"), false);
    assert.equal(state.invalidations.length, 1);
    assert(state.invalidations[0].message.includes(id));
  });
}

const OUTCOMES = [
  ["refusal", () => ({ ok: false, error: { code: "fixture", category: "validation", path: "/" } })],
  ["SDK throw", () => { throw new FixtureSdkError({ code: "fixture", category: "authority", path: "/" }); }],
  ["raw throw", () => { throw new TypeError("fixture native throw"); }],
  ["acceptance", () => ({ ok: true, value: { status: "accepted" } })],
];
test("ordinary outcomes all continue, awaited case order never overlaps", async () => {
  const { state } = fixture();
  const target = { sink: { events: [] } };
  let active = 0;
  const cases = OUTCOMES.map(([case_id, invoke]) => ({ case_id, run: async (s) => {
    assert.equal(active++, 0);
    await Promise.resolve();
    await step(s, "main", target, () => s.call(case_id, invoke));
    active -= 1;
  } }));
  await executeCases({ state, cases });
  assert.equal(state.records.length, OUTCOMES.length);
  assert.deepEqual(state.invalidations, []);
});
