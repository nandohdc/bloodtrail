import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureState } from "./p-e-runtime-fixtures.mjs";
import { peDouble } from "./p-e-case-fixtures.mjs";
import { outboxWorkload } from "../p-e/outbox-workload.mjs";

// Fixture-only wiring. Native host databases and an independently source-cited
// public-shape SDK double; no package or kit import, no probe entry or network.
export function outboxFixture(t, { modules = peDouble(), budget = 200 } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "pe-host-workload-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const state = fixtureState({ ...modules, budget });
  return { directory, state, async run() {
    const rows = await outboxWorkload(state, { directory });
    assert.deepEqual(readdirSync(directory), [], "all per-case SQLite files removed");
    return rows;
  } };
}

export function outboxRecord(state, caseId, id) {
  const record = state.records.find((row) => row.step_id === `${caseId}/${id}`);
  assert.notEqual(record, undefined, `${caseId}/${id}`);
  return record;
}

// sdk.ts:318-338 invokes sink.emit before its first await. The host sink
// inserts before returning its promise; the connection remains in BEGIN.
export function assertTransactionalEmit(record) {
  assert.deepEqual(record.raw, { ok: true, value: { status: "accepted" } });
  assert.equal(record.sink_ran_before_await, true);
  assert.equal(record.inserts_before_await, 1);
  assert.equal(record.transaction_open_after_await, true);
  assert.equal(record.host_sink.length, 1);
  const sink = record.host_sink[0];
  assert.equal(sink.is_transaction, true);
  assert.equal(sink.inserted_is_transaction, true);
  assert.equal(sink.frozen, true);
  assert.equal(sink.deferred, false);
  assert(sink.inserted_at_ms >= sink.at_ms);
}

export function diagnosticTuple(record) {
  return [record.diagnostic.code, record.diagnostic.category, record.diagnostic.path];
}

export function decorateMfa(decorate) {
  const modules = peDouble();
  const factory = modules.node.createNodeSecurityAuditSdk;
  modules.node.createNodeSecurityAuditSdk = (config) => {
    const sdk = factory(config);
    return { ...sdk, mfaRemoved: decorate(sdk.mfaRemoved) };
  };
  return modules;
}
