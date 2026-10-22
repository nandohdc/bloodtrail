import { sameIdentity } from "./snapshot.mjs";

export function logoutFacts(record) {
  if (record.captures.length !== 1) return;
  const event = record.captures[0].event;
  record.signal = { actor_type: event.actor.type, actor_trust: event.actor.provenance.trust_level,
    authorization_decision: event.authorization.decision,
    actor_matches_subject: sameIdentity(event.actor.id, event.subject.id),
    resource_matches_session: sameIdentity(event.resource.id, event.session.id) };
}

export function failureFacts(record) {
  if (record.captures.length !== 1) return;
  const event = record.captures[0].event;
  record.signal = { actor_type: event.actor.type, actor_trust: event.actor.provenance.trust_level,
    subject_present: event.subject !== undefined,
    actor_id_present: typeof event.actor.id === "string",
    credential_reference_present: event.credential.reference !== undefined,
    mfa_state: event.authentication.mfa_state, failure_reason: event.authentication.failure_reason,
    outcome_reason: event.event.outcome_reason.code,
    operation_id_nonempty: nonempty(event.correlation.operation_id),
    correlation_id_nonempty: nonempty(event.correlation.correlation_id) };
}

function nonempty(value) {
  return typeof value === "string" && value.length > 0;
}
