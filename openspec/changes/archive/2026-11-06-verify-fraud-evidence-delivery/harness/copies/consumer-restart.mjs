// Consumer restart mid-burst phase logic for the Stage 2 copies probe (#839, Q130, Q162, Q163).
// Pure module without kit or SDK imports; receives factories and manages the restart sequence.
import { phaseCallPlan } from "./call-plan.mjs";

function collectUnacknowledged({ capturedEvents, deliveries }) {
  const unacknowledged = [];
  for (let i = 0; i < capturedEvents.length; i += 1) {
    const event = capturedEvents[i];
    const status = deliveries.get(event?.event?.id)?.status;
    if (event && status !== "acknowledged") {
      unacknowledged.push({ index: i, event });
    }
  }
  return unacknowledged;
}

function mergeOutputs({ comp1, comp2 }) {
  const mergedDeliveries = new Map(comp1.deliveries);
  for (const [id, delivery] of comp2.deliveries) {
    mergedDeliveries.set(id, delivery);
  }
  const callbacks = {};
  for (const key of Object.keys(comp1.callbacks)) {
    callbacks[key] = [...comp1.callbacks[key], ...comp2.callbacks[key]];
  }
  return {
    deliveries: Object.fromEntries(mergedDeliveries),
    delivery_log: [...comp1.deliveryLog, ...comp2.deliveryLog],
    exchanges: [...comp1.exchanges, ...comp2.exchanges],
    callbacks,
    trace: [...comp1.trace, ...comp2.trace],
  };
}

async function executeRedeliveries({ unacknowledged, redeliverySteps, sdk, record, ledger }) {
  const calls = [];
  for (const { index, event } of unacknowledged) {
    const stepDef = redeliverySteps[index] ?? { label: `consumer_restart_redelivery_${index}` };
    calls.push(
      await record({
        ledger,
        label: stepDef.label,
        invoke: () => sdk.authenticationSucceeded({ redelivery: { event } }),
      }),
    );
  }
  return calls;
}

function launchComp1({ buildComposition, buildSdk, isFenced, onFenced }) {
  let shutdownPromise = null;
  let onFirstRetryScheduled = null;
  const retryScheduledPromise = new Promise((resolve) => {
    onFirstRetryScheduled = resolve;
  });

  let restartTriggered = false;
  let comp1 = null;
  const onAttemptScheduled = () => {
    if (!restartTriggered) {
      restartTriggered = true;
      shutdownPromise = comp1.shutdown();
      onFirstRetryScheduled();
    }
  };

  comp1 = buildComposition({
    gateTimers: true,
    onAttemptScheduled,
    isFenced,
    onFenced,
  });

  const capturedEvents = [];
  const sdk1 = buildSdk({
    composition: comp1,
    onCaptured: (event) => capturedEvents.push(event),
  });

  return {
    comp1,
    sdk1,
    capturedEvents,
    retryScheduledPromise,
    getShutdownPromise: () => shutdownPromise,
    wasRestartTriggered: () => restartTriggered,
  };
}

export async function runConsumerRestart(options) {
  const { buildComposition, buildSdk, ledger, identities, input, sessionKey, recordedCall, authenticationInput } = options;
  const plan = phaseCallPlan(input.phase);
  const initialSteps = plan.filter((step) => step.step !== "redelivery");
  const redeliverySteps = plan.filter((step) => step.step === "redelivery");

  let fenced = false;
  const fencedAttempts = [];
  const comp1State = launchComp1({
    buildComposition,
    buildSdk,
    isFenced: () => fenced,
    onFenced: (item) => fencedAttempts.push(item),
  });

  const initialPromises = initialSteps.map((step) => {
    const eventInput = authenticationInput({ identities: identities[step.identity], at: input.clock.start, sessionKey });
    return recordedCall({ ledger, label: step.label, invoke: () => comp1State.sdk1.authenticationSucceeded(eventInput) });
  });

  await Promise.race([comp1State.retryScheduledPromise, Promise.all(initialPromises)]);
  const shutdownPromise = comp1State.getShutdownPromise() ?? comp1State.comp1.shutdown();
  const beforeRestart = await shutdownPromise;
  const exchangesAtShutdown = comp1State.comp1.exchanges.length;

  fenced = true;
  comp1State.comp1.gate.open();

  const initialResults = await Promise.all(initialPromises);
  const comp1ExchangesTotal = comp1State.comp1.exchanges.length;
  const unacknowledged = collectUnacknowledged({ capturedEvents: comp1State.capturedEvents, deliveries: comp1State.comp1.deliveries });

  const comp2 = buildComposition({ gateTimers: false, onAttemptScheduled: () => {}, isFenced: () => false, onFenced: () => {} });
  const sdk2 = buildSdk({ composition: comp2 });
  const redeliveryCalls = await executeRedeliveries({ unacknowledged, redeliverySteps, sdk: sdk2, record: recordedCall, ledger });
  const afterRestart = await comp2.shutdown();
  const merged = mergeOutputs({ comp1: comp1State.comp1, comp2 });

  return {
    calls: [...initialResults, ...redeliveryCalls],
    health: { before_restart: beforeRestart, after_restart: afterRestart },
    fenced_attempts: fencedAttempts,
    restart_triggered: comp1State.wasRestartTriggered(),
    exchanges_at_shutdown: exchangesAtShutdown,
    comp1_exchanges_count: comp1ExchangesTotal,
    ...merged,
  };
}
