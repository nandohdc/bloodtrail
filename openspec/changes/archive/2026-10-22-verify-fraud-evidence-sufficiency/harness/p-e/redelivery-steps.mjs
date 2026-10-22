import { action } from "./runtime.mjs";
import { commitGate, delivery } from "./delivery.mjs";
import { businessCounter, caseSummary, freshCase, handleFacts, occurrenceFacts, recordStep } from "./case-steps.mjs";

const ORDER_NAMES = ["commit", "markCommitted", "sinkEmit", "probe", "gate", "exchange"];
export const trueProbe = async () => true;
export const committedGate = async () => "committed";

export function scriptedDelivery(state, { exchange, probe, gate }) {
  const made = delivery(state, { exchange, durabilityProbe: probe });
  return { ...made, gate: commitGate(state, gate) };
}

function deliveryCounters({ target, business, deliveries }) {
  return () => ({
    probe: deliveries.reduce((sum, unit) => sum + unit.probe.counts.calls, 0),
    gate: deliveries.reduce((sum, unit) => sum + unit.gate.counts.calls, 0),
    exchange: deliveries.reduce((sum, unit) => sum + unit.boundary.counts.calls, 0),
    sink: target.counts.calls,
    business_commits: business.commits,
  });
}

// Implementer default: each variant owns its step namespace. Counter totals
// follow bindings added later as well (fresh-instance and value variants).
async function operationSetup(state, entry, scriptsList, { stepPrefix, commits, transition }) {
  const seqStart = state.sequence.length;
  const { input, target } = freshCase(state, entry.case_id);
  const business = businessCounter();
  const deliveries = scriptsList.map((scripts) => scriptedDelivery(state, scripts));
  const counters = deliveryCounters({ target, business, deliveries });
  const handle = state.method(target.sdk, "beginOperation", { boundEvent: "mfaRemoved" }).value;
  if (commits) business.commit(state);
  const stepId = (id) => (stepPrefix === "" ? id : `${stepPrefix}/${id}`);
  await recordStep(state, { id: stepId("mark"), target, counters,
    run: () => state.method(handle, transition), extra: () => ({ handle: handleFacts(handle) }) });
  action(state, transition);
  const emit = await recordStep(state, { id: stepId("emit"), target, counters,
    run: () => state.method(target.sdk, "mfaRemoved", { ...input, operation: handle }),
    extra: () => ({ handle: handleFacts(handle) }) });
  emit.occurrence = occurrenceFacts({ captures: emit.captures, handle });
  return { seqStart, input, target, business, handle, event: emit.captures[0].event, deliveries, counters, stepId };
}

export function truthfulSetup(state, entry, scriptsList, stepPrefix = "") {
  return operationSetup(state, entry, scriptsList, { stepPrefix, commits: true, transition: "markCommitted" });
}

export function notCommittedSetup(state, entry, scriptsList) {
  return operationSetup(state, entry, scriptsList, { stepPrefix: "", commits: false, transition: "markNotCommitted" });
}

export function attemptFacts(attempts) {
  if (attempts.length === 0) return undefined;
  return { count: attempts.length,
    all_attempt_zero: attempts.every((entry) => entry.request_attempt === 0),
    same_event_id: new Set(attempts.map((entry) => entry.event_id)).size === 1,
    identical_body_sha256: new Set(attempts.map((entry) => entry.body_sha256)).size === 1,
    event_id: attempts[0].event_id };
}

export function deliverStep(state, setup, unit) {
  return async (id, transactionId = setup.handle.transactionId) => {
    const before = unit.boundary.attempts.length;
    const sequenceStart = state.sequence.length;
    const record = await recordStep(state, { id: setup.stepId(id), target: setup.target, counters: setup.counters,
      run: () => state.method(unit.binding, "deliver", setup.event, transactionId, unit.gate.invoke) });
    const attempts = unit.boundary.attempts.slice(before);
    record.callback_order = state.sequence.slice(sequenceStart).map((entry) => entry.name);
    record.exchange_attempts = structuredClone(attempts);
    record.exchange_facts = attemptFacts(attempts);
    return record;
  };
}

// One observed event-loop turn AFTER failure, BEFORE caller retries. This is
// a bounded observation, not a claim of persistence or absence of all future
// work. No timer controls transaction ordering (implementer default).
export async function quietStep(state, setup) {
  return recordStep(state, { id: "quiet", target: setup.target, counters: setup.counters,
    run: () => new Promise((resolve) => setImmediate(() => resolve({ kind: "quiet_interval", macrotask_turns: 1 }))) });
}

export function summarize(state, entry, setups, steps) {
  const actual = { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 };
  for (const setup of setups) {
    const next = setup.counters();
    for (const key of Object.keys(actual)) actual[key] += next[key];
  }
  return caseSummary(state, entry, { seqStart: setups[0].seqStart, actual, steps, orderNames: ORDER_NAMES });
}

export function throwingOnce({ label, recovered }) {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls === 1) throw new Error(`synthetic ${label} fault`);
    return recovered;
  };
}
