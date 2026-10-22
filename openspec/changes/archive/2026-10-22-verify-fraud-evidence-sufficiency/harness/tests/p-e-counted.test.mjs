import assert from "node:assert/strict";
import test from "node:test";
import { callback, observations, step } from "../p-e/runtime.mjs";
import { ACCEPTED, REFUSED, fixtureState } from "./p-e-runtime-fixtures.mjs";

const SURFACES = [
  { id: "accepted", run: () => ACCEPTED, kind: "returned", accepted: true },
  { id: "refused", run: () => REFUSED, kind: "returned", accepted: false },
  { id: "throw", run: () => { throw Object.assign(new TypeError("pe-fixture"), REFUSED.error); }, kind: "thrown", accepted: false },
  { id: "reject", run: async () => { throw new Error("pe-async-fixture"); }, kind: "thrown", accepted: false },
];

for (const row of SURFACES) {
  test(`P-E counted boundary retains ${row.id} and exact diagnostic surface`, async () => {
    const state = fixtureState();
    const record = await step(state, { id: row.id, refusalExpected: true, run: () => state.call(row.id, row.run) });
    assert.equal(record.kind, row.kind);
    assert.equal(record.accepted, row.accepted);
    assert.deepEqual(record.raw, state.calls[0].raw);
    assert.equal(state.calls[0].ordinal, 1);
    assert.equal(Boolean(record.unexpected_acceptance), row.accepted);
    if (row.id === "refused") assert.deepEqual(record.diagnostic, REFUSED.error);
    assert.equal(observations(state).ledger.occurrence_count, 1);
  });
}

test("P-E callbacks count first, including nested and overlapping calls with stable ordinals", async () => {
  const state = fixtureState();
  const release = Promise.withResolvers();
  const nested = callback(state, { name: "probe", invoke: () => {
    assert.equal(state.ledger.report().occurrence_count, 3);
    return true;
  } });
  const first = state.call("outer", async () => {
    await release.promise;
    return nested.invoke();
  });
  assert.equal(state.call("interleaved", () => "pe-interleaved"), "pe-interleaved");
  release.resolve();
  assert.equal(await first, true);
  assert.deepEqual(state.calls.map(({ ordinal, label }) => [ordinal, label]),
    [[1, "setup:outer"], [2, "setup:interleaved"], [3, "setup:probe.callback"]]);
  assert.equal(nested.counts.calls, 1);
  assert.equal(state.sequence[0].name, "probe");
  assert.equal(state.sequence[0].ordinal, 1);
  assert.equal(typeof state.sequence[0].at_ms, "number");
});

test("P-E synchronous callback throws retain the outer outcome rather than the last nested slot", () => {
  const state = fixtureState();
  const fault = new TypeError("pe-nested-fixture");
  const probe = callback(state, { name: "probe", invoke: () => { throw fault; } });
  assert.throws(() => state.call("outer", probe.invoke), (error) => error === fault);
  assert.deepEqual(state.calls.map(({ ordinal, kind }) => [ordinal, kind]), [[1, "thrown"], [2, "thrown"]]);
  assert.equal(state.calls[0].raw.message, "pe-nested-fixture");
  assert.equal(probe.counts.calls, 1);
});

test("P-E contained callback exhaustion stays sticky and retains the public refusal as harness fault", async () => {
  const state = fixtureState({ budget: 1 });
  let reached = false;
  const probe = callback(state, { name: "probe", invoke: () => { reached = true; } });
  const contained = () => {
    try { return probe.invoke(); }
    catch { return REFUSED; }
  };
  await assert.rejects(step(state, { id: "contained", run: () => state.call("outer", contained) }), /budget exhausted/);
  assert.equal(reached, false);
  assert.equal(probe.counts.calls, 0);
  assert.equal(state.records.length, 0);
  assert.equal(state.calls[0].attribution, "harness_fault");
  assert.deepEqual(state.calls[0].raw, REFUSED);
  assert.equal(state.ledger.report().exhausted, true);
  assert.throws(() => state.call("after", () => ACCEPTED), /budget exhausted/);
});
