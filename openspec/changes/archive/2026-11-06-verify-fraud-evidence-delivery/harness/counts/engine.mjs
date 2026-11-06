// The only SDK/delivery engine, shared by sequential, burst, restart and copy paths.
import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { TRANSACTION_BOUND_METHODS } from "../chains/call-plan.mjs";
import { sha256 } from "../lib/io.mjs";
import { inputFor, signature } from "./workload.mjs";

async function prepareOperation({ engine, sdk, step, input }) {
  if (!TRANSACTION_BOUND_METHODS.has(step.method)) return null;
  const begin = await engine.record("beginOperation", () => sdk.beginOperation({ boundEvent: step.method }));
  if (!begin.ok) return begin;
  const commit = await engine.record("markCommitted", () => begin.value.markCommitted());
  if (!commit.ok) return commit;
  input.operation = begin.value;
  return null;
}

function captureEvent({ scope, event, onCaptured }) {
  const emission = scope.getStore();
  if (emission) Object.assign(emission, { event_id: event.event.id, body_sha256: sha256(JSON.stringify(event)) });
  if (onCaptured) onCaptured(event);
}

export function createEngine({ deps, ledger, sessionKey }) {
  const emissions = [];
  const latencies = [];
  const scope = new AsyncLocalStorage();
  const record = (label, invoke) => deps.recordedCall({ ledger, label, invoke });
  const engine = { emissions, latencies, record, deliveryReports: [] };
  engine.capture = (event, onCaptured) => captureEvent({ scope, event, onCaptured });
  engine.emit = (sdk, step) => emitStep({ engine, sdk, step, options: { deps, sessionKey, scope } });
  engine.redeliver = (sdk, event) => redeliver({ engine, sdk, event });
  return engine;
}

async function invokeEmission({ engine, sdk, step, context }) {
  const emission = { signature: signature(step), event_id: null, result: null };
  engine.emissions.push(emission);
  const started = performance.now();
  const result = await context.scope.run(emission, () => engine.record(step.method, () => sdk[step.method](context.input)));
  emission.result = result;
  if (result.ok) engine.latencies.push(performance.now() - started);
  return result;
}

async function emitStep({ engine, sdk, step, options }) {
  const input = inputFor({ core: options.deps.core, step, sessionKey: options.sessionKey });
  if (step.retry) input.retry = step.retry;
  const failure = await prepareOperation({ engine, sdk, step, input });
  if (failure) return failure;
  return invokeEmission({ engine, sdk, step, context: { input, scope: options.scope } });
}

async function redeliver({ engine, sdk, event }) {
  const started = performance.now();
  const result = await engine.record("redeliver", () => sdk.redeliver(event));
  if (result.ok) engine.latencies.push(performance.now() - started);
  return result;
}
