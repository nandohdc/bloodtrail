// Expectations are validated before any approval is claimed, with the same predicates the sender applies
// after the claim, so a malformed file is refused without spending a run.
import assert from "node:assert/strict";
import { seededJitter, syntheticClock } from "../lib/clock.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { validateFaultPlan } from "../lib/faults.mjs";
import { seededRandom } from "../lib/workload.mjs";

const CASE_KEYS = ["case_id", "setup", "expected", "basis"];
const COMPOSITION_KEYS = ["exchange_timeout_ms", "max_attempts", "base_delay_ms", "max_delay_ms", "jitter_seed", "capacity", "shutdown_deadline_ms"];
// The kit factories' own ceilings at the frozen base: fetch-exchange.ts MAX_TIMEOUT_MS, delivery-retry.ts
// MAX_ATTEMPTS_CEILING and delivery-backpressure.ts MAX_CAPACITY_CEILING. Past them the factory throws.
const KIT_CEILINGS = Object.freeze({ exchange_timeout_ms: 60_000, max_attempts: 1000, capacity: 100_000 });

function validateComposition(composition) {
  for (const key of COMPOSITION_KEYS) assert(Number.isSafeInteger(composition[key]) && composition[key] > 0, `composition.${key}`);
  for (const [key, ceiling] of Object.entries(KIT_CEILINGS)) assert(composition[key] <= ceiling, `composition.${key} exceeds the kit ceiling ${ceiling}`);
  assert(composition.max_delay_ms >= composition.base_delay_ms, "composition.max_delay_ms must be at least base_delay_ms");
  seededJitter(composition.jitter_seed);
}

function validateRuntimeInputs(value) {
  seededRandom(value.workload.seed);
  syntheticClock({ start: value.clock.start, stepMs: value.clock.step_ms });
  validateComposition(value.composition);
  planBudget(value.planned_call_budget);
  assert.deepEqual(Object.keys(value.planned_call_budget.processes), ["sender"], "the tracer budgets only the sender");
  occurrenceLedger({ budget: value.planned_call_budget.processes.sender });
}

function validateCase(entry, index) {
  assert.equal(entry.case_id, `T-${String(index + 1).padStart(2, "0")}`);
  for (const key of CASE_KEYS) assert(Object.hasOwn(entry, key), `${entry.case_id}: missing ${key}`);
  assert(entry.setup.length > 0, `${entry.case_id}: empty setup`);
  assert(entry.basis.length > 0, `${entry.case_id}: empty basis`);
  for (const citation of entry.basis) assert.match(citation, /^packages\/.+:[0-9]+$/, `${entry.case_id}: basis must cite package source lines`);
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
  value.cases.forEach(validateCase);
  return value;
}
