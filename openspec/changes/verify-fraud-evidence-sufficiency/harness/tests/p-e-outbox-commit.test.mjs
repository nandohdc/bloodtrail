import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { sha256 } from "../lib/io.mjs";
import { observations } from "../p-e/runtime.mjs";
import { OUTBOX_CASES } from "../p-e/outbox-cases.mjs";
import { peDouble } from "./p-e-case-fixtures.mjs";
import { assertTransactionalEmit, decorateMfa, diagnosticTuple, outboxFixture, outboxRecord } from "./p-e-outbox-fixtures.mjs";

// Independent oracle at abcbefa: sdk.ts:208-245,279-296,318-338 (sync sink
// entry, accepted completion, duplicate guard); operations.ts:86-112,212-224;
// events.ts:227-253 (public correlation); http-handoff.ts:98-114,139-175 (one
// exchange, attempt zero, actual JSON body). Counts include 6 context factories,
// ONE Node factory (custom host sink, no capturing factory) and snapshot().
const ORACLE = [
  { id: "P-E-9", calls: 13, exchange: 0, business: 1 },
  { id: "P-E-9b", calls: 15, exchange: 1, business: 1 },
  { id: "P-E-10", calls: 17, exchange: 0, business: 0 },
];
const COMMIT_IDS = ["P-E-9", "P-E-9b"];

test("outbox workloads: independent predicted public-call totals and zero binding probe/gate calls", async (t) => {
  const fixture = outboxFixture(t);
  const rows = await fixture.run();
  for (const oracle of ORACLE) {
    const row = rows.find((entry) => entry.case_id === oracle.id);
    assert.equal(row.public_calls, oracle.calls, oracle.id);
    assert.equal(row.predicted_calls, oracle.calls, oracle.id);
    assert.deepEqual(row.actual, { probe: 0, gate: 0, exchange: oracle.exchange, sink: 1, business_commits: oracle.business });
    assert.deepEqual(row.predicted, row.actual);
  }
  assert.equal(fixture.state.ledger.report().occurrence_count, 45);
  assert.equal(fixture.state.calls.some((call) => call.label.includes("createTransactionCriticalDelivery")), false);
  assert.doesNotThrow(() => structuredClone(observations(fixture.state)));
  assert.deepEqual(fixture.state.accounting, rows);
});

test("P-E-9/9b commit only after accepted synchronous transaction-bound insert and preserve public body fields", async (t) => {
  const fixture = outboxFixture(t);
  const rows = await fixture.run();
  for (const id of COMMIT_IDS) {
    const emit = outboxRecord(fixture.state, id, "emit");
    assertTransactionalEmit(emit);
    const snapshot = outboxRecord(fixture.state, id, "snapshot");
    assert.equal(snapshot.raw.state, "committed");
    assert.equal(snapshot.raw.commit_state, "committed");
    const database = snapshot.database;
    assert.equal(database.is_transaction, false);
    assert.deepEqual(database.counts, { business_change: 1, audit_outbox: 1 });
    assert.deepEqual(database.business_ids, ["pe-change-0001"]);
    const stored = database.outbox_rows[0];
    assert.deepEqual(JSON.parse(stored.body), emit.captures[0].event);
    assert.equal(stored.event_id, emit.captures[0].event.event.id);
    assert.equal(stored.transaction_id, snapshot.raw.transaction_id);
    assert.deepEqual(database.row_facts[0], {
      event_id_matches_body: true, transaction_id_matches_body: true, transaction_id_matches_handle: true,
      operation_id_matches_handle: true, correlation_id_matches_handle: true, body_matches_capture: true,
      commit_state: "committed", body_sha256: sha256(Buffer.from(stored.body)),
    });
    const row = rows.find((entry) => entry.case_id === id);
    assert.deepEqual(row.host_order.map((entry) => entry.op), ["begin", "business_insert", "outbox_insert", "commit"]);
    assert.deepEqual(row.host_order.map((entry) => entry.is_transaction), [true, true, true, false]);
    assert(row.host_order[3].at_ms >= emit.host_sink[0].inserted_at_ms);
    assert.equal(emit.occurrence.operation_type, "delete");
    assert.equal(emit.occurrence.lifecycle_phase, "completed");
    assert.equal(emit.occurrence.outcome, "success");
  }
  const duplicate = outboxRecord(fixture.state, "P-E-9", "reemit");
  assert.deepEqual(diagnosticTuple(duplicate), ["SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state"]);
  assert.equal(duplicate.captures.length, 0);
  assert.equal(duplicate.host_sink.length, 0);
  assert.equal(duplicate.counters.sink, 0);
});

test("P-E-9b one bare handoff sees durable committed rows through a second native connection", async (t) => {
  const modules = peDouble();
  const factory = modules.node.createHttpDeliveryHandoff;
  const fixture = outboxFixture(t, { modules });
  let inspected = 0;
  modules.node.createHttpDeliveryHandoff = (options) => {
    const reader = new DatabaseSync(join(fixture.directory, "P-E-9b.sqlite"));
    try {
      assert.equal(reader.prepare("SELECT count(*) AS n FROM business_change").get().n, 1);
      assert.equal(reader.prepare("SELECT count(*) AS n FROM audit_outbox").get().n, 1);
      inspected += 1;
    } finally { reader.close(); }
    return factory(options);
  };
  await fixture.run();
  assert.equal(inspected, 1);
  const snapshot = outboxRecord(fixture.state, "P-E-9b", "snapshot");
  const row = snapshot.database.outbox_rows[0];
  const relay = outboxRecord(fixture.state, "P-E-9b", "relay");
  assert.deepEqual(relay.raw, { status: "acknowledged", code: "acknowledged", event_id: row.event_id, attempt: 0 });
  assert.deepEqual(relay.counters, { probe: 0, gate: 0, exchange: 1, sink: 0, business_commits: 0 });
  assert.equal(relay.exchange_attempts.length, 1);
  assert.equal(relay.stored_body_sha256, sha256(Buffer.from(row.body)));
  assert.deepEqual(relay.round_trip, [{ live_body_matches_stored: true, event_id_matches_row: true, request_attempt: 0 }]);
  const request = relay.exchange_attempts[0];
  assert.equal(request.body_sha256, relay.stored_body_sha256);
  assert.equal(request.method, "POST");
  assert.equal(request.path, "/v1/security-audit");
});

test("a delayed public emit is observed as non-synchronous, never concealed by waiting for acceptance", async (t) => {
  const modules = decorateMfa((emit) => async (input) => { await Promise.resolve(); return emit(input); });
  const fixture = outboxFixture(t, { modules });
  await fixture.run();
  for (const id of COMMIT_IDS) {
    const record = outboxRecord(fixture.state, id, "emit");
    assert.equal(record.sink_ran_before_await, false);
    assert.equal(record.inserts_before_await, 0);
    assert.equal(record.host_sink[0].inserted_is_transaction, true);
    assert.throws(() => assertTransactionalEmit(record));
  }
});

test("relay mutation changes the LIVE boundary-3 hash even though the stored text stays unchanged", async (t) => {
  const modules = peDouble();
  const factory = modules.node.createHttpDeliveryHandoff;
  modules.node.createHttpDeliveryHandoff = ({ path, exchange }) => factory({ path,
    exchange: (request) => exchange({ ...request, body: `${request.body} ` }) });
  const fixture = outboxFixture(t, { modules });
  await fixture.run();
  const relay = outboxRecord(fixture.state, "P-E-9b", "relay");
  assert.equal(relay.raw.status, "acknowledged");
  assert.notEqual(relay.exchange_attempts[0].body_sha256, relay.stored_body_sha256);
  assert.deepEqual(relay.round_trip, [{ live_body_matches_stored: false, event_id_matches_row: true, request_attempt: 0 }]);
});

test("outbox case hypotheses carry fresh setups, source citations and no outcome corrections", () => {
  assert.deepEqual(OUTBOX_CASES.map((entry) => entry.case_id), ORACLE.map((row) => row.id));
  for (const entry of OUTBOX_CASES) {
    assert.equal(entry.family, "outbox");
    assert.equal(entry.confidence, "high");
    assert.equal(entry.corrected_from, undefined);
    assert(entry.basis.some((cite) => cite.includes("sdk.ts:208-245")));
    assert(entry.basis.some((cite) => cite.includes("operations.ts:")));
  }
});
