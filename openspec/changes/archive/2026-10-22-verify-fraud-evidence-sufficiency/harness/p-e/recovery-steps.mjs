import { caseSummary, handleFacts, recordStep } from "./case-steps.mjs";
import { hostFacts } from "./outbox-steps.mjs";

// Computed identity facts only; never freeze random ids or body hashes.
export function recoveryIdentity({ prior, next }) {
  if (next === undefined) return null;
  return {
    same_event_id: next.event.id === prior.event.id,
    same_operation_id: next.correlation.operation_id === prior.correlation.operation_id,
    same_transaction_id: next.correlation.transaction_id === prior.correlation.transaction_id,
    same_correlation_id: next.correlation.correlation_id === prior.correlation.correlation_id,
    same_body: JSON.stringify(next) === JSON.stringify(prior),
    retry_attempt: next.correlation.retry_attempt,
    original_event_id_matches_prior: next.correlation.original_event_id === prior.event.id,
  };
}

export async function recoveryHandle(state, setup, input) {
  return recordStep(state, { id: setup.prefix + "beginOperation", target: setup.target,
    counters: setup.counters, refusalExpected: input.operationId !== undefined,
    run: () => {
      const result = state.method(setup.target.sdk, "beginOperation", { boundEvent: "mfaRemoved", ...input });
      if (result.ok) setup.handle = result.value;
      return result;
    }, extra: () => ({ handle: handleFacts(setup.handle), database: hostFacts(setup) }) });
}

export function recoverySummary(state, entry, { branches, seqStart, recordStart }) {
  const actual = { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 };
  for (const branch of branches) {
    for (const key of Object.keys(actual)) actual[key] += branch.actual[key];
  }
  const steps = state.records.slice(recordStart).map((row) => row.step_id.slice(entry.case_id.length + 1));
  return { ...caseSummary(state, entry, { seqStart, actual, steps }), branches };
}

export function recoveryBranchFacts(setup, extra = {}) {
  return { actual: setup.counters(), database: hostFacts(setup), host_order: setup.host.order,
    final_handle: handleFacts(setup.handle), ...extra };
}
