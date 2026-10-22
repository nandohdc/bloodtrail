import assert from "node:assert/strict";
import test from "node:test";
import { hostSink, insertOutboxEvent } from "../p-e/sink.mjs";
import { EVENT, temporaryHost } from "./p-e-host-fixtures.mjs";

test("normal sink inserts synchronously before its emit promise settles", async (t) => {
  const { host } = temporaryHost(t);
  const sink = hostSink({ host });
  host.begin();
  const pending = sink.emit(EVENT);
  assert.deepEqual(host.counts(), { business_change: 0, audit_outbox: 1 });
  assert.deepEqual(await pending, { status: "accepted" });
  assert.equal(sink.records[0].is_transaction, true);
  assert.equal(sink.records[0].inserted_is_transaction, true);
  assert.equal(sink.records[0].frozen, true);
  assert.equal(sink.records[0].deferred, false);
  assert.equal(sink.records[0].faulted, undefined);
  assert.equal(typeof sink.records[0].at_ms, "number");
  assert.equal(typeof sink.records[0].inserted_at_ms, "number");
  assert.deepEqual(sink.captures, [{ frozen: true, event: EVENT }]);
  assert.deepEqual(sink.counts, { entries: 1, inserts: 1, faults: 0 });
  assert.deepEqual(host.outboxRows(), [{ event_id: EVENT.event.id, transaction_id: EVENT.correlation.transaction_id, body: JSON.stringify(EVENT) }]);
});

test("deferred control inserts after the microtask and exposes state at actual insertion", async (t) => {
  const { host } = temporaryHost(t);
  const sink = hostSink({ host, deferred: true });
  host.begin();
  const pending = sink.emit(EVENT);
  assert.deepEqual(host.counts(), { business_change: 0, audit_outbox: 0 });
  host.commit();
  assert.equal(host.isTransaction, false);
  assert.deepEqual(await pending, { status: "accepted" });
  assert.deepEqual(host.counts(), { business_change: 0, audit_outbox: 1 });
  assert.equal(sink.records[0].is_transaction, true);
  assert.equal(sink.records[0].inserted_is_transaction, false);
  assert.equal(sink.records[0].deferred, true);
});

test("fault control throws before any insert and retains the entry capture", async (t) => {
  const { host } = temporaryHost(t);
  const fault = Object.assign(new TypeError("pe-sink-fault"), { code: "SDK_SINK_FAILURE" });
  const sink = hostSink({ host, fault });
  await assert.rejects(sink.emit(EVENT), (error) => error === fault);
  assert.deepEqual(host.counts(), { business_change: 0, audit_outbox: 0 });
  assert.deepEqual(sink.counts, { entries: 1, inserts: 0, faults: 1 });
  assert.equal(sink.records[0].faulted, true);
  assert.equal(sink.captures.length, 1);
});

test("function fault control selects per-emit faults and later emits insert normally", async (t) => {
  const { host } = temporaryHost(t);
  const fault = new TypeError("pe-first-emit-fault");
  const sink = hostSink({ host, fault: ({ ordinal }) => (ordinal === 1 ? fault : null) });
  await assert.rejects(sink.emit(EVENT), (error) => error === fault);
  assert.deepEqual(await sink.emit(EVENT), { status: "accepted" });
  assert.deepEqual(host.counts(), { business_change: 0, audit_outbox: 1 });
  assert.deepEqual(sink.counts, { entries: 2, inserts: 1, faults: 1 });
  assert.deepEqual(sink.records.map((record) => record.faulted), [true, undefined]);
});

test("custom insert keeps the default outbox mapping overridable", async (t) => {
  const { host } = temporaryHost(t);
  const sink = hostSink({ host, insert: ({ event }) => host.insertBusiness({ id: event.event.id }) });
  host.begin();
  assert.deepEqual(await sink.emit(EVENT), { status: "accepted" });
  assert.deepEqual(host.counts(), { business_change: 1, audit_outbox: 0 });
});

test("insertOutboxEvent derives event_id, transaction_id and serialized body from the emitted shape", (t) => {
  const { host } = temporaryHost(t);
  insertOutboxEvent({ host, event: EVENT });
  assert.deepEqual(host.outboxRows(), [{ event_id: "pe-event-0001", transaction_id: "pe-txn-0001", body: JSON.stringify(EVENT) }]);
});

test("entry transaction state is false when the sink runs outside a host transaction", async (t) => {
  const { host } = temporaryHost(t);
  const sink = hostSink({ host });
  assert.deepEqual(await sink.emit(EVENT), { status: "accepted" });
  assert.equal(sink.records[0].is_transaction, false);
  assert.equal(sink.records[0].inserted_is_transaction, false);
});
