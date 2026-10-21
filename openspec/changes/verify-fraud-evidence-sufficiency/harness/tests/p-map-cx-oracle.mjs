// Independent hand-written boundary oracle, not imported from plans or doubles.
// Sources at 8e6cdf781445574c67883a465eb37581ca14b5ab; all are build hypotheses.
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/source/contract.source.json";
const SCHEMA = "contracts/security-audit/schema/security-audit-event.schema.json";
const CONTACT = { "occurrence.event_name": "bloodtrail.audit.data.sensitive_resource.modified",
  "occurrence.category": "data_access", "occurrence.action": "modify", "occurrence.operation_type": "update",
  "signal.resource_type": "account", "signal.actor_type": "authenticated_human",
  "signal.data_classification": "restricted", "signal.categories_preserved": true };
const COMMITTED = { "occurrence.lifecycle_phase": "completed", "occurrence.outcome": "success",
  "occurrence.commit_state": "committed", "occurrence.delivery_class": "transaction_critical",
  "occurrence.operation_id_matches_handle": true, "occurrence.transaction_id_matches_handle": true,
  "occurrence.correlation_id_matches_handle": true };
const CONTACT_BASIS = [`${CONTRACT}:3814-3855`, `${CORE}events.ts:205-225,457-472,503-519`,
  `${CORE}validation/semantic.ts:249-289,326-330,426-435`];
const CATEGORY_BASIS = [`${CONTRACT}:305-573,2286-2296`, `${SCHEMA}:1197-1207`, `${CORE}validation/prohibited.ts:7-12,45-50,65-71`];

function accepted(step_id, fields, basis) {
  return { step_id, fields: { kind: "returned", accepted: true, sink_count: 1,
    "raw.value.status": "accepted", "captures.0.frozen": true, ...COMMITTED, ...fields }, basis };
}

function refused(step_id, diagnostic, basis) {
  return { step_id, fields: { kind: "returned", accepted: false, sink_count: 0,
    "diagnostic.code": diagnostic.code, "diagnostic.category": diagnostic.category, "diagnostic.path": diagnostic.path }, basis };
}

export const CX_ORACLE = [
  accepted("C1/email", { ...CONTACT, "signal.change_categories": ["contact_email"] }, CONTACT_BASIS),
  accepted("C1/phone", { ...CONTACT, "signal.change_categories": ["contact_phone"] }, CONTACT_BASIS),
  accepted("C2a/unregistered", { ...CONTACT, "signal.change_categories": ["zz-unregistered-0001"] }, CATEGORY_BASIS),
  accepted("C2a/object", { ...CONTACT, "signal.change_categories": [{}] }, CATEGORY_BASIS),
  accepted("C2a/object-kind", { ...CONTACT, "signal.change_categories": [{ kind: "contact_email" }] }, CATEGORY_BASIS),
  accepted("C2a/ascii-4000", { ...CONTACT, "signal.change_categories": ["a".repeat(4000)] }, CATEGORY_BASIS),
  refused("C2a/bytes-8193", { code: "FIELD_LIMIT_EXCEEDED", category: "validation", path: "/resource/change_categories/0" },
    [`${CORE}events.ts:73-75`, `${CORE}validation/prohibited.ts:10,45-50`]),
  refused("C2b/items-17", { code: "FIELD_LIMIT_EXCEEDED", category: "validation", path: "/resource/change_categories" },
    [`${SCHEMA}:1197-1207`, `${CORE}validation/prohibited.ts:8,65-71`, `${CORE}validation/schema.ts:9-17,80-81,123-127`]),
  accepted("C3/after-value", { ...CONTACT, "signal.change_categories": ["contact_email", "after-val-0001"] },
    [`${CONTRACT}:3819,3848`, ...CATEGORY_BASIS]),
  accepted("C4/configuration", { "occurrence.event_name": "bloodtrail.audit.security.configuration.changed",
    "occurrence.category": "security_configuration", "occurrence.action": "change_security_configuration",
    "occurrence.operation_type": "configure", "signal.resource_type": "account", "signal.actor_type": "authenticated_human",
    "signal.categories_preserved": true, "signal.change_categories": ["contact_email"] },
  [`${CONTRACT}:3998-4036`, `${CORE}validation/semantic.ts:249-280,328-330`]),
  accepted("C5/removed", { "occurrence.event_name": "bloodtrail.audit.authentication.mfa.removed",
    "occurrence.category": "authentication", "occurrence.action": "remove_mfa", "occurrence.operation_type": "delete" },
  [`${CONTRACT}:3014-3050`, `${CORE}events.ts:205-225`]),
  accepted("C5/enrolled", { "occurrence.event_name": "bloodtrail.audit.authentication.mfa.enrolled",
    "occurrence.category": "authentication", "occurrence.action": "enroll_mfa", "occurrence.operation_type": "create",
    "replacement.complete": true, "replacement.shared_transaction_id": true, "replacement.shared_operation_id": true,
    "replacement.shared_correlation_id": true, "replacement.distinct_event_ids": true,
    "replacement.enrolled_resource_type": "credential", "replacement.enrolled_credential_type": "mfa_factor",
    "replacement.distinct_factor_ids": true },
  [`${CONTRACT}:2956-2992,3014-3050`, `${CORE}operations.ts:161-181`, `${CORE}sdk.ts:234-282`]),
  refused("C6/tenantless", { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/scope" },
    [`${CORE}validation/semantic.ts:66,391-399`, `${CONTRACT}:3846`]),
  refused("X1/spread", { code: "AUTHORITY_ESCALATION", category: "authority", path: "/resource" },
    [`${CORE}context.ts:388-392,430-445`, `${CORE}duplicate-copy-probe.ts:100-102`]),
];
