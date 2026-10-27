// Validates the copies probe expectations before any approval is claimed.
import assert from "node:assert/strict";
import { validateCase, validateComposition, validateSeedAndClock } from "../lib/expectations.mjs";
import { PASSES } from "../lib/gated-session.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { OBSERVERS } from "./evaluate.mjs";

const KINDS = Object.freeze(["identities", "collector_restart", "consumer_restart", "storage_less", "duplicates_volume"]);

function validatePhases(phases) {
  assert(Array.isArray(phases) && phases.length > 0, "phases must be a non-empty array");
  const names = new Set();
  for (const phase of phases) {
    assert(!names.has(phase.name), `duplicate phase name: ${phase.name}`);
    names.add(phase.name);
    assert(PASSES.includes(phase.pass), `invalid pass for phase ${phase.name}: ${phase.pass}`);
    assert(KINDS.includes(phase.kind), `invalid kind for phase ${phase.name}: ${phase.kind}`);
    assert(Number.isSafeInteger(phase.occurrences) && phase.occurrences > 0, `invalid occurrences for ${phase.name}`);
    validateComposition(phase.composition);
  }
}

function validateBudget(budget, phases) {
  planBudget(budget);
  assert.deepEqual(Object.keys(budget.processes).sort(), phases.map((p) => p.name).sort(), "budget must match phase names");
  for (const phase of phases) {
    assert(Number.isSafeInteger(budget.processes[phase.name]), `missing budget for ${phase.name}`);
    occurrenceLedger({ budget: budget.processes[phase.name] });
  }
}

function validateCases(cases, phases) {
  assert(Array.isArray(cases) && cases.length === 11, "cases must contain exactly 11 cases");
  const ids = new Set();
  const phaseNames = new Set(phases.map((p) => p.name));
  for (const [index, entry] of cases.entries()) {
    assert(!ids.has(entry.case_id), `duplicate case_id: ${entry.case_id}`);
    ids.add(entry.case_id);
    assert(PASSES.includes(entry.pass), `invalid pass in case: ${entry.case_id}`);
    assert(Object.hasOwn(OBSERVERS, entry.observer), `unknown observer in case ${entry.case_id}: ${entry.observer}`);
    assert(Array.isArray(entry.phases), `phases must be array in case: ${entry.case_id}`);
    for (const phaseName of entry.phases) {
      assert(phaseNames.has(phaseName), `unknown phase ${phaseName} cited by case ${entry.case_id}`);
    }
    validateCase({ entry, index, prefix: "C" });
  }
  const order = cases.map((entry) => PASSES.indexOf(entry.pass));
  assert.deepEqual(order, [...order].sort((left, right) => left - right), "small-pass cases come before volume-pass cases");
  for (const pass of PASSES) assert(order.includes(PASSES.indexOf(pass)), `the ${pass} pass has no case`);
}

export function validateExpectations(expectations) {
  assert.equal(expectations.probe, "S2-copies");
  assert.equal(expectations.ticket, 839);
  assert.equal(expectations.version, 1);
  assert.equal(expectations.contract_version, "2.1.0");
  validateSeedAndClock(expectations);
  validateComposition(expectations.composition);
  validatePhases(expectations.phases);
  validateBudget(expectations.planned_call_budget, expectations.phases);
  validateCases(expectations.cases, expectations.phases);
  return Object.freeze(expectations);
}
