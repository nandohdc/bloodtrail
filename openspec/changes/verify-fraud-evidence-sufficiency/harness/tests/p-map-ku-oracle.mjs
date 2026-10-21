// Independently hand-written source-cited boundary oracle. Does not import
// descriptors, expectations, workloads or scripted doubles. Base 8e6cdf7.
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/source/contract.source.json";
const MODIFICATION = { "occurrence.event_name": "bloodtrail.audit.data.sensitive_resource.modified",
  "occurrence.lifecycle_phase": "completed", "occurrence.outcome": "success", "occurrence.commit_state": "committed",
  "occurrence.delivery_class": "transaction_critical", "occurrence.transaction_id_matches_handle": true,
  "occurrence.operation_id_matches_handle": true, "occurrence.correlation_id_matches_handle": true,
  "signal.resource_type": "account", "signal.authorization_decision": "allow" };
const MODIFICATION_BASIS = [`${CONTRACT}:3814-3855`, `${CORE}events.ts:190-225`, `${CORE}validation/semantic.ts:227-289,326-330,426-435`];
const TENANT_BASIS = [`${CORE}validation/semantic.ts:58,66,391-399`, `${CONTRACT}:3376,3846`];

function accepted(step_id, fields, basis) {
  return { step_id, fields: { kind: "returned", accepted: true, sink_count: 1,
    "raw.value.status": "accepted", "captures.0.frozen": true, ...fields }, basis };
}

function tenantRefusal(step_id) {
  return { step_id, fields: { kind: "returned", accepted: false, sink_count: 0,
    "diagnostic.code": "TENANT_RESOURCE_CONFLICT", "diagnostic.category": "validation", "diagnostic.path": "/tenant/scope" }, basis: TENANT_BASIS };
}

function handleRefusal(step_id) {
  return { step_id, fields: { kind: "returned", accepted: false, sink_count: 0,
    "diagnostic.code": "SDK_INVALID_OPERATION_TRANSITION", "diagnostic.category": "lifecycle", "diagnostic.path": "/operation" },
  basis: [`${CORE}operations.ts:121-128`, `${CORE}sdk.ts:213-223`] };
}

export const KU_ORACLE = [
  accepted("K1/attempt", { "occurrence.event_name": "bloodtrail.audit.authentication.failed", "occurrence.outcome": "failure",
    "occurrence.commit_state": "not_applicable", "occurrence.lifecycle_phase": "completed",
    "occurrence.delivery_class": "security_significant", "signal.actor_type": "anonymous", "signal.target_absent": true,
    "signal.failure_reason": "rate_limited", "signal.outcome_reason": "rate_limited" },
  [`${CONTRACT}:518-536,2902-2934`, `${CORE}events.ts:223`, "#795 decision log G36"]),
  accepted("K2a/policy", { ...MODIFICATION, "signal.actor_type": "service_account", "signal.change_categories": ["lockout"],
    "signal.outcome_reason": "rate_limited" },
  [...MODIFICATION_BASIS, `${CORE}events.ts:238-272`, `${CORE}context.ts:198-200`, "contracts/security-audit/docs/authority-matrix.md:16"]),
  tenantRefusal("K2a/tenantless"),
  accepted("K2b/not-applicable", { ...MODIFICATION, "signal.authorization_decision": "not_applicable", "signal.change_categories": ["lockout"] },
    [`${CONTRACT}:3849`, `${CORE}validation/semantic.ts:287-289,380-384,426-435`]),
  tenantRefusal("K2b/tenantless"),
  accepted("K3/account", { "occurrence.event_name": "bloodtrail.audit.security.configuration.changed", "occurrence.outcome": "success",
    "occurrence.commit_state": "committed", "occurrence.delivery_class": "transaction_critical", "signal.actor_type": "workload_identity",
    "signal.resource_type": "account", "signal.change_categories": ["lockout"] },
  [`${CONTRACT}:3998-4036`, `${CORE}validation/semantic.ts:278-280,328-330`]),
  accepted("K3/relabeled", { "occurrence.event_name": "bloodtrail.audit.security.configuration.changed", "occurrence.commit_state": "committed",
    "signal.resource_type": "security_configuration", "signal.resource_id": "pmap-acct-0001" },
  [`${CONTRACT}:465-478,2162-2173,4029`, `${CORE}validation/semantic.ts:278-280`]),
  accepted("K4/tenant", { "occurrence.event_name": "bloodtrail.audit.authorization.denied", "occurrence.outcome": "denied",
    "occurrence.lifecycle_phase": "attempted", "occurrence.commit_state": "not_applicable", "occurrence.delivery_class": "security_significant",
    "signal.actor_type": "anonymous", "signal.resource_type": "account", "signal.resource_id": "pmap-acct-0001", "signal.target_absent": false,
    "signal.authorization_decision": "deny" }, [`${CONTRACT}:3351-3385,2906,2927`, `${CORE}events.ts:223`]),
  tenantRefusal("K4/tenantless"),
  accepted("U1/administrator", { ...MODIFICATION, "signal.actor_type": "administrator", "signal.change_categories": ["lockout_release"],
    "signal.outcome_reason": "operator_requested" }, [...MODIFICATION_BASIS, `${CORE}context.ts:210-212`]),
  accepted("U1/scheduled", { ...MODIFICATION, "signal.actor_type": "scheduled_process", "signal.change_categories": ["lockout_release"] },
    [...MODIFICATION_BASIS, `${CORE}context.ts:218-220`]),
  tenantRefusal("U1/tenantless"),
  accepted("U2/same-instance", { ...MODIFICATION, "occurrence.lifecycle_phase": "compensating", "occurrence.outcome": "partial",
    "occurrence.commit_state": "compensated", "signal.change_categories": ["lockout_release"],
    "compensation.complete": true, "compensation.shared_transaction_id": true, "compensation.shared_operation_id": true,
    "compensation.shared_correlation_id": true, "compensation.distinct_event_ids": true,
    "compensation.release_compensates_original": true },
  [`${CONTRACT}:3814-3855`, `${CORE}operations.ts:111,213-220`, `${CORE}events.ts:190-225`,
    `${CORE}validation/semantic.ts:227-247`, `${CORE}sdk.ts:475-479,513-547`, "openspec/specs/security-audit-event-contract/spec.md:149-167"]),
  handleRefusal("U2/foreign"), handleRefusal("U2/copied"),
];
