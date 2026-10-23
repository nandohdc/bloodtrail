// Expectations are validated before any approval is claimed, with the same predicates the sender applies
// after the claim, so a malformed file is refused without spending a run.
import assert from "node:assert/strict";
import { validateCase, validateWorkloadInputs } from "../lib/expectations.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { validateFaultPlan } from "../lib/faults.mjs";

function validateRuntimeInputs(value) {
  validateWorkloadInputs(value);
  planBudget(value.planned_call_budget);
  assert.deepEqual(Object.keys(value.planned_call_budget.processes), ["sender"], "the tracer budgets only the sender");
  occurrenceLedger({ budget: value.planned_call_budget.processes.sender });
}

export function validateExpectations(value) {
  assert.equal(value.probe, "S2-tracer");
  assert.equal(value.version, 1);
  assert.equal(value.ticket, 836);
  assert.match(value.base, /^[0-9a-f]{40}$/);
  assert.equal(value.contract_version, "2.1.0");
  assert.equal(value.workload.occurrences, 1);
  validateRuntimeInputs(value);
  validateFaultPlan(value.fault_plan);
  assert(Number.isSafeInteger(value.deadline_ms) && value.deadline_ms > 0);
  assert.equal(value.planned_call_budget.total, value.workload.occurrences, "the call budget equals the planned occurrences");
  assert.equal(value.thresholds.unexplained, 0);
  assert.equal(value.cases.length, 7);
  value.cases.forEach((entry, index) => validateCase({ entry, index, prefix: "T" }));
  return value;
}
