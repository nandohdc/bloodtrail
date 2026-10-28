// Validates the copies probe expectations before any approval is claimed.
import assert from "node:assert/strict";
import { validateCase, validateComposition, validateSeedAndClock } from "../lib/expectations.mjs";
import { PASSES } from "../lib/gated-session.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { OBSERVERS } from "./evaluate.mjs";

const KINDS = Object.freeze(["identities", "collector_restart", "consumer_restart", "storage_less", "duplicates_volume"]);
const KNOWN_SCENARIOS = Object.freeze(["clean", "retry_once"]);

function validatePhaseSchedule(phase, scenarios) {
  assert(Array.isArray(phase.schedule), `schedule must be an array for ${phase.name}`);
  assert(
    typeof phase.cycles === "number" && Number.isSafeInteger(phase.cycles) && phase.cycles > 0,
    `cycles is required and must be a positive safe integer for ${phase.name}`,
  );
  assert.equal(
    phase.schedule.length * phase.cycles,
    phase.distinct_occurrences,
    `schedule length times cycles must equal distinct_occurrences for ${phase.name}`,
  );
  for (const entry of phase.schedule) {
    assert(Object.hasOwn(scenarios, entry), `unknown schedule entry: ${entry}`);
  }
}

function validatePhaseKeys(phase) {
  const allowed = phase.kind === "consumer_restart"
    ? ["name", "pass", "kind", "occurrences", "distinct_occurrences", "schedule", "cycles", "composition", "gate_timers"]
    : ["name", "pass", "kind", "occurrences", "distinct_occurrences", "schedule", "cycles", "composition"];
  for (const key of Object.keys(phase)) {
    assert(allowed.includes(key), `unknown or forbidden key ${key} on phase ${phase.name}`);
  }
}

function validatePhases(phases, scenarios = {}) {
  assert(Array.isArray(phases) && phases.length > 0, "phases must be a non-empty array");
  for (const name of Object.keys(scenarios)) {
    assert(KNOWN_SCENARIOS.includes(name), `unknown scenario name: ${name}`);
  }
  const names = new Set();
  for (const phase of phases) {
    assert(!names.has(phase.name), `duplicate phase name: ${phase.name}`);
    names.add(phase.name);
    validatePhaseKeys(phase);
    assert(PASSES.includes(phase.pass), `invalid pass for phase ${phase.name}: ${phase.pass}`);
    assert(KINDS.includes(phase.kind), `invalid kind for phase ${phase.name}: ${phase.kind}`);
    assert(Number.isSafeInteger(phase.occurrences) && phase.occurrences > 0, `invalid occurrences for ${phase.name}`);
    assert(Number.isSafeInteger(phase.distinct_occurrences) && phase.distinct_occurrences > 0, `invalid distinct_occurrences for ${phase.name}`);
    if (phase.kind === "consumer_restart") {
      assert(phase.gate_timers === true, `gate_timers must be true for consumer_restart phase`);
    }
    validateComposition(phase.composition);
    validatePhaseSchedule(phase, scenarios);
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
  assert.equal(expectations.version, 2, `unsupported expectations version: ${expectations.version}`);
  assert.equal(expectations.contract_version, "2.1.0");
  validateSeedAndClock(expectations);
  validateComposition(expectations.composition);
  validatePhases(expectations.phases, expectations.scenarios);
  validateBudget(expectations.planned_call_budget, expectations.phases);
  validateCases(expectations.cases, expectations.phases);
  return Object.freeze(expectations);
}
