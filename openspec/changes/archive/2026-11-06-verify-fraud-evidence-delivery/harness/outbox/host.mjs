// Synthetic host database for outbox probe cases (#842, Q244, Q245).
// Harness-local node:sqlite only: it is neither Bloodtrail storage nor a Bloodtrail
// outbox product, and dies with the per-case file and the parent scratch directory.
import assert from "node:assert/strict";
import { closeSync, openSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { inside, sha256 } from "../lib/io.mjs";

export const HOST_SCHEMA = `
CREATE TABLE business_change (
  id TEXT PRIMARY KEY,
  transaction_id TEXT UNIQUE,
  event_id TEXT
);
CREATE TABLE audit_outbox (
  row_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  transaction_id TEXT NOT NULL,
  body TEXT NOT NULL,
  relayed INTEGER NOT NULL DEFAULT 0
);`;

function reserveHostFile(file) {
  let descriptor;
  try {
    descriptor = openSync(file, "wx");
  } catch (error) {
    if (error.code === "EEXIST") assert.fail(`per-case host file must not pre-exist: ${file}`);
    throw error;
  }
  closeSync(descriptor);
}

function resolveHostDirectory(directory) {
  if (process.permission) return resolve(directory);
  return realpathSync(directory);
}

function resolveHostFilePath({ directory, name }) {
  assert(!name.includes("/"), "per-case host name must be a plain file name");
  const root = resolveHostDirectory(directory);
  const file = resolve(root, `${name}.sqlite`);
  inside({ root, path: file });
  return resolve(directory, `${name}.sqlite`);
}

function recordHostOrder(state, extra) {
  state.order.push({
    ordinal: state.order.length + 1,
    at_ms: performance.now(),
    is_transaction: state.db.isTransaction,
    ...extra,
  });
}

function transact(state, sql) {
  assert(!state.closed, "host is closed");
  state.db.exec(sql);
  state.businessId = undefined;
  recordHostOrder(state, { op: sql.toLowerCase() });
}

function insertRow(state, statement, extra, args) {
  assert(!state.closed, "host is closed");
  statement.run(...args);
  recordHostOrder(state, extra);
}

function hostStatements(db) {
  return {
    businessInsert: db.prepare("INSERT INTO business_change (id, transaction_id) VALUES (?, ?)"),
    businessRows: db.prepare("SELECT id, transaction_id, event_id FROM business_change ORDER BY id"),
    bindEvent: db.prepare("UPDATE business_change SET event_id = ? WHERE id = ?"),
    businessIds: db.prepare("SELECT id FROM business_change ORDER BY id"),
    businessCount: db.prepare("SELECT count(*) AS n FROM business_change"),
    outboxInsert: db.prepare("INSERT INTO audit_outbox (event_id, transaction_id, body) VALUES (?, ?, ?)"),
    outboxRows: db.prepare("SELECT row_id, event_id, transaction_id, body, relayed FROM audit_outbox ORDER BY row_id"),
    pendingRows: db.prepare("SELECT row_id, event_id, transaction_id, body, relayed FROM audit_outbox WHERE relayed = 0 ORDER BY row_id"),
    outboxCount: db.prepare("SELECT count(*) AS n FROM audit_outbox"),
    pendingCount: db.prepare("SELECT count(*) AS n FROM audit_outbox WHERE relayed = 0"),
    relayedCount: db.prepare("SELECT count(*) AS n FROM audit_outbox WHERE relayed = 1"),
    markRelayed: db.prepare("UPDATE audit_outbox SET relayed = 1 WHERE event_id = ?"),
  };
}

function hostReadApi({ state, statements }) {
  return {
    get file() { return state.file; },
    get closed() { return state.closed; },
    get isOpen() { return state.db.isOpen; },
    get isTransaction() { return state.db.isTransaction; },
    get order() { return structuredClone(state.order); },
    counts() {
      assert(!state.closed, "host is closed");
      return {
        business_change: statements.businessCount.get().n,
        audit_outbox: statements.outboxCount.get().n,
        pending_outbox: statements.pendingCount.get().n,
        relayed_outbox: statements.relayedCount.get().n,
      };
    },
    businessRows() {
      assert(!state.closed, "host is closed");
      return statements.businessRows.all().map((row) => ({ ...row }));
    },
    businessIds() {
      assert(!state.closed, "host is closed");
      return statements.businessIds.all().map((row) => row.id);
    },
    outboxRows() {
      assert(!state.closed, "host is closed");
      return statements.outboxRows.all().map((row) => ({ ...row }));
    },
    pendingOutboxRows() {
      assert(!state.closed, "host is closed");
      return statements.pendingRows.all().map((row) => ({ ...row }));
    },
  };
}

function hostWriteApi({ state, statements }) {
  return {
    markRelayed({ event_id }) {
      assert(!state.closed, "host is closed");
      statements.markRelayed.run(event_id);
      recordHostOrder(state, { op: "mark_relayed", event_id });
    },
    begin() { return transact(state, "BEGIN"); },
    commit() { return transact(state, "COMMIT"); },
    rollback() { return transact(state, "ROLLBACK"); },
    insertBusiness({ id, transaction_id = null }) {
      state.businessId = id;
      return insertRow(state, statements.businessInsert, { op: "business_insert", id, transaction_id }, [id, transaction_id]);
    },
    insertOutbox({ event_id, transaction_id, body }) {
      assert(state.db.isTransaction, "outbox insert requires an open business transaction");
      assert.equal(typeof state.businessId, "string", "business row required before outbox insert");
      statements.bindEvent.run(event_id, state.businessId);
      const extra = { op: "outbox_insert", event_id, transaction_id, body_sha256: sha256(Buffer.from(body)) };
      return insertRow(state, statements.outboxInsert, extra, [event_id, transaction_id, body]);
    },
    close() {
      if (state.closed) return;
      state.closed = true;
      state.db.close();
    },
  };
}

function hostApi(context) {
  return Object.defineProperties(hostWriteApi(context), Object.getOwnPropertyDescriptors(hostReadApi(context)));
}

export function openHostDatabase({ directory, name, exists = false }) {
  assert.equal(typeof directory, "string", "database directory required");
  assert.equal(typeof name, "string", "per-case host name required");
  assert(name.length > 0, "per-case host name must not be empty");

  const file = resolveHostFilePath({ directory, name });
  if (!exists) {
    reserveHostFile(file);
  }
  const db = new DatabaseSync(file);
  if (!exists) {
    db.exec(HOST_SCHEMA);
  }
  const state = { db, file, closed: false, order: [] };
  const statements = hostStatements(db);
  return hostApi({ state, statements });
}

export function insertOutboxEvent({ host, event }) {
  assert.equal(typeof event.event.id, "string", "emitted event id required");
  assert.equal(typeof event.correlation.transaction_id, "string", "emitted transaction id required");
  return host.insertOutbox({
    event_id: event.event.id,
    transaction_id: event.correlation.transaction_id,
    body: JSON.stringify(event),
  });
}

export function createTransactionBoundSink({ host, insert = insertOutboxEvent } = {}) {
  assert.notEqual(host, undefined, "host required");
  const records = [];
  return {
    records,
    async emit(event) {
      const record = {
        event_id: event.event.id,
        transaction_id: event.correlation.transaction_id,
        ordinal: records.length + 1,
        at_ms: performance.now(),
        is_transaction: host.isTransaction,
      };
      records.push(record);
      insert({ host, event });
      record.counts_after_insert = host.counts();
      record.inserted_at_ms = performance.now();
      record.inserted_is_transaction = host.isTransaction;
      return { status: "accepted" };
    },
  };
}
