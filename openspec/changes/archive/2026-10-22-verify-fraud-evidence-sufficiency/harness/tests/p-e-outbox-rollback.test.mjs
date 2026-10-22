import assert from "node:assert/strict";
import test from "node:test";
import { assertTransactionalEmit, decorateMfa, diagnosticTuple, outboxFixture, outboxRecord } from "./p-e-outbox-fixtures.mjs";

// Independent oracle, pinned abcbefa: operations.ts:86-112 (same-state no-op,
// invalid reverse transitions, committed -> compensated only), sdk.ts:248-266,
// 279-296,475-483 (completed success blocks plain re-emit, regardless of host
// rollback); operations.ts:212-224 (public snapshot commit_state mapping).
const ROLLBACK_STEPS = ["mark", "emit", "snapshot", "reemit", "markNot", "markCancelled", "markCommitted", "markCompensated"];
const REVERSE_STEPS = ["markNot", "markCancelled"];
const NO_ROWS = { business_change: 0, audit_outbox: 0 };

function assertDuplicateRefusal(record) {
  assert.equal(record.accepted, false);
  assert.deepEqual(diagnosticTuple(record), ["SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state"]);
  assert.equal(record.counters.sink, 0);
  assert.deepEqual(record.captures, []);
  assert.deepEqual(record.host_sink, []);
}

test("P-E-10 accepted-before-rollback leaves no rows but committed public handle/snapshot and a completed success", async (t) => {
  const fixture = outboxFixture(t);
  const rows = await fixture.run();
  const record = (id) => outboxRecord(fixture.state, "P-E-10", id);
  const emit = record("emit");
  assertTransactionalEmit(emit);
  const snapshot = record("snapshot");
  assert.equal(snapshot.raw.state, "committed");
  assert.equal(snapshot.raw.commit_state, "committed");
  assert.equal(snapshot.raw.transaction_id, emit.captures[0].event.correlation.transaction_id);
  assert.deepEqual(snapshot.database.counts, NO_ROWS);
  assert.deepEqual(snapshot.database.outbox_rows, []);
  assert.equal(snapshot.handle.state, "committed");
  assertDuplicateRefusal(record("reemit"));
  for (const id of REVERSE_STEPS) {
    assert.deepEqual(diagnosticTuple(record(id)), ["SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation/state"]);
    assert.equal(record(id).handle.state, "committed");
  }
  assert.equal(record("markCommitted").accepted, true);
  assert.deepEqual(record("markCommitted").raw.value, snapshot.raw, "same-state transition is a no-op");
  const compensated = record("markCompensated");
  assert.equal(compensated.accepted, true);
  assert.equal(compensated.raw.value.state, "compensated");
  assert.equal(compensated.raw.value.commit_state, "compensated");
  assert.equal(compensated.handle.state, "compensated");
  const row = rows.find((entry) => entry.case_id === "P-E-10");
  assert.deepEqual(row.steps, ROLLBACK_STEPS);
  assert.deepEqual(fixture.state.records.filter((entry) => entry.step_id.startsWith("P-E-10/"))
    .map((entry) => entry.step_id.split("/").at(-1)), ROLLBACK_STEPS);
  assert.deepEqual(row.host_order.map((entry) => entry.op), ["begin", "business_insert", "outbox_insert", "rollback"]);
  assert(row.host_order[3].at_ms >= emit.host_sink[0].inserted_at_ms);
  assert.deepEqual(row.database.counts, NO_ROWS);
  assert.equal(row.final_handle.state, "compensated");
  assert.deepEqual(row.actual, { probe: 0, gate: 0, exchange: 0, sink: 1, business_commits: 0 });
});

test("rollback duplicate mutation is retained as unexpected acceptance and later transitions still run", async (t) => {
  const modules = decorateMfa((emit) => {
    let calls = 0;
    return (input) => {
      calls += 1;
      if (calls === 2) return Promise.resolve({ ok: true, value: { status: "accepted" } });
      return emit(input);
    };
  });
  const fixture = outboxFixture(t, { modules });
  const rows = await fixture.run();
  const duplicate = outboxRecord(fixture.state, "P-E-10", "reemit");
  assert.equal(duplicate.unexpected_acceptance, true);
  assert.throws(() => assertDuplicateRefusal(duplicate));
  assert.equal(outboxRecord(fixture.state, "P-E-10", "markCompensated").handle.state, "compensated");
  assert.deepEqual(rows.find((entry) => entry.case_id === "P-E-10").database.counts, NO_ROWS);
});
