// Host transaction tests over a temporary SQLite file (#842, Q245).
// Covers commit, rollback, and transaction state as reported by SQLite DatabaseSync.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createTransactionBoundSink, openHostDatabase } from "../outbox/host.mjs";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "outbox-host-test-"));
}

function makeSampleEvent({ eventId = "evt-1", transactionId = "tx-1" } = {}) {
  return {
    event: { id: eventId, timestamp: "2026-10-23T00:00:00.000Z" },
    correlation: { transaction_id: transactionId },
    actor: { id: "admin-1" },
  };
}

test("host database creates tables and reports initial empty state", () => {
  const dir = makeTempDir();
  try {
    const host = openHostDatabase({ directory: dir, name: "init_test" });
    assert.equal(host.isOpen, true);
    assert.equal(host.isTransaction, false);
    const counts = host.counts();
    assert.equal(counts.business_change, 0);
    assert.equal(counts.audit_outbox, 0);
    assert.equal(counts.pending_outbox, 0);
    assert.equal(counts.relayed_outbox, 0);
    host.close();
    assert.equal(host.closed, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("host commit atomicity: business change and outbox row committed together", async () => {
  const dir = makeTempDir();
  try {
    const host = openHostDatabase({ directory: dir, name: "commit_test" });
    const sink = createTransactionBoundSink({ host });

    host.begin();
    assert.equal(host.isTransaction, true);
    host.insertBusiness({ id: "biz-1" });

    const emitResult = await sink.emit(makeSampleEvent({ eventId: "evt-1", transactionId: "tx-1" }));
    assert.equal(emitResult.status, "accepted");
    assert.equal(sink.records[0].is_transaction, true);

    host.commit();
    assert.equal(host.isTransaction, false);

    const counts = host.counts();
    assert.equal(counts.business_change, 1);
    assert.equal(counts.audit_outbox, 1);
    assert.equal(counts.pending_outbox, 1);
    assert.equal(counts.relayed_outbox, 0);

    const ids = host.businessIds();
    assert.deepEqual(ids, ["biz-1"]);

    const rows = host.outboxRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].event_id, "evt-1");
    assert.equal(rows[0].transaction_id, "tx-1");
    assert.equal(rows[0].relayed, 0);

    host.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("host rollback atomicity: rollback discards both business change and outbox row", async () => {
  const dir = makeTempDir();
  try {
    const host = openHostDatabase({ directory: dir, name: "rollback_test" });
    const sink = createTransactionBoundSink({ host });

    host.begin();
    assert.equal(host.isTransaction, true);
    host.insertBusiness({ id: "biz-discarded" });

    await sink.emit(makeSampleEvent({ eventId: "evt-discarded", transactionId: "tx-discarded" }));
    assert.equal(sink.records[0].is_transaction, true);

    host.rollback();
    assert.equal(host.isTransaction, false);

    const counts = host.counts();
    assert.equal(counts.business_change, 0);
    assert.equal(counts.audit_outbox, 0);
    assert.equal(counts.pending_outbox, 0);
    assert.deepEqual(host.businessIds(), []);
    assert.deepEqual(host.outboxRows(), []);

    host.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("host markRelayed updates status and decreases pending count", async () => {
  const dir = makeTempDir();
  try {
    const host = openHostDatabase({ directory: dir, name: "mark_test" });
    const sink = createTransactionBoundSink({ host });

    host.begin();
    host.insertBusiness({ id: "biz-1" });
    await sink.emit(makeSampleEvent({ eventId: "evt-1", transactionId: "tx-1" }));
    host.commit();

    assert.equal(host.counts().pending_outbox, 1);
    assert.equal(host.counts().relayed_outbox, 0);

    host.markRelayed({ event_id: "evt-1" });

    const counts = host.counts();
    assert.equal(counts.pending_outbox, 0);
    assert.equal(counts.relayed_outbox, 1);
    assert.equal(counts.audit_outbox, 1);

    assert.equal(host.pendingOutboxRows().length, 0);
    host.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("re-opening existing host database file preserves committed rows", async () => {
  const dir = makeTempDir();
  try {
    const host1 = openHostDatabase({ directory: dir, name: "reopen_test" });
    const sink = createTransactionBoundSink({ host: host1 });
    host1.begin();
    host1.insertBusiness({ id: "biz-persisted" });
    await sink.emit(makeSampleEvent({ eventId: "evt-persisted", transactionId: "tx-persisted" }));
    host1.commit();
    host1.close();

    const host2 = openHostDatabase({ directory: dir, name: "reopen_test", exists: true });
    assert.equal(host2.counts().business_change, 1);
    assert.equal(host2.counts().audit_outbox, 1);
    assert.equal(host2.pendingOutboxRows()[0].event_id, "evt-persisted");
    host2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sink binds the open transaction's business id despite swapped event transaction ids", async () => {
  const dir = makeTempDir();
  const host = openHostDatabase({ directory: dir, name: "swapped_identity" });
  try {
    const sink = createTransactionBoundSink({ host });
    for (const [id, transactionId, eventTransactionId] of [["biz-a", "tx-a", "tx-b"], ["biz-b", "tx-b", "tx-a"]]) {
      host.begin();
      host.insertBusiness({ id, transaction_id: transactionId });
      await sink.emit(makeSampleEvent({ eventId: `evt-${id}`, transactionId: eventTransactionId }));
      host.commit();
    }
    assert.deepEqual(host.businessRows(), [
      { id: "biz-a", transaction_id: "tx-a", event_id: "evt-biz-a" },
      { id: "biz-b", transaction_id: "tx-b", event_id: "evt-biz-b" },
    ]);
  } finally {
    host.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
