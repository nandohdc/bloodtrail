// Hand-written from source, independently of plans, workloads and fixture
// scripts. Base 8e6cdf781445574c67883a465eb37581ca14b5ab. SDK acceptance
// is not semantic fit. US-006 should consume these rows in evaluator tests.
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/source/contract.source.json";
const COMPLETE = { "occurrence.event_name": "bloodtrail.audit.account.password_reset.completed",
  "occurrence.category": "account", "occurrence.action": "complete_password_reset", "occurrence.lifecycle_phase": "completed",
  "occurrence.outcome": "success", "occurrence.commit_state": "committed", "occurrence.delivery_class": "transaction_critical",
  "occurrence.operation_id_matches_handle": true, "occurrence.transaction_id_matches_handle": true,
  "occurrence.correlation_id_matches_handle": true, "signal.resource_type": "credential", "signal.authorization_decision": "allow" };
const REQUEST = { "occurrence.event_name": "bloodtrail.audit.account.password_reset.requested", "occurrence.lifecycle_phase": "attempted",
  "occurrence.outcome": "success", "occurrence.commit_state": "not_applicable", "occurrence.delivery_class": "security_significant",
  "signal.actor_type": "authenticated_human", "signal.causation_present": false, "signal.original_event_present": false };
const LINK = { "causality.complete": true, "causality.causation_matches_original": true,
  "causality.original_event_matches_original": true, "causality.distinct_event_ids": true };
const ROTATION = { "occurrence.event_name": "bloodtrail.audit.data.sensitive_resource.modified", "occurrence.commit_state": "committed",
  "occurrence.delivery_class": "transaction_critical", "signal.resource_type": "credential", "signal.credential_type": "api_credential",
  "signal.change_categories": ["rotation"], "signal.authorization_decision": "allow", "occurrence.transaction_id_matches_handle": true };
const COMPLETION_BASIS = [`${CONTRACT}:3238-3275`, `${CORE}validation/semantic.ts:32,91-111,227-247,249-319,354-369`, `${CORE}events.ts:190-225,238-272`];
const REQUEST_BASIS = [`${CONTRACT}:3182-3216`, `${CORE}events.ts:223,238-272`, `${CORE}validation/semantic.ts:55`];
const ROTATION_BASIS = [`${CONTRACT}:445-454,465-478,3814-3855`, `${CORE}validation/semantic.ts:249-289,326-330,426-435`];

function accepted(step_id, fields, basis) {
  return { step_id, fields: { kind: "returned", accepted: true, sink_count: 1,
    "raw.value.status": "accepted", "captures.0.frozen": true, ...fields }, basis };
}

function refused(step_id, diagnostic, basis, fields = {}) {
  return { step_id, fields: { kind: "returned", accepted: false, sink_count: 0,
    "diagnostic.code": diagnostic[0], "diagnostic.category": diagnostic[1], "diagnostic.path": diagnostic[2], ...fields }, basis };
}

const TENANT = ["TENANT_RESOURCE_CONFLICT", "validation", "/tenant/scope"];
export const R_ORACLE = [
  refused("R1/unlinked", ["BAD_CAUSALITY", "validation", "/correlation"], COMPLETION_BASIS),
  accepted("R2/pair-request", REQUEST, REQUEST_BASIS),
  accepted("R2/pair-completed", { ...COMPLETE, ...LINK,
    "causality.shared_operation_id": true, "causality.shared_correlation_id": true },
  [...COMPLETION_BASIS, "openspec/specs/security-audit-event-contract/spec.md:149-167"]),
  accepted("R2/tenantless-request", REQUEST, REQUEST_BASIS),
  refused("R2/tenantless-completed", TENANT, [`${CORE}validation/semantic.ts:55-56,391-399`, `${CONTRACT}:3266`]),
  accepted("R3/login", { "occurrence.event_name": "bloodtrail.audit.authentication.succeeded", "occurrence.lifecycle_phase": "completed",
    "occurrence.outcome": "success", "occurrence.commit_state": "not_applicable", "occurrence.delivery_class": "security_significant" },
  [`${CONTRACT}:2847-2880`, `${CORE}validation/semantic.ts:49,249-319`]),
  accepted("R3/completed", { ...COMPLETE, ...LINK,
    "causality.shared_operation_id": false, "causality.shared_correlation_id": false },
  [...COMPLETION_BASIS, "packages/security-audit-sdk-core/API.md:198", "openspec/specs/security-audit-event-contract/spec.md:161-163"]),
  accepted("R4/human", { ...ROTATION, "signal.actor_type": "authenticated_human" }, ROTATION_BASIS),
  accepted("R4/service", { ...ROTATION, "signal.actor_type": "service_account" }, [...ROTATION_BASIS, `${CORE}context.ts:198-200`]),
  refused("R4/tenantless", TENANT, [`${CORE}validation/semantic.ts:66,391-399`, `${CONTRACT}:3846`]),
  refused("R5a/human", ["MISSING_REQUIRED_ACTOR", "validation", "/actor/type"],
    [`${CONTRACT}:3427-3437`, `${CORE}validation/semantic.ts:249-263`]),
  accepted("R5b/administrator", { "occurrence.event_name": "bloodtrail.audit.authorization.role.assigned",
    "occurrence.category": "authorization", "occurrence.action": "assign_role", "occurrence.commit_state": "committed",
    "occurrence.delivery_class": "transaction_critical", "signal.actor_type": "administrator", "signal.resource_type": "role",
    "signal.resource_id": "pmap-cred-rec-0001" }, [`${CONTRACT}:3407-3443`, `${CORE}validation/semantic.ts:275-277,344-346,380-384`]),
];
