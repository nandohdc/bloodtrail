import { action, instance, step } from "./runtime.mjs";
import { mfaInput } from "./inputs.mjs";

// Shared P-E case-step plumbing. Records stay plain data: public snapshots,
// frozen sink captures, handle state, per-step counters and occurrence facts
// expressed as computed booleans, never frozen runtime ids or timestamps.

// Host-side business commit: a counted harness action, never a public SDK
// call. Ordering cases measure its monotonic seq position against the probe,
// the gate and the exchange (performance.now()-based at_ms, never
// event.timestamp).
export function businessCounter() {
  const counter = { commits: 0 };
  return {
    get commits() { return counter.commits; },
    commit(state) {
      counter.commits += 1;
      action(state, "commit");
    },
  };
}

export function counterSnapshot({ target, probe, gate, boundary, business }) {
  return () => ({
    probe: probe === undefined ? 0 : probe.counts.calls,
    gate: gate === undefined ? 0 : gate.counts.calls,
    exchange: boundary === undefined ? 0 : boundary.counts.calls,
    sink: target.counts.calls,
    business_commits: business.commits,
  });
}

function stepDelta(total, before) {
  const delta = {};
  for (const key of Object.keys(total)) delta[key] = total[key] - before[key];
  return delta;
}

export async function recordStep(state, { id, run, target, counters, refusalExpected = false, extra }) {
  const before = counters();
  const record = await step(state, { id, run, target, refusalExpected });
  record.counters = stepDelta(counters(), before);
  return Object.assign(record, typeof extra === "function" ? extra() : extra);
}

export function handleFacts(handle) {
  return { state: handle.state, transactional: handle.transactional, bound_event: handle.boundEvent };
}

export function occurrenceFacts({ captures, handle }) {
  if (captures.length !== 1) return undefined;
  const event = captures[0].event;
  const correlation = event.correlation;
  const facts = {
    event_name: event.event.name,
    outcome: event.event.outcome,
    lifecycle_phase: event.event.lifecycle_phase,
    commit_state: event.event.commit_state,
    delivery_class: event.event.delivery_class,
    operation_type: event.resource.operation_type,
    retry_attempt: correlation.retry_attempt,
  };
  if (correlation.original_event_id !== undefined) facts.original_event_id = correlation.original_event_id;
  if (handle !== undefined) {
    facts.transaction_id_matches_handle = correlation.transaction_id === handle.transactionId;
    facts.operation_id_matches_handle = correlation.operation_id === handle.operationId;
    facts.correlation_id_matches_handle = correlation.correlation_id === handle.correlationId;
  }
  return facts;
}

export function orderFacts(state, names, seqStart = 0) {
  const sequence = state.sequence.slice(seqStart);
  const positions = {};
  for (const name of names) positions[name] = sequence.findIndex((entry) => entry.name === name);
  return {
    names: sequence.map((entry) => entry.name),
    positions,
    monotonic_ms: sequence.every((entry, index) => index === 0 || entry.at_ms >= sequence[index - 1].at_ms),
  };
}

export function freshCase(state, caseId) {
  state.current = caseId;
  const input = mfaInput(state);
  const target = instance(state);
  return { input, target };
}

export function construct(state, caseId) {
  const { input, target } = freshCase(state, caseId);
  const business = businessCounter();
  const counters = counterSnapshot({ target, business });
  return { input, target, business, counters };
}

// Per-case containment (G1): one case's unexpected throw is an owned abort
// observation, never a harness_fault invalidation of the whole run. Budget
// exhaustion stays sticky and propagates; only the baselines stop everything.
export async function runCase(state, entry, work) {
  try {
    return await work();
  } catch (error) {
    if (state.ledger.report().exhausted === true) throw error;
    state.case_aborts.push(entry.case_id);
    state.records.push({ step_id: `${entry.case_id}/aborted`, variant: "case_aborted",
      message: error.message, current: state.current });
    return null;
  }
}

export function caseSummary(state, entry, { actual, steps, orderNames = [], seqStart = 0 }) {
  const calls = state.calls.filter((call) => call.label.startsWith(`${entry.case_id}:`));
  return {
    case_id: entry.case_id,
    predicted_calls: entry.predicted_calls,
    public_calls: calls.length,
    predicted: entry.predicted,
    actual: structuredClone(actual),
    steps,
    order: orderFacts(state, orderNames, seqStart),
  };
}
