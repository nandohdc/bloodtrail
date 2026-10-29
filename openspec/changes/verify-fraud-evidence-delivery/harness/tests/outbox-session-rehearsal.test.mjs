// In-process session rehearsal gate for the Stage 2 outbox probe (#842, Q243-Q258).
// Tests that rehearsal matches all 11 cases across small and volume passes under deadline.
import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonFile } from "../lib/io.mjs";
import { phaseCallPlan } from "../outbox/call-plan.mjs";
import { evaluateCases } from "../outbox/evaluate.mjs";
import { exchangeUnit } from "../lib/gated-session.mjs";
import { buildEventInput } from "../outbox/workload.mjs";
import { runOutboxRehearsal, testOutboxSenderSdk } from "./outbox-fakes.mjs";

const FROZEN_V1 = jsonFile(new URL("../expectations/outbox.v1.json", import.meta.url));
const SHORTENED_DEADLINE_MS = 25000;

test("outbox in-process session rehearsal passes both passes and matches all 11 cases", { timeout: 60000 }, async () => {
  const sessionResult = await runOutboxRehearsal();

  assert.equal(sessionResult.gate.small_matched, true);
  assert.deepEqual(sessionResult.gate.small_mismatched, []);
  assert.equal(sessionResult.gate.volume_pass, "completed");

  const commitPhase = sessionResult.phases.commit_relay;
  assert.equal(commitPhase.sender.host.business_count, 6);
  assert.equal(commitPhase.sender.host.outbox_count, 6);
  assert.equal(commitPhase.ingress.persisted_bodies.length, 6);

  const rollbackPhase = sessionResult.phases.rollback;
  assert.equal(rollbackPhase.sender.host.business_count, 0);
  assert.equal(rollbackPhase.sender.host.outbox_count, 0);
  assert.equal(rollbackPhase.ingress.persisted_bodies.length, 0);

  const crashPhase = sessionResult.phases.crash_restart;
  assert.equal(crashPhase.sender.host.business_count, 6);
  assert.equal(crashPhase.ingress.persisted_bodies.length, 6);

  const outagePhase = sessionResult.phases.outage_defer;
  assert.equal(outagePhase.sender.host.business_count, 6);
  assert.equal(outagePhase.ingress.persisted_bodies.length, 6);

  const volumePhase = sessionResult.phases.commit_relay_volume;
  assert.equal(volumePhase.sender.host.business_count, 100);
  assert.equal(volumePhase.ingress.persisted_bodies.length, 100);

  const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V1 });
  assert.equal(verdict.verdict.matched, 11, `Expected 11 matched cases, got ${verdict.verdict.matched}`);
  assert.equal(verdict.verdict.mismatched, 0);
  for (const entry of verdict.evaluations) {
    assert.equal(entry.matched, true, `Case ${entry.case_id} failed`);
    console.log(`${entry.case_id}: MATCH`);
  }
});

test("null control: honest rehearsal completes under shortened deadline", { timeout: 45000 }, async () => {
  const shortenedExpectations = { ...FROZEN_V1, deadline_ms: SHORTENED_DEADLINE_MS };
  const sessionResult = await runOutboxRehearsal({ expectations: shortenedExpectations });
  assert.equal(sessionResult.gate.small_matched, true);
  assert.equal(sessionResult.gate.volume_pass, "completed");
});

test("seam defect 1: dropped persisted_bodies fails H-04 and gates volume pass", { timeout: 45000 }, async () => {
  const shortenedExpectations = { ...FROZEN_V1, deadline_ms: SHORTENED_DEADLINE_MS };
  const sessionResult = await runOutboxRehearsal({
    expectations: shortenedExpectations,
    dropPersistedBodies: true,
  });

  assert.equal(sessionResult.gate.small_matched, false);
  assert.equal(sessionResult.gate.volume_pass, "skipped");

  const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V1 });
  const h04 = verdict.evaluations.find((e) => e.case_id === "H-04");
  assert.equal(h04.matched, false, "H-04 must fail when persisted_bodies are dropped");
});

test("seam defect 2: missing host observations fails H-01 and gates volume pass", { timeout: 45000 }, async () => {
  const missingHostExchange = async (opts) => {
    const result = await exchangeUnit(opts);
    if (result.sender?.host) {
      delete result.sender.host;
    }
    return result;
  };

  const shortenedExpectations = { ...FROZEN_V1, deadline_ms: SHORTENED_DEADLINE_MS };
  const sessionResult = await runOutboxRehearsal({
    expectations: shortenedExpectations,
    exchange: missingHostExchange,
  });

  assert.equal(sessionResult.gate.small_matched, false);
  assert.equal(sessionResult.gate.volume_pass, "skipped");

  const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V1 });
  const h01 = verdict.evaluations.find((e) => e.case_id === "H-01");
  assert.equal(h01.matched, false, "H-01 must fail when host observations are missing");
});

const SEAMS = [
  {
    name: "plain-object context", caseId: "H-01",
    options: { senderDeps: {
      makeInput: (args) => JSON.parse(JSON.stringify(buildEventInput(args))),
    } },
  },
  { name: "binding retry absorbs outage", caseId: "H-07", options: { bindingAbsorbsOutage: true } },
  {
    name: "constant H-08", caseId: "H-08",
    options: { senderDeps: {
      markBeforeAckControl: async () => ({
        mark_before_ack_defect_detected: true, null_control_passed: true, holds: true,
      }),
    } },
  },
  {
    name: "empty rollback", caseId: "H-02",
    options: { senderDeps: {
      senderSdk: ({ input, sdkNode, sink }) => {
        const effectiveSink = input.phase.kind === "rollback"
          ? { emit: async () => ({ status: "accepted" }) } : sink;
        return testOutboxSenderSdk({ input, sdkNode, sink: effectiveSink });
      },
    } },
  },
];
for (const seam of SEAMS) {
  test(`seam: ${seam.name} mismatches with the honest null-control deadline`, { timeout: 45000 }, async () => {
    const result = await runOutboxRehearsal({
      expectations: { ...FROZEN_V1, deadline_ms: SHORTENED_DEADLINE_MS }, ...seam.options,
    });
    const verdict = evaluateCases({ observations: result, expectations: FROZEN_V1 });
    assert.equal(verdict.evaluations.find((e) => e.case_id === seam.caseId).matched, false);
    assert.equal(result.gate.volume_pass, "skipped");
  });
}

function assertHostOrder(sender, phase) {
  const transactionOps = new Set(["begin", "business_insert", "outbox_insert", "commit", "rollback"]);
  const trace = sender.transaction_order.filter((entry) => transactionOps.has(entry.op));
  const terminal = phase.kind === "rollback" ? "rollback" : "commit";
  const expected = ["begin", "business_insert", "outbox_insert", terminal];
  for (let offset = 0; offset < trace.length; offset += expected.length) {
    assert.deepEqual(trace.slice(offset, offset + expected.length).map((entry) => entry.op), expected);
  }
  assert.equal(trace.length, phase.change_count * expected.length);
}

test("producer reports actual calls, transactional inserts, control deliveries and restart evidence", async () => {
  const result = await runOutboxRehearsal();
  for (const phase of FROZEN_V1.phases) {
    const { sender } = result.phases[phase.name];
    assert.equal(sender.calls.length, FROZEN_V1.planned_call_budget.processes[phase.name]);
    assert.equal(sender.calls.length, sender.ledger.occurrence_count);
    assertHostOrder(sender, phase);
    assert.equal(sender.host.sink_records.length, phase.change_count);
    for (const row of sender.host.sink_records) {
      assert.equal(row.inserted_is_transaction, true);
      assert.equal(row.counts_after_insert.business_change, row.counts_after_insert.audit_outbox);
    }
  }
  const control = result.phases.crash_restart.sender.controls.outbox_checks;
  assert.equal(control.planted.ingress.persisted_bodies.length, 5);
  assert.equal(control.null_control.ingress.persisted_bodies.length, 6);
  assert.equal(result.phases.outage_defer.sender.pending_outbox, 6);
  assert.equal(result.phases.outage_defer.sender.pending_after_recovery, 0);
  assert.equal(result.phases.outage_defer.sender.relayed_count, 6);
  assert.equal(result.phases.crash_restart.sender.crash_fired, true);
  assert.equal(result.phases.crash_restart.sender.pending_after_resume, 0);
});

function measureCall(invoke, calls) {
  return (...args) => {
    calls.count += 1;
    return invoke(...args);
  };
}

function measuredSdk(args, calls) {
  const sdk = testOutboxSenderSdk(args);
  const begin = measureCall(sdk.beginOperation, calls);
  sdk.beginOperation = (options) => {
    const result = begin(options);
    const handle = result.value;
    handle.markCommitted = measureCall(handle.markCommitted.bind(handle), calls);
    return result;
  };
  for (const method of ["roleAssigned", "sensitiveResourceModified"]) {
    sdk[method] = measureCall(sdk[method], calls);
  }
  return sdk;
}

test("run ledger equals every sender SDK call including both crash controls", async () => {
  const sdkCalls = { count: 0 };
  const clock = { start: "2026-10-24T00:00:00.000Z", step_ms: 1300 };
  const result = await runOutboxRehearsal({
    expectations: { ...FROZEN_V1, clock },
    senderDeps: { senderSdk: (args) => measuredSdk(args, sdkCalls) },
  });
  let recordedSdkCalls = 0;
  let totalLedger = 0;
  let compositionCalls = 0;
  for (const phase of FROZEN_V1.phases) {
    const sender = result.phases[phase.name].sender;
    const plan = phaseCallPlan(phase);
    const sdkLabels = new Set(plan.filter((step) => SDK_STEPS.has(step.step)).map((step) => step.label));
    recordedSdkCalls += sender.calls.filter((call) => sdkLabels.has(call.label)).length;
    totalLedger += sender.ledger.occurrence_count;
    compositionCalls += sender.delivery_log.length;
    assert.deepEqual(sender.calls.map((call) => call.label), sender.ledger.calls.map((call) => call.label));
    assert.deepEqual(sender.calls.map((call) => call.label), plan.map((step) => step.label));
    assert.equal(new Set(sender.calls.map((call) => call.label)).size, plan.length);
    assert.equal(Object.hasOwn(sender.controls, "outbox_checks"), phase.kind === "crash_restart");
  }
  assert.equal(sdkCalls.count, 402);
  assert.equal(recordedSdkCalls, sdkCalls.count);
  const checks = result.phases.crash_restart.sender.controls.outbox_checks;
  assert.equal(checks.planted.ingress.persisted_bodies[0].event.timestamp, clock.start);
  assert.equal(checks.null_control.ingress.persisted_bodies[1].event.timestamp, "2026-10-24T00:00:01.300Z");
  compositionCalls += checks.planted.ingress.delivery_count + checks.null_control.ingress.delivery_count;
  assert.equal(compositionCalls, 137);
  assert.equal(totalLedger, sdkCalls.count + compositionCalls);
  assert.equal(totalLedger, FROZEN_V1.planned_call_budget.total);
  assert.equal(result.occurrence_count, totalLedger);
});

const SDK_STEPS = new Set(["begin_operation", "mark_committed", "emit"]);

test("SDK refusal rolls back each change before any business commit", async () => {
  const result = await runOutboxRehearsal({
    senderDeps: { makeInput: (args) => JSON.parse(JSON.stringify(buildEventInput(args))) },
  });
  const sender = result.phases.commit_relay.sender;
  assert.equal(sender.host.business_count, 0);
  assert.equal(sender.host.outbox_count, 0);
  const refusals = sender.calls.filter((call) => call.ok === false);
  assert.equal(refusals.length, FROZEN_V1.phases[0].change_count);
  for (const refusal of refusals) {
    assert.equal(refusal.error.code, "AUTHORITY_ESCALATION");
    assert.equal(refusal.error.path, "/actor");
  }
  assert.equal(sender.transaction_order.some((entry) => entry.op === "commit"), false);
});
