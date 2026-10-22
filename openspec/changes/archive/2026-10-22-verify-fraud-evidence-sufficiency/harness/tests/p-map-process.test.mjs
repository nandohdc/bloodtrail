import assert from "node:assert/strict";
import test from "node:test";
import { measure } from "../p-map/workload.mjs";
import { CONCRETE_CASES } from "../p-map/plan.mjs";
import { BASELINE_PLAN } from "../p-map/baseline-cases.mjs";
import { P_MAP_BUDGET, P_MAP_PREDICTED_TOTAL } from "../p-map/budget.mjs";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { evaluationPlan } from "./p-map-evaluation-fixtures.mjs";
import { processFixture } from "./p-map-process-fixtures.mjs";

// Independent count totals from source-cited family oracles and the two
// controls: 13 (2 factories + 7 contexts + begin/mark/named + sink), 9
// (2 factories + 5 contexts + named + sink). S analyses add exactly zero.
const TOTAL = 13 + 9 + 118 + 56 + 149 + 11 + 88 + 54 + 125;

test("P-map complete sequential workload reproduces all 32 concrete predictions plus positive controls", async () => {
  const observed = await measure(processFixture());
  assert.deepEqual(observed.invalidations, []);
  assert.deepEqual(observed.case_aborts, []);
  assert.equal(P_MAP_PREDICTED_TOTAL, TOTAL);
  assert.equal(TOTAL, 623);
  assert.equal(P_MAP_BUDGET.total, 1246);
  assert.equal(observed.ledger.exhausted, false);
  assert.equal(observed.ledger.occurrence_count, TOTAL);
  assert.equal(observed.public_calls.length, TOTAL);
  assert.deepEqual(observed.accounting.map((row) => row.case_id), CONCRETE_CASES.map((row) => row.case_id));
  assert.deepEqual(observed.baselines.accounting.map((row) => row.case_id), BASELINE_PLAN.map((row) => row.case_id));
  for (const row of [...observed.baselines.accounting, ...observed.accounting]) {
    assert.equal(row.public_calls, row.predicted_calls, row.case_id);
    assert.deepEqual(row.notes, []);
  }
  assert(observed.public_calls.slice(0, 13).every((call) => call.label.startsWith("B-LOGOUT:")));
  assert(observed.public_calls.slice(13, 22).every((call) => call.label.startsWith("B-MFA:")));
  const evaluated = evaluateProbe({ expectations: evaluationPlan(), observations: [observed] });
  assert.deepEqual(evaluated.notes, []);
  assert(evaluated.baseline_evaluations.every((row) => row.matched));
  assert(evaluated.evaluations.every((row) => row.matched), JSON.stringify(evaluated.evaluations.filter((row) => !row.matched)));
  assert.deepEqual(evaluated.observations[0].baselines, observed.baselines, "baseline owner namespace retained, never unknown concrete steps");
});

const BASELINE_FAULTS = [
  ["refusal", { fault: { case_id: "B-LOGOUT", method: "sessionRevoked", kind: "refuse" } }, 1],
  ["throw", { fault: { case_id: "B-LOGOUT", method: "sessionRevoked", kind: "throw" } }, 1],
  ["no capture", { fault: { case_id: "B-MFA", method: "authenticationFailed", kind: "no-capture" } }, 2],
  ["constructor abort", { abort: "B-LOGOUT" }, 1],
];
for (const [label, options, controls] of BASELINE_FAULTS) {
  test(`P-map baseline ${label} stops every remaining control/case as a precondition`, async () => {
    const observed = await measure(processFixture(options));
    assert.equal(observed.accounting.length, 0);
    assert.equal(observed.baselines.accounting.length, controls);
    assert.equal(observed.baselines.accounting.at(-1).matched, false);
    assert.equal(observed.invalidations.length, 1);
    assert.equal(observed.invalidations[0].attribution, "precondition");
    assert.match(observed.invalidations[0].message, /baseline precondition failed/);
    assert(observed.baselines.records.length > 0);
  });
}

const CASE_FAULTS = [
  ["ordinary refusal", { fault: { case_id: "L4", method: "sessionRevoked", kind: "refuse" } }, "L4"],
  ["ordinary abort", { abort: "C4" }, "C4"],
  ["lost K2a dependency", { abort: "K2a" }, "U2"],
];
for (const [label, options, mismatch] of CASE_FAULTS) {
  test(`P-map ${label} stays local and all later families continue`, async () => {
    const observed = await measure(processFixture(options));
    assert.deepEqual(observed.invalidations, []);
    assert.equal(observed.accounting.length, 32);
    assert.equal(observed.accounting.at(-1).case_id, "R5b");
    const evaluated = evaluateProbe({ expectations: evaluationPlan(), observations: [observed] });
    assert.equal(evaluated.evaluations.find((row) => row.case_id === mismatch).matched, false);
    assert.equal(evaluated.evaluations.find((row) => row.case_id === "R5b").matched, true);
    if (options.abort === "K2a") {
      assert(observed.case_aborts.includes("U2"));
      assert.equal(evaluated.evaluations.find((row) => row.case_id === "U1").matched, true);
    }
  });
}

test("P-map in-allowance count drift is a note, not mismatch or invalidation", async () => {
  const observed = await measure(processFixture({ extra: "L2" }));
  assert.equal(observed.ledger.occurrence_count, TOTAL + 1);
  assert.deepEqual(observed.invalidations, []);
  assert.equal(observed.notes.length, 1);
  assert.equal(observed.accounting.find((row) => row.case_id === "L2").notes.length, 1);
  assert(evaluateProbe({ expectations: evaluationPlan(), observations: [observed] }).evaluations.every((row) => row.matched));
});

test("P-map sticky exhaustion stops remaining work, retaining the active case and all baseline evidence", async () => {
  const fixture = processFixture({ budget: 55 });
  const observed = await measure(fixture);
  assert.equal(observed.ledger.exhausted, true);
  assert.equal(observed.ledger.occurrence_count, 55);
  assert.match(observed.invalidations[0].message, /budget exhausted/);
  assert.equal(observed.accounting.at(-1).case_id, "L2");
  assert.equal(observed.baselines.accounting.length, 2);
  assert.throws(() => fixture.state.call("after-exhaustion", () => assert.fail("never invoked")), /budget exhausted/);
});
