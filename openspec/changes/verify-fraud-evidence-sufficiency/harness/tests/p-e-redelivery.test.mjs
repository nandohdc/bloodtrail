import assert from "node:assert/strict";
import test from "node:test";
import { redeliveryCase } from "../p-e/redelivery-workload.mjs";
import { REDELIVERY_CASES, REDELIVERY_K, PE_BASE, PE_COMMENT } from "../p-e/redelivery-cases.mjs";
import { acknowledgingExchange, exchangeScript } from "../p-e/scripts.mjs";
import { observations } from "../p-e/runtime.mjs";
import { sha256 } from "../lib/io.mjs";
import { peState } from "./p-e-case-fixtures.mjs";
import { checkDescriptors, checkTotals, runCases, stepRecord } from "./p-e-redelivery-fixtures.mjs";

// Independent hand-written oracle, derived from the pinned sources, not from
// the workload: delivery-classes.ts:258-286,320-326,342-356,448-479 (binding
// at abcbefa), http-handoff.ts:13-21,98-114,139-163,
// http-response-classification.ts:31-78. Per-case public-call counts are
// counted from the same sources, call by call. P-E-5 freezes k=3, so its
// failed attempts (1 initial + k-1 redeliveries) plus the settling redelivery
// give 4 probe/gate/exchange calls; the final extra deliver is
// already_delivered with no new calls.
const ORACLE = [
  { id: "P-E-5", calls: 31, probe: 4, gate: 4, exchange: 4, sink: 1, business: 1 },
  { id: "P-E-7", calls: 25, probe: 2, gate: 2, exchange: 2, sink: 1, business: 1 },
  { id: "P-E-8", calls: 30, probe: 4, gate: 4, exchange: 4, sink: 1, business: 1 },
];

const FAILED_CLOSED = { status: "failed_closed", code: "audit_durability_unreachable",
  commitGateInvoked: true, durabilityAttempted: true };

const CASE_IDS = ["P-E-5", "P-E-7", "P-E-8"];
const runRedelivery = () => runCases(CASE_IDS);

test("P-E redelivery family: independent per-case oracle for totals, counts and k=3", async () => {
  const { state, rows } = await runRedelivery();
  checkTotals(rows, ORACLE);
  assert.equal(state.ledger.report().occurrence_count, 86);
  assert.equal(state.ledger.report().exhausted, false);
  assert.doesNotThrow(() => structuredClone(observations(state)));
});

test("P-E-5: k=3 caller retries after 503s; identical attempt-0 bodies, quiet interval and already_delivered add nothing", async () => {
  const { state, rows } = await runRedelivery();
  const emit = stepRecord(state, "P-E-5", "emit");
  const eventId = emit.captures[0].event.event.id;
  const transactionId = emit.captures[0].event.correlation.transaction_id;
  for (const step of ["initial", "redeliver-1", "redeliver-2"]) {
    const record = stepRecord(state, "P-E-5", step);
    assert.deepEqual(record.raw, { ...FAILED_CLOSED, event_id: eventId });
    assert.equal(record.result_frozen, true);
    assert.deepEqual(record.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
    assert.deepEqual(record.exchange_facts, { count: 1, all_attempt_zero: true,
      same_event_id: true, identical_body_sha256: true, event_id: eventId });
  }
  const settle = stepRecord(state, "P-E-5", "settle");
  assert.deepEqual(settle.raw, { status: "committed_and_durable", event_id: eventId, transaction_id: transactionId });
  assert.deepEqual(Object.keys(settle.raw).sort(),
    ["event_id", "status", "transaction_id"]);
  assert.deepEqual(settle.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
  const quiet = stepRecord(state, "P-E-5", "quiet");
  assert.deepEqual(quiet.raw, { kind: "quiet_interval", macrotask_turns: 1 });
  assert.deepEqual(quiet.counters, { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 });
  const extra = stepRecord(state, "P-E-5", "extra");
  assert.deepEqual(extra.raw, { status: "already_delivered", event_id: eventId, transaction_id: transactionId });
  assert.deepEqual(extra.counters, { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 });
  const summary = rows.find((row) => row.case_id === "P-E-5");
  assert.equal(summary.k, 3);
  assert.deepEqual(summary.exchange_identity, { count: 4, all_attempt_zero: true,
    same_event_id: true, identical_body_sha256: true, event_id: eventId });
  const settleAttempt = settle.exchange_attempts[0];
  assert.equal(settleAttempt.request_attempt, 0);
  assert.equal(settleAttempt.method, "POST");
  assert.equal(settleAttempt.path, "/v1/security-audit");
  assert.equal(settleAttempt.body_sha256, sha256(Buffer.from(JSON.stringify(emit.captures[0].event))));
});

test("P-E-7: a fresh instance re-delivers the settled occurrence; the settled instance reports already_delivered", async () => {
  const { state } = await runRedelivery();
  const emit = stepRecord(state, "P-E-7", "emit");
  const eventId = emit.captures[0].event.event.id;
  const transactionId = emit.captures[0].event.correlation.transaction_id;
  const b1 = stepRecord(state, "P-E-7", "b1-deliver");
  assert.deepEqual(b1.raw, { status: "committed_and_durable", event_id: eventId, transaction_id: transactionId });
  assert.deepEqual(b1.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
  const b2 = stepRecord(state, "P-E-7", "b2-deliver");
  assert.deepEqual(b2.raw, { status: "committed_and_durable", event_id: eventId, transaction_id: transactionId });
  assert.deepEqual(b2.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
  assert.deepEqual(b2.cross_instance, { count: 2, all_attempt_zero: true,
    same_event_id: true, identical_body_sha256: true, event_id: eventId });
  const again = stepRecord(state, "P-E-7", "b1-again");
  assert.deepEqual(again.raw, { status: "already_delivered", event_id: eventId, transaction_id: transactionId });
  assert.deepEqual(again.counters, { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 });
});

test("P-E-8: 422 permanent and both protocol-error variants collapse to one code; only the exchange log keeps the statuses", async () => {
  const { state } = await runRedelivery();
  const emit = stepRecord(state, "P-E-8", "emit");
  const eventId = emit.captures[0].event.event.id;
  const statuses = { deliver: 422, redeliver: 422, "variant-2xx": 202, "variant-3xx": 302 };
  for (const [step, status] of Object.entries(statuses)) {
    const record = stepRecord(state, "P-E-8", step);
    assert.deepEqual(record.raw, { ...FAILED_CLOSED, event_id: eventId });
    assert.deepEqual(Object.keys(record.raw).sort(),
      ["code", "commitGateInvoked", "durabilityAttempted", "event_id", "status"]);
    assert.deepEqual(record.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
    assert.equal(record.exchange_attempts.length, 1);
    assert.equal(record.exchange_attempts[0].outcome.raw.status, status);
  }
});

test("P-E-5 mutation: an ACK on the first exchange settles immediately, so the frozen 4/4/4 totals do not hold", async () => {
  const state = peState({ budget: 400 });
  const [entry] = REDELIVERY_CASES.filter((row) => row.case_id === "P-E-5");
  const summary = await redeliveryCase(state, entry, { exchange: exchangeScript([acknowledgingExchange()]) });
  assert.notDeepEqual(summary.actual, summary.predicted);
  assert.deepEqual(summary.actual, { probe: 1, gate: 1, exchange: 1, sink: 1, business_commits: 1 });
  assert.equal(stepRecord(state, "P-E-5", "initial").raw.status, "committed_and_durable");
  assert.equal(stepRecord(state, "P-E-5", "redeliver-1").raw.status, "already_delivered");
});

test("P-E redelivery descriptors are source-cited, complete and k-frozen", () => {
  assert.equal(PE_BASE, "abcbefa03d5b0afc610deb712d7f4ded5a9e82be");
  assert.equal(PE_COMMENT, "6137619745");
  assert.equal(REDELIVERY_K, 3);
  checkDescriptors(CASE_IDS);
});
