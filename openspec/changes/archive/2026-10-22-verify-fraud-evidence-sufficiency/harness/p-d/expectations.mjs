import assert from "node:assert/strict";
import { planBudget } from "../lib/ledger.mjs";
import { CASE_ORDER, CASES, PLANNED_TOTAL } from "./cases.mjs";

export function validateExpectations(value) {
  assert.equal(value.probe, "P-D");
  assert.equal(value.version, 1);
  assert.equal(value.corrected_at, "dbdd0936ba874d7b622403103644206c4a6fa56f");
  assert.deepEqual(value.cases.map((entry) => entry.case_id), CASE_ORDER);
  assert.equal(new Set(CASE_ORDER).size, 66);
  for (const entry of value.cases) validateCase(entry);
  assert.deepEqual(value.planned_occurrence_budget.calls_by_case, Object.fromEntries(CASES.map((entry) => [entry.case_id, entry.calls])));
  const prediction = Object.values(value.planned_occurrence_budget.calls_by_case).reduce((sum, calls) => sum + calls, 0);
  assert.equal(prediction, PLANNED_TOTAL);
  assert.equal(value.planned_occurrence_budget.predicted_total, prediction);
  assert.equal(prediction, 371);
  const budget = planBudget(value.planned_occurrence_budget);
  assert.deepEqual(budget.processes, { integrity: 742 });
  return value;
}

function validateCase(entry) {
  for (const field of ["setup", "expected", "basis", "classification", "confidence"]) assert(entry[field], `${entry.case_id}: missing ${field}`);
  assert(entry.basis.length > 0);
  assert(["holds", "gap", "bypass", "cannot-establish"].includes(entry.classification));
  const steps = entry.expected.map((step) => step.step_id);
  assert.equal(new Set(steps).size, steps.length);
  for (const step of entry.expected) {
    assert(step.step_id.startsWith(`${entry.case_id}/`));
    assert(["accepted", "returned-refusal", "thrown-sdk", "raw-throw"].includes(step.assertions.surface));
    assert(Number.isInteger(step.assertions.sink_count));
  }
}
