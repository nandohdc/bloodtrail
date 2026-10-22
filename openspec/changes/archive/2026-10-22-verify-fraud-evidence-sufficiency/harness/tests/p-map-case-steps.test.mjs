import assert from "node:assert/strict";
import test from "node:test";
import { runCase } from "../p-map/case-steps.mjs";
import { instance, named, step } from "../p-map/runtime.mjs";
import { causalFacts, handleFacts, handleIdentityFacts, occurrenceFacts, sameIdentity } from "../p-map/snapshot.mjs";
import { ACCEPTED, REFUSED, eventFixture, handleFixture, runtimeFixture } from "./p-map-runtime-fixtures.mjs";

const THROWS = [new Error("fixture-work-fault"), "fixture-string-fault"];
for (const fault of THROWS) test(`P-map contains ${String(fault)} and continues the next owned case`, async () => {
  const { state } = runtimeFixture();
  const failed = await runCase(state, { case_id: "L1", predicted_calls: 1 }, () => {
    state.call("anonymousActor", () => ({}));
    throw fault;
  });
  assert.equal(failed, null);
  assert.equal(state.accounting[0].matched, false);
  assert.equal(state.accounting[0].case_aborted, true);
  assert.deepEqual(state.accounting[0].steps, ["L1/aborted"]);
  assert.equal(state.records[0].variant, "case_aborted");
  assert.equal(state.records[0].kind, "thrown");
  assert.equal(state.records[0].accepted, false);
  await runCase(state, { case_id: "L2", predicted_calls: 1 }, () => step(state, {
    id: "refusal", run: () => state.call("sessionRevoked", () => REFUSED),
  }));
  assert.equal(state.records[1].step_id, "L2/refusal");
  assert.equal(state.accounting[1].case_aborted, undefined);
  assert.deepEqual(state.invalidations, []);
  assert.deepEqual(state.case_aborts, ["L1"]);
});

test("P-map retains earlier step observations when later work aborts", async () => {
  const { state } = runtimeFixture();
  await runCase(state, { case_id: "C1", predicted_calls: 4 }, async () => {
    const target = instance(state);
    await named(state, { target, method: "sessionRevoked", input: {} });
    throw new Error("fixture-after-capture");
  });
  assert.deepEqual(state.records.map((record) => record.step_id), ["C1/emit", "C1/aborted"]);
  assert.equal(state.records[0].sink_count, 1);
  assert.equal(state.accounting[0].public_calls, 4);
  assert.equal(state.accounting[0].matched, false);
});

const PREDICTIONS = [1, 2, 3];
for (const predicted of PREDICTIONS) test(`P-map prediction ${predicted} versus two calls is accounting only`, async () => {
  const { state } = runtimeFixture({ budget: 6 });
  const result = await runCase(state, { case_id: "M1", predicted_calls: predicted }, () => {
    state.call("anonymousActor", () => ({}));
    return state.call("authenticationFailed", () => ACCEPTED);
  });
  assert.deepEqual(result, ACCEPTED);
  const row = state.accounting[0];
  assert.equal(row.public_calls, 2);
  assert.equal(row.notes.length, Number(predicted !== 2));
  assert.equal(row.matched, undefined);
  assert.deepEqual(state.invalidations, []);
  assert.equal(state.ledger.report().exhausted, false);
});

test("P-map case containment cannot swallow sticky ledger exhaustion", async () => {
  const { state } = runtimeFixture({ budget: 1 });
  await assert.rejects(() => runCase(state, { case_id: "K1", predicted_calls: 2 }, () => {
    state.call("anonymousActor", () => ({}));
    try { state.call("authenticationFailed", () => ACCEPTED); } catch { /* Provider swallows fault. */ }
    return ACCEPTED;
  }), /budget exhausted/);
  assert.deepEqual(state.case_aborts, []);
  assert.equal(state.accounting[0].public_calls, 1);
  assert.equal(state.ledger.report().exhausted, true);
  assert.throws(() => state.ledger.assertAvailable(), /budget exhausted/);
});

test("P-map occurrence and causal comparisons are structural, not frozen dynamic identifiers", () => {
  const handle = handleFixture();
  const event = eventFixture();
  const captures = [{ frozen: true, event }];
  const facts = occurrenceFacts({ captures, handle });
  assert.equal(facts.event_name, "bloodtrail.audit.session.revoked");
  assert.equal(facts.delivery_class, "transaction_critical");
  assert.equal(facts.operation_id_matches_handle, true);
  assert.equal(facts.transaction_id_matches_handle, true);
  assert.equal(facts.correlation_id_matches_handle, true);
  assert.deepEqual(handleFacts(handle), { state: "started", transactional: true, bound_event: undefined });
  assert.equal(occurrenceFacts({ captures: [] }), undefined);
  assert.equal(occurrenceFacts({ captures: [captures[0], captures[0]] }), undefined);
  assert.deepEqual(handleIdentityFacts({ handle }), { operation_id_matches_handle: false,
    transaction_id_matches_handle: false, correlation_id_matches_handle: false });
  const completion = { correlation: { causation_id: event.event.id, original_event_id: event.event.id } };
  assert.deepEqual(causalFacts({ original: event, completion }), {
    causation_matches_original: true, original_event_matches_original: true,
  });
  completion.correlation.original_event_id = "pmap-other-occurrence";
  assert.equal(causalFacts({ original: event, completion }).original_event_matches_original, false);
  assert.equal(sameIdentity(undefined, undefined), false);
  assert.equal(sameIdentity("", ""), false);
});
