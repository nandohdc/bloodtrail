// Pure phase execution logic for the Stage 2 chains sender (#840, Q209, Q210).
// Imports no kit packages; receives factories and helpers as arguments.
import { compositionSink, referenceComposition } from "../lib/composition.mjs";
import { gatedTimers, seededJitter, timerGate } from "../lib/clock.mjs";
import { requireControls } from "../lib/controls.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { awaitProcessMessage } from "../copies/sender-phases.mjs";
import { chainsControls } from "./controls.mjs";
import { phaseCallPlan, TRANSACTION_BOUND_METHODS } from "./call-plan.mjs";
import { buildEventInput, generateWorkloadDefinition } from "./workload.mjs";

export { awaitProcessMessage, TRANSACTION_BOUND_METHODS };

export function buildComposition({
  input,
  origin,
  token,
  customSdkNode,
}) {
  const parameters = input.composition;
  const gate = timerGate();
  const composition = referenceComposition({
    sdkNode: customSdkNode,
    origin,
    token,
    parameters,
    timers: gatedTimers({ gate }),
    jitter: seededJitter(parameters.jitter_seed),
    onAttemptScheduled: () => {},
  });
  return { ...composition, gate };
}

export function senderFactories({ sdkNode, senderSdk }) {
  return {
    buildComposition: ({ input, origin, token }) => {
      return buildComposition({
        input,
        origin,
        token,
        customSdkNode: sdkNode,
      });
    },
    buildSdk: ({ input, composition, onCaptured }) => {
      const baseSink = compositionSink({ composition });
      const sink = onCaptured ? { async emit(ev) { onCaptured(ev); return baseSink.emit(ev); } } : baseSink;
      return senderSdk({ sdkNode, input, sink });
    },
  };
}

function assertIpcChannels(options) {
  if (typeof options?.send !== "function") {
    throw new TypeError("send is required for sender phases");
  }
  if (typeof options?.awaitMessage !== "function") {
    throw new TypeError("awaitMessage is required for sender phases");
  }
}

async function executeBoundStep({ step, boundEntries, core, sessionKey, sdk, recordCall, ledger, calls }) {
  if (typeof sdk.beginOperation !== "function") {
    throw new TypeError("sdk.beginOperation must be a function");
  }
  const [beginEntry, commitEntry, emitEntry] = boundEntries;
  const beginResult = await recordCall({
    ledger,
    label: beginEntry.label,
    invoke: () => sdk.beginOperation({ boundEvent: step.method }),
  });
  calls.push(beginResult);
  if (!beginResult.ok) return;

  const handle = beginResult.value;
  const commitResult = await recordCall({
    ledger,
    label: commitEntry.label,
    invoke: () => handle.markCommitted(),
  });
  calls.push(commitResult);
  if (!commitResult.ok) return;

  const eventInput = buildEventInput({
    core,
    method: step.method,
    identity: step.identity,
    at: step.at,
    sessionKey,
  });
  eventInput.operation = handle;
  const emitResult = await recordCall({
    ledger,
    label: emitEntry.label,
    invoke: () => sdk[step.method](eventInput),
  });
  calls.push(emitResult);
}

async function executeNonBoundStep({ step, entry, core, sessionKey, sdk, recordCall, ledger, calls }) {
  const eventInput = buildEventInput({
    core,
    method: step.method,
    identity: step.identity,
    at: step.at,
    sessionKey,
  });
  const result = await recordCall({
    ledger,
    label: entry.label,
    invoke: () => sdk[step.method](eventInput),
  });
  calls.push(result);
}

async function executePhaseSteps({ workload, plan, core, sessionKey, sdk, recordCall, ledger }) {
  const calls = [];
  let planIndex = 0;
  for (let i = 0; i < workload.submissionSteps.length; i += 1) {
    const step = workload.submissionSteps[i];
    if (TRANSACTION_BOUND_METHODS.has(step.method)) {
      const boundEntries = plan.slice(planIndex, planIndex + 3);
      planIndex += 3;
      await executeBoundStep({ step, boundEntries, core, sessionKey, sdk, recordCall, ledger, calls });
    } else {
      const entry = plan[planIndex];
      planIndex += 1;
      await executeNonBoundStep({ step, entry, core, sessionKey, sdk, recordCall, ledger, calls });
    }
  }
  return calls;
}

async function executeStandardPhase(options) {
  const {
    buildComposition: buildComp, buildSdk: buildSdkFn,
    input, origin, token, sessionKey, core,
    recordedCall: recordCall, ledger, controls,
  } = options;

  const composition = buildComp({ input, origin, token });
  const sdk = buildSdkFn({ input, composition });

  const phase = input.phase;
  const offset = phase.seed_offset ?? 0;

  const workload = generateWorkloadDefinition({
    seed: input.workload.seed + offset,
    chainCount: phase.chain_count,
    tenantCount: phase.tenant_count,
    failedCount: phase.failed_count,
    clockStart: input.clock.start,
    clockStepMs: input.clock.step_ms,
    sessionKey,
  });

  const plan = phaseCallPlan(phase, input.workload.seed);
  const calls = await executePhaseSteps({
    workload,
    plan,
    core,
    sessionKey,
    sdk,
    recordCall,
    ledger,
  });

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
  return executeStandardPhase(options);
}

export async function senderRun({ deps, message }) {
  const { expectations: input, origin, token, port } = message;
  const senderControlValues = await deps.senderControls(port);
  const controls = requireControls({
    ...senderControlValues,
    chains_checks: chainsControls(),
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
    core: deps.core,
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
