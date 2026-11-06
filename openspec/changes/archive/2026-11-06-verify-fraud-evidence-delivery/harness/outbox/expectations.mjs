// Validates the outbox probe expectations before any approval is claimed (#842, Q243, Q251, Q252).
import assert from "node:assert/strict";
import { validateComposition, validateSeedAndClock } from "../lib/expectations.mjs";
import { PASSES } from "../lib/gated-session.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { OBSERVERS } from "./evaluate.mjs";
import { phaseCallPlan } from "./call-plan.mjs";

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function nonemptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function codePointCompare(left, right) {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    const difference = leftPoints[index] - rightPoints[index];
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function validateCrashPoint(phase) {
  if (phase.kind !== "crash_restart") return;
  const crash = phase.crash_after_acknowledgment;
  assert(Number.isSafeInteger(crash), "crash_after_acknowledgment must be an integer");
  assert(crash >= 1, "crash_after_acknowledgment must be positive");
  assert(crash <= phase.change_count, "crash_after_acknowledgment exceeds change_count");
}

const KINDS = Object.freeze(["commit_relay", "rollback", "crash_restart", "outage_defer"]);
const KNOWN_SCENARIOS = Object.freeze(["clean", "outage"]);
const TOP_LEVEL_KEYS = Object.freeze([
  "probe", "version", "ticket", "base", "contract_version",
  "workload", "clock", "composition", "scenarios", "phases",
  "deadline_ms", "planned_call_budget", "cases",
]);

const PHASE_KEYS = Object.freeze([
  "name", "pass", "kind", "occurrences", "distinct_occurrences",
  "schedule", "cycles", "composition", "change_count", "crash_after_acknowledgment",
]);

function validatePhaseSchedule(phase, scenarios) {
  assert(Array.isArray(phase.schedule), `schedule must be an array for ${phase.name}`);
  assert(
    positiveInteger(phase.cycles),
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
  for (const key of Object.keys(phase)) {
    assert(PHASE_KEYS.includes(key), `unknown or forbidden key ${key} on phase ${phase.name}`);
  }
}

function validatePhaseCounts(phase, expectations) {
  assert(positiveInteger(phase.occurrences), `invalid occurrences for ${phase.name}`);
  assert.equal(phase.distinct_occurrences, phase.occurrences, `distinct_occurrences must equal occurrences for ${phase.name}`);
  assert.equal(phase.change_count, phase.occurrences, `change_count must equal occurrences for ${phase.name}`);

  const plan = phaseCallPlan(phase);
  const phaseBudget = expectations.planned_call_budget?.processes?.[phase.name];
  assert.equal(phaseBudget, plan.length, `per-phase budget (${phaseBudget}) must equal call plan (${plan.length}) for ${phase.name}`);
}

function validatePhases(expectations) {
  const { phases, scenarios = {} } = expectations;
  assert(nonemptyArray(phases), "phases must be a non-empty array");
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
    validateCrashPoint(phase);
    validatePhaseCounts(phase, expectations);
    validateComposition(phase.composition);
    validatePhaseSchedule(phase, scenarios);
  }
}

function validateBudget(budget, phases) {
  planBudget(budget);
  assert.deepEqual(
    Object.keys(budget.processes).sort(codePointCompare),
    phases.map((p) => p.name).sort(codePointCompare),
    "budget must match phase names",
  );
  let totalCalculated = 0;
  for (const phase of phases) {
    const phaseBudget = budget.processes[phase.name];
    assert(Number.isSafeInteger(phaseBudget), `missing budget for ${phase.name}`);
    occurrenceLedger({ budget: phaseBudget });
    totalCalculated += phaseBudget;
  }
  assert.equal(budget.total, totalCalculated, `planned_call_budget.total must equal sum of per-phase budgets (${totalCalculated})`);
}

function validateOutboxCase(entry, index) {
  assert.equal(entry.case_id, `H-${String(index + 1).padStart(2, "0")}`);
  const required = ["case_id", "setup", "expected", "basis"];
  assert(required.every((key) => Object.hasOwn(entry, key)), `${entry.case_id}: missing case field`);
  assert.equal(typeof entry.setup, "string");
  assert(entry.setup.length > 0, `${entry.case_id}: empty setup`);
  assert(nonemptyArray(entry.basis), `${entry.case_id}: empty basis`);
  const sourceLine = /^(?:packages\/|openspec\/changes\/verify-fraud-evidence-delivery\/harness\/)[^:]+:[1-9][0-9]*$/;
  for (const citation of entry.basis) assert.match(citation, sourceLine, `${entry.case_id}: basis must cite package or harness source lines`);
}

function validateCases(cases, phases) {
  const elevenCases = Array.isArray(cases) && cases.length === 11;
  assert(elevenCases, "cases must contain exactly 11 cases");
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
    validateOutboxCase(entry, index);
  }
  const order = cases.map((entry) => PASSES.indexOf(entry.pass));
  assert.deepEqual(order, [...order].sort((left, right) => left - right), "small-pass cases come before volume-pass cases");
  for (const pass of PASSES) assert(order.includes(PASSES.indexOf(pass)), `the ${pass} pass has no case`);
}

function validateTopLevelKeys(expectations) {
  for (const key of Object.keys(expectations)) {
    assert(TOP_LEVEL_KEYS.includes(key), `unknown top-level key: ${key}`);
  }
}

export function validateExpectations(expectations) {
  validateTopLevelKeys(expectations);
  assert.equal(expectations.probe, "S2-outbox");
  assert.equal(expectations.ticket, 842);
  assert.equal(expectations.version, 1, `unsupported expectations version: ${expectations.version}`);
  assert.equal(expectations.contract_version, "2.1.0");
  assert.match(expectations.base, /^[0-9a-f]{40}$/, "base must be a 40-character commit sha");

  validateSeedAndClock(expectations);
  validateComposition(expectations.composition);
  validatePhases(expectations);
  validateBudget(expectations.planned_call_budget, expectations.phases);
  validateCases(expectations.cases, expectations.phases);

  return Object.freeze(expectations);
}
