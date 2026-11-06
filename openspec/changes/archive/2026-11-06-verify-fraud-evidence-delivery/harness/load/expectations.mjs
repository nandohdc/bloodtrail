// The load probe's expectations are validated before any approval is claimed, with the same predicates the
// session and the sender apply after the claim, so a malformed file is refused without spending a run.
import assert from "node:assert/strict";
import { KIT_CEILINGS, validateCase, validateComposition, validateSeedAndClock } from "../lib/expectations.mjs";
import { scheduledFaultPlan } from "../lib/faults.mjs";
import { PASSES } from "../lib/gated-session.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { OBSERVERS } from "./evaluate.mjs";

const KINDS = Object.freeze(["burst", "best_effort"]);
const BURST_SHUTDOWN = Object.freeze(["after_settle", "after_admission", "after_retry_scheduled"]);
// The observers that judge a whole pass, so they must read every one of its phases.
const PASS_WIDE = Object.freeze(["g4_predicates", "isolation_controls"]);
// The phase kind each single-phase observer reads.
const OBSERVER_KINDS = Object.freeze({ admission: "burst", shutdown_accounting: "burst", retry_accounting: "burst", loss: "best_effort" });

function positiveInteger(value, limit, label) {
  assert(Number.isSafeInteger(value) && value > 0 && value <= limit, label);
}

// A burst runs through the reference composition; its held answers must come back before the exchange
// deadline, so every admitted delivery is acknowledged unless shutdown abandons it first.
function validateCombinedBurst({ phase, scenarios }) {
  assert(phase.composition.max_attempts > 1, `${phase.name}: pending retries require multiple attempts`);
  assert(phase.occurrences > phase.composition.capacity, `${phase.name}: the combined case must saturate admission`);
  assert(phase.after_shutdown > 0, `${phase.name}: the combined case checks shutdown rejection`);
  for (const name of phase.schedule) {
    assert.deepEqual(scenarios[name], Array.from({ length: phase.composition.max_attempts }, (_, attempt) => ({ attempt, action: "status", status: 503 })), `${phase.name}: every possible attempt must fail uniformly before ingest`);
  }
}

function validateHeldBurst({ phase, scenarios }) {
  for (const name of phase.schedule) {
    for (const rule of scenarios[name]) {
      assert.equal(rule.action, "delay", `${phase.name}: a burst's answers are held, not failed`);
      assert(rule.delay_ms < phase.composition.exchange_timeout_ms, `${phase.name}: a held answer must beat the exchange deadline`);
    }
  }
}

function validateBurst({ phase, scenarios }) {
  validateComposition(phase.composition);
  assert(BURST_SHUTDOWN.includes(phase.shutdown), `${phase.name}: unknown shutdown timing`);
  assert(Number.isSafeInteger(phase.after_shutdown) && phase.after_shutdown >= 0, `${phase.name}: after_shutdown`);
  if (phase.after_shutdown > 0) assert.notEqual(phase.shutdown, "after_settle", `${phase.name}: later submissions need a shutdown in progress`);
  if (phase.shutdown === "after_retry_scheduled") validateCombinedBurst({ phase, scenarios });
  else validateHeldBurst({ phase, scenarios });
}

// best_effort runs through the binding's class: one attempt over the governed exchange, a loss ceiling. A
// scheduled drop is a refused answer to that one attempt; any other attempt is acknowledged.
function validateBestEffort({ phase, scenarios }) {
  for (const name of phase.schedule) {
    for (const rule of scenarios[name]) {
      assert.equal(rule.attempt, 0, `${phase.name}: best_effort makes one attempt`);
      assert.equal(rule.action, "status", `${phase.name}: a best_effort drop is a refused answer`);
    }
  }
  assert.deepEqual(Object.keys(phase.composition).sort(), ["exchange_timeout_ms", "loss_ceiling"], `${phase.name}: best_effort takes an exchange deadline and a loss ceiling`);
  positiveInteger(phase.composition.exchange_timeout_ms, KIT_CEILINGS.exchange_timeout_ms, `${phase.name}: exchange_timeout_ms`);
  positiveInteger(phase.composition.loss_ceiling, KIT_CEILINGS.loss_ceiling, `${phase.name}: loss_ceiling`);
  assert.equal(phase.shutdown, "after_sequence", `${phase.name}: best_effort shuts down after its sequence`);
  assert.equal(phase.after_shutdown, 0, `${phase.name}: best_effort submits nothing after shutdown`);
}

function validatePhases({ phases, scenarios }) {
  assert.equal(new Set(phases.map((phase) => phase.name)).size, phases.length, "phase names must be unique");
  const order = phases.map((phase) => PASSES.indexOf(phase.pass));
  assert(!order.includes(-1), "every phase names a pass");
  assert.deepEqual(order, [...order].sort((left, right) => left - right), "small-pass phases come first");
  for (const pass of PASSES) assert(order.includes(PASSES.indexOf(pass)), `the ${pass} pass has no phase`);
  for (const phase of phases) {
    assert.match(phase.name, /^[a-z_]+$/, `invalid phase name: ${phase.name}`);
    assert(KINDS.includes(phase.kind), `${phase.name}: unknown kind`);
    positiveInteger(phase.occurrences, Number.MAX_SAFE_INTEGER, `${phase.name}: occurrences`);
    assert.equal(phase.schedule.length * phase.cycles, phase.occurrences + phase.after_shutdown, `${phase.name}: the schedule covers every submission`);
    scheduledFaultPlan({ scenarios, schedule: phase.schedule, cycles: phase.cycles });
    if (phase.kind === "burst") validateBurst({ phase, scenarios });
    else validateBestEffort({ phase, scenarios });
  }
}

function validateBudget({ budget, phases }) {
  planBudget(budget);
  assert.deepEqual(Object.keys(budget.processes), phases.map((phase) => phase.name), "the load probe budgets one sender per phase");
  for (const phase of phases) {
    assert.equal(budget.processes[phase.name], phase.occurrences + phase.after_shutdown, `${phase.name}: the call budget equals its submissions`);
    occurrenceLedger({ budget: budget.processes[phase.name] });
  }
}

function validateCaseShape({ entry, phases }) {
  assert(Object.hasOwn(OBSERVERS, entry.observer), `${entry.case_id}: unknown observer`);
  assert(Array.isArray(entry.phases) && entry.phases.length > 0, `${entry.case_id}: names no phase`);
  const named = entry.phases.map((name) => phases.find((phase) => phase.name === name));
  assert(named.every((phase) => phase !== undefined && phase.pass === entry.pass), `${entry.case_id}: every phase must be a known phase of its pass`);
  if (Object.hasOwn(OBSERVER_KINDS, entry.observer)) {
    assert.equal(named.length, 1, `${entry.case_id}: ${entry.observer} reads one phase`);
    assert.equal(named[0].kind, OBSERVER_KINDS[entry.observer], `${entry.case_id}: ${entry.observer} reads a ${OBSERVER_KINDS[entry.observer]} phase`);
  }
  if (entry.observer === "planted_controls") assert.deepEqual(named.map((phase) => phase.kind), KINDS, `${entry.case_id}: planted controls read a burst, then a best_effort phase`);
  if (PASS_WIDE.includes(entry.observer)) {
    const all = phases.filter((phase) => phase.pass === entry.pass).map((phase) => phase.name);
    assert.deepEqual(entry.phases, all, `${entry.case_id}: ${entry.observer} reads every phase of its pass`);
  }
}

function validateCases({ cases, phases }) {
  cases.forEach((entry, index) => {
    validateCase({ entry, index, prefix: "L" });
    assert(PASSES.includes(entry.pass), `${entry.case_id}: unknown pass`);
    validateCaseShape({ entry, phases });
  });
  const order = cases.map((entry) => PASSES.indexOf(entry.pass));
  assert.deepEqual(order, [...order].sort((left, right) => left - right), "small-pass cases come before volume-pass cases");
  for (const pass of PASSES) assert(order.includes(PASSES.indexOf(pass)), `the ${pass} pass has no case`);
}

const SUPPORTED_VERSIONS = Object.freeze([1, 2]);

export function validateExpectations(value) {
  assert.equal(value.probe, "S2-load");
  assert(SUPPORTED_VERSIONS.includes(value.version), `unsupported expectations version: ${value.version}`);
  assert.equal(value.ticket, 838);
  assert.match(value.base, /^[0-9a-f]{40}$/);
  assert.equal(value.contract_version, "2.1.0");
  validateSeedAndClock(value);
  validatePhases(value);
  validateBudget({ budget: value.planned_call_budget, phases: value.phases });
  assert(Number.isSafeInteger(value.deadline_ms) && value.deadline_ms > 0);
  assert.equal(value.thresholds.unexplained, 0);
  validateCases(value);
  if (value.version === 2) {
    for (const name of ["abandon", "retry_shutdown"]) {
      const phase = value.phases.find((p) => p.name === name);
      assert(phase, `version 2 requires phase: ${name}`);
      assert.equal(phase.composition.shutdown_deadline_ms, 200, `${name}: shutdown_deadline_ms must be 200`);
      assert.equal(phase.composition.drain_budget_ms, 180, `${name}: drain_budget_ms must be 180`);
      assert.equal(phase.composition.report_reserve_ms, 20, `${name}: report_reserve_ms must be 20`);
    }
  }
  return value;
}
