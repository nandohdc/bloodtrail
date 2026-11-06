// Bounded predicates for atomicity and durable-row identity.
import { allTrue, hasCount, read, sinkInserted } from "./observer-access.mjs";

function transactionGroupHolds(group) {
  const [begin, business, outbox, commit] = group;
  return allTrue([
    begin.op === "begin", business.op === "business_insert",
    outbox.op === "outbox_insert", commit.op === "commit",
    begin.is_transaction === true, business.is_transaction === true,
    outbox.is_transaction === true, commit.is_transaction === false,
  ]);
}

function transactionOrderHolds(order, count) {
  if (!Array.isArray(order)) return false;
  const operations = new Set(["begin", "business_insert", "outbox_insert", "commit", "rollback"]);
  const trace = order.filter((entry) => operations.has(entry.op));
  if (trace.length !== count * 4) return false;
  for (let offset = 0; offset < trace.length; offset += 4) {
    if (!transactionGroupHolds(trace.slice(offset, offset + 4))) return false;
  }
  return true;
}

export function isCommitAtomicityValid(host, count, order) {
  return allTrue([
    read(host, "transaction_active_during") === true,
    read(host, "transaction_inactive_after") === true,
    read(host, "business_count") === count,
    read(host, "outbox_count") === count,
    sinkInserted(host, count),
    transactionOrderHolds(order, count),
  ]);
}

export function isRollbackDiscarded({ host, relayed, persisted, count }) {
  return allTrue([
    read(host, "business_count") === 0, read(host, "outbox_count") === 0,
    relayed === 0, persisted === 0, sinkInserted(host, count),
    read(host, "transaction_inactive_after") === true,
  ]);
}

function matchesHostRow(body, rows) {
  const id = read(body, "event.id");
  const tx = read(body, "correlation.transaction_id");
  if (typeof id !== "string") return false;
  if (typeof tx !== "string") return false;
  return rows.some((row) => allTrue([row.event_id === id, row.transaction_id === tx]));
}

export function checkTransactionIdsMatchHost({ bodies, rows, count }) {
  const complete = allTrue([hasCount(bodies, count), hasCount(rows, count), count > 0]);
  if (!complete) return false;
  return bodies.every((body) => matchesHostRow(body, rows));
}

export function areTransactionIdsUnique(bodies) {
  if (!Array.isArray(bodies)) return false;
  if (bodies.length === 0) return false;
  const ids = bodies.map((body) => read(body, "correlation.transaction_id"));
  if (!ids.every((id) => typeof id === "string")) return false;
  return new Set(ids).size === bodies.length;
}

export function exactEventIdentities({ bodies, host, count }) {
  const rows = read(host, "business_rows");
  if (!checkTransactionIdsMatchHost({ bodies, rows, count })) return false;
  const ids = bodies.map((body) => read(body, "event.id"));
  return new Set(ids).size === count;
}

export function storedExactlyOnce(bodies, readBack) {
  if (!Array.isArray(bodies)) return false;
  if (!Array.isArray(readBack)) return false;
  const stored = readBack.filter((entry) => entry.persisted === true);
  if (stored.length !== bodies.length) return false;
  const copies = (body) => stored.filter((entry) => entry.event_id === read(body, "event.id")).length;
  return bodies.every((body) => copies(body) === 1);
}
