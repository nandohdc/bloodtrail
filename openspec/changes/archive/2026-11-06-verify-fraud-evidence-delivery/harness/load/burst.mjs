// A concurrent burst over the public composition; no SDK package is imported here.
import { performance } from "node:perf_hooks";

// Waits, one event-loop turn at a time, until every burst occurrence has met the admission gate, or until
// every call has settled: a call that ends before the gate (refused by the SDK, or rejected by the
// lifecycle) never meets it, and the run must then report what happened rather than spin to its deadline.
async function gateDecisions({ composition, count, settled }) {
  const decided = () => composition.callbacks.admitted.length + composition.callbacks.rejected_overload.length;
  const expected = () => {
    const settledAtSink = [...composition.deliveries.values()].filter((delivery) => delivery.status !== "pending").length;
    // Calls that settled without a sink result were refused before emission. They remain in the frozen
    // denominator, but cannot meet the gate; waiting for them would strand held admitted operations.
    return count - Math.max(0, settled.count - settledAtSink);
  };
  while (decided() < expected() && settled.count < count) await new Promise((resolveTurn) => { setImmediate(resolveTurn); });
}

// Each call's outcome is observed as it is made, so a rejection is never unhandled while the burst waits;
// it surfaces where the calls are awaited, and fails the phase through the role's error path.
function submit({ call, settled }) {
  const promise = call();
  promise.then(() => { settled.count += 1; }, () => { settled.count += 1; });
  return promise;
}

export async function emitBurst({ composition, phase, call }) {
  const settled = { count: 0 };
  const calls = Array.from({ length: phase.occurrences }, () => submit({ call, settled }));
  await gateDecisions({ composition, count: phase.occurrences, settled });
  if (phase.shutdown === "after_retry_scheduled") {
    const pending = () => [...composition.deliveries.values()].filter((delivery) => delivery.status === "pending").length;
    while (composition.callbacks.scheduled.length < pending() && settled.count < phase.occurrences) await new Promise((resolveTurn) => setImmediate(resolveTurn));
  }
  if (phase.shutdown === "after_settle") await Promise.all(calls);
  const started = performance.now();
  const report = composition.shutdown();
  const later = Array.from({ length: phase.after_shutdown }, () => submit({ call, settled }));
  const shutdownReport = await report;
  const elapsed = performance.now() - started;
  composition.releaseRetries();
  return { calls: await Promise.all([...calls, ...later]), shutdown_report: shutdownReport, shutdown_elapsed_ms: elapsed, shutdown_primitive_elapsed_ms: composition.shutdownTiming.primitive_elapsed_ms };
}
