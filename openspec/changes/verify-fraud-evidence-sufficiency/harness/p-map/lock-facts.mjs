import { sameIdentity } from "./snapshot.mjs";

import { captured, oneStep, stepMatched } from "./evidence.mjs";

function targetAbsent({ actor, subject, credential = {}, resource = {} }) {
  return actor.id === undefined && subject === undefined && credential.reference === undefined && resource.id === undefined;
}

export function lockFacts(record) {
  const event = captured(record);
  if (event === undefined) return;
  const { resource = {}, authorization = {}, authentication = {} } = event;
  record.signal = { actor_type: event.actor.type, resource_type: resource.type,
    resource_id: resource.id, change_categories: resource.change_categories,
    authorization_decision: authorization.decision, failure_reason: authentication.failure_reason,
    outcome_reason: event.event.outcome_reason?.code, target_absent: targetAbsent(event) };
}

// This measures preservation of HOST-supplied linkage, never SDK attribution.
// Missing evidence stays local to this finding; #806 decides join policy.
export function hostLinkagePreserved(context) {
  if (!stepMatched(context, "K1/attempt")) return null;
  if (!stepMatched(context, "K2a/policy")) return null;
  const attempt = captured(oneStep(context.records, "K1/attempt"));
  const committed = captured(oneStep(context.records, "K2a/policy"));
  if (attempt === undefined || committed === undefined) return null;
  return sameIdentity(attempt.correlation.request_id, committed.correlation.request_id)
    && sameIdentity(attempt.correlation.correlation_id, committed.correlation.correlation_id);
}

export function compensationFacts(lock, release) {
  const first = captured(lock);
  const second = captured(release);
  if (first === undefined || second === undefined) return { complete: false };
  return { complete: true,
    shared_transaction_id: sameIdentity(first.correlation.transaction_id, second.correlation.transaction_id),
    shared_operation_id: sameIdentity(first.correlation.operation_id, second.correlation.operation_id),
    shared_correlation_id: sameIdentity(first.correlation.correlation_id, second.correlation.correlation_id),
    distinct_event_ids: !sameIdentity(first.event.id, second.event.id),
    release_compensates_original: second.event.lifecycle_phase === "compensating" && second.event.commit_state === "compensated" };
}
