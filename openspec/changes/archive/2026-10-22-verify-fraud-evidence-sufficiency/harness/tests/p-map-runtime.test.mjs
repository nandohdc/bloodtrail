import assert from "node:assert/strict";
import test from "node:test";
import { callback, instance, named, observations, step } from "../p-map/runtime.mjs";
import { ACCEPTED, REFUSED, eventFixture, handleFixture, runtimeFixture } from "./p-map-runtime-fixtures.mjs";

test("P-map counts constructors/factories/methods and nested sink callbacks before invocation", async () => {
  const { state, configs } = runtimeFixture({ core: { authenticatedHumanActor(input) {
    assert.equal(state.ledger.report().occurrence_count, 1);
    return Object.freeze({ type: "authenticated_human", ...input });
  } } });
  state.current = "L1";
  state.c("authenticatedHumanActor", { id: "acct-0001" });
  const target = instance(state);
  const record = await named(state, { target, method: "sessionRevoked", input: {} });
  assert.deepEqual(record.raw, ACCEPTED);
  assert.equal(record.kind, "returned");
  assert.equal(record.sink_count, 1);
  assert.equal(record.captures[0].frozen, true);
  assert.deepEqual(state.calls.map((call) => call.ordinal), [1, 2, 3, 4, 5]);
  assert.deepEqual(state.calls.map((call) => call.label), ["L1:authenticatedHumanActor",
    "L1:createCapturingAuditSink", "L1:createNodeSecurityAuditSdk", "L1:sessionRevoked", "L1:sinkEmit.callback"]);
  assert.equal(state.ledger.report().occurrence_count, 5);
  assert.equal(configs[0].contractVersion, "2.1.0");
  assert.equal(configs[0].producer.name, "p-map-synthetic-producer");
  assert.equal(configs[0].service.name, "p-map-synthetic-service");
  assert.equal(state.calls[2].raw.representation, "opaque public return");
  const exported = observations(state);
  exported.records[0].raw.value.status = "changed-fixture";
  assert.equal(record.raw.value.status, "accepted");
});

const SURFACES = [
  { name: "returned refusal", invoke: () => REFUSED, kind: "returned", unexpected: false },
  { name: "async refusal", invoke: async () => REFUSED, kind: "returned", unexpected: false },
  { name: "sync throw", invoke: () => { throw Object.assign(new Error("fixture-refusal"), REFUSED.error); }, kind: "thrown", unexpected: undefined },
  { name: "async throw", invoke: async () => { throw Object.assign(new Error("fixture-refusal"), REFUSED.error); }, kind: "thrown", unexpected: undefined },
  { name: "unexpected acceptance", invoke: () => ACCEPTED, kind: "returned", unexpected: true },
];

for (const fixture of SURFACES) test(`P-map preserves ${fixture.name} at the public boundary`, async () => {
  const { state } = runtimeFixture();
  state.current = "L2";
  const record = await step(state, { id: "call", refusalExpected: true,
    run: () => state.call("sessionRevoked", fixture.invoke) });
  assert.equal(record.kind, fixture.kind);
  assert.equal(record.unexpected_acceptance, fixture.unexpected);
  assert.equal(record.sink_count, 0);
  if (!fixture.unexpected) assert.deepEqual(record.diagnostic, REFUSED.error);
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].kind, fixture.kind);
  assert.equal(state.records[0], record);
  assert.deepEqual(state.invalidations, []);
});

test("P-map snapshots frozen status separately from its own immutable capture clone", async () => {
  const { state } = runtimeFixture();
  const source = structuredClone(eventFixture());
  const target = instance(state);
  const record = await step(state, { id: "sink", target, run: () => target.sink.emit(source) });
  source.resource.type = "account";
  assert.equal(record.captures[0].frozen, false);
  assert.equal(record.captures[0].event.resource.type, "session");
  assert(Object.isFrozen(record.captures[0].event.resource));
  assert.throws(() => { record.captures[0].event.resource.type = "account"; }, TypeError);
  assert.deepEqual(record.raw, { status: "accepted" });
});

test("P-map snapshots a handle's public getters at call completion, never SDK closures", () => {
  const handle = handleFixture();
  const { state } = runtimeFixture({ factory: () => ({ beginOperation: () => ({ ok: true, value: handle }) }) });
  const target = instance(state);
  state.method(target.sdk, "beginOperation");
  const captured = state.calls.at(-1).raw;
  state.method(handle, "markCommitted");
  assert.equal(captured.value.state, "started");
  assert.equal(captured.value.transactionId, handle.transactionId);
  assert.equal(captured.value.representation, "operation handle public getters");
  assert.equal(state.calls.at(-1).raw.value.state, "committed");
  assert.doesNotThrow(() => JSON.stringify(observations(state)));
});

test("P-map preserves outer acceptance even when a provider swallows budget exhaustion", async () => {
  const { state } = runtimeFixture({ budget: 1 });
  const provider = callback(state, { name: "provider", invoke: () => ACCEPTED });
  await assert.rejects(async () => step(state, { id: "budget", run: () => state.call("sessionRevoked", () => {
    try { provider.invoke(); } catch { /* Public-shape provider containment. */ }
    return ACCEPTED;
  }) }), /budget exhausted/);
  assert.equal(provider.counts.calls, 0);
  assert.equal(state.ledger.report().exhausted, true);
  assert.equal(state.calls[0].attribution, "harness_fault");
  assert.deepEqual(state.calls[0].raw, ACCEPTED);
  assert.throws(() => state.call("after-exhaustion", () => ACCEPTED), /budget exhausted/);
});
