import assert from "node:assert/strict";
import test from "node:test";
import { orderingWorkload } from "../p-e/ordering-workload.mjs";
import { ORDERING_CASES, PE_BASE, PE_COMMENT } from "../p-e/ordering-cases.mjs";
import { observations } from "../p-e/runtime.mjs";
import { sha256 } from "../lib/io.mjs";
import { peState } from "./p-e-case-fixtures.mjs";

// Independent hand-written oracle, derived from the pinned sources, not from
// the workload: delivery-classes.ts:259-285,305-335,342-356,448-479 (binding
// at abcbefa), http-handoff.ts:98-114,139-163, operations.ts:86-112,
// sdk.ts:86-107,208-266,475-483, events.ts:106-143,190-225,227-253. Per-case
// public-call counts are counted from the same sources, call by call.
const ORACLE = [
  { id: "P-E-2", calls: 18, probe: 1, gate: 1, exchange: 1, sink: 1, business: 1,
    status: "committed_and_durable" },
  { id: "P-E-2b", calls: 16, probe: 1, gate: 0, exchange: 0, sink: 1, business: 1,
    status: "failed_closed", code: "audit_durability_unreachable", gateInvoked: false, durable: false },
  { id: "P-E-3a", calls: 18, probe: 1, gate: 1, exchange: 1, sink: 1, business: 0,
    status: "committed_and_durable" },
  { id: "P-E-3b", calls: 17, probe: 1, gate: 1, exchange: 0, sink: 1, business: 0,
    status: "failed_closed", code: "business_commit_declined", gateInvoked: true, durable: false },
  { id: "P-E-4", calls: 28, probe: 2, gate: 1, exchange: 1, sink: 2, business: 0 },
  { id: "P-E-4b", calls: 35, probe: 2, gate: 2, exchange: 1, sink: 2, business: 1 },
];

function recordsFor(state, caseId) {
  return state.records.filter((record) => record.step_id.startsWith(`${caseId}/`));
}

function stepRecord(state, caseId, step) {
  const record = recordsFor(state, caseId).find((entry) => entry.step_id === `${caseId}/${step}`);
  assert.notEqual(record, undefined, `${caseId}/${step}`);
  return record;
}

function runOrdering() {
  const state = peState({ budget: 200 });
  return orderingWorkload(state).then((rows) => ({ state, rows }));
}

test("P-E ordering family: independent per-case oracle for totals, counts and result shapes", async () => {
  const { state, rows } = await runOrdering();
  for (const oracle of ORACLE) {
    const summary = rows.find((row) => row.case_id === oracle.id);
    assert.equal(summary.public_calls, oracle.calls, oracle.id);
    assert.equal(summary.predicted_calls, oracle.calls, oracle.id);
    assert.deepEqual(summary.actual, summary.predicted, oracle.id);
    assert.equal(summary.actual.probe, oracle.probe, oracle.id);
    assert.equal(summary.actual.gate, oracle.gate, oracle.id);
    assert.equal(summary.actual.exchange, oracle.exchange, oracle.id);
    assert.equal(summary.actual.sink, oracle.sink, oracle.id);
    assert.equal(summary.actual.business_commits, oracle.business, oracle.id);
  }
  assert.equal(state.ledger.report().occurrence_count, 132);
  assert.equal(state.ledger.report().exhausted, false);
  assert.doesNotThrow(() => structuredClone(observations(state)));
});

test("P-E-2 truthful order: business commit precedes the probe; boundary-3 request is attempt 0 with the live body hash", async () => {
  const { state, rows } = await runOrdering();
  const emit = stepRecord(state, "P-E-2", "emit");
  const deliver = stepRecord(state, "P-E-2", "deliver");
  assert.equal(emit.accepted, true);
  assert.equal(emit.captures[0].frozen, true);
  assert.deepEqual(emit.occurrence, {
    event_name: "bloodtrail.audit.authentication.mfa.removed",
    outcome: "success", lifecycle_phase: "completed", commit_state: "committed",
    delivery_class: "transaction_critical", operation_type: "delete", retry_attempt: 0,
    transaction_id_matches_handle: true, operation_id_matches_handle: true, correlation_id_matches_handle: true,
  });
  const captured = emit.captures[0].event;
  assert.deepEqual(deliver.raw, { status: "committed_and_durable",
    event_id: captured.event.id, transaction_id: captured.correlation.transaction_id });
  assert.equal(deliver.result_frozen, false);
  const attempt = deliver.exchange_attempts[0];
  assert.equal(deliver.exchange_attempts.length, 1);
  assert.equal(attempt.request_attempt, 0);
  assert.equal(attempt.method, "POST");
  assert.equal(attempt.path, "/v1/security-audit");
  assert.equal(attempt.event_id, captured.event.id);
  assert.equal(attempt.body_sha256, sha256(Buffer.from(JSON.stringify(captured))));
  const summary = rows.find((row) => row.case_id === "P-E-2");
  assert.deepEqual(summary.order.names, ["commit", "markCommitted", "sinkEmit", "probe", "gate", "exchange"]);
  assert.equal(summary.order.monotonic_ms, true);
  const { positions } = summary.order;
  assert(positions.commit < positions.markCommitted && positions.markCommitted < positions.sinkEmit);
  assert(positions.sinkEmit < positions.probe && positions.probe < positions.gate);
  assert(positions.gate < positions.exchange && positions.exchange >= 0);
});

// One table-driven test for both fail-closed refusals: the probe-false branch
// (P-E-2b) never reaches the gate or the exchange; the declined gate (P-E-3b)
// runs the gate and never reaches the exchange (delivery-classes.ts:342-356).
const FAILED_CLOSED_ROWS = [
  { caseId: "P-E-2b", code: "audit_durability_unreachable", gate: 0, exchange: 0 },
  { caseId: "P-E-3b", code: "business_commit_declined", gate: 1, exchange: 0 },
];

test("fail-closed result shapes are exact for the probe-false and declined-gate branches", async () => {
  const { state } = await runOrdering();
  for (const row of FAILED_CLOSED_ROWS) {
    const emit = stepRecord(state, row.caseId, "emit");
    const deliver = stepRecord(state, row.caseId, "deliver");
    assert.deepEqual(deliver.raw, { status: "failed_closed", code: row.code,
      event_id: emit.captures[0].event.event.id, commitGateInvoked: row.gate === 1, durabilityAttempted: false });
    assert.equal(deliver.result_frozen, true);
    assert.deepEqual(deliver.counters, { probe: 1, gate: row.gate, exchange: row.exchange, sink: 0, business_commits: 0 });
    assert.equal(deliver.exchange_attempts.length, 0);
  }
});

test("P-E-3a not_committed occurrence still runs the gate and is labelled committed_and_durable (expected finding)", async () => {
  const { state } = await runOrdering();
  const emit = stepRecord(state, "P-E-3a", "emit");
  const deliver = stepRecord(state, "P-E-3a", "deliver");
  assert.equal(emit.occurrence.outcome, "failure");
  assert.equal(emit.occurrence.commit_state, "not_committed");
  assert.deepEqual(deliver.raw, { status: "committed_and_durable",
    event_id: emit.captures[0].event.event.id, transaction_id: emit.captures[0].event.correlation.transaction_id });
  assert.deepEqual(deliver.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
});

test("P-E-4 untruthful order: false committed record, invalid reverse transitions, fresh-handle corrective linkage and reused-operation-id refusal", async () => {
  const { state } = await runOrdering();
  const mark = stepRecord(state, "P-E-4", "mark");
  const emit = stepRecord(state, "P-E-4", "emit");
  const deliver = stepRecord(state, "P-E-4", "deliver");
  assert.equal(mark.accepted, true);
  assert.equal(emit.occurrence.commit_state, "committed");
  assert.deepEqual(deliver.raw, { status: "failed_closed", code: "audit_durability_unreachable",
    event_id: emit.captures[0].event.event.id, commitGateInvoked: false, durabilityAttempted: false });
  const invalid = ["SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation/state"];
  for (const step of ["markNot", "markCancelled"]) {
    const record = stepRecord(state, "P-E-4", step);
    assert.deepEqual([record.diagnostic.code, record.diagnostic.category, record.diagnostic.path], invalid, step);
  }
  const reemit = stepRecord(state, "P-E-4", "reemit");
  assert.deepEqual([reemit.diagnostic.code, reemit.diagnostic.category, reemit.diagnostic.path],
    ["SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state"]);
  assert.equal(reemit.captures.length, 0);
  const fresh = stepRecord(state, "P-E-4", "fresh");
  assert.equal(fresh.accepted, true);
  assert.deepEqual(fresh.linkage, { operation_id_minted: true, transaction_id_reused: true, correlation_id_reused: true });
  assert.equal(fresh.handle.state, "started");
  assert.equal(stepRecord(state, "P-E-4", "mark2").accepted, true);
  const corrective = stepRecord(state, "P-E-4", "corrective");
  assert.equal(corrective.accepted, true);
  assert.deepEqual(corrective.links_false_occurrence, {
    original_event_id_equals_false_event: true,
    transaction_id_matches_false_handle: true,
    correlation_id_matches_false_handle: true,
    operation_id_matches_false_handle: false,
  });
  assert.equal(corrective.occurrence.outcome, "failure");
  assert.equal(corrective.occurrence.commit_state, "not_committed");
  assert.equal(corrective.occurrence.retry_attempt, 1);
  const reuse = stepRecord(state, "P-E-4", "reuse");
  assert.deepEqual([reuse.diagnostic.code, reuse.diagnostic.category, reuse.diagnostic.path],
    ["SDK_INVALID_IDENTIFIER", "validation", "/operation/operation_id"]);
  const correctiveDeliver = stepRecord(state, "P-E-4", "corrective-deliver");
  assert.equal(correctiveDeliver.raw.status, "committed_and_durable");
  assert.deepEqual(correctiveDeliver.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 0 });
  const summary = rowsFor(state).find((row) => row.case_id === "P-E-4");
  assert.deepEqual(summary.actual, { probe: 2, gate: 1, exchange: 1, sink: 2, business_commits: 0 });
});

test("P-E-4b designed order: the gate is the only business commit, and both gate outcomes are recorded", async () => {
  const { state, rows } = await runOrdering();
  const mainEmit = stepRecord(state, "P-E-4b", "main/emit");
  const declinedEmit = stepRecord(state, "P-E-4b", "declined/emit");
  const main = stepRecord(state, "P-E-4b", "main/deliver");
  assert.deepEqual(main.raw, { status: "committed_and_durable",
    event_id: mainEmit.captures[0].event.event.id, transaction_id: mainEmit.captures[0].event.correlation.transaction_id });
  assert.deepEqual(main.counters, { probe: 1, gate: 1, exchange: 1, sink: 0, business_commits: 1 });
  const declined = stepRecord(state, "P-E-4b", "declined/deliver");
  assert.deepEqual(declined.raw, { status: "failed_closed", code: "business_commit_declined",
    event_id: declinedEmit.captures[0].event.event.id, commitGateInvoked: true, durabilityAttempted: false });
  assert.deepEqual(declined.counters, { probe: 1, gate: 1, exchange: 0, sink: 0, business_commits: 0 });
  const summary = rows.find((row) => row.case_id === "P-E-4b");
  assert.deepEqual(summary.actual, { probe: 2, gate: 2, exchange: 1, sink: 2, business_commits: 1 });
  const { positions, monotonic_ms } = summary.order;
  assert.equal(monotonic_ms, true);
  assert(positions.markCommitted < positions.sinkEmit && positions.sinkEmit < positions.probe);
  assert(positions.probe < positions.gate && positions.gate < positions.commit && positions.commit < positions.exchange);
});

test("P-E ordering descriptors are source-cited, complete and correction-aware", () => {
  assert.equal(PE_BASE, "abcbefa03d5b0afc610deb712d7f4ded5a9e82be");
  assert.equal(PE_COMMENT, "6137619745");
  assert.deepEqual(ORDERING_CASES.map((row) => row.case_id),
    ["P-E-2", "P-E-2b", "P-E-3a", "P-E-3b", "P-E-4", "P-E-4b"]);
  for (const entry of ORDERING_CASES) {
    for (const field of ["case_id", "family", "scenario", "comment_id", "setup", "expected",
      "classification", "basis", "confidence", "predicted_calls", "predicted"]) {
      assert.notEqual(entry[field], undefined, `${entry.case_id} ${field}`);
    }
    assert(entry.basis.length > 0 && entry.basis.every((cite) => cite.includes(":")), entry.case_id);
    assert.equal(entry.family, "ordering");
    assert(entry.basis.some((cite) => cite.includes("delivery-classes.ts")), entry.case_id);
  }
  const corrected = ORDERING_CASES.filter((row) => row.corrected_from !== undefined);
  assert.deepEqual(corrected.map((row) => row.case_id), ["P-E-4"]);
  assert.match(corrected[0].corrected_from.reason, /transactionId/);
  assert.match(corrected[0].corrected_from.reason, /original_event_id/);
});

function rowsFor(state) {
  return state.accounting;
}
