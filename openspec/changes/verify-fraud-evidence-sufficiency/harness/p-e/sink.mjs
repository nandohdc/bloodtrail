// Transaction-bound synthetic host sink (boundary 2, host side). Implementer
// default: each emit records entry, host transaction state and a retained
// public capture, then inserts synchronously before the emit promise settles.
// Fault and deferred-insert controls are explicit and separately selectable;
// normal sink timing never changes silently.
import assert from "node:assert/strict";

export function insertOutboxEvent({ host, event }) {
  assert.equal(typeof event.event.id, "string", "emitted event id required");
  assert.equal(typeof event.correlation.transaction_id, "string", "emitted transaction id required");
  return host.insertOutbox({
    event_id: event.event.id,
    transaction_id: event.correlation.transaction_id,
    body: JSON.stringify(event),
  });
}

function faultFor(fault, context) {
  if (typeof fault === "function") return fault(context);
  return fault;
}

export function hostSink({ host, insert = insertOutboxEvent, fault = null, deferred = false } = {}) {
  assert.notEqual(host, undefined, "host required");
  assert.equal(typeof host.isTransaction, "boolean", "host isTransaction required");
  assert.equal(typeof insert, "function", "insert must be a function");
  assert.equal(typeof deferred, "boolean", "deferred must be a boolean");
  const records = [];
  const captures = [];
  const retained = [];
  const counts = { entries: 0, inserts: 0, faults: 0 };
  return {
    records,
    captures,
    retained,
    counts,
    async emit(event) {
      const record = {
        ordinal: records.length + 1,
        at_ms: performance.now(),
        deferred,
        is_transaction: host.isTransaction,
        frozen: Object.isFrozen(event),
      };
      records.push(record);
      counts.entries += 1;
      captures.push({ frozen: record.frozen, event: structuredClone(event) });
      retained.push(event);
      const faultError = faultFor(fault, { event, ordinal: record.ordinal });
      if (faultError) {
        record.faulted = true;
        counts.faults += 1;
        throw faultError;
      }
      if (deferred) await Promise.resolve();
      insert({ host, event });
      record.inserted_at_ms = performance.now();
      record.inserted_is_transaction = host.isTransaction;
      counts.inserts += 1;
      return { status: "accepted" };
    },
  };
}
