// G1 probe and evaluator: per-case containment through the shared runCase
// helper. One unexpected SDK refusal inside a family case becomes an owned
// `case_aborted` observation; measure() finishes every other case in every
// family with no invalidation. Budget exhaustion and baseline failures keep
// their stopping semantics. Offline public-shape doubles only: no kit/SDK
// import or execution, no probe run, no network.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CONCURRENCY_CASES } from "../p-e/concurrency-cases.mjs";
import { CONSTRUCTION_CASES } from "../p-e/construction-cases.mjs";
import { ORDERING_CASES } from "../p-e/ordering-cases.mjs";
import { OUTBOX_CASES } from "../p-e/outbox-cases.mjs";
import { RECOVERY_CASES } from "../p-e/recovery-cases.mjs";
import { REDELIVERY_CASES } from "../p-e/redelivery-cases.mjs";
import { measure } from "../p-e/workload.mjs";
import { evaluateProbe } from "../p-e/evaluate.mjs";
import { evaluateWithGuard } from "../lib/probe-runner.mjs";
import { authenticationFailed, concurrencyState } from "./p-e-concurrency-fixtures.mjs";
import { recoveryDouble } from "./p-e-recovery-fixtures.mjs";
import { fixtureState } from "./p-e-runtime-fixtures.mjs";

const FAMILY_CASES = [CONSTRUCTION_CASES, ORDERING_CASES, REDELIVERY_CASES,
  CONCURRENCY_CASES, OUTBOX_CASES, RECOVERY_CASES];
const CASE_IDS = ["P-E-g", "P-E-adm",
  ...FAMILY_CASES.flatMap((cases) => cases.map((entry) => entry.case_id))];
const BASELINE_CALLS = 28;
// A refusal where v1 predicts acceptance: the uncontrolled follow-up read
// (`emit.captures[0].event`) then throws inside the case.
const UNEXPECTED_REFUSAL = () => ({ ok: false,
  error: { code: "SDK_UNEXPECTED_REFUSAL", category: "lifecycle", path: "/probe" } });
const EXPECTATIONS = JSON.parse(readFileSync(new URL("../expectations/p-e.v1.json", import.meta.url), "utf8"));
const FAMILY_REFUSALS = [
  { family: "construction", caseId: "P-E-1a", faultInstance: 2, method: "beginOperation" },
  { family: "ordering", caseId: "P-E-2", faultInstance: 8, method: "mfaRemoved" },
  { family: "redelivery", caseId: "P-E-5", faultInstance: 15, method: "mfaRemoved" },
  { family: "concurrency", caseId: "P-E-6b", faultInstance: 25, method: "mfaRemoved" },
  { family: "outbox", caseId: "P-E-9b", faultInstance: 28, method: "mfaRemoved" },
  { family: "recovery", caseId: "P-E-10b", faultInstance: 30, method: "beginOperation" },
  { family: "construction SDK throw mentioning budget exhausted", caseId: "P-E-1a",
    faultInstance: 2, method: "beginOperation",
    fault: () => { throw new Error("SDK callback: budget exhausted"); } },
];

// The full 32-case process needs every offline public surface (recovery and
// admission extensions plus observedSource). faultInstance is the nth
// createNodeSecurityAuditSdk call of the run; the fixed sequential family
// order makes it deterministic (P-E-6b is instance 25).
function refusingPeState({ faultInstance, method = "mfaRemoved", budget = 5000, fault = UNEXPECTED_REFUSAL }) {
  const modules = recoveryDouble();
  modules.core.observedSource = (input) => Object.freeze(structuredClone(input));
  const factory = modules.node.createNodeSecurityAuditSdk;
  let created = 0;
  modules.node.createNodeSecurityAuditSdk = (config) => {
    created += 1;
    const full = Object.freeze({ ...factory(config), authenticationFailed: authenticationFailed(config.sink) });
    return created === faultInstance ? Object.freeze({ ...full, [method]: fault }) : full;
  };
  return fixtureState({ budget, ...modules });
}

function directoryFor(t, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("one mid-family SDK refusal aborts only its case; every other case finishes with no invalidation", async (t) => {
  const directory = directoryFor(t, "pe-case-abort-");
  const state = refusingPeState({ faultInstance: 25 }); // P-E-6b, mid-run
  const observed = await measure({ state, directory });
  assert.deepEqual(observed.invalidations, []);
  assert.deepEqual(observed.case_aborts, ["P-E-6b"]);
  const aborts = observed.records.filter((record) => record.variant === "case_aborted");
  assert.deepEqual(aborts, [{ step_id: "P-E-6b/aborted", variant: "case_aborted",
    message: "Cannot read properties of undefined (reading 'event')", current: "P-E-6b" }]);
  // the aborted case keeps its earlier records
  assert.deepEqual(observed.records.filter((record) => record.step_id.startsWith("P-E-6b/"))
    .map((record) => record.step_id), ["P-E-6b/mark", "P-E-6b/emit", "P-E-6b/aborted"]);
  // every other case in every family produced its accounting row, in order
  assert.deepEqual(observed.accounting.map((row) => row.case_id),
    CASE_IDS.filter((id) => id !== "P-E-6b"));
  assert.equal(observed.ledger.exhausted, false);
  assert.deepEqual(readdirSync(directory), [], "every host database closed and deleted");
  assert.doesNotThrow(() => structuredClone(observed));
});

function assertAbortEvaluation(observed, caseId) {
  const observations = [observed];
  const { cases: result, invalidations } = evaluateWithGuard({
    plan: { evaluate: evaluateProbe }, context: { expectations: EXPECTATIONS }, observations });
  assert.deepEqual(invalidations, [], "case abort is never an evaluator invalidation");
  assert.equal(result.observations, observations, "raw observations, including case_aborts, are retained");
  assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), [caseId]);
  const row = result.evaluations.find((entry) => entry.case_id === caseId);
  const abort = row.raw.find((record) => record.variant === "case_aborted");
  const planned = EXPECTATIONS.cases.find((entry) => entry.case_id === caseId);
  const missing = planned.expected.filter((step) => !row.raw.some((record) => record.step_id === step.step_id));
  assert(missing.length > 0, "the aborted case has unobserved planned steps");
  assert.deepEqual(row.mismatches, [`case aborted: ${abort.message}`,
    ...missing.map((step) => `${step.step_id}: planned step not observed (case aborted)`)]);
  assert.deepEqual(row.accounting, []);
  assert(Array.isArray(row.aggregates));
}

for (const fault of FAMILY_REFUSALS) {
  test(`${fault.family} accepted-setup refusal aborts only ${fault.caseId}; all other cases finish and match`, async (t) => {
    const directory = directoryFor(t, "pe-family-abort-");
    const observed = await measure({ state: refusingPeState(fault), directory });
    assert.deepEqual(observed.invalidations, []);
    assert.deepEqual(observed.case_aborts, [fault.caseId]);
    assert.deepEqual(observed.accounting.map((row) => row.case_id), CASE_IDS.filter((id) => id !== fault.caseId));
    assert.equal(observed.records.filter((record) => record.variant === "case_aborted").length, 1);
    assert.equal(observed.ledger.exhausted, false);
    assert.deepEqual(readdirSync(directory), [], "aborted case resources are closed and deleted too");
    assertAbortEvaluation(observed, fault.caseId);
  });
}

test("measure asserts the ledger once after each completed family, not once per case", async (t) => {
  const state = refusingPeState({});
  const checkpoints = [];
  const assertAvailable = state.ledger.assertAvailable;
  state.ledger.assertAvailable = () => {
    if (state.accounting.some((row) => row.case_id === state.current)) checkpoints.push(state.current);
    assertAvailable();
  };
  const observed = await measure({ state, directory: directoryFor(t, "pe-family-ledger-") });
  assert.deepEqual(observed.invalidations, []);
  assert.deepEqual(observed.case_aborts, []);
  assert.deepEqual(observed.accounting.map((row) => row.case_id), CASE_IDS);
  assert.deepEqual(checkpoints, ["P-E-adm", ...FAMILY_CASES.map((cases) => cases.at(-1).case_id)]);
});

test("budget exhaustion inside a family still stops the run with the harness_fault invalidation", async (t) => {
  const state = refusingPeState({ budget: BASELINE_CALLS + 2 }); // exhausts inside P-E-1a
  const observed = await measure({ state, directory: directoryFor(t, "pe-case-budget-") });
  assert.equal(observed.invalidations.length, 1);
  assert.equal(observed.invalidations[0].attribution, "harness_fault");
  assert.match(observed.invalidations[0].message, /budget exhausted/);
  assert.equal(observed.invalidations[0].stopped_at, "P-E-1a");
  assert.deepEqual(observed.case_aborts, [], "budget exhaustion is never contained as a case abort");
  assert.deepEqual(observed.accounting.map((row) => row.case_id), ["P-E-g", "P-E-adm"],
    "the run stops right after the baselines");
});

test("a baseline failure still invalidates and stops every remaining case with no case aborts", async (t) => {
  const state = concurrencyState({ transformBinding: (binding) => ({ ...binding,
    guarantees: { ...binding.guarantees, deliveryClass: "best_effort" } }) });
  const observed = await measure({ state, directory: directoryFor(t, "pe-case-baseline-") });
  assert.equal(observed.invalidations.length, 1);
  assert.match(observed.invalidations[0].message, /baseline precondition failed/);
  assert.deepEqual(observed.case_aborts, []);
  assert.deepEqual(observed.accounting.map((row) => row.case_id), ["P-E-g", "P-E-adm"]);
});
