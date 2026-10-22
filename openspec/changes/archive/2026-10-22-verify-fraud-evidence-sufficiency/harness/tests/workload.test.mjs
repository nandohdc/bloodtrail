import assert from "node:assert/strict";
import test from "node:test";
import { fixtureState } from "./process-fixture.mjs";
import { ROLES } from "../p-ids/roles.mjs";
import { measureRole } from "../p-ids/measure.mjs";
import { captureState } from "../p-ids/workload.mjs";
import { evaluateCases } from "../p-ids/evaluate.mjs";
import { jsonFile } from "../lib/io.mjs";

const EXPECTATIONS = jsonFile(new URL("../expectations/p-ids.v1.json", import.meta.url));

test("fixture-only role sequences exactly consume frozen per-process budgets; 02/06 reuse 01", async () => {
  const observations = [];
  for (const plan of ROLES) {
    const budget = EXPECTATIONS.planned_occurrence_budget.processes[plan.role];
    const state = fixtureState({ role: plan.role, budget });
    await measureRole({ state, plan });
    assert.deepEqual(state.invalidations, [], plan.role);
    assert.equal(state.ledger.report().occurrence_count, budget, plan.role);
    observations.push(captureState({ state }));
  }
  const results = evaluateCases({ observations, expectations: EXPECTATIONS });
  for (const entry of results.slice(0, 11)) assert.equal(entry.matched, true, entry.case_id);
  assert.equal(results[11].matched, null);
  assert.equal(results[11].raw.execution, "not executed: Stage 2 (G22)");
  assert.equal(results[2].raw.processes[0], results[1].raw.processes[0]);
  assert.equal(results[6].raw.processes[0], results[1].raw.processes[0]);
  const repeated = structuredClone(observations);
  repeated.find((process) => process.role === "core-B").ids.event_id[0] = repeated.find((process) => process.role === "core-A").ids.event_id[0];
  assert.equal(evaluateCases({ observations: repeated, expectations: EXPECTATIONS })[1].matched, false);
});

test("positive setup refusal does not execute remaining factories or negatives", async () => {
  const state = fixtureState({ role: "setup", budget: 28 });
  state.factories.core = () => { throw new Error("fixture positive construction refused"); };
  await measureRole({ state, plan: ROLES[0] });
  assert.equal(state.ledger.report().occurrence_count, 2);
  assert.equal(state.invalidations.length, 1);
  assert.equal(state.recorder.outcomes.length, 2);
});
