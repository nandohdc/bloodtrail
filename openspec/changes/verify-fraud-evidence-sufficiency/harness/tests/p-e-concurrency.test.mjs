import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateProbe } from "../p-e/evaluate.mjs";
import { validateExpectations } from "../p-e/expectations-validate.mjs";
import { concurrencyCase, concurrencyWorkload } from "../p-e/concurrency-workload.mjs";
import { CONCURRENCY_CASES } from "../p-e/concurrency-cases.mjs";
import { parking, withTimeout } from "../p-e/parking.mjs";
import { observations } from "../p-e/runtime.mjs";
import { checkTotals, stepRecord } from "./p-e-redelivery-fixtures.mjs";
import { concurrencyState } from "./p-e-concurrency-fixtures.mjs";

// Independent oracle at abcbefa: node delivery-classes.ts:273-286,305-328,
// 342-356,462-464; core sdk.ts:475-483; events.ts:190-225. Totals are
// handwritten, not read from case descriptors or generated expectations.
const ORACLE = [
  { id: "P-E-6", calls: 20, probe: 1, gate: 1, exchange: 1, sink: 1, business: 1 },
  { id: "P-E-6b", calls: 22, probe: 2, gate: 2, exchange: 2, sink: 1, business: 1 },
  { id: "P-E-6c", calls: 24, probe: 2, gate: 2, exchange: 2, sink: 2, business: 0 },
];

const PAIRS = [
  { id: "P-E-6b", same: true, sameTransaction: false },
  { id: "P-E-6c", same: false, sameTransaction: true },
];
const TIMEOUT = { ms: 1000, label: "concurrent fixture" };
const PLAN = JSON.parse(readFileSync(new URL("../expectations/p-e.v1.json", import.meta.url), "utf8"));
const OLD_PARKING_RULE = { path: "parking.exchange_entered_after_release", op: "equal", value: false };

async function runConcurrency() {
  const state = concurrencyState();
  const rows = await withTimeout(concurrencyWorkload(state), TIMEOUT);
  return { state, rows };
}

async function runHeldConcurrency() {
  const hold = parking();
  const state = concurrencyState({ probeWait: hold.promise });
  const [entry] = CONCURRENCY_CASES;
  const row = await withTimeout(concurrencyCase(state, entry, { beforeRelease: hold.release }), TIMEOUT);
  return { state, row };
}

function evaluateParking({ state, row }, plan = PLAN) {
  assert.equal(validateExpectations(plan), plan);
  // concurrencyCase returns its row without appending it to state.accounting.
  // Validate the full plan, but judge only the case exercised by this fixture.
  const result = evaluateProbe({ expectations: plan, observations: [
    { records: state.records, accounting: [row], public_calls: state.calls },
  ] });
  assert.deepEqual(result.notes, []);
  return result.evaluations.find((entry) => entry.case_id === "P-E-6");
}

function checkParking(input, enteredAfterRelease) {
  const before = structuredClone(input.row);
  assert.deepEqual(input.row.parking, { released: true, exchange_entered_after_release: enteredAfterRelease });
  const result = evaluateParking(input);
  assert.equal(result.matched, true);
  assert.deepEqual(result.mismatches, []);
  assert.equal(result.accounting[0], input.row, "raw parking facts remain in accounting");
  assert.deepEqual(input.row, before, "evaluation does not alter observations");
}

function checkDuplicate(record, eventId) {
  assert.deepEqual(record.raw, { status: "refused", code: "duplicate_transaction_delivery", event_id: eventId });
}

test("concurrency totals and exact record ownership match independent source oracle", async () => {
  const { state, rows } = await runConcurrency();
  checkTotals(rows, ORACLE);
  assert.equal(state.ledger.report().occurrence_count, 66);
  const planned = rows.flatMap((row) => row.steps.map((id) => `${row.case_id}/${id}`));
  assert.deepEqual(state.records.map((record) => record.step_id), planned);
  assert.equal(new Set(planned).size, planned.length);
  assert.doesNotThrow(() => structuredClone(observations(state)));
});

test("P-E-6 reserves before the first await; duplicate shape, success and settled third call", async () => {
  const { state, rows } = await runConcurrency();
  const event = stepRecord(state, "P-E-6", "emit").captures[0].event;
  const d2 = stepRecord(state, "P-E-6", "d2");
  checkDuplicate(d2, event.event.id);
  assert.equal(d2.after_d1_start.probe, 1);
  assert.equal(d2.after_d1_start.gate, 0);
  assert.equal(d2.after_d1_start.exchange, 0);
  assert.deepEqual(stepRecord(state, "P-E-6", "d1").raw,
    { status: "committed_and_durable", event_id: event.event.id, transaction_id: event.correlation.transaction_id });
  const third = stepRecord(state, "P-E-6", "third");
  assert.deepEqual(third.raw, { status: "already_delivered", event_id: event.event.id,
    transaction_id: event.correlation.transaction_id });
  assert.equal(third.counters.probe + third.counters.gate + third.counters.exchange, 0);
  checkParking({ state, row: rows[0] }, false);
});

test("P-E-6 explicitly releases before exchange entry without hanging", async () => {
  const { state, row } = await runHeldConcurrency();
  const d2 = stepRecord(state, "P-E-6", "d2");
  assert.deepEqual(d2.at_resolution, { probe: 1, gate: 0, exchange: 0, sink: 1, business_commits: 1 });
  checkParking({ state, row }, true);
  checkTotals([row], [ORACLE[0]]);
});

test("P-E-6 negative mutation: refreezing parking timing rejects the same held-probe observations", async () => {
  const input = await runHeldConcurrency();
  checkParking(input, true);
  const plan = structuredClone(PLAN);
  plan.cases.find((entry) => entry.case_id === "P-E-6").summary.assertions.push(OLD_PARKING_RULE);
  const before = structuredClone(input.row);
  const result = evaluateParking(input, plan);
  assert.equal(result.matched, false);
  assert.deepEqual(result.mismatches, ["assertion parking.exchange_entered_after_release equal failed"]);
  assert.deepEqual(input.row, before, "negative control does not change observations");
  checkParking(input, true);
});

for (const pair of PAIRS) {
  test(`${pair.id}: independent pair-key and body identity facts`, async () => {
    const { state, rows } = await runConcurrency();
    const row = rows.find((entry) => entry.case_id === pair.id);
    assert.deepEqual(row.pair_facts, { same_event_id: pair.same, same_caller_transaction_id: pair.sameTransaction,
      same_occurrence_transaction_id: true, caller_transaction_matches_occurrence: pair.sameTransaction });
    assert.equal(row.exchange_identity.same_event_id, pair.same);
    assert.equal(row.exchange_identity.identical_body_sha256, pair.same);
    assert.equal(row.exchange_identity.count, 2);
    for (const id of ["first", "second"]) {
      const delivered = stepRecord(state, pair.id, id);
      assert.equal(delivered.raw.status, "committed_and_durable");
      assert.equal(delivered.counters.gate, 1);
      assert.deepEqual(Object.keys(delivered.raw).sort(), ["event_id", "status", "transaction_id"]);
    }
    if (!pair.same) {
      for (const id of ["emit", "emit-again"]) {
        const emitted = stepRecord(state, pair.id, id);
        assert.equal(emitted.occurrence.outcome, "failure");
        assert.equal(emitted.occurrence.commit_state, "not_committed");
      }
    }
  });
}

test("concurrency negative mutation: a falsely successful d2 fails the independent shape oracle", async () => {
  const { state } = await runConcurrency();
  const eventId = stepRecord(state, "P-E-6", "emit").captures[0].event.event.id;
  const mutated = structuredClone(stepRecord(state, "P-E-6", "d2"));
  mutated.raw.status = "committed_and_durable";
  assert.throws(() => checkDuplicate(mutated, eventId), assert.AssertionError);
});
