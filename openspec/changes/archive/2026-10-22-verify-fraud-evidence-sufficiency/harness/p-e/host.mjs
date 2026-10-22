// Synthetic host database for P-E cases. Harness-local node:sqlite only: it is
// neither Bloodtrail storage nor a Bloodtrail outbox, and it dies with the
// per-case file and the parent scratch. Plan/proposal: one fresh file-backed
// DatabaseSync per case below the declared database directory, whose single
// fs write grant is --allow-fs-write=<that directory>; SQLite placement is
// enforced here, not by Node 26's permission model.
import assert from "node:assert/strict";
import { closeSync, openSync, realpathSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { inside, sha256 } from "../lib/io.mjs";

export const HOST_SCHEMA = `
CREATE TABLE business_change (id TEXT PRIMARY KEY);
CREATE TABLE audit_outbox (
  event_id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  body TEXT NOT NULL
);`;

export function openHostDatabase({ directory, name }) {
  assert.equal(typeof directory, "string", "database directory required");
  assert.equal(typeof name, "string", "per-case host name required");
  assert(name.length > 0, "per-case host name must not be empty");
  const file = hostFilePath({ directory, name });
  reserveHostFile(file);
  const db = new DatabaseSync(file);
  db.exec(HOST_SCHEMA);
  const state = { db, file, closed: false, order: [] };
  const statements = {
    businessInsert: db.prepare("INSERT INTO business_change (id) VALUES (?)"),
    businessIds: db.prepare("SELECT id FROM business_change ORDER BY id"),
    businessCount: db.prepare("SELECT count(*) AS n FROM business_change"),
    outboxInsert: db.prepare("INSERT INTO audit_outbox (event_id, transaction_id, body) VALUES (?, ?, ?)"),
    outboxRows: db.prepare("SELECT event_id, transaction_id, body FROM audit_outbox ORDER BY event_id"),
    outboxCount: db.prepare("SELECT count(*) AS n FROM audit_outbox"),
  };
  return hostApi({ state, statements });
}

function hostFilePath({ directory, name }) {
  const root = hostDirectory(directory);
  const file = resolve(root, `${name}.sqlite`);
  inside({ root, path: file });
  assert(!name.includes("/"), "per-case host name must be a plain file name");
  // Preserve the caller's directory spelling in observations (e.g. /var on
  // macOS), after checking placement against its canonical root above.
  return resolve(directory, `${name}.sqlite`);
}

function hostDirectory(directory) {
  // The launcher has already realpath-checked the declared directory. Its
  // write-only child cannot repeat that fs.read operation; offline callers can.
  // Only a direct child is allowed, and exclusive reservation below refuses
  // existing files (including symlinks) before SQLite can follow them.
  if (process.permission) return resolve(directory);
  return realpathSync(directory);
}

function hostApi({ state, statements }) {
  return {
    get file() { return state.file; },
    get closed() { return state.closed; },
    get isOpen() { return state.db.isOpen; },
    get isTransaction() { return state.db.isTransaction; },
    get order() { return structuredClone(state.order); },
    counts() {
      assert(!state.closed, "host is closed");
      return { business_change: statements.businessCount.get().n, audit_outbox: statements.outboxCount.get().n };
    },
    businessIds() {
      assert(!state.closed, "host is closed");
      return statements.businessIds.all().map((row) => row.id);
    },
    outboxRows() {
      assert(!state.closed, "host is closed");
      return statements.outboxRows.all().map((row) => ({ ...row }));
    },
    begin() { return transact(state, "BEGIN"); },
    commit() { return transact(state, "COMMIT"); },
    rollback() { return transact(state, "ROLLBACK"); },
    insertBusiness({ id }) { return insertRow(state, statements.businessInsert, { op: "business_insert", id }, [id]); },
    insertOutbox({ event_id, transaction_id, body }) {
      const entry = { op: "outbox_insert", event_id, transaction_id, body_sha256: sha256(Buffer.from(body)) };
      return insertRow(state, statements.outboxInsert, entry, [event_id, transaction_id, body]);
    },
    close() { return closeState(state); },
  };
}

function recordOrder(state, extra) {
  state.order.push({ ordinal: state.order.length + 1, at_ms: performance.now(), is_transaction: state.db.isTransaction, ...extra });
}

function insertRow(state, statement, extra, args) {
  assert(!state.closed, "host is closed");
  statement.run(...args);
  recordOrder(state, extra);
}

function transact(state, sql) {
  assert(!state.closed, "host is closed");
  state.db.exec(sql);
  recordOrder(state, { op: sql.toLowerCase() });
}

// Exclusive creation and unlink require only the declared write grant. Never
// inspect existence first: that would require a second fs.read grant and race
// the open. A pre-existing case file must remain untouched.
function reserveHostFile(file) {
  let descriptor;
  try { descriptor = openSync(file, "wx"); }
  catch (error) {
    if (error.code === "EEXIST") assert.fail(`per-case host file must not pre-exist: ${file}`);
    throw error;
  }
  closeSync(descriptor);
}

function removeHostFile(file) {
  try { unlinkSync(file); return true; }
  catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function closeState(state) {
  if (state.closed) return { file: state.file, removed: false };
  state.closed = true;
  state.db.close();
  return { file: state.file, removed: removeHostFile(state.file) };
}

// Per-case cleanup seam: the connection closes and the file is removed even
// when the work throws; parent scratch deletion remains the final backstop.
export async function withHostDatabase({ directory, name, work }) {
  const host = openHostDatabase({ directory, name });
  try {
    return await work(host);
  } finally {
    host.close();
  }
}
