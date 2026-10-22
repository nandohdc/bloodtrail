import assert from "node:assert/strict";
import test from "node:test";
import { redeliveryCase } from "../p-e/redelivery-workload.mjs";
import { REDELIVERY_CASES } from "../p-e/redelivery-cases.mjs";
import { scripted } from "../p-e/scripts.mjs";
import { observations } from "../p-e/runtime.mjs";
import { peState } from "./p-e-case-fixtures.mjs";
import { checkDescriptors, checkTotals, runCases, stepRecord } from "./p-e-redelivery-fixtures.mjs";

// Independent hand-written oracles: pinned delivery-classes.ts:190,273-286,
// 320-326,342-356,466-479; http-handoff.ts:13-21,98-114;
// http-response-classification.ts:31-78. No import from SDK/kit code.
const ORACLE = [
  { id: "P-E-x1", calls: 41, probe: 4, gate: 3, exchange: 2, sink: 2, business: 2 },
  { id: "P-E-2c", calls: 41, probe: 4, gate: 3, exchange: 2, sink: 2, business: 2 },
  { id: "P-E-x2", calls: 44, probe: 7, gate: 4, exchange: 4, sink: 1, business: 1 },
  { id: "P-E-x3", calls: 32, probe: 4, gate: 4, exchange: 4, sink: 1, business: 1 },
];
const FAULT_IDS = ["P-E-x1", "P-E-2c", "P-E-x2", "P-E-x3"];
const CALLBACK_VARIANTS = [{ name: "gate", gate: 1 }, { name: "probe", gate: 0 }];
const REFUSAL_VARIANTS = [
  { prefix: "probe-false", code: "audit_durability_unreachable", gate: 0 },
  { prefix: "gate-declined", code: "business_commit_declined", gate: 1 },
];
const UNREACHABLE = { status: "failed_closed", code: "audit_durability_unreachable",
  commitGateInvoked: false, durabilityAttempted: false };
const runFaults = () => runCases(FAULT_IDS);

function thrownCall(state, label) {
  return state.calls.find((call) => call.label === label && call.kind === "thrown");
}

function success(event) {
  return { status: "committed_and_durable", event_id: event.event.id, transaction_id: event.correlation.transaction_id };
}

test("P-E faults: independent totals, unique step ownership and cloneable raw observations", async () => {
  const { state, rows } = await runFaults();
  checkTotals(rows, ORACLE);
  assert.equal(state.ledger.report().occurrence_count, 158);
  assert.equal(state.ledger.report().exhausted, false);
  assert.doesNotThrow(() => structuredClone(observations(state)));
  checkDescriptors(FAULT_IDS);
});

for (const variant of CALLBACK_VARIANTS) {
  test(`P-E-x1: throwing ${variant.name} rejects, releases reservation and admits retry`, async () => {
    const { state } = await runFaults();
    const record = stepRecord(state, "P-E-x1", `${variant.name}/throw`);
    assert.equal(record.kind, "thrown");
    assert.deepEqual(record.raw, { name: "Error", message: `synthetic ${variant.name} fault` });
    assert.deepEqual(record.diagnostic, {});
    assert.deepEqual(record.counters, { probe: 1, gate: variant.gate, exchange: 0, sink: 0, business_commits: 0 });
    assert.notEqual(thrownCall(state, `P-E-x1:${variant.name}.callback`), undefined);
    const retry = stepRecord(state, "P-E-x1", `${variant.name}/retry`);
    const emit = stepRecord(state, "P-E-x1", `${variant.name}/emit`);
    assert.equal(retry.kind, "returned");
    assert.deepEqual(retry.raw, success(emit.captures[0].event));
    assert.deepEqual(retry.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
    assert.deepEqual(retry.exchange_attempts.map((row) => row.request_attempt), [0]);
  });
}

for (const variant of REFUSAL_VARIANTS) {
  test(`P-E-2c: ${variant.prefix} never settles; caller retry runs probe/gate after commit`, async () => {
    const { state } = await runFaults();
    const emit = stepRecord(state, "P-E-2c", `${variant.prefix}/emit`);
    const event = emit.captures[0].event;
    const first = stepRecord(state, "P-E-2c", `${variant.prefix}/first`);
    assert.deepEqual(first.raw, { status: "failed_closed", code: variant.code, event_id: event.event.id,
      commitGateInvoked: Boolean(variant.gate), durabilityAttempted: false });
    assert.deepEqual(first.counters, { probe: 1, gate: variant.gate, exchange: 0, sink: 0, business_commits: 0 });
    const second = stepRecord(state, "P-E-2c", `${variant.prefix}/second`);
    assert.deepEqual(second.raw, success(event));
    assert.deepEqual(second.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
    const summary = state.accounting.find((row) => row.case_id === "P-E-2c");
    assert(summary.order.positions.commit < summary.order.positions.gate);
  });
}

test("P-E-x2: gate exact-declined comparison and probe truthiness retain distinct shapes", async () => {
  const { state } = await runFaults();
  const emit = stepRecord(state, "P-E-x2", "emit");
  const event = emit.captures[0].event;
  for (const step of ["gate-failed", "gate-undefined", "probe-one", "probe-string"]) {
    const record = stepRecord(state, "P-E-x2", step);
    assert.deepEqual(record.raw, success(event));
    assert.deepEqual(record.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
  }
  for (const step of ["falsy-zero", "falsy-empty", "falsy-undefined"]) {
    const record = stepRecord(state, "P-E-x2", step);
    assert.deepEqual(record.raw, { ...UNREACHABLE, event_id: event.event.id });
    assert.deepEqual(record.counters, { probe: 1, gate: 0, exchange: 0, sink: 0, business_commits: 0 });
  }
});

test("P-E-x3: thrown/timeout exchanges resolve failed_closed and caller redelivery is admitted", async () => {
  const { state } = await runFaults();
  const emit = stepRecord(state, "P-E-x3", "emit");
  for (const step of ["throw", "throw-redeliver", "timeout", "timeout-redeliver"]) {
    const record = stepRecord(state, "P-E-x3", step);
    assert.equal(record.kind, "returned");
    assert.deepEqual(record.raw, { status: "failed_closed", code: "audit_durability_unreachable",
      event_id: emit.captures[0].event.event.id, commitGateInvoked: true, durabilityAttempted: true });
    assert.deepEqual(record.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
  }
  assert.equal(stepRecord(state, "P-E-x3", "throw").exchange_attempts[0].outcome.kind, "thrown");
  assert.notEqual(thrownCall(state, "P-E-x3:exchange.callback"), undefined);
  assert.deepEqual(stepRecord(state, "P-E-x3", "timeout").exchange_attempts[0].outcome.raw, { kind: "timeout" });
});

test("P-E-2c mutation: always-true probe erases probe-false refusal and settles early", async () => {
  const state = peState({ budget: 400 });
  const entry = REDELIVERY_CASES.find((row) => row.case_id === "P-E-2c");
  const summary = await redeliveryCase(state, entry, { probeA: scripted([true], true) });
  assert.notDeepEqual(summary.actual, entry.predicted);
  assert.equal(stepRecord(state, "P-E-2c", "probe-false/first").raw.status, "committed_and_durable");
  assert.equal(stepRecord(state, "P-E-2c", "probe-false/second").raw.status, "already_delivered");
});
