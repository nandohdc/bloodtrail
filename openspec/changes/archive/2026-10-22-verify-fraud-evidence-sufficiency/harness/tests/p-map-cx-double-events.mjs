import { frozenSnapshot } from "../p-map/snapshot.mjs";

// Hand-written catalog fixture shapes at 8e6cdf7, not generated from plans.
// contract.source.json:2956-2992,3014-3050,3814-3855,3998-4036.
const EVENTS = {
  contact: { method: "sensitiveResourceModified", name: "data.sensitive_resource.modified", category: "data_access", action: "modify" },
  configuration: { method: "securityConfigurationChanged", name: "security.configuration.changed",
    category: "security_configuration", action: "change_security_configuration" },
  removed: { method: "mfaRemoved", name: "authentication.mfa.removed", category: "authentication", action: "remove_mfa" },
  enrolled: { method: "mfaEnrolled", name: "authentication.mfa.enrolled", category: "authentication", action: "enroll_mfa" },
};
const COPY_FIELDS = ["actor", "tenant", "subject", "authentication", "authorization", "credential", "resource", "source", "request"];

export function contactEventDouble({ kind, input, ordinal }) {
  const { method, name, ...classification } = EVENTS[kind];
  const handle = input.operation;
  const event = { event: { ...classification, name: `bloodtrail.audit.${name}`,
    id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
    lifecycle_phase: "completed", outcome: "success", commit_state: "committed", delivery_class: "transaction_critical" },
  schema: { name: "com.bloodtrail.security-audit.event", version: "2.1.0" },
  data: { classification: input.resource.data_classification ?? "internal" },
  correlation: { operation_id: handle.operationId, transaction_id: handle.transactionId, correlation_id: handle.correlationId } };
  for (const field of COPY_FIELDS) if (input[field] !== undefined) event[field] = input[field];
  return { method, event: frozenSnapshot(event) };
}
