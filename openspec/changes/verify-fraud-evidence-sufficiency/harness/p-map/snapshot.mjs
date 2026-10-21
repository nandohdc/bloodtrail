// Implementer default: retain runtime identities in raw observations, but
// compare them structurally in facts. No UUID, timestamp or digest is frozen
// into an expectation. Reading public handle getters is not an invocation.
export { publicSnapshot } from "../p-e/snapshot.mjs";
export { handleFacts } from "../p-e/case-steps.mjs";

function freezeTree(value) {
  if (value === null || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeTree(child);
  return Object.freeze(value);
}

export function frozenSnapshot(value) {
  return freezeTree(structuredClone(value));
}

export function sameIdentity(left, right) {
  return typeof left === "string" && left.length > 0 && left === right;
}

export function handleIdentityFacts({ correlation = {}, handle }) {
  return {
    operation_id_matches_handle: sameIdentity(correlation.operation_id, handle.operationId),
    transaction_id_matches_handle: sameIdentity(correlation.transaction_id, handle.transactionId),
    correlation_id_matches_handle: sameIdentity(correlation.correlation_id, handle.correlationId),
  };
}

export function occurrenceFacts({ captures, handle }) {
  if (captures.length !== 1) return undefined;
  const { event, correlation, resource = {} } = captures[0].event;
  const facts = {
    event_name: event.name, category: event.category, action: event.action,
    lifecycle_phase: event.lifecycle_phase, outcome: event.outcome,
    commit_state: event.commit_state, delivery_class: event.delivery_class,
    operation_type: resource.operation_type,
  };
  if (handle !== undefined) Object.assign(facts, handleIdentityFacts({ correlation, handle }));
  return facts;
}

export function causalFacts({ original, completion }) {
  const id = original.event.id;
  return {
    causation_matches_original: sameIdentity(completion.correlation.causation_id, id),
    original_event_matches_original: sameIdentity(completion.correlation.original_event_id, id),
  };
}
