// Kit-free sender logic, shared by the process shell and session rehearsal.
import assert from "node:assert/strict";
import { gatedTimers, seededJitter, timerGate } from "../lib/clock.mjs";
import { referenceComposition } from "../lib/composition.mjs";
import { requireControls } from "../lib/controls.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { phaseCallPlan } from "./call-plan.mjs";
import { createTransactionBoundSink, openHostDatabase } from "./host.mjs";
import { executeHostWorkload, phaseRecorder } from "./host-execution.mjs";
import { executePhaseRelay } from "./phase-relay.mjs";
import { generateWorkloadDefinition } from "./workload.mjs";
import { hostDbIsolationControl, markBeforeAckControl } from "./controls.mjs";

export function buildComposition({ input, origin, token, customSdkNode }) {
  const parameters = input.composition;
  const gate = timerGate();
  const composition = referenceComposition({
    sdkNode: customSdkNode, origin, token, parameters,
    timers: gatedTimers({ gate }), jitter: seededJitter(parameters.jitter_seed),
  });
  return { ...composition, gate };
}

export function senderFactories({ sdkNode, senderSdk }) {
  return {
    buildComposition: ({ input, origin, token }) => buildComposition({
      input, origin, token, customSdkNode: sdkNode,
    }),
    buildSdk: ({ input, sink }) => senderSdk({ sdkNode, input, sink }),
  };
}

function resolveHostDirectory(input) {
  assert.equal(typeof input.host_database, "string", "host database directory required");
  assert(input.host_database.length > 0, "host database directory required");
  return input.host_database;
}

function hostReport(host, sink, count) {
  const counts = host.counts();
  const expectedRecords = sink.records.length === count;
  const activeDuring = expectedRecords && sink.records.every((r) => r.is_transaction === true);
  return {
    business_count: counts.business_change, outbox_count: counts.audit_outbox,
    relayed_count: counts.relayed_outbox, outbox_rows: host.outboxRows(),
    business_rows: host.businessRows(), sink_records: sink.records,
    transaction_active_during: activeDuring,
    transaction_inactive_after: host.isTransaction === false,
  };
}

export async function runSenderPhases(options) {
  const { input, origin, token, ledger, controls } = options;
  const phase = input.phase;
  const hostDirectory = resolveHostDirectory(input);
  const host = openHostDatabase({ directory: hostDirectory, name: phase.name });
  let finalHost = host;
  const sink = createTransactionBoundSink({ host });
  const composition = options.buildComposition({ input, origin, token });
  try {
    const sdk = options.buildSdk({ input, sink });
    const calls = options.calls;
    const record = phaseRecorder({ ledger, calls, recordedCall: options.recordedCall });
    const workload = generateWorkloadDefinition({
      count: phase.change_count, seed: input.workload.seed,
      clockStart: input.clock.start, clockStepMs: input.clock.step_ms,
    });
    const plan = phaseCallPlan(phase).slice(calls.length);
    const planIndex = await executeHostWorkload({
      workload, host, sdk, plan, record, phase, core: options.core, makeInput: options.makeInput,
    });
    const relay = await executePhaseRelay({
      phase, host, hostDirectory, composition, ledger, record, plan, planIndex,
    });
    finalHost = relay.finalHost;
    const hostObservation = hostReport(finalHost, sink, phase.change_count);
    const relayObservation = { ...relay };
    delete relayObservation.finalHost;
    return {
      controls, calls, health: await composition.shutdown(), host: hostObservation,
      ...relayObservation, relayed_count: finalHost.counts().relayed_outbox,
      ledger: ledger.report(), deliveries: Object.fromEntries(composition.deliveries),
      delivery_log: composition.deliveryLog, exchanges: composition.exchanges,
      callbacks: composition.callbacks,
    };
  } finally {
    finalHost.close();
  }
}

export async function senderRun({ deps, message }) {
  const { expectations: input, origin, token, port } = message;
  const hostDirectory = resolveHostDirectory(input);
  const senderControlValues = await deps.senderControls(port);
  const isolation = deps.hostDbIsolationControl ?? hostDbIsolationControl;
  const control = deps.markBeforeAckControl ?? markBeforeAckControl;
  const factories = senderFactories({ sdkNode: deps.sdkNode, senderSdk: deps.senderSdk });
  const controls = {
    ...senderControlValues,
    host_db_isolation: isolation(hostDirectory),
  };
  const ledger = occurrenceLedger({ budget: input.planned_call_budget.processes.sender });
  const calls = [];
  if (input.phase.kind === "crash_restart") {
    controls.outbox_checks = await control({
      directory: hostDirectory, input, core: deps.core, buildSdk: factories.buildSdk,
      recordedCall: deps.recordedCall, ledger, calls,
    });
  }
  requireControls(controls);
  if (typeof deps.onBeforeRun === "function") deps.onBeforeRun();
  const report = await runSenderPhases({
    ...factories, input: { ...input, host_database: hostDirectory }, origin, token,
    core: deps.core, recordedCall: deps.recordedCall, ledger, calls, controls, makeInput: deps.makeInput,
  });
  return {
    type: "report", resolved: deps.resolved(), ...report,
    guard_violations: deps.guardViolations(),
  };
}
