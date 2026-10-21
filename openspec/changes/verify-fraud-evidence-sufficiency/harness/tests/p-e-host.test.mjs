import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "../lib/io.mjs";
import { openHostDatabase } from "../p-e/host.mjs";
import { temporaryHost } from "./p-e-host-fixtures.mjs";

test("each host owns a fresh file below its authorized directory and refuses reuse", (t) => {
  const { directory, host } = temporaryHost(t, "p-e-case");
  assert.equal(host.file, join(directory, "p-e-case.sqlite"));
  assert.equal(host.closed, false);
  assert.equal(host.isOpen, true);
  assert.throws(() => openHostDatabase({ directory, name: "p-e-case" }), /must not pre-exist/);
  assert.deepEqual(host.close(), { file: join(directory, "p-e-case.sqlite"), removed: true });
  assert.equal(host.closed, true);
  assert.equal(host.isOpen, false);
  assert.deepEqual(host.close(), { file: join(directory, "p-e-case.sqlite"), removed: false });
});

test("schema is exactly the two declared tables with their required columns", (t) => {
  const { directory, host } = temporaryHost(t);
  const db = new DatabaseSync(join(directory, "case.sqlite"));
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all().map((row) => row.name);
    assert.deepEqual(tables, ["audit_outbox", "business_change"]);
    const columns = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((row) => [row.name, row.type, row.notnull, row.pk]);
    assert.deepEqual(columns("business_change"), [["id", "TEXT", 0, 1]]);
    assert.deepEqual(columns("audit_outbox"), [["event_id", "TEXT", 0, 1], ["transaction_id", "TEXT", 1, 0], ["body", "TEXT", 1, 0]]);
  } finally {
    db.close();
  }
  host.close();
});

test("counts, row contents and host order are observable and independent per host", (t) => {
  const { directory, host } = temporaryHost(t);
  const body = JSON.stringify({ event: "pe-event-0001", correlation: "pe-txn-0001" });
  host.begin();
  host.insertBusiness({ id: "pe-biz-0001" });
  host.insertOutbox({ event_id: "pe-event-0001", transaction_id: "pe-txn-0001", body });
  assert.deepEqual(host.counts(), { business_change: 1, audit_outbox: 1 });
  assert.deepEqual(host.businessIds(), ["pe-biz-0001"]);
  assert.deepEqual(host.outboxRows(), [{ event_id: "pe-event-0001", transaction_id: "pe-txn-0001", body }]);
  host.commit();
  assert.equal(host.isTransaction, false);
  assert.deepEqual(host.order.map((entry) => entry.op), ["begin", "business_insert", "outbox_insert", "commit"]);
  assert.deepEqual(host.order.map((entry) => entry.ordinal), [1, 2, 3, 4]);
  assert.deepEqual(host.order.slice(1, 3).map((entry) => entry.is_transaction), [true, true]);
  assert.equal(host.order[3].is_transaction, false);
  for (const entry of host.order) {
    assert.equal(typeof entry.ordinal, "number");
    assert.equal(typeof entry.at_ms, "number");
    assert.equal(typeof entry.is_transaction, "boolean");
  }
  assert.equal(host.order[2].body_sha256, sha256(Buffer.from(body)));
  const sibling = openHostDatabase({ directory, name: "sibling" });
  assert.deepEqual(sibling.counts(), { business_change: 0, audit_outbox: 0 });
  assert.equal(sibling.file, join(directory, "sibling.sqlite"));
  sibling.close();
});

test("rollback discards rows and every per-case file carries only its own contents", (t) => {
  const { host } = temporaryHost(t);
  host.begin();
  host.insertBusiness({ id: "pe-biz-rolled" });
  host.insertOutbox({ event_id: "pe-event-rolled", transaction_id: "pe-txn-rolled", body: "{}" });
  host.rollback();
  assert.deepEqual(host.counts(), { business_change: 0, audit_outbox: 0 });
  assert.deepEqual(host.businessIds(), []);
  assert.deepEqual(host.outboxRows(), []);
});

test("a closed host refuses further use", (t) => {
  const { host } = temporaryHost(t);
  host.close();
  assert.throws(() => host.insertBusiness({ id: "pe-biz-late" }), /host is closed/);
  assert.throws(() => host.insertOutbox({ event_id: "pe-event-late", transaction_id: "pe-txn-late", body: "{}" }), /host is closed/);
  assert.throws(() => host.begin(), /host is closed/);
  assert.throws(() => host.counts(), /host is closed/);
});
