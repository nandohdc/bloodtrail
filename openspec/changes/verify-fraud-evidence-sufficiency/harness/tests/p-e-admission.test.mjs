import assert from "node:assert/strict";
import test from "node:test";
import { admissionCase } from "../p-e/admission-workload.mjs";
import { ADMISSION_CASE } from "../p-e/admission-cases.mjs";
import { checkTotals, stepRecord } from "./p-e-redelivery-fixtures.mjs";
import { concurrencyState } from "./p-e-concurrency-fixtures.mjs";

// Independent source table: node delivery-classes.ts:305-328,448-455.
// Core events.ts:223-225 means P-E-1f supplies no occurrence after #797.
const REFUSAL_ORACLE = [
  { id: "undefined", code: "transaction_id_required", capture: "emit" },
  { id: "empty", code: "transaction_id_required", capture: "emit" },
  { id: "class", code: "delivery_class_mismatch", capture: "auth" },
];
const TOTALS = [{ id: "P-E-adm", calls: 26, probe: 0, gate: 0, exchange: 0, sink: 2, business: 1 }];

function refusalOracle(record, code, eventId) {
  assert.deepEqual(record.raw, { status: "refused", code, event_id: eventId });
  assert.deepEqual(record.counters, { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 });
}

test("admission uses SDK-constructed legitimate MFA and authenticationFailed occurrences", async () => {
  const state = concurrencyState();
  const row = await admissionCase(state);
  checkTotals([row], TOTALS);
  const mfa = stepRecord(state, "P-E-adm", "emit").captures[0].event;
  assert.equal(mfa.event.commit_state, "committed");
  assert.equal(mfa.event.delivery_class, "transaction_critical");
  assert.equal(typeof mfa.correlation.transaction_id, "string");
  const auth = stepRecord(state, "P-E-adm", "auth");
  assert.deepEqual(auth.raw, { ok: true, value: { status: "accepted" } });
  assert.equal(auth.captures[0].event.event.name, "bloodtrail.audit.authentication.failed");
  assert.equal(auth.captures[0].event.event.delivery_class, "security_significant");
  assert.equal(auth.captures[0].event.source.observed.address, "203.0.113.10");
  const names = state.calls.map((call) => call.label);
  assert.equal(names.filter((name) => name.endsWith(":authenticationFailed")).length, 1);
  assert.equal(names.filter((name) => name.endsWith(":observedSource")).length, 1);
  assert.match(ADMISSION_CASE.corrected_from.reason, /#797/);
  assert.match(ADMISSION_CASE.corrected_from.new, /handle-backed/);
});

test("missing/empty ids and class mismatch repeatedly refuse with zero callbacks and exact shapes", async () => {
  const state = concurrencyState();
  const row = await admissionCase(state);
  for (const expected of REFUSAL_ORACLE) {
    const eventId = stepRecord(state, "P-E-adm", expected.capture).captures[0].event.event.id;
    for (const suffix of ["first", "repeat"]) {
      refusalOracle(stepRecord(state, "P-E-adm", `${expected.id}-${suffix}`), expected.code, eventId);
    }
  }
  assert.deepEqual(state.records.map((record) => record.step_id), row.steps.map((id) => `P-E-adm/${id}`));
});

test("admission negative mutation: extra transaction_id or a callback violates the refusal oracle", async () => {
  const state = concurrencyState();
  await admissionCase(state);
  const record = structuredClone(stepRecord(state, "P-E-adm", "undefined-first"));
  const eventId = record.raw.event_id;
  record.raw.transaction_id = "pe-txn-extra-0001";
  assert.throws(() => refusalOracle(record, "transaction_id_required", eventId), assert.AssertionError);
  delete record.raw.transaction_id;
  record.counters.gate = 1;
  assert.throws(() => refusalOracle(record, "transaction_id_required", eventId), assert.AssertionError);
});
