import { frozenSnapshot } from "../p-map/snapshot.mjs";

// Hand-scripted occurrences from catalog rows, not from workload descriptors or
// expectations. This module never chooses acceptance/refusal from SDK input.
// contract.source.json:2847-2880,2902-2934,3072-3105,3126-3161 at 8e6cdf7.
const EVENTS = {
  logout: { method: "sessionRevoked", name: "session.revoked", category: "session", action: "revoke_session",
    outcome: "success", commit_state: "committed", delivery_class: "transaction_critical" },
  denial: { method: "sessionRevoked", name: "session.revoked", category: "session", action: "revoke_session",
    outcome: "denied", commit_state: "not_committed", delivery_class: "transaction_critical" },
  mfa: { method: "authenticationFailed", name: "authentication.failed", category: "authentication", action: "authenticate",
    outcome: "failure", commit_state: "not_applicable", delivery_class: "security_significant" },
  login: { method: "authenticationSucceeded", name: "authentication.succeeded", category: "authentication", action: "authenticate",
    outcome: "success", commit_state: "not_applicable", delivery_class: "security_significant" },
  created: { method: "sessionCreated", name: "session.created", category: "session", action: "create_session",
    outcome: "success", commit_state: "not_applicable", delivery_class: "security_significant" },
};
const COPY_FIELDS = ["actor", "tenant", "subject", "session", "authentication", "authorization", "credential",
  "resource", "source", "request", "authenticated_principal"];

export function eventDouble({ kind, input, ordinal }) {
  const { method, name, ...classification } = EVENTS[kind];
  const event = { event: { ...classification, name: `bloodtrail.audit.${name}`,
    id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
    lifecycle_phase: "completed", timestamp: "2026-10-01T10:00:00.000Z", observed_at: "2026-10-01T10:00:00.000Z" },
  schema: { name: "com.bloodtrail.security-audit.event", version: "2.1.0" },
  resource: { operation_type: "execute" }, correlation: correlationDouble(input.operation, ordinal) };
  for (const field of COPY_FIELDS) if (input[field] !== undefined) event[field] = input[field];
  if (input.event !== undefined) event.event.outcome_reason = input.event.outcome_reason;
  return { method, event: frozenSnapshot(event) };
}

function correlationDouble(handle, ordinal) {
  if (handle !== undefined) return { operation_id: handle.operationId, transaction_id: handle.transactionId,
    correlation_id: handle.correlationId, retry_attempt: 0 };
  return { operation_id: `fixture-auto-op-${ordinal}`, correlation_id: `fixture-auto-cor-${ordinal}`, retry_attempt: 0 };
}
