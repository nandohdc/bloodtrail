import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { validateProbeInventory } from "../lib/import-closure.mjs";
import { runApprovedSession } from "../lib/orchestrate.mjs";
import { CHANGE } from "../lib/results.mjs";
import { P_MAP_BUDGET, P_MAP_PREDICTED_CALLS } from "../p-map/budget.mjs";
import { BASELINE_PLAN } from "../p-map/baseline-cases.mjs";
import { evaluationPlan } from "./p-map-evaluation-fixtures.mjs";
import { capturedPlan, withApproved } from "./p-map-runner-fixtures.mjs";

function adjustPrediction(value) {
  value.cases.find((row) => row.case_id === "C1").predicted_calls += 1;
  value.predicted_total += 1;
  value.planned_occurrence_budget.predicted_total += 1;
  value.planned_occurrence_budget.total += 2;
  value.planned_occurrence_budget.processes.sequential += 2;
}
function truncate(value) {
  const removed = value.cases.pop();
  value.predicted_total -= removed.predicted_calls;
  value.planned_occurrence_budget.predicted_total = value.predicted_total;
  value.planned_occurrence_budget.total = 2 * value.predicted_total;
  value.planned_occurrence_budget.processes.sequential = value.planned_occurrence_budget.total;
}
const PLAN_FAULTS = [
  ["missing budget", (value) => { delete value.planned_occurrence_budget; }],
  ["missing total", (value) => { delete value.predicted_total; }],
  ["missing baselines", (value) => { delete value.baseline_plan; }],
  ["wrong baseline count", (value) => { value.baseline_plan[0].predicted_calls += 1; }],
  ["missing baseline step", (value) => { value.baseline_plan[0].steps.pop(); }],
  ["relabelled baseline", (value) => { value.baseline_plan[0].case_id = "L1"; }],
  ["zero S calls changed", (value) => { value.cases[0].predicted_calls = 1; }],
  ["self-consistent wrong prediction", adjustPrediction],
  ["self-consistent truncated cases", truncate],
  ["empty steps", (value) => { value.cases.find((row) => row.case_id === "C1").expected = []; }],
  ["altered allowance", (value) => { value.planned_occurrence_budget.total += 1; value.planned_occurrence_budget.processes.sequential += 1; }],
  ["altered cap", (value) => { value.planned_occurrence_budget.limit = 4999; }],
  ["extra process", (value) => { value.planned_occurrence_budget.processes.extra = 1; }],
];

// The injected runner exercises the same plan/inventory guards before shared
// approval orchestration; no production runProbe, real entry or kit pipeline.
for (const [label, mutate] of PLAN_FAULTS) {
  test(`P-map preclaim refuses ${label} without a marker or launch`, () => withApproved(async (fixture) => {
    const { plan } = await capturedPlan();
    const value = evaluationPlan();
    mutate(value);
    let launched = false;
    await assert.rejects(async () => {
      plan.validate(value);
      await runApprovedSession({ ...fixture, session: () => { launched = true; },
        failure: () => assert.fail("no claim"), refuse: () => assert.fail("shape must fail earlier") });
    }, /malformed P-map expectations/);
    assert.equal(launched, false);
    assert.equal(existsSync(fixture.options["once-marker"]), false);
  }));
}

test("P-map frozen header and every per-case prediction mechanically close over controls and all cases", async () => {
  const { plan } = await capturedPlan();
  const value = evaluationPlan();
  assert.equal(plan.validate(value), value);
  assert.deepEqual(value.planned_occurrence_budget, P_MAP_BUDGET);
  const sum = [...BASELINE_PLAN, ...value.cases].reduce((total, row) => total + row.predicted_calls, 0);
  assert.equal(sum, P_MAP_BUDGET.predicted_total);
  assert.equal(value.cases.length, 39);
  for (const row of value.cases) assert.equal(row.predicted_calls, P_MAP_PREDICTED_CALLS[row.case_id], row.case_id);
  assert(P_MAP_BUDGET.total <= 5000);
});

test("P-map truncated inventory refuses before the marker with no child or kit launch", () => withApproved(async (fixture) => {
  const { plan } = await capturedPlan();
  plan.validate(evaluationPlan());
  assert.throws(() => validateProbeInventory({ repo: process.cwd(), prefix: `${CHANGE}/harness`, probeDirectory: plan.probeDirectory,
    files: plan.files.filter((file) => file !== "p-map/observation-validation.mjs" && file !== "p-map/workload.mjs") }), /import closure missing/);
  assert.equal(existsSync(fixture.options["once-marker"]), false);
}));
