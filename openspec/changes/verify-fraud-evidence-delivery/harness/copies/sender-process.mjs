// Sender role for the Stage 2 copies probe (#839).
// Exercises byte-identity, attempt-ordinal exclusion, duplicates without readmission,
// conflict rejection, re-executions, collector restart, consumer restart mid-burst,
// and the storage-less deduplication capacity bound.
import { roleGuard as guard } from "../lib/role-guard.mjs";
import { randomBytes } from "node:crypto";
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
import { compositionSink, referenceComposition } from "../lib/composition.mjs";
import { gatedTimers, seededJitter, timerGate } from "../lib/clock.mjs";
import { requireControls, senderControls } from "../lib/controls.mjs";
import { copiesControls } from "./controls.mjs";
import { copiesIdentities, authenticationInput, createConflictingEvent } from "./workload.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { haltOnViolations, kitResolutions, recordedCall, senderSdk, serveSender } from "../lib/sender-role.mjs";

const mode = haltOnViolations();

function awaitParentMessage(type) {
  return new Promise((resolve) => {
    const handler = (message) => {
      if (message.type === type) {
        process.off("message", handler);
        resolve(message);
      }
    };
    process.on("message", handler);
  });
}

function buildComposition({ input, origin, token, onAttemptScheduled = () => {} }) {
  const parameters = input.composition;
  const gate = timerGate();
  if (input.phase.gate_timers) gate.close();
  const composition = referenceComposition({
    sdkNode,
    origin,
    token,
    parameters,
    timers: gatedTimers({ gate }),
    jitter: seededJitter(parameters.jitter_seed),
    onAttemptScheduled,
  });
  return { ...composition, releaseTimers: () => gate.open(), gate };
}

async function runIdentitiesPhase({ sdk, composition, ledger, input, sessionKey }) {
  const identitiesList = copiesIdentities({ seed: input.workload.seed, count: 5 });
  const calls = [];
  let capturedEvent = null;

  // 1. First occurrence (Occ 0)
  const input0 = authenticationInput({ core, identities: identitiesList[0], at: input.clock.start, sessionKey });
  calls.push(await recordedCall({ ledger, label: "clean_submission", invoke: () => sdk.authenticationSucceeded(input0) }));
  const event0 = capturedEvent;

  // 2. Duplicate copy of Occ 0 (identical payload and event ID)
  calls.push(await recordedCall({
    ledger,
    label: "duplicate_submission",
    invoke: async () => {
      const settled = await composition.deliver(event0);
      return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
    },
  }));

  // 3. Conflict of Occ 0 (same event ID, modified payload)
  const conflicting0 = createConflictingEvent(event0);
  calls.push(await recordedCall({
    ledger,
    label: "conflict_submission",
    invoke: async () => {
      const settled = await composition.deliver(conflicting0);
      return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
    },
  }));

  // 4. Re-execution (Occ 1, distinct event ID)
  const input1 = authenticationInput({ core, identities: identitiesList[1], at: input.clock.start, sessionKey });
  calls.push(await recordedCall({ ledger, label: "re_execution_submission", invoke: () => sdk.authenticationSucceeded(input1) }));

  // 5. Redelivery retry (Occ 2, attempt 0 503, attempt 1 202)
  const input2 = authenticationInput({ core, identities: identitiesList[2], at: input.clock.start, sessionKey });
  calls.push(await recordedCall({ ledger, label: "retry_redelivery_submission", invoke: () => sdk.authenticationSucceeded(input2) }));

  return { calls, health: await composition.shutdown() };
}

async function runCollectorRestartPhase({ sdk, composition, ledger, input, sessionKey }) {
  const identitiesList = copiesIdentities({ seed: input.workload.seed + 100, count: 3 });
  const calls = [];
  let capturedEvent = null;

  // 1. Occurrence before restart
  const input0 = authenticationInput({ core, identities: identitiesList[0], at: input.clock.start, sessionKey });
  calls.push(await recordedCall({ ledger, label: "before_restart_submission", invoke: () => sdk.authenticationSucceeded(input0) }));
  const event0 = capturedEvent;

  // 2. Request collector restart
  process.send({ type: "request_ingress_restart" });
  await awaitParentMessage("ingress_restarted");

  // 3. Duplicate submission of occurrence 0 across restart
  calls.push(await recordedCall({
    ledger,
    label: "duplicate_across_restart_submission",
    invoke: async () => {
      const settled = await composition.deliver(event0);
      return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
    },
  }));

  // 4. Fresh occurrence after restart
  const input1 = authenticationInput({ core, identities: identitiesList[1], at: input.clock.start, sessionKey });
  calls.push(await recordedCall({ ledger, label: "fresh_after_restart_submission", invoke: () => sdk.authenticationSucceeded(input1) }));

  return { calls, health: await composition.shutdown() };
}

async function runConsumerRestartPhase({ sdk, composition, ledger, input, sessionKey, triggerRestart }) {
  const identitiesList = copiesIdentities({ seed: input.workload.seed + 200, count: input.phase.occurrences });
  let restartInitiated = false;

  triggerRestart.fn = async () => {
    if (restartInitiated) return;
    restartInitiated = true;
    const shutdownPromise = composition.shutdown();
    composition.releaseTimers();
    await shutdownPromise;
  };

  const calls = [];
  for (let i = 0; i < input.phase.occurrences; i += 1) {
    const inputI = authenticationInput({ core, identities: identitiesList[i], at: input.clock.start, sessionKey });
    calls.push(recordedCall({ ledger, label: `consumer_restart_call_${i}`, invoke: () => sdk.authenticationSucceeded(inputI) }));
  }

  const results = await Promise.all(calls);
  if (!restartInitiated) {
    composition.releaseTimers();
    await composition.shutdown();
  }
  return { calls: results, restart_triggered: restartInitiated };
}

async function runStorageLessPhase({ sdk, ledger, input, sessionKey }) {
  const count = input.phase.occurrences; // 33 occurrences: 32 within bound, 1 at capacity
  const identitiesList = copiesIdentities({ seed: input.workload.seed + 300, count });
  const calls = [];

  for (let i = 0; i < count; i += 1) {
    const inputI = authenticationInput({ core, identities: identitiesList[i], at: input.clock.start, sessionKey });
    calls.push(await recordedCall({ ledger, label: `storage_less_call_${i}`, invoke: () => sdk.authenticationSucceeded(inputI) }));
  }

  return { calls };
}

async function runVolumeDuplicatesPhase({ sdk, composition, ledger, input, sessionKey }) {
  const count = input.phase.occurrences; // 50 occurrences
  const identitiesList = copiesIdentities({ seed: input.workload.seed + 400, count });
  const events = [];
  let capturedEvent = null;

  // First delivery of all 50 occurrences
  const initialCalls = [];
  for (let i = 0; i < count; i += 1) {
    const inputI = authenticationInput({ core, identities: identitiesList[i], at: input.clock.start, sessionKey });
    initialCalls.push(await recordedCall({ ledger, label: `vol_first_${i}`, invoke: () => sdk.authenticationSucceeded(inputI) }));
    events.push(capturedEvent);
  }

  // Second delivery (duplicate copy) of all 50 occurrences
  const duplicateCalls = [];
  for (let i = 0; i < count; i += 1) {
    const eventI = events[i];
    duplicateCalls.push(await recordedCall({
      ledger,
      label: `vol_duplicate_${i}`,
      invoke: async () => {
        const settled = await composition.deliver(eventI);
        return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
      },
    }));
  }

  return { calls: [...initialCalls, ...duplicateCalls], health: await composition.shutdown() };
}

async function run({ expectations: input, origin, token, port }) {
  const controls = requireControls({
    ...await senderControls({ guard, port }),
    copies_checks: copiesControls(),
  });
  mode.halt = true;

  const triggerRestart = { fn: null };
  const onAttemptScheduled = (...args) => {
    if (triggerRestart.fn) triggerRestart.fn(...args);
  };

  const composition = buildComposition({ input, origin, token, onAttemptScheduled });
  let captured = null;
  const baseSink = compositionSink({ composition });
  const sink = {
    async emit(event) {
      captured = event;
      return baseSink.emit(event);
    },
  };

  const sdk = senderSdk({ sdkNode, input, sink });
  const ledger = occurrenceLedger({ budget: input.planned_call_budget.processes.sender });
  const sessionKey = randomBytes(32);

  let outcome;
  const kind = input.phase.kind;

  if (kind === "identities") {
    // Monkey patch captured reference
    const originalIdentitiesRun = runIdentitiesPhase;
    outcome = await (async () => {
      const identitiesList = copiesIdentities({ seed: input.workload.seed, count: 5 });
      const calls = [];

      const input0 = authenticationInput({ core, identities: identitiesList[0], at: input.clock.start, sessionKey });
      calls.push(await recordedCall({ ledger, label: "clean_submission", invoke: () => sdk.authenticationSucceeded(input0) }));
      const event0 = captured;

      calls.push(await recordedCall({
        ledger,
        label: "duplicate_submission",
        invoke: async () => {
          const settled = await composition.deliver(event0);
          return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
        },
      }));

      const conflicting0 = createConflictingEvent(event0);
      calls.push(await recordedCall({
        ledger,
        label: "conflict_submission",
        invoke: async () => {
          const settled = await composition.deliver(conflicting0);
          return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
        },
      }));

      const input1 = authenticationInput({ core, identities: identitiesList[1], at: input.clock.start, sessionKey });
      calls.push(await recordedCall({ ledger, label: "re_execution_submission", invoke: () => sdk.authenticationSucceeded(input1) }));

      const input2 = authenticationInput({ core, identities: identitiesList[2], at: input.clock.start, sessionKey });
      calls.push(await recordedCall({ ledger, label: "retry_redelivery_submission", invoke: () => sdk.authenticationSucceeded(input2) }));

      return { calls, health: await composition.shutdown() };
    })();
  } else if (kind === "collector_restart") {
    outcome = await (async () => {
      const identitiesList = copiesIdentities({ seed: input.workload.seed + 100, count: 3 });
      const calls = [];

      const input0 = authenticationInput({ core, identities: identitiesList[0], at: input.clock.start, sessionKey });
      calls.push(await recordedCall({ ledger, label: "before_restart_submission", invoke: () => sdk.authenticationSucceeded(input0) }));
      const event0 = captured;

      process.send({ type: "request_ingress_restart" });
      await awaitParentMessage("ingress_restarted");

      calls.push(await recordedCall({
        ledger,
        label: "duplicate_across_restart_submission",
        invoke: async () => {
          const settled = await composition.deliver(event0);
          return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
        },
      }));

      const input1 = authenticationInput({ core, identities: identitiesList[1], at: input.clock.start, sessionKey });
      calls.push(await recordedCall({ ledger, label: "fresh_after_restart_submission", invoke: () => sdk.authenticationSucceeded(input1) }));

      return { calls, health: await composition.shutdown() };
    })();
  } else if (kind === "consumer_restart") {
    outcome = await runConsumerRestartPhase({ sdk, composition, ledger, input, sessionKey, triggerRestart });
  } else if (kind === "storage_less") {
    outcome = await runStorageLessPhase({ sdk, ledger, input, sessionKey });
  } else if (kind === "duplicates_volume") {
    outcome = await (async () => {
      const count = input.phase.occurrences;
      const identitiesList = copiesIdentities({ seed: input.workload.seed + 400, count });
      const events = [];

      const initialCalls = [];
      for (let i = 0; i < count; i += 1) {
        const inputI = authenticationInput({ core, identities: identitiesList[i], at: input.clock.start, sessionKey });
        initialCalls.push(await recordedCall({ ledger, label: `vol_first_${i}`, invoke: () => sdk.authenticationSucceeded(inputI) }));
        events.push(captured);
      }

      const duplicateCalls = [];
      for (let i = 0; i < count; i += 1) {
        const eventI = events[i];
        duplicateCalls.push(await recordedCall({
          ledger,
          label: `vol_duplicate_${i}`,
          invoke: async () => {
            const settled = await composition.deliver(eventI);
            return settled.status === "acknowledged" ? { ok: true, value: { status: "accepted" } } : { ok: false, error: settled.status };
          },
        }));
      }

      return { calls: [...initialCalls, ...duplicateCalls], health: await composition.shutdown() };
    })();
  } else {
    throw new Error(`unknown phase kind: ${kind}`);
  }

  return {
    type: "report",
    resolved: kitResolutions((specifier) => import.meta.resolve(specifier)),
    controls,
    ...outcome,
    ledger: ledger.report(),
    deliveries: Object.fromEntries(composition.deliveries),
    delivery_log: composition.deliveryLog,
    exchanges: composition.exchanges,
    callbacks: composition.callbacks,
    trace: composition.trace ?? [],
    guard_violations: guard.violations,
  };
}

serveSender(run);
