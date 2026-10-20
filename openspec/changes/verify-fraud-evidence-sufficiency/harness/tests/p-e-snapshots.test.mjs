import assert from "node:assert/strict";
import test from "node:test";
import { instance, observations, step } from "../p-e/runtime.mjs";
import { publicSnapshot } from "../p-e/snapshot.mjs";
import { ACCEPTED, EVENT, REFUSED, fixtureState, handleFixture } from "./p-e-runtime-fixtures.mjs";

// Public handle getters/snapshot/transition signatures: core/src/operations.ts:31-46.
// No extra snapshot invocation is invented merely to serialize a handle.
test("P-E snapshots handle getters at return time, with no live methods or later state drift", () => {
  const handle = handleFixture();
  const sdk = { beginOperation: () => ({ ok: true, value: handle }) };
  const state = fixtureState();
  const result = state.method(sdk, "beginOperation");
  assert.equal(result.value, handle);
  const captured = state.calls[0].raw.value;
  assert.equal(captured.state, "started");
  assert.equal(captured.operationId, handle.operationId);
  assert.equal(captured.transactionId, handle.transactionId);
  assert.equal(captured.correlationId, handle.correlationId);
  assert.equal(captured.boundEvent, "mfaRemoved");
  assert.equal(captured.transactional, true);
  assert.equal(captured.frozen, true);
  state.method(handle, "markCommitted");
  state.method(handle, "snapshot");
  assert.equal(captured.state, "started");
  assert.equal(state.calls[1].raw.value.state, "committed");
  assert.equal(state.calls[2].raw.state, "committed");
  assert.doesNotThrow(() => structuredClone(observations(state)));
  assert.equal(state.ledger.report().occurrence_count, 3);
});

test("P-E capturing sink preserves synchronous entry, captures, frozen state and isolated snapshots", async () => {
  let sinkEntered = false;
  const state = fixtureState({ node: { createNodeSecurityAuditSdk: ({ sink }) => ({
    async mfaRemoved() {
      const pending = sink.emit(EVENT);
      sinkEntered = true;
      await pending;
      return ACCEPTED;
    },
  }) } });
  const target = instance(state);
  const pending = step(state, { id: "emit", target, run: () => state.method(target.sdk, "mfaRemoved") });
  assert.equal(sinkEntered, true);
  assert.equal(target.captures.length, 1);
  const record = await pending;
  assert.deepEqual(record.captures, [{ frozen: true, event: EVENT }]);
  assert.notEqual(record.captures[0].event, EVENT);
  record.captures[0].event.event.id = "pe-clone-only";
  assert.equal(target.captures[0].event.event.id, EVENT.event.id);
  assert.equal(target.counts.calls, 1);
  assert.equal(record.result_frozen, true);
  assert.equal(state.calls[0].raw.representation, "opaque public return");
  assert.equal(state.calls[1].raw.representation, "opaque public return");
  assert.deepEqual(state.calls.map(({ ordinal }) => ordinal), [1, 2, 3, 4]);
  assert.doesNotThrow(() => structuredClone(observations(state)));
});

test("P-E host sink callbacks retain a capture even when the injected sink throws", async () => {
  const state = fixtureState({ node: { createNodeSecurityAuditSdk: ({ sink }) => ({
    mfaRemoved: () => sink.emit(EVENT),
  }) } });
  const target = instance(state, { sink: { emit() { throw new Error("pe-host-fixture"); } } });
  const record = await step(state, { id: "sink-fault", target, run: () => state.method(target.sdk, "mfaRemoved") });
  assert.equal(record.kind, "thrown");
  assert.equal(record.raw.message, "pe-host-fixture");
  assert.equal(record.captures[0].frozen, true);
  assert.equal(target.counts.calls, 1);
  assert.equal(state.ledger.report().occurrence_count, 3);
});

test("P-E factory throws are not mistaken for opaque factory acceptances", async () => {
  const fault = Object.assign(new TypeError("pe-factory-fixture"), REFUSED.error);
  const state = fixtureState({ node: { createNodeSecurityAuditSdk() { throw fault; } } });
  const record = await step(state, { id: "factory", run: () => instance(state) });
  assert.equal(record.kind, "thrown");
  assert.deepEqual(state.calls[1].diagnostic, REFUSED.error);
  assert.equal(state.calls[1].raw.message, "pe-factory-fixture");
});

test("P-E binding admission refusals retain their exact public result without invented SDK diagnostics", async () => {
  const state = fixtureState();
  const raw = { status: "refused", code: "transaction_id_required", event_id: EVENT.event.id };
  const record = await step(state, { id: "admission", refusalExpected: true, run: () => state.call("deliver", () => raw) });
  assert.deepEqual(record.raw, raw);
  assert.equal(record.accepted, false);
  assert.equal(record.unexpected_acceptance, false);
  assert.deepEqual(record.diagnostic, { code: raw.code });
  assert.equal(state.calls[0].accepted, false);
});

test("P-E generic snapshots never invoke accessors/toJSON or retain closures or cycles", () => {
  const value = { closure() {}, toJSON() { assert.fail("must not execute toJSON"); } };
  Object.defineProperty(value, "accessor", { enumerable: true, get() { assert.fail("must not read accessor"); } });
  value.self = value;
  const snapshot = publicSnapshot({ label: "fixture", value });
  assert.equal(snapshot.closure.representation, "opaque public return");
  assert.equal(snapshot.accessor.value_type, "function");
  assert.equal(snapshot.self.representation, "opaque public return");
  assert.doesNotThrow(() => JSON.stringify(structuredClone(snapshot)));
});
