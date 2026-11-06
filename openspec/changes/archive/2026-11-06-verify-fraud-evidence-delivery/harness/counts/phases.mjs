// Earlier probes own the burst and restart mechanics; this adapter supplies chains events to them.
import { emitBurst } from "../load/burst.mjs";
import { runConsumerRestart } from "../copies/consumer-restart.mjs";
import { createConflictingEvent } from "../copies/workload.mjs";
import { phaseCallPlan } from "../copies/call-plan.mjs";

function compositionReport(composition) {
  return {
    deliveries: Object.fromEntries(composition.deliveries), delivery_log: composition.deliveryLog,
    exchanges: composition.exchanges, callbacks: composition.callbacks, trace: composition.trace,
  };
}

async function emitBatches({ engine, sdk, steps, capacity }) {
  const calls = [];
  for (let index = 0; index < steps.length; index += capacity) {
    const batch = steps.slice(index, index + capacity);
    calls.push(...await Promise.all(batch.map((step) => engine.emit(sdk, step))));
  }
  return calls;
}

async function runBurst({ input, engine, factories, steps }) {
  const composition = factories.buildComposition({ gateTimers: input.phase.shutdown === "after_retry_scheduled" });
  composition.releaseRetries = () => composition.gate.open();
  const sdk = factories.buildSdk({ composition });
  let index = 0;
  const phase = { ...input.phase, occurrences: steps.length - input.phase.after_shutdown };
  const outcome = await emitBurst({ composition, phase, call: () => engine.emit(sdk, steps[index++]) });
  return { ...outcome, ...compositionReport(composition) };
}

async function restartCollector(deps) {
  deps.send({ type: "request_ingress_restart" });
  await deps.awaitMessage("ingress_restarted");
}

async function runCopies(options) {
  const originals = new Map();
  const selected = copyInputs(options);
  const plan = phaseCallPlan(options.input.phase);
  const calls = [];
  for (const entry of plan) {
    const result = await copyStep({ options, entry, originals, selected });
    if (result !== undefined) calls.push(result);
  }
  const remaining = options.steps.filter((step) => !selected.includes(step));
  return [...calls, ...await emitBatches({ engine: options.engine, sdk: options.sdk, steps: remaining, capacity: options.input.composition.capacity })];
}

function copyInputs({ input, steps }) {
  if (input.phase.kind === "collector_restart") return steps.slice(0, 2);
  if (input.phase.kind !== "identities") return steps;
  const authentications = steps.filter((step) => step.method === "authenticationSucceeded");
  return [authentications[0], steps.find((step) => step.retry), authentications[1]];
}

async function copyStep({ options, entry, originals, selected }) {
  const { engine, sdk } = options;
  if (entry.step === "ingress_restart") return restartCollector(options.deps);
  const original = originals.get(entry.identity);
  if (entry.step === "duplicate") return copyDelivery({ engine, sdk, original, transform: (event) => event });
  if (entry.step === "conflict") return copyDelivery({ engine, sdk, original, transform: createConflictingEvent });
  if (entry.step === "re_execution") {
    const retry = { retry_attempt: 1, original_event_id: original?.event.id };
    return engine.emit(sdk, { ...selected[1], retry });
  }
  const result = await engine.emit(sdk, selected[entry.identity]);
  if (result.ok) originals.set(entry.identity, options.captured.at(-1));
  return result;
}

function copyDelivery({ engine, sdk, original, transform }) {
  if (!original) return engine.record("redeliver", () => ({ ok: false, error: "original_not_delivered" }));
  return engine.redeliver(sdk, transform(original));
}

function hasCopies(kind) {
  return ["identities", "collector_restart", "duplicates_volume"].includes(kind);
}

async function runStandard(options) {
  const { input, engine, factories, steps } = options;
  const composition = factories.buildComposition({ gateTimers: false });
  const captured = [];
  const sdk = factories.buildSdk({ composition, onCaptured: (event) => captured.push(event) });
  const calls = hasCopies(input.phase.kind)
    ? await runCopies({ ...options, sdk, captured })
    : await emitBatches({ engine, sdk, steps, capacity: input.composition.capacity });
  return { calls, health: await composition.shutdown(), ...compositionReport(composition) };
}

async function runRestart({ input, engine, factories, ledger, steps }) {
  let index = 0;
  return runConsumerRestart({
    input, ledger, identities: steps, sessionKey: null,
    authenticationInput: () => ({ step: steps[index++] }),
    // runConsumerRestart accounts each outer emit. engine.record already counts SDK calls, so the
    // adapter only observes those calls; redeliveries still take the ledger before invoking the SDK.
    recordedCall: ({ invoke }) => invoke(),
    buildComposition: (options) => factories.buildComposition(options),
    buildSdk: ({ composition, onCaptured }) => {
      const sdk = factories.buildSdk({ composition, onCaptured });
      return { authenticationSucceeded: (value) => consumerDispatch({ value, sdk, engine }) };
    },
  });
}

function consumerDispatch({ value, sdk, engine }) {
  if (value.redelivery) return engine.redeliver(sdk, value.redelivery.event);
  return engine.emit(sdk, value.step);
}

export function runPhase(options) {
  if (options.input.phase.kind === "burst") return runBurst(options);
  if (options.input.phase.kind === "consumer_restart") return runRestart(options);
  return runStandard(options);
}
