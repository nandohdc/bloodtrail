// Injected public API only. Reuse P-E's package-free counted observer rather
// than duplicating its call ordering, sticky-budget and public-return handling.
// The eventual tracked import inventory must include these two P-E modules.
import { instance as observedInstance, step as observedStep } from "../p-e/runtime.mjs";
import { frozenSnapshot } from "./snapshot.mjs";

export { callback, createState, observations } from "../p-e/runtime.mjs";

// G-log implementer default: Node factory. Sink construction, factory calls,
// direct methods/constructors and sink/provider callbacks all count BEFORE
// invocation through lib/counted, lib/ledger and lib/observe (transitively).
export function instance(state, extra = {}) {
  return observedInstance(state, {
    producer: { name: "p-map-synthetic-producer", version: "0.0.0" },
    service: { name: "p-map-synthetic-service", version: "0.0.0" },
    ...extra,
  });
}

export function requireDependency(value, name) {
  if (value === undefined || value === null) throw new Error(`missing ${name} dependency`);
  return value;
}

export async function step(state, options) {
  const record = await observedStep(state, options);
  // frozen is the observed original, NOT an inference from our frozen clone.
  record.captures = frozenSnapshot(record.captures);
  record.sink_count = record.captures.length;
  return record;
}

export function named(state, { target, method, input, id = "emit", refusalExpected = false }) {
  requireDependency(target, "target");
  requireDependency(target.sdk, "target.sdk");
  requireDependency(input, "named input");
  return step(state, { id, target, refusalExpected,
    run: () => state.method(target.sdk, method, input) });
}
