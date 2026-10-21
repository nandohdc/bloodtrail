import assert from "node:assert/strict";
import test from "node:test";
import { compareGuarantees } from "../p-e/guarantee-analysis.mjs";
import { TRANSACTION_ROW, tabulateSteps } from "../p-e/contract-columns.mjs";
import { guaranteesCase, GUARANTEES_CASE } from "../p-e/guarantees-workload.mjs";
import { checkTotals, stepRecord } from "./p-e-redelivery-fixtures.mjs";
import { concurrencyState } from "./p-e-concurrency-fixtures.mjs";
import { guaranteeFixture } from "./p-e-guarantees-fixtures.mjs";

// Independent hand-written oracle. Declaration: delivery-classes.ts:262-267;
// comparisons: :258-286,320-326,342-356; contract.source.json:595-604.
// None of these values is read from descriptors or the comparison module.
const DECLARED = { deliveryClass: "transaction_critical", semantic: "at_least_once",
  claimsAtLeastOnce: true, failsClosedBeforeCommit: true };
const ASPECTS = [
  { step: "P-E-2b/deliver", column: "business_failure_posture", classification: "vacuous" },
  { step: "P-E-5/quiet", column: "retry", classification: "not provided" },
  { step: "P-E-7/b2-deliver", column: "idempotency", classification: "not provided" },
  { step: "P-E-8/deliver", column: "business_failure_posture", classification: "misrepresents" },
  { step: "P-E-g/read", column: "shutdown", classification: "not provided" },
  { step: "P-E-g/read", column: "backpressure", classification: "not provided" },
];
const COLUMNS = ["semantic", "durability", "idempotency", "retry", "backpressure", "shutdown", "outage", "business_failure_posture"];
const CLASSIFICATIONS = ["holds", "vacuous", "not provided", "SDK cannot detect", "misrepresents"];
const TOTALS = [{ id: "P-E-g", calls: 2, probe: 0, gate: 0, exchange: 0, sink: 0, business: 0 }];

function declaredOracle(raw) {
  assert.deepEqual(raw, { guarantees: DECLARED, guarantees_frozen: true, public_keys: ["guarantees", "deliver"] });
}

test("P-E-g reads exact frozen declarations and public keys without any delivery", async () => {
  const state = concurrencyState();
  const row = await guaranteesCase(state);
  declaredOracle(stepRecord(state, "P-E-g", "read").raw);
  checkTotals([row], TOTALS);
  assert.equal(GUARANTEES_CASE.corrected_from, undefined);
});

test("independent guarantee comparison table distinguishes six aspects row by row", async () => {
  const { comparisons } = await guaranteeFixture();
  assert.equal(comparisons.length, 5);
  for (const expected of ASPECTS) {
    const row = comparisons.find((entry) => entry.step_id === expected.step);
    assert.equal(row.status, "observed");
    assert.deepEqual(row.issues, []);
    assert.equal(row.columns[expected.column].classification, expected.classification);
    assert(Object.values(row.facts).every((fact) => fact === true));
  }
});

test("all planned steps have all eight contract columns with bounded classifications and reasons", async () => {
  const { rows, steps } = await guaranteeFixture();
  assert.deepEqual(Object.keys(TRANSACTION_ROW), COLUMNS);
  assert.equal(steps.length, rows.reduce((total, row) => total + row.steps.length, 0));
  for (const entry of steps) {
    assert.deepEqual(Object.keys(entry.columns), COLUMNS);
    assert.deepEqual(entry.issues, []);
    for (const cell of Object.values(entry.columns)) {
      assert(CLASSIFICATIONS.includes(cell.classification));
      assert(cell.reason.length > 0);
      assert(cell.claim.length > 0);
    }
  }
});

test("missing/duplicate/malformed comparison peers are inconclusive locally, never voiding unrelated rows", async () => {
  const { state, rows, comparisons } = await guaranteeFixture();
  const records = state.records.filter((entry) => entry.step_id !== "P-E-2b/deliver");
  records.push(structuredClone(stepRecord(state, "P-E-5", "quiet")));
  const damaged = structuredClone(records);
  damaged.find((entry) => entry.step_id === "P-E-8/deliver").raw = null;
  const actual = compareGuarantees({ records: damaged, rows });
  assert.deepEqual(actual.map((entry) => entry.status),
    ["inconclusive", "inconclusive", "observed", "inconclusive", "observed"]);
  assert.deepEqual(actual[2], comparisons[2]);
  assert.deepEqual(actual[4], comparisons[4]);
  const table = tabulateSteps({ records: damaged, rows, comparisons: actual });
  assert.deepEqual(table.find((entry) => entry.step_id === "P-E-2b/deliver").issues, ["missing/duplicate planned step"]);
});

test("negative guarantee mutation is detected; declarations do not substitute for behavior", async () => {
  const changed = (binding) => ({ ...binding, guarantees: { ...binding.guarantees, claimsAtLeastOnce: false }, flush() {} });
  const state = concurrencyState({ transformBinding: changed });
  await guaranteesCase(state);
  assert.throws(() => declaredOracle(stepRecord(state, "P-E-g", "read").raw), assert.AssertionError);
  const { state: baseline, rows, comparisons } = await guaranteeFixture();
  const records = structuredClone(baseline.records);
  records.find((entry) => entry.step_id === "P-E-5/quiet").counters.exchange = 1;
  const mutated = compareGuarantees({ records, rows });
  assert.equal(mutated[1].status, "inconclusive");
  assert.equal(mutated[1].columns.retry.classification, "SDK cannot detect");
  assert.deepEqual(mutated[0], comparisons[0]);
});
