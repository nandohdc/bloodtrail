import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { commitGate, delivery, exchangeBoundary } from "../p-e/delivery.mjs";
import { observations, step } from "../p-e/runtime.mjs";
import { fixtureState, requestFixture } from "./p-e-runtime-fixtures.mjs";

// node/src/http-handoff.ts:98-113,139-163 and delivery-classes.ts:342-358:
// request.attempt=0 is not the exchange invocation ordinal. These are offline
// exchange fixtures, NOT a run of the binding or an installed handoff.
const OUTCOMES = [
  { id: "ack", run: async (request) => ({ kind: "response", status: 202,
    acknowledgments: [{ event_id: request.event_id, outcome: "accepted" }] }), kind: "returned" },
  { id: "503", run: async () => ({ kind: "response", status: 503, acknowledgments: [] }), kind: "returned" },
  { id: "throw", run: () => { throw new Error("pe-exchange-fixture"); }, kind: "thrown" },
];

for (const row of OUTCOMES) {
  test(`P-E live exchange ${row.id} records actual UTF-8 hash and metadata`, async () => {
    const state = fixtureState();
    const boundary = exchangeBoundary(state, row.run);
    const request = requestFixture();
    const pending = boundary.exchange(request);
    if (row.kind === "thrown") await assert.rejects(pending, /pe-exchange-fixture/);
    else assert.deepEqual(await pending, await row.run(request));
    const observed = boundary.attempts[0];
    assert.equal(observed.outcome.kind, row.kind);
    assert.equal(observed.body_sha256, createHash("sha256").update(request.body).digest("hex"));
    assert.equal(observed.body_bytes, Buffer.byteLength(request.body));
    assert.equal(observed.exchange_ordinal, 1);
    assert.equal(observed.attempt, 1);
    assert.equal(observed.request_attempt, 0);
    assert.equal(observed.event_id, request.event_id);
    assert.equal(observed.method, "POST");
    assert.equal(observed.path, "/v1/security-audit");
    assert.deepEqual(observed.headers, request.headers);
    assert.equal(Object.hasOwn(observed, "body"), false);
    assert.equal(boundary.counts.calls, 1);
    assert.equal(state.ledger.report().occurrence_count, 1);
  });
}

test("P-E exchange ordinals stay stable across caller-driven attempts and metadata is snapshotted", async () => {
  const state = fixtureState();
  const boundary = exchangeBoundary(state, OUTCOMES[0].run);
  const request = requestFixture();
  await boundary.exchange(request);
  await boundary.exchange(request);
  request.headers["content-length"] = "0";
  assert.deepEqual(boundary.attempts.map(({ exchange_ordinal, request_attempt }) => [exchange_ordinal, request_attempt]), [[1, 0], [2, 0]]);
  assert.equal(boundary.attempts[0].body_sha256, boundary.attempts[1].body_sha256);
  assert.notEqual(boundary.attempts[0].headers["content-length"], "0");
  assert.equal(boundary.counts.calls, 2);
  assert.deepEqual(state.calls.map(({ ordinal }) => ordinal), [1, 2]);
});

test("P-E delivery factories receive counted injected callbacks; results retain full variant shape", async () => {
  const options = {};
  const node = {
    createHttpDeliveryHandoff(input) { options.handoff = input; return Object.freeze({ handoff() {} }); },
    createTransactionCriticalDelivery(input) { options.binding = input; return Object.freeze({ deliver() {} }); },
  };
  const state = fixtureState({ node });
  const target = delivery(state, { exchange: OUTCOMES[0].run, durabilityProbe: async () => true });
  const gate = commitGate(state, async () => "declined");
  assert.equal(await options.binding.durabilityProbe(), true);
  assert.equal(await gate.invoke(), "declined");
  await options.handoff.exchange(requestFixture());
  assert.equal(options.binding.handoff, target.handoff);
  assert.equal(target.probe.counts.calls, 1);
  assert.equal(gate.counts.calls, 1);
  assert.equal(target.boundary.counts.calls, 1);
  const raw = { status: "failed_closed", code: "business_commit_declined", event_id: "pe-event-0001",
    commitGateInvoked: true, durabilityAttempted: false };
  const record = await step(state, { id: "result", run: () => state.call("deliver", () => raw) });
  assert.deepEqual(record.raw, raw);
  assert.deepEqual(state.sequence.map(({ name }) => name), ["probe", "gate", "exchange"]);
  assert.equal(state.ledger.report().occurrence_count, 6);
  assert.doesNotThrow(() => structuredClone(observations(state)));
});
