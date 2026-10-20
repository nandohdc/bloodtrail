import assert from "node:assert/strict";
import test from "node:test";
import { mutateRecovery, recoveryFixture, recoveryRecord } from "./p-e-recovery-fixtures.mjs";

// Independent oracle, abcbefa sdk.ts:279-296 releases reservations in finally;
// 318-338 maps thrown sink errors; operations.ts:176-186 only completes on
// accepted sink result. SQL rollback is NOT a lifecycle reversal.
function assertSinkFailureRetry(fixture, row) {
  const first = recoveryRecord(fixture.state, "P-E-10c", "fault:emit");
  assert.equal(first.accepted, false);
  assert.deepEqual(first.raw, { ok: false, error: { code: "SDK_SINK_FAILURE", category: "sink", path: "/sink",
    eventName: "bloodtrail.audit.authentication.mfa.removed" } });
  assert.equal(first.sink_ran_before_await, true);
  assert.equal(first.inserts_before_await, 0);
  assert.equal(first.host_sink[0].faulted, true);
  assert.equal(first.host_sink[0].is_transaction, true);
  assert.equal(first.handle.state, "committed");
  const rolledBack = recoveryRecord(fixture.state, "P-E-10c", "fault:snapshot");
  assert.deepEqual(rolledBack.database.counts, { business_change: 0, audit_outbox: 0 });
  assert.equal(rolledBack.raw.state, "committed");
  const retry = recoveryRecord(fixture.state, "P-E-10c", "retry:emit");
  assert.deepEqual(retry.raw, { ok: true, value: { status: "accepted" } });
  assert.equal(retry.host_sink[0].inserted_is_transaction, true);
  const branch = row.branches[0];
  assert.deepEqual(branch.identity, { same_event_id: false, same_operation_id: true, same_transaction_id: true,
    same_correlation_id: true, same_body: false, retry_attempt: 0, original_event_id_matches_prior: false });
  assert.deepEqual(branch.database.counts, { business_change: 1, audit_outbox: 1 });
  assert.deepEqual(branch.sink_counts, { entries: 2, inserts: 1, faults: 1 });
  assert.equal(row.public_calls, 15);
  assert.deepEqual(branch.host_order.map((entry) => entry.op),
    ["begin", "business_insert", "rollback", "begin", "business_insert", "outbox_insert", "commit"]);
}

test("P-E-10c sink failure releases reservation; plain retry on same committed handle becomes durable", async (t) => {
  const fixture = recoveryFixture(t);
  const row = await fixture.run("P-E-10c");
  assertSinkFailureRetry(fixture, row);
});

test("reservation-not-released mutation prevents retry and is preserved as a refusal", async (t) => {
  const modules = mutateRecovery((sdk) => {
    let failed = false;
    return { ...sdk, mfaRemoved: async (input) => {
      if (failed) return { ok: false, error: { code: "SDK_DUPLICATE_SUCCESS", category: "lifecycle", path: "/operation/state" } };
      const result = await sdk.mfaRemoved(input);
      failed = !result.ok;
      return result;
    } };
  });
  const fixture = recoveryFixture(t, { modules });
  const row = await fixture.run("P-E-10c");
  assert.throws(() => assertSinkFailureRetry(fixture, row));
  const retry = recoveryRecord(fixture.state, "P-E-10c", "retry:emit");
  assert.equal(retry.diagnostic.code, "SDK_DUPLICATE_SUCCESS");
  assert.deepEqual(row.branches[0].database.counts, { business_change: 1, audit_outbox: 0 });
});
