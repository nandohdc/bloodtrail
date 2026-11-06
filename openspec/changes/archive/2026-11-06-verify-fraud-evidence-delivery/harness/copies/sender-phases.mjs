// Pure phase execution logic for the Stage 2 copies sender (#839, Q142, Q155, Q167, Q168, Q170, Q175).
// Imports no kit packages; receives factories and helpers as arguments.
import { compositionSink, referenceComposition } from "../lib/composition.mjs";
import { gatedTimers, seededJitter, timerGate } from "../lib/clock.mjs";
import { requireControls } from "../lib/controls.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { phaseCallPlan } from "./call-plan.mjs";
import { copiesControls } from "./controls.mjs";
import { runConsumerRestart } from "./consumer-restart.mjs";
import { authenticationInput as defaultAuthInput, copiesIdentities, createConflictingEvent } from "./workload.mjs";

export function seedOffsetForKind(kind) {
  if (kind === "collector_restart") return 100;
  if (kind === "consumer_restart") return 200;
  if (kind === "storage_less") return 300;
  if (kind === "duplicates_volume") return 400;
  return 0;
}

export function buildComposition({
  input,
  origin,
  token,
  gateTimers = false,
  onAttemptScheduled = () => {},
  customSdkNode,
}) {
  const parameters = input.composition;
  const gate = timerGate();
  if (gateTimers) gate.close();
  const composition = referenceComposition({
    sdkNode: customSdkNode,
    origin,
    token,
    parameters,
    timers: gatedTimers({ gate }),
    jitter: seededJitter(parameters.jitter_seed),
    onAttemptScheduled,
  });
  return { ...composition, gate };
}

export function makeFencedSdkNode(nodeBase, isFenced, onFenced) {
  return {
    ...nodeBase,
    createHttpDeliveryHandoff(options) {
      const realHandoff = nodeBase.createHttpDeliveryHandoff(options);
      return {
        async handoff(event, attempt = 0) {
          if (isFenced()) {
            onFenced({ event_id: event.event.id, attempt });
            return {
              status: "non_retryable",
              code: "http_permanent",
              event_id: event.event.id,
              attempt,
            };
          }
          return realHandoff.handoff(event, attempt);
        },
      };
    },
  };
}

export function senderFactories({ sdkNode, senderSdk }) {
  return {
    buildComposition: ({
      input,
      origin,
      token,
      gateTimers = false,
      onAttemptScheduled = () => {},
      isFenced,
      onFenced = () => {},
    }) => {
      const fencedSdk = isFenced ? makeFencedSdkNode(sdkNode, isFenced, onFenced) : sdkNode;
      return buildComposition({
        input,
        origin,
        token,
        gateTimers,
        onAttemptScheduled,
        customSdkNode: fencedSdk,
      });
    },
    buildSdk: ({ input, composition, onCaptured }) => {
      const baseSink = compositionSink({ composition });
      const sink = onCaptured ? { async emit(ev) { onCaptured(ev); return baseSink.emit(ev); } } : baseSink;
      return senderSdk({ sdkNode, input, sink });
    },
  };
}

export async function submitDuplicate({ composition, ledger, label, event, recordedCall }) {
  return recordedCall({
    ledger,
    label,
    invoke: async () => {
      const settled = await composition.deliver(event);
      return settled.status === "acknowledged"
        ? { ok: true, value: { status: "accepted" } }
        : { ok: false, error: settled.status };
    },
  });
}

async function submitStoredCopy({ step, context, transform }) {
  const { composition, ledger, eventsByIdentity, recordedCall } = context;
  const event = eventsByIdentity.get(step.identity);
  if (!event) {
    return recordedCall({ ledger, label: step.label, invoke: () => ({ ok: false, error: "original_not_delivered" }) });
  }
  return submitDuplicate({ composition, ledger, label: step.label, event: transform(event), recordedCall });
}

async function dispatchPlanStep({ step, context }) {
  const {
    ledger, eventsByIdentity, identitiesList, sdk, input, sessionKey,
    getCaptured, clearCaptured, authenticationInput, recordedCall,
  } = context;
  if (step.step === "duplicate") {
    return submitStoredCopy({ step, context, transform: (event) => event });
  }
  if (step.step === "conflict") {
    return submitStoredCopy({ step, context, transform: createConflictingEvent });
  }
  if (step.step === "re_execution") {
    const originalEvent = eventsByIdentity.get(step.identity);
    const eventInput = authenticationInput({ identities: identitiesList[step.identity], at: input.clock.start, sessionKey });
    eventInput.retry = { retry_attempt: 1, original_event_id: originalEvent?.event?.id };
    return recordedCall({ ledger, label: step.label, invoke: () => sdk.authenticationSucceeded(eventInput) });
  }
  clearCaptured();
  const eventInput = authenticationInput({ identities: identitiesList[step.identity], at: input.clock.start, sessionKey });
  const result = await recordedCall({ ledger, label: step.label, invoke: () => sdk.authenticationSucceeded(eventInput) });
  const capturedEvent = getCaptured();
  if (result.ok && capturedEvent) {
    eventsByIdentity.set(step.identity, capturedEvent);
  }
  return result;
}

function assertIpcChannels(options) {
  if (typeof options?.send !== "function") {
    throw new TypeError("send is required for sender phases");
  }
  if (typeof options?.awaitMessage !== "function") {
    throw new TypeError("awaitMessage is required for sender phases");
  }
}

async function runConsumerRestartPhase(options) {
  assertIpcChannels(options);
  const {
    buildComposition: buildComp, buildSdk: buildSdkFn, input, origin, token, sessionKey,
    recordedCall: recordCall, authenticationInput: authInput, ledger, controls,
  } = options;
  const kind = input.phase.kind;
  const outcome = await runConsumerRestart({
    buildComposition: ({ gateTimers, onAttemptScheduled, isFenced, onFenced }) => {
      return buildComp({ input, origin, token, gateTimers, onAttemptScheduled, isFenced, onFenced });
    },
    buildSdk: ({ composition, onCaptured }) => {
      return buildSdkFn({ input, composition, onCaptured });
    },
    ledger,
    identities: copiesIdentities({ seed: input.workload.seed + seedOffsetForKind(kind), count: input.phase.occurrences }),
    input,
    sessionKey,
    recordedCall: recordCall,
    authenticationInput: authInput,
  });
  return {
    controls,
    ...outcome,
    ledger: ledger.report(),
  };
}

function isHigherIdentity(step, max) {
  return step.identity !== undefined && step.identity > max;
}

function updateMaxIdentity(max, step) {
  return isHigherIdentity(step, max) ? step.identity : max;
}

async function executeStandardPhase(options) {
  assertIpcChannels(options);
  const {
    buildComposition: buildComp, buildSdk: buildSdkFn, send, awaitMessage,
    input, origin, token, sessionKey, authenticationInput: authInput,
    recordedCall: recordCall, ledger, controls,
  } = options;
  const kind = input.phase.kind;
  const composition = buildComp({ input, origin, token, gateTimers: false });
  let captured = null;
  const sdk = buildSdkFn({ input, composition, onCaptured: (event) => { captured = event; } });
  const getCaptured = () => captured;
  const clearCaptured = () => { captured = null; };
  const offset = seedOffsetForKind(kind);
  const plan = phaseCallPlan(input.phase);
  const maxIdentity = plan.reduce(updateMaxIdentity, -1);
  const identitiesCount = maxIdentity + 1;
  const identitiesList = copiesIdentities({ seed: input.workload.seed + offset, count: identitiesCount });
  const eventsByIdentity = new Map();
  const calls = [];
  const context = {
    composition, ledger, eventsByIdentity, identitiesList, sdk, input, sessionKey,
    getCaptured, clearCaptured, send, awaitMessage, authenticationInput: authInput, recordedCall: recordCall,
  };

  for (const step of plan) {
    if (step.step === "ingress_restart") {
      send({ type: "request_ingress_restart" });
      await awaitMessage("ingress_restarted");
      continue;
    }
    calls.push(await dispatchPlanStep({ step, context }));
  }

  const outcome = { calls, health: await composition.shutdown() };
  return {
    controls,
    ...outcome,
    ledger: ledger.report(),
    deliveries: Object.fromEntries(composition.deliveries),
    delivery_log: composition.deliveryLog,
    exchanges: composition.exchanges,
    callbacks: composition.callbacks,
    trace: composition.trace ?? [],
  };
}

export async function runSenderPhases(options) {
  assertIpcChannels(options);
  if (options.input.phase.kind === "consumer_restart") {
    return runConsumerRestartPhase(options);
  }
  return executeStandardPhase(options);
}

export function awaitProcessMessage(proc, type) {
  return new Promise((resolve) => {
    const handler = (message) => {
      if (message.type === type) {
        proc.off("message", handler);
        resolve(message);
      }
    };
    proc.on("message", handler);
  });
}

export async function senderRun({ deps, message }) {
  const { expectations: input, origin, token, port } = message;
  const senderControlValues = await deps.senderControls(port);
  const controls = requireControls({
    ...senderControlValues,
    copies_checks: copiesControls(),
  });
  if (typeof deps.onBeforeRun !== "function") {
    throw new TypeError("deps.onBeforeRun must be a function");
  }
  deps.onBeforeRun();

  const ledger = occurrenceLedger({ budget: input.planned_call_budget.processes.sender });
  const sessionKey = deps.randomBytes(32);
  const factories = senderFactories({ sdkNode: deps.sdkNode, senderSdk: deps.senderSdk });

  const report = await runSenderPhases({
    buildComposition: factories.buildComposition,
    buildSdk: factories.buildSdk,
    send: deps.send,
    awaitMessage: deps.awaitMessage,
    input,
    origin,
    token,
    sessionKey,
    authenticationInput: (opts) => defaultAuthInput({ core: deps.core, ...opts, sessionKey }),
    recordedCall: deps.recordedCall,
    ledger,
    controls,
  });

  return {
    type: "report",
    resolved: deps.resolved(),
    ...report,
    guard_violations: deps.guardViolations(),
  };
}
