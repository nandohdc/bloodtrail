import { causalFacts, sameIdentity } from "./snapshot.mjs";

import { captured } from "./evidence.mjs";

export function rotationFacts(record) {
  const event = captured(record);
  if (event === undefined) return;
  const { resource = {}, credential = {}, authorization = {} } = event;
  record.signal = { actor_type: event.actor.type, actor_trust: event.actor.provenance.trust_level,
    resource_type: resource.type, resource_id: resource.id, change_categories: resource.change_categories,
    credential_type: credential.type, authorization_decision: authorization.decision,
    causation_present: typeof event.correlation.causation_id === "string",
    original_event_present: typeof event.correlation.original_event_id === "string" };
}

// Owned by the completion, derived from two existing captures. A real link to
// the wrong kind of original is different from missing/aborted causal evidence.
export function rotationLinkFacts(original, completion) {
  const first = captured(original);
  const second = captured(completion);
  if (first === undefined || second === undefined) return { complete: false };
  return { complete: true, ...causalFacts({ original: first, completion: second }),
    shared_operation_id: sameIdentity(first.correlation.operation_id, second.correlation.operation_id),
    shared_correlation_id: sameIdentity(first.correlation.correlation_id, second.correlation.correlation_id),
    distinct_event_ids: !sameIdentity(first.event.id, second.event.id) };
}

export function capturedOriginal(record) {
  const event = captured(record);
  if (record.accepted !== true || event === undefined) throw new Error("causal precursor prerequisite failed; see owned step");
  if (typeof event.event.id !== "string" || event.event.id.length === 0) throw new Error("causal precursor has no event ID; see owned capture");
  return { causation_id: event.event.id, original_event_id: event.event.id };
}
