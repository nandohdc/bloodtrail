// Validates the chains probe expectations before any approval is claimed (#840, Q201, Q208, Q225, Q230, Q233).
import assert from "node:assert/strict";
import { validateCase, validateComposition, validateSeedAndClock } from "../lib/expectations.mjs";
import { PASSES } from "../lib/gated-session.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { OBSERVERS } from "./evaluate.mjs";
import { generateWorkloadDefinition } from "./workload.mjs";
import { phaseCallPlan } from "./call-plan.mjs";
import { codePointCompare } from "./reconstruct.mjs";

const KINDS = Object.freeze(["chains"]);
const KNOWN_SCENARIOS = Object.freeze(["clean"]);
const TOP_LEVEL_KEYS = Object.freeze([
  "probe", "version", "ticket", "base", "contract_version",
  "workload", "clock", "composition", "scenarios", "phases",
  "deadline_ms", "planned_call_budget", "ground_truth", "cases",
]);

const PHASE_KEYS = Object.freeze([
  "name", "pass", "kind", "occurrences", "distinct_occurrences",
  "schedule", "cycles", "composition",
  "chain_count", "tenant_count", "failed_count", "seed_offset",
]);

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
  for (const key of Object.keys(phase)) {
    assert(PHASE_KEYS.includes(key), `unknown or forbidden key ${key} on phase ${phase.name}`);
  }
}

function validatePhaseCounts(phase, expectations) {
  assert(Number.isSafeInteger(phase.chain_count) && phase.chain_count > 0, `invalid chain_count for ${phase.name}`);
  assert(Number.isSafeInteger(phase.tenant_count) && phase.tenant_count > 0, `invalid tenant_count for ${phase.name}`);
  assert(Number.isSafeInteger(phase.failed_count) && phase.failed_count > 0, `invalid failed_count for ${phase.name}`);
  assert(Number.isSafeInteger(phase.seed_offset) && phase.seed_offset >= 0, `invalid seed_offset for ${phase.name}`);

  const expectedSteps = 5 * phase.chain_count + phase.failed_count;
  assert.equal(phase.occurrences, expectedSteps, `occurrences must equal submission steps (${expectedSteps}) for ${phase.name}`);
  assert.equal(phase.distinct_occurrences, expectedSteps, `distinct_occurrences must equal submission steps (${expectedSteps}) for ${phase.name}`);
  assert.equal(phase.schedule.length, expectedSteps, `schedule length must equal submission steps (${expectedSteps}) for ${phase.name}`);

  const plan = phaseCallPlan(phase, expectations.workload.seed);
  const phaseBudget = expectations.planned_call_budget?.processes?.[phase.name];
  assert.equal(phaseBudget, plan.length, `per-phase budget (${phaseBudget}) must equal call plan (${plan.length}) for ${phase.name}`);
}

function validatePhases(expectations) {
  const { phases, scenarios = {} } = expectations;
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
    validatePhaseCounts(phase, expectations);
    validateComposition(phase.composition);
    validatePhaseSchedule(phase, scenarios);
  }
}

function validateBudget(budget, phases) {
  planBudget(budget);
  const budgetNames = Object.keys(budget.processes).sort(codePointCompare);
  const phaseNames = phases.map((p) => p.name).sort(codePointCompare);
  assert.deepEqual(budgetNames, phaseNames, "budget must match phase names");
  let totalCalculated = 0;
  for (const phase of phases) {
    const phaseBudget = budget.processes[phase.name];
    assert(Number.isSafeInteger(phaseBudget), `missing budget for ${phase.name}`);
    occurrenceLedger({ budget: phaseBudget });
    totalCalculated += phaseBudget;
  }
  assert.equal(budget.total, totalCalculated, `planned_call_budget.total must equal sum of per-phase budgets (${totalCalculated})`);
}

function validateGroundTruthPhase(gt, phaseName) {
  assert(gt && typeof gt === "object", `ground_truth for ${phaseName} must be an object`);
  assert(gt.chains && typeof gt.chains === "object", `ground_truth.chains missing for ${phaseName}`);
  assert(gt.per_source_counts && typeof gt.per_source_counts === "object", `per_source_counts missing for ${phaseName}`);
  assert(gt.per_tenant_partitions && typeof gt.per_tenant_partitions === "object", `per_tenant_partitions missing for ${phaseName}`);
  assert(gt.failed_authentications && typeof gt.failed_authentications === "object", `failed_authentications missing for ${phaseName}`);
  assert(Array.isArray(gt.shared_source_pairs), `shared_source_pairs must be an array for ${phaseName}`);
}

function validateGroundTruth(expectations) {
  const { ground_truth: groundTruth, phases, workload, clock } = expectations;
  assert(groundTruth && typeof groundTruth === "object", "ground_truth is required");
  for (const phase of phases) {
    const phaseGt = groundTruth[phase.name] ?? groundTruth;
    validateGroundTruthPhase(phaseGt, phase.name);
    const seed = workload.seed + (phase.seed_offset ?? 0);
    const regenerated = generateWorkloadDefinition({
      seed,
      chainCount: phase.chain_count,
      tenantCount: phase.tenant_count,
      failedCount: phase.failed_count,
      clockStart: clock.start,
      clockStepMs: clock.step_ms,
    });
    assert.deepEqual(phaseGt, regenerated.groundTruth, `ground truth mismatch for phase ${phase.name}`);
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
    validateCase({ entry, index, prefix: "R" });
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
  assert.equal(expectations.probe, "S2-chains");
  assert.equal(expectations.ticket, 840);
  assert.equal(expectations.version, 1, `unsupported expectations version: ${expectations.version}`);
  assert.equal(expectations.contract_version, "2.1.0");
  assert.match(expectations.base, /^[0-9a-f]{40}$/, "base must be a 40-character commit sha");

  validateSeedAndClock(expectations);
  validateComposition(expectations.composition);
  validatePhases(expectations);
  validateBudget(expectations.planned_call_budget, expectations.phases);
  validateGroundTruth(expectations);
  validateCases(expectations.cases, expectations.phases);

  return Object.freeze(expectations);
}
