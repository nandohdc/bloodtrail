import assert from "node:assert/strict";
import { planBudget } from "../lib/ledger.mjs";
import { validateComposition } from "../lib/expectations.mjs";
import { plannedCalls, referencedPlan, verifyReferences } from "./plans.mjs";
import { sourceTruth, workloadFor } from "./workload.mjs";
import { OBSERVATION_CONTRACT } from "./observations.mjs";
import { validateShape } from "./shape.mjs";
import { frozenCallPlan } from "./accounting.mjs";

export const RECONCILIATION = "persisted_distinct_by_event_id + reported_undelivered_and_not_persisted = ground_truth; persisted_despite_failure_report itemized; unexplained or outside_ground_truth is a mismatch";
export const CASES = Object.freeze([
  "plans", "successful", "failed", "remainder", "duplicates",
  "per_target", "observations", "planted", "isolation", "accounting",
]);

export function noObservationThresholds(value) {
  try {
    validateShape(value);
    return true;
  } catch (error) {
    assert(error instanceof Error);
    return false;
  }
}

function validateCases(expectations) {
  assert.equal(expectations.cases.length, 10);
  expectations.cases.forEach((entry, index) => {
    assert.equal(entry.case_id, `N-${String(index + 1).padStart(2, "0")}`);
    assert.equal(entry.observer, CASES[index]);
    assert.equal(entry.pass, "small");
    assert.deepEqual(entry.expected, { holds: true });
    assert(entry.basis.length > 0);
  });
}

function extraBound(original, phase) {
  if (original.kind === "consumer_restart") return phase.occurrences;
  if (original.kind === "duplicates_volume") return phase.occurrences;
  if (original.kind === "identities") return 2;
  if (original.kind === "collector_restart") return 1;
  return 0;
}

function validatePhase(expectations, phase, files) {
  const reference = expectations.plans.find((plan) => plan.phase === phase.name);
  const original = referencedPlan(reference, files);
  assert.equal(phase.pass, original.pass);
  assert.equal(phase.seed_offset, expectations.phases.indexOf(phase));
  const count = Math.max(4, Math.ceil(original.occurrences / 6));
  assert.equal(phase.chain_count, count);
  assert.equal(phase.failed_count, count);
  assert.equal(phase.tenant_count, 1);
  assert.equal(phase.occurrences, 6 * count);
  assert.equal(phase.basis.frozen_occurrences, original.occurrences);
  assert.equal(phase.basis.formula, "chain_count = max(4, ceil(frozen_occurrences / 6)); failed_count = chain_count");
  assert.equal(phase.extra_call_bound, extraBound(original, phase));
  assert.equal(expectations.planned_call_budget.processes[phase.name], plannedCalls(phase));
  assert.deepEqual(phase.call_plan, frozenCallPlan({ phase, kind: original.kind }));
  assert.deepEqual(expectations.ground_truth[phase.name], sourceTruth(workloadFor(expectations, phase)));
  validateComposition(original.composition);
}

function validateInventory(expectations) {
  const included = expectations.plans.filter((plan) => !plan.excluded_reason);
  assert.deepEqual(included.map((plan) => plan.phase), expectations.phases.map((phase) => phase.name));
  assert.equal(new Set(included.map((plan) => plan.phase)).size, included.length);
  expectations.plans.filter((plan) => plan.excluded_reason).forEach((plan) => {
    assert.equal(typeof plan.excluded_reason, "string");
    assert(plan.excluded_reason.length > 20);
    assert(["best_effort", "best_effort_volume", "storage_less"].includes(plan.id));
  });
}

export function validateExpectations(expectations, read) {
  validateShape(expectations);
  assert.equal(expectations.probe, "S2-counts");
  assert.equal(expectations.ticket, 841);
  assert.equal(expectations.version, 1);
  assert.equal(expectations.contract_version, "2.1.0");
  assert.match(expectations.base, /^[0-9a-f]{40}$/);
  assert.equal(expectations.reconciliation, RECONCILIATION);
  assert.equal(expectations.per_target, "not_attempted");
  assert.equal(expectations.per_target_reference, "G33");
  assert.deepEqual(expectations.observations, OBSERVATION_CONTRACT);
  assert.equal(expectations.deadline_ms, 300000);
  assert.equal(expectations.workload.seed, 841001);
  assert.equal(expectations.clock.start, "2026-10-23T00:00:00.000Z");
  assert.equal(expectations.clock.step_ms, 1000);
  assert(noObservationThresholds(expectations), "observation thresholds are forbidden");
  const files = verifyReferences(expectations, read);
  validateInventory(expectations);
  expectations.phases.forEach((phase) => validatePhase(expectations, phase, files));
  planBudget({ ...expectations.planned_call_budget, limit: 20000 });
  assert.deepEqual(Object.keys(expectations.planned_call_budget.processes), expectations.phases.map((phase) => phase.name));
  validateCases(expectations);
  return Object.freeze(expectations);
}
