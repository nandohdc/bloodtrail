// GENERATED FILE. DO NOT EDIT.
// Contract: Bloodtrail Security Audit Event Contract 1.0.0
// Sources: contracts/security-audit/source/contract.source.json and generated contract artifacts.
export type SecurityAuditEvent = {
  readonly "event": {
    readonly "id": string;
    readonly "name": "bloodtrail.audit.account.registration.attempted" | "bloodtrail.audit.account.registration.completed" | "bloodtrail.audit.authentication.succeeded" | "bloodtrail.audit.authentication.failed" | "bloodtrail.audit.authentication.mfa.enrolled" | "bloodtrail.audit.authentication.mfa.removed" | "bloodtrail.audit.session.created" | "bloodtrail.audit.session.revoked" | "bloodtrail.audit.account.password_reset.requested" | "bloodtrail.audit.account.password_reset.completed" | "bloodtrail.audit.authorization.allowed" | "bloodtrail.audit.authorization.denied" | "bloodtrail.audit.authorization.role.assigned" | "bloodtrail.audit.authorization.role.removed" | "bloodtrail.audit.authorization.privilege.elevated" | "bloodtrail.audit.administration.impersonation.started" | "bloodtrail.audit.administration.impersonation.ended" | "bloodtrail.audit.data.sensitive_resource.viewed" | "bloodtrail.audit.data.sensitive_resource.created" | "bloodtrail.audit.data.sensitive_resource.modified" | "bloodtrail.audit.data.sensitive_resource.deleted" | "bloodtrail.audit.data.sensitive_data.exported" | "bloodtrail.audit.security.configuration.changed" | "bloodtrail.audit.tenant.context_violation.detected";
    readonly "category": "account" | "authentication" | "session" | "authorization" | "privilege" | "administration" | "data_access" | "security_configuration" | "tenant_security";
    readonly "action": "register" | "authenticate" | "enroll_mfa" | "remove_mfa" | "create_session" | "revoke_session" | "request_password_reset" | "complete_password_reset" | "evaluate_authorization" | "assign_role" | "remove_role" | "elevate_privilege" | "start_impersonation" | "end_impersonation" | "view" | "create" | "modify" | "delete" | "export" | "change_security_configuration" | "detect_tenant_violation";
    readonly "lifecycle_phase": "attempted" | "completed" | "compensating";
    readonly "outcome": "success" | "failure" | "denied" | "partial" | "unknown" | "cancelled";
    readonly "outcome_reason"?: {
      readonly "code"?: "accepted" | "completed" | "cancelled_by_actor" | "commit_failed" | "policy_denied" | "tenant_mismatch" | "credential_invalid" | "mfa_failed" | "rate_limited" | "break_glass" | "delegation_expired" | "not_found_or_not_disclosed" | "system_error" | "compensated" | "partial_limit" | "operator_requested" | "policy_baseline";
      readonly "message"?: string;
    };
    readonly "commit_state"?: "not_applicable" | "not_started" | "pending" | "committed" | "not_committed" | "partially_committed" | "compensated" | "unknown";
    readonly "timestamp": string;
    readonly "observed_at": string;
    readonly "delivery_class": "best_effort" | "security_significant" | "transaction_critical" | "policy_critical";
  };
  readonly "schema": {
    readonly "name": string;
    readonly "version": string;
  };
  readonly "producer": {
    readonly "name": string;
    readonly "version": string;
    readonly "instance_id"?: string;
  };
  readonly "environment": {
    readonly "name": string;
  };
  readonly "service": {
    readonly "name": string;
    readonly "version"?: string;
    readonly "instance_id"?: string;
  };
  readonly "deployment"?: {
    readonly "id"?: string;
    readonly "region"?: string;
    readonly "zone"?: string;
  };
  readonly "tenant": {
    readonly "scope": "tenant" | "cross_tenant" | "platform" | "tenantless";
    readonly "actor_tenant_id"?: string;
    readonly "effective_tenant_id"?: string;
    readonly "resource_tenant_id"?: string;
    readonly "parent_tenant_id"?: string;
    readonly "claimed_tenant_id"?: string;
  };
  readonly "actor": {
    readonly "type": "authenticated_human" | "anonymous" | "service_account" | "workload_identity" | "api_credential" | "administrator" | "background_job" | "scheduled_process" | "external_integration";
    readonly "id"?: string;
    readonly "tenant_id"?: string;
    readonly "display_name"?: string;
    readonly "provenance"?: {
      readonly "trust_level"?: "authoritative_server" | "verified_assertion" | "observed_transport" | "derived_server" | "downstream_enrichment" | "client_claim" | "unknown";
      readonly "source"?: string;
    };
  };
  readonly "subject"?: {
    readonly "type"?: "account" | "credential" | "session" | "role" | "privilege_grant" | "impersonation_session" | "tenant" | "sensitive_record" | "sensitive_collection" | "security_configuration" | "authorization_policy" | "platform_control";
    readonly "id"?: string;
    readonly "tenant_id"?: string;
    readonly "display_name"?: string;
  };
  readonly "authenticated_principal"?: {
    readonly "type"?: "human_user" | "service_account" | "workload" | "external_integration" | "anonymous";
    readonly "id"?: string;
    readonly "issuer"?: string;
  };
  readonly "delegation"?: {
    readonly "mode"?: string;
    readonly "principal_id"?: string;
    readonly "scope"?: ReadonlyArray<string | Readonly<Record<string, never>>>;
    readonly "reason_code"?: "accepted" | "completed" | "cancelled_by_actor" | "commit_failed" | "policy_denied" | "tenant_mismatch" | "credential_invalid" | "mfa_failed" | "rate_limited" | "break_glass" | "delegation_expired" | "not_found_or_not_disclosed" | "system_error" | "compensated" | "partial_limit" | "operator_requested" | "policy_baseline";
    readonly "expires_at"?: string;
    readonly "chain"?: ReadonlyArray<string | Readonly<Record<string, never>>>;
  };
  readonly "credential"?: {
    readonly "type"?: "password" | "session" | "api_credential" | "workload_federation" | "mfa_factor" | "recovery_flow" | "federated_assertion" | "none";
    readonly "reference"?: string;
    readonly "key_id"?: string;
  };
  readonly "initiator": {
    readonly "type": "application" | "service" | "workload" | "background_job" | "scheduled_process" | "external_integration" | "browser_client" | "api_client";
    readonly "id": string;
    readonly "version"?: string;
  };
  readonly "session"?: {
    readonly "id"?: string;
    readonly "created_at"?: string;
    readonly "age_seconds"?: number;
    readonly "assurance_level"?: string;
  };
  readonly "authentication"?: {
    readonly "method"?: string;
    readonly "assurance_level"?: string;
    readonly "mfa_state"?: "not_used" | "required" | "satisfied" | "failed" | "not_applicable" | "unknown";
    readonly "credential_type"?: "password" | "session" | "api_credential" | "workload_federation" | "mfa_factor" | "recovery_flow" | "federated_assertion" | "none";
    readonly "authenticated_at"?: string;
    readonly "identity_provider"?: string;
    readonly "account_recovery"?: {
      readonly "flow"?: string;
      readonly "state"?: string;
      readonly "reason_code"?: "accepted" | "completed" | "cancelled_by_actor" | "commit_failed" | "policy_denied" | "tenant_mismatch" | "credential_invalid" | "mfa_failed" | "rate_limited" | "break_glass" | "delegation_expired" | "not_found_or_not_disclosed" | "system_error" | "compensated" | "partial_limit" | "operator_requested" | "policy_baseline";
    };
    readonly "failure_reason"?: "accepted" | "completed" | "cancelled_by_actor" | "commit_failed" | "policy_denied" | "tenant_mismatch" | "credential_invalid" | "mfa_failed" | "rate_limited" | "break_glass" | "delegation_expired" | "not_found_or_not_disclosed" | "system_error" | "compensated" | "partial_limit" | "operator_requested" | "policy_baseline";
    readonly "delegated"?: boolean;
    readonly "impersonated"?: boolean;
  };
  readonly "authorization"?: {
    readonly "decision"?: "allow" | "deny" | "not_applicable" | "indeterminate" | "error";
    readonly "policy_id"?: string;
    readonly "policy_version"?: string;
    readonly "capability"?: string;
    readonly "enforcement_point"?: string;
    readonly "decision_reason"?: "accepted" | "completed" | "cancelled_by_actor" | "commit_failed" | "policy_denied" | "tenant_mismatch" | "credential_invalid" | "mfa_failed" | "rate_limited" | "break_glass" | "delegation_expired" | "not_found_or_not_disclosed" | "system_error" | "compensated" | "partial_limit" | "operator_requested" | "policy_baseline";
    readonly "resource_context"?: {
      readonly "type"?: string;
      readonly "id"?: string;
    };
    readonly "tenant_context"?: {
      readonly "effective_tenant_id"?: string;
    };
    readonly "override"?: boolean;
    readonly "break_glass"?: boolean;
    readonly "policy_correlation_id"?: string;
  };
  readonly "source"?: {
    readonly "observed"?: {
      readonly "address"?: string;
      readonly "port"?: number;
      readonly "proxy_chain"?: ReadonlyArray<string | Readonly<Record<string, never>>>;
    };
    readonly "client_reported"?: {
      readonly "user_agent_family"?: string;
      readonly "user_agent_version"?: string;
    };
  };
  readonly "destination"?: {
    readonly "service"?: string;
    readonly "address"?: string;
    readonly "port"?: number;
  };
  readonly "resource": {
    readonly "type"?: "account" | "credential" | "session" | "role" | "privilege_grant" | "impersonation_session" | "tenant" | "sensitive_record" | "sensitive_collection" | "security_configuration" | "authorization_policy" | "platform_control";
    readonly "id"?: string;
    readonly "parent_type"?: "account" | "credential" | "session" | "role" | "privilege_grant" | "impersonation_session" | "tenant" | "sensitive_record" | "sensitive_collection" | "security_configuration" | "authorization_policy" | "platform_control";
    readonly "parent_id"?: string;
    readonly "owning_tenant_id"?: string;
    readonly "data_classification"?: "public" | "internal" | "confidential" | "restricted";
    readonly "operation_type": "create" | "read" | "update" | "delete" | "execute" | "export" | "administer" | "configure";
    readonly "bulk"?: {
      readonly "count"?: number;
      readonly "scope"?: string;
      readonly "child_event_policy"?: string;
    };
    readonly "change_categories"?: ReadonlyArray<string | Readonly<Record<string, never>>>;
    readonly "deletion_mode"?: string;
    readonly "export"?: {
      readonly "destination_class"?: string;
      readonly "size_class"?: string;
      readonly "record_count"?: number;
    };
  };
  readonly "request"?: {
    readonly "id"?: string;
    readonly "method"?: string;
    readonly "route"?: string;
    readonly "user_agent"?: string;
    readonly "message_id"?: string;
  };
  readonly "correlation": {
    readonly "trace_id"?: string;
    readonly "span_id"?: string;
    readonly "correlation_id": string;
    readonly "causation_id"?: string;
    readonly "operation_id": string;
    readonly "transaction_id"?: string;
    readonly "request_id"?: string;
    readonly "message_id"?: string;
    readonly "retry_attempt"?: number;
    readonly "original_event_id"?: string;
  };
  readonly "risk"?: {
    readonly "level"?: "none" | "low" | "medium" | "high" | "critical" | "unknown";
    readonly "score"?: number;
    readonly "reason_codes"?: ReadonlyArray<string | Readonly<Record<string, never>>>;
    readonly "model"?: {
      readonly "name"?: string;
      readonly "version"?: string;
      readonly "provenance"?: {
        readonly "trust_level"?: "authoritative_server" | "verified_assertion" | "observed_transport" | "derived_server" | "downstream_enrichment" | "client_claim" | "unknown";
      };
    };
  };
  readonly "data": {
    readonly "classification": "public" | "internal" | "confidential" | "restricted";
    readonly "retention_class": "operational_short" | "security_standard" | "security_elevated" | "policy_governed";
    readonly "field_policy_version": string;
  };
  readonly "integrity"?: {
    readonly "attestations"?: ReadonlyArray<string | Readonly<Record<string, never>>>;
    readonly "transport_authentication"?: {
      readonly "method"?: string;
      readonly "verified"?: boolean;
      readonly "peer"?: string;
    };
  };
  readonly "extensions"?: {
    readonly "bloodtrail.audit.enrichment.v1"?: {
      readonly "provenance": {
        readonly "trust_level": "downstream_enrichment";
        readonly "source": string;
        readonly "version": string;
      };
      readonly "risk"?: {
        readonly "level"?: "none" | "low" | "medium" | "high" | "critical" | "unknown";
        readonly "reason_codes"?: ReadonlyArray<"accepted" | "completed" | "cancelled_by_actor" | "commit_failed" | "policy_denied" | "tenant_mismatch" | "credential_invalid" | "mfa_failed" | "rate_limited" | "break_glass" | "delegation_expired" | "not_found_or_not_disclosed" | "system_error" | "compensated" | "partial_limit" | "operator_requested" | "policy_baseline">;
      };
    };
  };
};

export const CONTRACT_VERSION = "1.0.0" as const;

export const CONTRACT_SCHEMA_NAME = "com.bloodtrail.security-audit.event" as const;

export const CONTRACT_SCHEMA_ID = "https://bloodtrail.dev/contracts/security-audit/1.0.0/security-audit-event.schema.json" as const;

export const REGISTRIES = {
  "actions": [
    "register",
    "authenticate",
    "enroll_mfa",
    "remove_mfa",
    "create_session",
    "revoke_session",
    "request_password_reset",
    "complete_password_reset",
    "evaluate_authorization",
    "assign_role",
    "remove_role",
    "elevate_privilege",
    "start_impersonation",
    "end_impersonation",
    "view",
    "create",
    "modify",
    "delete",
    "export",
    "change_security_configuration",
    "detect_tenant_violation"
  ],
  "actor_types": [
    "authenticated_human",
    "anonymous",
    "service_account",
    "workload_identity",
    "api_credential",
    "administrator",
    "background_job",
    "scheduled_process",
    "external_integration"
  ],
  "auth_decisions": [
    "allow",
    "deny",
    "not_applicable",
    "indeterminate",
    "error"
  ],
  "categories": [
    "account",
    "authentication",
    "session",
    "authorization",
    "privilege",
    "administration",
    "data_access",
    "security_configuration",
    "tenant_security"
  ],
  "commit_states": [
    "not_applicable",
    "not_started",
    "pending",
    "committed",
    "not_committed",
    "partially_committed",
    "compensated",
    "unknown"
  ],
  "credential_types": [
    "password",
    "session",
    "api_credential",
    "workload_federation",
    "mfa_factor",
    "recovery_flow",
    "federated_assertion",
    "none"
  ],
  "data_classifications": [
    "public",
    "internal",
    "confidential",
    "restricted"
  ],
  "delivery_classes": [
    "best_effort",
    "security_significant",
    "transaction_critical",
    "policy_critical"
  ],
  "extension_namespaces": [
    "bloodtrail.audit.enrichment.v1"
  ],
  "field_policy_values": [
    "allowed",
    "conditionally_allowed",
    "transform_required",
    "prohibited"
  ],
  "initiator_types": [
    "application",
    "service",
    "workload",
    "background_job",
    "scheduled_process",
    "external_integration",
    "browser_client",
    "api_client"
  ],
  "lifecycle_phases": [
    "attempted",
    "completed",
    "compensating"
  ],
  "mfa_states": [
    "not_used",
    "required",
    "satisfied",
    "failed",
    "not_applicable",
    "unknown"
  ],
  "operation_types": [
    "create",
    "read",
    "update",
    "delete",
    "execute",
    "export",
    "administer",
    "configure"
  ],
  "outcomes": [
    "success",
    "failure",
    "denied",
    "partial",
    "unknown",
    "cancelled"
  ],
  "principal_types": [
    "human_user",
    "service_account",
    "workload",
    "external_integration",
    "anonymous"
  ],
  "privacy_classifications": [
    "public_metadata",
    "internal",
    "confidential",
    "restricted"
  ],
  "reason_codes": [
    "accepted",
    "completed",
    "cancelled_by_actor",
    "commit_failed",
    "policy_denied",
    "tenant_mismatch",
    "credential_invalid",
    "mfa_failed",
    "rate_limited",
    "break_glass",
    "delegation_expired",
    "not_found_or_not_disclosed",
    "system_error",
    "compensated",
    "partial_limit",
    "operator_requested",
    "policy_baseline"
  ],
  "resource_types": [
    "account",
    "credential",
    "session",
    "role",
    "privilege_grant",
    "impersonation_session",
    "tenant",
    "sensitive_record",
    "sensitive_collection",
    "security_configuration",
    "authorization_policy",
    "platform_control"
  ],
  "retention_classes": [
    "operational_short",
    "security_standard",
    "security_elevated",
    "policy_governed"
  ],
  "risk_levels": [
    "none",
    "low",
    "medium",
    "high",
    "critical",
    "unknown"
  ],
  "tenant_scopes": [
    "tenant",
    "cross_tenant",
    "platform",
    "tenantless"
  ],
  "trust_levels": [
    "authoritative_server",
    "verified_assertion",
    "observed_transport",
    "derived_server",
    "downstream_enrichment",
    "client_claim",
    "unknown"
  ],
  "validation_error_codes": [
    "MISSING_REQUIRED_ACTOR",
    "MISSING_TENANT_CONTEXT",
    "TENANT_RESOURCE_CONFLICT",
    "UNKNOWN_CATALOG_VALUE",
    "UNSUPPORTED_SCHEMA_VERSION",
    "PROHIBITED_DATA",
    "FIELD_LIMIT_EXCEEDED",
    "AUTHORITY_ESCALATION",
    "PREMATURE_SUCCESS",
    "AUTHORIZATION_OUTCOME_CONFLICT",
    "BAD_CAUSALITY",
    "INVALID_DELEGATION",
    "UNKNOWN_EXTENSION",
    "ENVELOPE_PAYLOAD_CONFLICT",
    "UNSUPPORTED_MAPPING_VERSION",
    "DUPLICATE_AUTHORITY",
    "PROHIBITED_BODY_ATTRIBUTES",
    "MISSING_NATIVE_MAPPING",
    "MAPPING_SCOPE_OVERCLAIM",
    "UNAPPROVED_POLICY_CRITICAL_POSTURE",
    "UNSUPPORTED_COMPATIBILITY_VERSION"
  ]
} as const;

export const EVENT_CATALOG = [
  {
    "semantic": "account_registration_attempted",
    "name": "bloodtrail.audit.account.registration.attempted",
    "category": "account",
    "action": "register",
    "phase": [
      "attempted"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied",
      "cancelled"
    ],
    "commit": [
      "not_started",
      "not_applicable",
      "unknown"
    ],
    "producer": "registration-boundary",
    "required_context": [
      "actor",
      "tenant",
      "request",
      "source",
      "correlation"
    ],
    "delivery": "security_significant",
    "retention": "security_standard"
  },
  {
    "semantic": "account_registration_completed",
    "name": "bloodtrail.audit.account.registration.completed",
    "category": "account",
    "action": "register",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "partial",
      "cancelled"
    ],
    "commit": [
      "committed",
      "not_committed",
      "partially_committed"
    ],
    "producer": "account-transaction-owner",
    "required_context": [
      "actor",
      "tenant",
      "subject",
      "resource",
      "correlation"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "authentication_succeeded",
    "name": "bloodtrail.audit.authentication.succeeded",
    "category": "authentication",
    "action": "authenticate",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success"
    ],
    "commit": [
      "not_applicable"
    ],
    "producer": "authentication-authority",
    "required_context": [
      "actor",
      "authenticated_principal",
      "authentication",
      "credential",
      "session",
      "source"
    ],
    "delivery": "security_significant",
    "retention": "security_standard"
  },
  {
    "semantic": "authentication_failed",
    "name": "bloodtrail.audit.authentication.failed",
    "category": "authentication",
    "action": "authenticate",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "failure"
    ],
    "commit": [
      "not_applicable"
    ],
    "producer": "authentication-authority",
    "required_context": [
      "actor",
      "authentication",
      "source",
      "request",
      "correlation"
    ],
    "delivery": "security_significant",
    "retention": "security_standard"
  },
  {
    "semantic": "mfa_enrolled",
    "name": "bloodtrail.audit.authentication.mfa.enrolled",
    "category": "authentication",
    "action": "enroll_mfa",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "mfa-account-authority",
    "required_context": [
      "actor",
      "subject",
      "tenant",
      "authentication",
      "authorization",
      "resource"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "mfa_removed",
    "name": "bloodtrail.audit.authentication.mfa.removed",
    "category": "authentication",
    "action": "remove_mfa",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "mfa-account-authority",
    "required_context": [
      "actor",
      "subject",
      "tenant",
      "authentication",
      "authorization",
      "resource"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "session_created",
    "name": "bloodtrail.audit.session.created",
    "category": "session",
    "action": "create_session",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success"
    ],
    "commit": [
      "not_applicable"
    ],
    "producer": "session-authority",
    "required_context": [
      "authenticated_principal",
      "authentication",
      "session",
      "tenant",
      "source"
    ],
    "delivery": "security_significant",
    "retention": "security_standard"
  },
  {
    "semantic": "session_revoked",
    "name": "bloodtrail.audit.session.revoked",
    "category": "session",
    "action": "revoke_session",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "session-authority",
    "required_context": [
      "actor",
      "subject",
      "tenant",
      "authorization",
      "correlation"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "password_reset_requested",
    "name": "bloodtrail.audit.account.password_reset.requested",
    "category": "account",
    "action": "request_password_reset",
    "phase": [
      "attempted"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "not_applicable",
      "not_started"
    ],
    "producer": "recovery-authority",
    "required_context": [
      "actor",
      "request",
      "source",
      "correlation"
    ],
    "delivery": "security_significant",
    "retention": "security_standard"
  },
  {
    "semantic": "password_reset_completed",
    "name": "bloodtrail.audit.account.password_reset.completed",
    "category": "account",
    "action": "complete_password_reset",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "recovery-transaction-owner",
    "required_context": [
      "actor",
      "subject",
      "tenant",
      "authentication",
      "session",
      "correlation"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "authorization_allowed",
    "name": "bloodtrail.audit.authorization.allowed",
    "category": "authorization",
    "action": "evaluate_authorization",
    "phase": [
      "attempted"
    ],
    "outcomes": [
      "success"
    ],
    "commit": [
      "not_applicable"
    ],
    "producer": "policy-enforcement-point",
    "required_context": [
      "actor",
      "tenant",
      "resource",
      "authorization",
      "request"
    ],
    "delivery": "best_effort",
    "retention": "operational_short"
  },
  {
    "semantic": "authorization_denied",
    "name": "bloodtrail.audit.authorization.denied",
    "category": "authorization",
    "action": "evaluate_authorization",
    "phase": [
      "attempted"
    ],
    "outcomes": [
      "denied"
    ],
    "commit": [
      "not_applicable",
      "not_started"
    ],
    "producer": "policy-enforcement-point",
    "required_context": [
      "actor",
      "tenant",
      "resource",
      "authorization",
      "source"
    ],
    "delivery": "security_significant",
    "retention": "security_standard"
  },
  {
    "semantic": "role_assigned",
    "name": "bloodtrail.audit.authorization.role.assigned",
    "category": "authorization",
    "action": "assign_role",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "authorization-transaction-owner",
    "required_context": [
      "administrator",
      "subject",
      "tenant",
      "role",
      "authorization",
      "reason"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "role_removed",
    "name": "bloodtrail.audit.authorization.role.removed",
    "category": "authorization",
    "action": "remove_role",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "authorization-transaction-owner",
    "required_context": [
      "administrator",
      "subject",
      "tenant",
      "role",
      "authorization",
      "reason"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "privilege_elevated",
    "name": "bloodtrail.audit.authorization.privilege.elevated",
    "category": "privilege",
    "action": "elevate_privilege",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "privilege-authority",
    "required_context": [
      "real_actor",
      "subject",
      "delegation",
      "tenant",
      "authorization",
      "reason",
      "expiry"
    ],
    "delivery": "policy_critical",
    "retention": "policy_governed"
  },
  {
    "semantic": "impersonation_started",
    "name": "bloodtrail.audit.administration.impersonation.started",
    "category": "administration",
    "action": "start_impersonation",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "impersonation-authority",
    "required_context": [
      "real_admin_actor",
      "impersonated_subject",
      "tenants",
      "scope",
      "policy",
      "session",
      "expiry"
    ],
    "delivery": "policy_critical",
    "retention": "policy_governed"
  },
  {
    "semantic": "impersonation_ended",
    "name": "bloodtrail.audit.administration.impersonation.ended",
    "category": "administration",
    "action": "end_impersonation",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "impersonation-session-authority",
    "required_context": [
      "real_actor_or_process",
      "impersonated_subject",
      "original_start",
      "reason"
    ],
    "delivery": "policy_critical",
    "retention": "policy_governed"
  },
  {
    "semantic": "sensitive_resource_viewed",
    "name": "bloodtrail.audit.data.sensitive_resource.viewed",
    "category": "data_access",
    "action": "view",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "not_applicable"
    ],
    "producer": "resource-access-owner",
    "required_context": [
      "actor",
      "principal",
      "tenant",
      "resource",
      "authorization",
      "request"
    ],
    "delivery": "security_significant",
    "retention": "security_elevated"
  },
  {
    "semantic": "sensitive_resource_created",
    "name": "bloodtrail.audit.data.sensitive_resource.created",
    "category": "data_access",
    "action": "create",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied"
    ],
    "commit": [
      "committed",
      "not_committed"
    ],
    "producer": "resource-transaction-owner",
    "required_context": [
      "actor",
      "tenant",
      "resource",
      "authorization",
      "operation",
      "transaction"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "sensitive_resource_modified",
    "name": "bloodtrail.audit.data.sensitive_resource.modified",
    "category": "data_access",
    "action": "modify",
    "phase": [
      "completed",
      "compensating"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied",
      "partial"
    ],
    "commit": [
      "committed",
      "not_committed",
      "partially_committed",
      "compensated"
    ],
    "producer": "resource-transaction-owner",
    "required_context": [
      "actor",
      "tenant",
      "resource",
      "authorization",
      "change_categories",
      "transaction"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "sensitive_resource_deleted",
    "name": "bloodtrail.audit.data.sensitive_resource.deleted",
    "category": "data_access",
    "action": "delete",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied",
      "partial"
    ],
    "commit": [
      "committed",
      "not_committed",
      "partially_committed"
    ],
    "producer": "resource-transaction-owner",
    "required_context": [
      "actor",
      "tenant",
      "resource",
      "authorization",
      "deletion_mode",
      "transaction"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "sensitive_data_exported",
    "name": "bloodtrail.audit.data.sensitive_data.exported",
    "category": "data_access",
    "action": "export",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied",
      "partial",
      "cancelled"
    ],
    "commit": [
      "committed",
      "not_committed",
      "partially_committed"
    ],
    "producer": "export-transaction-owner",
    "required_context": [
      "actor",
      "tenant",
      "resource_scope",
      "authorization",
      "bounded_volume",
      "destination_class"
    ],
    "delivery": "policy_critical",
    "retention": "policy_governed"
  },
  {
    "semantic": "security_configuration_changed",
    "name": "bloodtrail.audit.security.configuration.changed",
    "category": "security_configuration",
    "action": "change_security_configuration",
    "phase": [
      "completed"
    ],
    "outcomes": [
      "success",
      "failure",
      "denied",
      "partial"
    ],
    "commit": [
      "committed",
      "not_committed",
      "partially_committed"
    ],
    "producer": "configuration-transaction-owner",
    "required_context": [
      "actor",
      "tenant_or_platform_scope",
      "config_resource",
      "authorization",
      "change_category"
    ],
    "delivery": "transaction_critical",
    "retention": "security_elevated"
  },
  {
    "semantic": "tenant_context_violation_detected",
    "name": "bloodtrail.audit.tenant.context_violation.detected",
    "category": "tenant_security",
    "action": "detect_tenant_violation",
    "phase": [
      "attempted"
    ],
    "outcomes": [
      "denied",
      "failure",
      "unknown"
    ],
    "commit": [
      "not_applicable",
      "not_started"
    ],
    "producer": "tenant-enforcement-boundary",
    "required_context": [
      "actor_or_claim",
      "authoritative_tenants",
      "claimed_tenant",
      "resource_owner",
      "request_source",
      "authorization"
    ],
    "delivery": "security_significant",
    "retention": "security_elevated"
  }
] as const;

export const EVENT_METHODS = [
  {
    "method": "accountRegistrationAttempted",
    "inputType": "AccountRegistrationAttemptedEventInput",
    "semantic": "account_registration_attempted",
    "name": "bloodtrail.audit.account.registration.attempted"
  },
  {
    "method": "accountRegistrationCompleted",
    "inputType": "AccountRegistrationCompletedEventInput",
    "semantic": "account_registration_completed",
    "name": "bloodtrail.audit.account.registration.completed"
  },
  {
    "method": "authenticationSucceeded",
    "inputType": "AuthenticationSucceededEventInput",
    "semantic": "authentication_succeeded",
    "name": "bloodtrail.audit.authentication.succeeded"
  },
  {
    "method": "authenticationFailed",
    "inputType": "AuthenticationFailedEventInput",
    "semantic": "authentication_failed",
    "name": "bloodtrail.audit.authentication.failed"
  },
  {
    "method": "mfaEnrolled",
    "inputType": "MfaEnrolledEventInput",
    "semantic": "mfa_enrolled",
    "name": "bloodtrail.audit.authentication.mfa.enrolled"
  },
  {
    "method": "mfaRemoved",
    "inputType": "MfaRemovedEventInput",
    "semantic": "mfa_removed",
    "name": "bloodtrail.audit.authentication.mfa.removed"
  },
  {
    "method": "sessionCreated",
    "inputType": "SessionCreatedEventInput",
    "semantic": "session_created",
    "name": "bloodtrail.audit.session.created"
  },
  {
    "method": "sessionRevoked",
    "inputType": "SessionRevokedEventInput",
    "semantic": "session_revoked",
    "name": "bloodtrail.audit.session.revoked"
  },
  {
    "method": "passwordResetRequested",
    "inputType": "PasswordResetRequestedEventInput",
    "semantic": "password_reset_requested",
    "name": "bloodtrail.audit.account.password_reset.requested"
  },
  {
    "method": "passwordResetCompleted",
    "inputType": "PasswordResetCompletedEventInput",
    "semantic": "password_reset_completed",
    "name": "bloodtrail.audit.account.password_reset.completed"
  },
  {
    "method": "authorizationAllowed",
    "inputType": "AuthorizationAllowedEventInput",
    "semantic": "authorization_allowed",
    "name": "bloodtrail.audit.authorization.allowed"
  },
  {
    "method": "authorizationDenied",
    "inputType": "AuthorizationDeniedEventInput",
    "semantic": "authorization_denied",
    "name": "bloodtrail.audit.authorization.denied"
  },
  {
    "method": "roleAssigned",
    "inputType": "RoleAssignedEventInput",
    "semantic": "role_assigned",
    "name": "bloodtrail.audit.authorization.role.assigned"
  },
  {
    "method": "roleRemoved",
    "inputType": "RoleRemovedEventInput",
    "semantic": "role_removed",
    "name": "bloodtrail.audit.authorization.role.removed"
  },
  {
    "method": "privilegeElevated",
    "inputType": "PrivilegeElevatedEventInput",
    "semantic": "privilege_elevated",
    "name": "bloodtrail.audit.authorization.privilege.elevated"
  },
  {
    "method": "impersonationStarted",
    "inputType": "ImpersonationStartedEventInput",
    "semantic": "impersonation_started",
    "name": "bloodtrail.audit.administration.impersonation.started"
  },
  {
    "method": "impersonationEnded",
    "inputType": "ImpersonationEndedEventInput",
    "semantic": "impersonation_ended",
    "name": "bloodtrail.audit.administration.impersonation.ended"
  },
  {
    "method": "sensitiveResourceViewed",
    "inputType": "SensitiveResourceViewedEventInput",
    "semantic": "sensitive_resource_viewed",
    "name": "bloodtrail.audit.data.sensitive_resource.viewed"
  },
  {
    "method": "sensitiveResourceCreated",
    "inputType": "SensitiveResourceCreatedEventInput",
    "semantic": "sensitive_resource_created",
    "name": "bloodtrail.audit.data.sensitive_resource.created"
  },
  {
    "method": "sensitiveResourceModified",
    "inputType": "SensitiveResourceModifiedEventInput",
    "semantic": "sensitive_resource_modified",
    "name": "bloodtrail.audit.data.sensitive_resource.modified"
  },
  {
    "method": "sensitiveResourceDeleted",
    "inputType": "SensitiveResourceDeletedEventInput",
    "semantic": "sensitive_resource_deleted",
    "name": "bloodtrail.audit.data.sensitive_resource.deleted"
  },
  {
    "method": "sensitiveDataExported",
    "inputType": "SensitiveDataExportedEventInput",
    "semantic": "sensitive_data_exported",
    "name": "bloodtrail.audit.data.sensitive_data.exported"
  },
  {
    "method": "securityConfigurationChanged",
    "inputType": "SecurityConfigurationChangedEventInput",
    "semantic": "security_configuration_changed",
    "name": "bloodtrail.audit.security.configuration.changed"
  },
  {
    "method": "tenantContextViolationDetected",
    "inputType": "TenantContextViolationDetectedEventInput",
    "semantic": "tenant_context_violation_detected",
    "name": "bloodtrail.audit.tenant.context_violation.detected"
  }
] as const;

export const EXTENSION_NAMESPACES = [
  {
    "namespace": "bloodtrail.audit.enrichment.v1",
    "version": "1.0.0",
    "trust": "downstream_enrichment",
    "policy": "conditionally_allowed",
    "privacy": "restricted",
    "max_bytes": 4096,
    "allowed_fields": [
      "provenance.trust_level",
      "provenance.source",
      "provenance.version",
      "risk.level",
      "risk.reason_codes"
    ]
  }
] as const;

export const FIELD_POLICY = [
  {
    "path": "event.id",
    "authority": "event_identity_catalog",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "event.name",
    "authority": "event_identity_catalog",
    "trust": "authoritative_server",
    "privacy": "public_metadata",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "event.category",
    "authority": "event_identity_catalog",
    "trust": "authoritative_server",
    "privacy": "public_metadata",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "event.action",
    "authority": "event_identity_catalog",
    "trust": "authoritative_server",
    "privacy": "public_metadata",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "event.lifecycle_phase",
    "authority": "lifecycle_outcome_commit",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "event.outcome",
    "authority": "lifecycle_outcome_commit",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable_registry"
  },
  {
    "path": "event.outcome_reason.code",
    "authority": "lifecycle_outcome_commit",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "event.outcome_reason.message",
    "authority": "lifecycle_outcome_commit",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "event.commit_state",
    "authority": "lifecycle_outcome_commit",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "event.timestamp",
    "authority": "timestamps",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "event.observed_at",
    "authority": "timestamps",
    "trust": "observed_transport",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "event.delivery_class",
    "authority": "data_privacy_delivery",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "schema.name",
    "authority": "event_identity_catalog",
    "trust": "authoritative_server",
    "privacy": "public_metadata",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "schema.version",
    "authority": "event_identity_catalog",
    "trust": "authoritative_server",
    "privacy": "public_metadata",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "producer.name",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "producer.version",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "producer.instance_id",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "environment.name",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "service.name",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "service.version",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "service.instance_id",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "deployment.id",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "deployment.region",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "deployment.zone",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "tenant.scope",
    "authority": "tenant_context",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "tenant.actor_tenant_id",
    "authority": "tenant_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "tenant.effective_tenant_id",
    "authority": "tenant_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "tenant.resource_tenant_id",
    "authority": "tenant_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "tenant.parent_tenant_id",
    "authority": "tenant_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "additive"
  },
  {
    "path": "tenant.claimed_tenant_id",
    "authority": "claimed_identity",
    "trust": "client_claim",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "operational_short",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "additive"
  },
  {
    "path": "actor.type",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "actor.id",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "actor.tenant_id",
    "authority": "tenant_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "actor.display_name",
    "authority": "claimed_identity",
    "trust": "client_claim",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "actor.provenance.trust_level",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "actor.provenance.source",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "subject.type",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "subject.id",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "subject.tenant_id",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "subject.display_name",
    "authority": "claimed_identity",
    "trust": "client_claim",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "authenticated_principal.type",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authenticated_principal.id",
    "authority": "authenticated_identity",
    "trust": "verified_assertion",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "authenticated_principal.issuer",
    "authority": "authenticated_identity",
    "trust": "verified_assertion",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "delegation.mode",
    "authority": "delegation_impersonation",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "delegation.principal_id",
    "authority": "delegation_impersonation",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "transform_required",
    "retention": "security_elevated",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "delegation.scope",
    "authority": "delegation_impersonation",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable_registry"
  },
  {
    "path": "delegation.reason_code",
    "authority": "delegation_impersonation",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "delegation.expires_at",
    "authority": "delegation_impersonation",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "delegation.chain",
    "authority": "delegation_impersonation",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "credential.type",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "credential.reference",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "credential.key_id",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "initiator.type",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "initiator.id",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "initiator.version",
    "authority": "producer_service_deployment",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "session.id",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "session.created_at",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "session.age_seconds",
    "authority": "authenticated_identity",
    "trust": "derived_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "session.assurance_level",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authentication.method",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authentication.assurance_level",
    "authority": "authenticated_identity",
    "trust": "verified_assertion",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authentication.mfa_state",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authentication.credential_type",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authentication.authenticated_at",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authentication.identity_provider",
    "authority": "authenticated_identity",
    "trust": "verified_assertion",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authentication.account_recovery.flow",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authentication.account_recovery.state",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "authentication.account_recovery.reason_code",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authentication.failure_reason",
    "authority": "authenticated_identity",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authentication.delegated",
    "authority": "delegation_impersonation",
    "trust": "derived_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authentication.impersonated",
    "authority": "delegation_impersonation",
    "trust": "derived_server",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authorization.decision",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable_registry"
  },
  {
    "path": "authorization.policy_id",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authorization.policy_version",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authorization.capability",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authorization.enforcement_point",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authorization.decision_reason",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "authorization.resource_context.type",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authorization.resource_context.id",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "authorization.tenant_context.effective_tenant_id",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "authorization.override",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authorization.break_glass",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "policy_governed",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "authorization.policy_correlation_id",
    "authority": "authorization_context",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "source.observed.address",
    "authority": "network_observation",
    "trust": "observed_transport",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "operational_short",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "source.observed.port",
    "authority": "network_observation",
    "trust": "observed_transport",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "source.observed.proxy_chain",
    "authority": "network_observation",
    "trust": "observed_transport",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "source.client_reported.user_agent_family",
    "authority": "claimed_identity",
    "trust": "client_claim",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "source.client_reported.user_agent_version",
    "authority": "claimed_identity",
    "trust": "client_claim",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "destination.service",
    "authority": "network_observation",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "destination.address",
    "authority": "network_observation",
    "trust": "observed_transport",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "destination.port",
    "authority": "network_observation",
    "trust": "observed_transport",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "resource.type",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "resource.id",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "resource.parent_type",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "resource.parent_id",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "additive"
  },
  {
    "path": "resource.owning_tenant_id",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_standard",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "resource.data_classification",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "resource.operation_type",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "resource.bulk.count",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "resource.bulk.scope",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "resource.bulk.child_event_policy",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "resource.change_categories",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "resource.deletion_mode",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "resource.export.destination_class",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "policy_governed",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "resource.export.size_class",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "policy_governed",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "resource.export.record_count",
    "authority": "resource_context",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "policy_governed",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "request.id",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "request.method",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "request.route",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "request.user_agent",
    "authority": "claimed_identity",
    "trust": "client_claim",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "request.message_id",
    "authority": "correlation_causality",
    "trust": "observed_transport",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.trace_id",
    "authority": "correlation_causality",
    "trust": "observed_transport",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.span_id",
    "authority": "correlation_causality",
    "trust": "observed_transport",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.correlation_id",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.causation_id",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.operation_id",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.transaction_id",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_elevated",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "stable"
  },
  {
    "path": "correlation.request_id",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.message_id",
    "authority": "correlation_causality",
    "trust": "observed_transport",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.retry_attempt",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "operational_short",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "correlation.original_event_id",
    "authority": "correlation_causality",
    "trust": "authoritative_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "risk.level",
    "authority": "risk_enrichment",
    "trust": "derived_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "risk.score",
    "authority": "risk_enrichment",
    "trust": "derived_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "risk.reason_codes",
    "authority": "risk_enrichment",
    "trust": "derived_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "risk.model.name",
    "authority": "risk_enrichment",
    "trust": "derived_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "risk.model.version",
    "authority": "risk_enrichment",
    "trust": "derived_server",
    "privacy": "confidential",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "risk.model.provenance.trust_level",
    "authority": "risk_enrichment",
    "trust": "derived_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "data.classification",
    "authority": "data_privacy_delivery",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "data.retention_class",
    "authority": "data_privacy_delivery",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "registry"
  },
  {
    "path": "data.field_policy_version",
    "authority": "data_privacy_delivery",
    "trust": "authoritative_server",
    "privacy": "internal",
    "policy": "allowed",
    "retention": "security_standard",
    "redaction": "role and tenant access policy",
    "compatibility": "stable"
  },
  {
    "path": "integrity.attestations",
    "authority": "integrity_metadata",
    "trust": "authoritative_server",
    "privacy": "restricted",
    "policy": "conditionally_allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "integrity.transport_authentication.method",
    "authority": "integrity_metadata",
    "trust": "observed_transport",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "integrity.transport_authentication.verified",
    "authority": "integrity_metadata",
    "trust": "observed_transport",
    "privacy": "restricted",
    "policy": "allowed",
    "retention": "security_elevated",
    "redaction": "role and tenant access policy",
    "compatibility": "additive"
  },
  {
    "path": "integrity.transport_authentication.peer",
    "authority": "integrity_metadata",
    "trust": "observed_transport",
    "privacy": "restricted",
    "policy": "transform_required",
    "retention": "security_elevated",
    "redaction": "purpose-scoped keyed transform or approved direct-reference exception",
    "compatibility": "additive"
  }
] as const;

export const PROHIBITED_DATA_KEYS = [
  "access_token",
  "api_key",
  "card_number",
  "connection_string",
  "cookie",
  "dsn",
  "factor_content",
  "factor_value",
  "full_request",
  "full_response",
  "id_token",
  "password",
  "password_verifier",
  "payment_card",
  "private_key",
  "raw_body",
  "raw_secret",
  "raw_token",
  "recovery_code",
  "refresh_token",
  "request_body",
  "response_body",
  "secret",
  "serialized_object",
  "session_cookie"
] as const;

export const CONTRACT_ERROR_CODES = REGISTRIES.validation_error_codes;

export const SDK_ERROR_CODES = [
  "SDK_INVALID_CONFIGURATION",
  "SDK_UNSUPPORTED_CONTRACT_VERSION",
  "SDK_MISSING_AUTHORITATIVE_CONTEXT",
  "SDK_MISSING_EVENT_FIELD",
  "SDK_NOT_READY",
  "SDK_SHUTTING_DOWN",
  "SDK_SHUT_DOWN",
  "SDK_SCHEMA_VALIDATION_FAILED",
  "SDK_SEMANTIC_VALIDATION_FAILED",
  "SDK_SINK_REJECTED",
  "SDK_SINK_FAILURE",
  "SDK_SHUTDOWN_TIMEOUT",
  "SDK_INVALID_OPERATION_TRANSITION",
  "SDK_INVALID_IDENTIFIER",
  "SDK_INVALID_CLOCK",
  "SDK_HOOK_FAILURE",
  "SDK_DUPLICATE_SUCCESS",
  "SDK_OPERATION_EVENT_MISMATCH",
  "SDK_UNSUPPORTED_HOOK_RESULT"
] as const;

export type EventDefinition = (typeof EVENT_CATALOG)[number];

export type EventName = EventDefinition["name"];

export type EventSemantic = EventDefinition["semantic"];

export type EventMethodDefinition = (typeof EVENT_METHODS)[number];

export type EventMethodName = EventMethodDefinition["method"];

export type EventNameFor<S extends EventSemantic> = Extract<EventDefinition, { readonly semantic: S }>["name"];

export type EventForName<N extends EventName> = SecurityAuditEvent & { readonly event: SecurityAuditEvent["event"] & { readonly name: N } };

export type EventDefinitionForName<N extends EventName> = Extract<EventDefinition, { readonly name: N }>;

export type EventPhaseForName<N extends EventName> = EventDefinitionForName<N>["phase"][number];

export type EventOutcomeForName<N extends EventName> = EventDefinitionForName<N>["outcomes"][number];

export type EventCommitForName<N extends EventName> = EventDefinitionForName<N>["commit"][number];

export type RequiredContextForName<N extends EventName> = EventDefinitionForName<N>["required_context"][number];

export type RegistryName = keyof typeof REGISTRIES;

export type RegistryValue<N extends RegistryName> = (typeof REGISTRIES)[N][number];

export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number];

export type SdkGeneratedErrorCode = (typeof SDK_ERROR_CODES)[number];

export type AuditErrorCode = ContractErrorCode | SdkGeneratedErrorCode;

type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer I) => void ? I : never;

export interface GeneratedOperationContext {
  readonly operation_id?: string;
  readonly transaction_id?: string;
  readonly state?: "started" | "committed" | "not_committed" | "partially_committed" | "compensated" | "cancelled";
  readonly commit_state?: SecurityAuditEvent["event"]["commit_state"];
  readonly bound_event?: string;
  readonly transactional?: boolean;
}

export interface RetryRelationshipInput {
  readonly retry_attempt: number;
  readonly original_event_id: string;
  readonly causation_id?: string;
}

export interface RedeliveryInput<N extends EventName = EventName> {
  readonly event: EventForName<N>;
}

export type EventBuilderBaseInput<N extends EventName> = {
  readonly event?: {
    readonly lifecycle_phase?: EventPhaseForName<N>;
    readonly outcome?: EventOutcomeForName<N>;
    readonly outcome_reason?: SecurityAuditEvent["event"]["outcome_reason"];
    readonly commit_state?: EventCommitForName<N>;
    readonly timestamp?: string;
    readonly observed_at?: string;
  };
  readonly tenant?: SecurityAuditEvent["tenant"];
  readonly claimedTenant?: Pick<SecurityAuditEvent["tenant"], "claimed_tenant_id">;
  readonly actor?: SecurityAuditEvent["actor"];
  readonly subject?: SecurityAuditEvent["subject"];
  readonly authenticated_principal?: SecurityAuditEvent["authenticated_principal"];
  readonly delegation?: SecurityAuditEvent["delegation"];
  readonly credential?: SecurityAuditEvent["credential"];
  readonly initiator?: SecurityAuditEvent["initiator"];
  readonly session?: SecurityAuditEvent["session"];
  readonly authentication?: SecurityAuditEvent["authentication"];
  readonly authorization?: SecurityAuditEvent["authorization"];
  readonly source?: SecurityAuditEvent["source"];
  readonly destination?: SecurityAuditEvent["destination"];
  readonly resource?: SecurityAuditEvent["resource"];
  readonly request?: SecurityAuditEvent["request"];
  readonly correlation?: Partial<SecurityAuditEvent["correlation"]>;
  readonly risk?: SecurityAuditEvent["risk"];
  readonly data?: Partial<SecurityAuditEvent["data"]>;
  readonly integrity?: SecurityAuditEvent["integrity"];
  readonly extensions?: SecurityAuditEvent["extensions"];
  readonly operation?: GeneratedOperationContext;
  readonly retry?: RetryRelationshipInput;
  readonly redelivery?: RedeliveryInput<N>;
};

type RequiredContextProperty<C extends string> =
  C extends "actor" | "administrator" | "real_actor" | "real_admin_actor" | "real_actor_or_process" | "actor_or_claim" ? { readonly actor: SecurityAuditEvent["actor"] } :
  C extends "tenant" | "tenants" | "authoritative_tenants" | "tenant_or_platform_scope" ? { readonly tenant: SecurityAuditEvent["tenant"] } :
  C extends "resource" | "role" | "resource_scope" | "config_resource" | "resource_owner" ? { readonly resource: SecurityAuditEvent["resource"] } :
  C extends "authorization" | "policy" ? { readonly authorization: SecurityAuditEvent["authorization"] } :
  C extends "authentication" ? { readonly authentication: SecurityAuditEvent["authentication"] } :
  C extends "session" ? { readonly session: SecurityAuditEvent["session"] } :
  C extends "credential" ? { readonly credential: SecurityAuditEvent["credential"] } :
  C extends "source" | "request_source" ? { readonly source: SecurityAuditEvent["source"] } :
  C extends "request" ? { readonly request: SecurityAuditEvent["request"] } :
  C extends "correlation" | "original_start" ? { readonly correlation: Partial<SecurityAuditEvent["correlation"]> } :
  C extends "subject" | "impersonated_subject" ? { readonly subject: SecurityAuditEvent["subject"] } :
  C extends "principal" | "authenticated_principal" ? { readonly authenticated_principal: SecurityAuditEvent["authenticated_principal"] } :
  C extends "delegation" | "scope" | "expiry" ? { readonly delegation: SecurityAuditEvent["delegation"] } :
  C extends "operation" | "transaction" ? { readonly operation: GeneratedOperationContext } :
  C extends "change_categories" | "change_category" ? { readonly resource: SecurityAuditEvent["resource"] & { readonly change_categories: NonNullable<SecurityAuditEvent["resource"]["change_categories"]> } } :
  C extends "deletion_mode" ? { readonly resource: SecurityAuditEvent["resource"] & { readonly deletion_mode: NonNullable<SecurityAuditEvent["resource"]["deletion_mode"]> } } :
  C extends "bounded_volume" | "destination_class" ? { readonly resource: SecurityAuditEvent["resource"] & { readonly export: NonNullable<SecurityAuditEvent["resource"]["export"]> } } :
  C extends "claimed_tenant" ? { readonly claimedTenant: Pick<SecurityAuditEvent["tenant"], "claimed_tenant_id"> } :
  {};

export type EventBuilderInputForName<N extends EventName> =
  EventBuilderBaseInput<N> & UnionToIntersection<RequiredContextProperty<RequiredContextForName<N>>>;

export type AccountRegistrationAttemptedEventInput = EventBuilderInputForName<"bloodtrail.audit.account.registration.attempted">;

export type AccountRegistrationCompletedEventInput = EventBuilderInputForName<"bloodtrail.audit.account.registration.completed">;

export type AuthenticationSucceededEventInput = EventBuilderInputForName<"bloodtrail.audit.authentication.succeeded">;

export type AuthenticationFailedEventInput = EventBuilderInputForName<"bloodtrail.audit.authentication.failed">;

export type MfaEnrolledEventInput = EventBuilderInputForName<"bloodtrail.audit.authentication.mfa.enrolled">;

export type MfaRemovedEventInput = EventBuilderInputForName<"bloodtrail.audit.authentication.mfa.removed">;

export type SessionCreatedEventInput = EventBuilderInputForName<"bloodtrail.audit.session.created">;

export type SessionRevokedEventInput = EventBuilderInputForName<"bloodtrail.audit.session.revoked">;

export type PasswordResetRequestedEventInput = EventBuilderInputForName<"bloodtrail.audit.account.password_reset.requested">;

export type PasswordResetCompletedEventInput = EventBuilderInputForName<"bloodtrail.audit.account.password_reset.completed">;

export type AuthorizationAllowedEventInput = EventBuilderInputForName<"bloodtrail.audit.authorization.allowed">;

export type AuthorizationDeniedEventInput = EventBuilderInputForName<"bloodtrail.audit.authorization.denied">;

export type RoleAssignedEventInput = EventBuilderInputForName<"bloodtrail.audit.authorization.role.assigned">;

export type RoleRemovedEventInput = EventBuilderInputForName<"bloodtrail.audit.authorization.role.removed">;

export type PrivilegeElevatedEventInput = EventBuilderInputForName<"bloodtrail.audit.authorization.privilege.elevated">;

export type ImpersonationStartedEventInput = EventBuilderInputForName<"bloodtrail.audit.administration.impersonation.started">;

export type ImpersonationEndedEventInput = EventBuilderInputForName<"bloodtrail.audit.administration.impersonation.ended">;

export type SensitiveResourceViewedEventInput = EventBuilderInputForName<"bloodtrail.audit.data.sensitive_resource.viewed">;

export type SensitiveResourceCreatedEventInput = EventBuilderInputForName<"bloodtrail.audit.data.sensitive_resource.created">;

export type SensitiveResourceModifiedEventInput = EventBuilderInputForName<"bloodtrail.audit.data.sensitive_resource.modified">;

export type SensitiveResourceDeletedEventInput = EventBuilderInputForName<"bloodtrail.audit.data.sensitive_resource.deleted">;

export type SensitiveDataExportedEventInput = EventBuilderInputForName<"bloodtrail.audit.data.sensitive_data.exported">;

export type SecurityConfigurationChangedEventInput = EventBuilderInputForName<"bloodtrail.audit.security.configuration.changed">;

export type TenantContextViolationDetectedEventInput = EventBuilderInputForName<"bloodtrail.audit.tenant.context_violation.detected">;

export type NamedAuditEventInputMap = {
  readonly "accountRegistrationAttempted": AccountRegistrationAttemptedEventInput;
  readonly "accountRegistrationCompleted": AccountRegistrationCompletedEventInput;
  readonly "authenticationSucceeded": AuthenticationSucceededEventInput;
  readonly "authenticationFailed": AuthenticationFailedEventInput;
  readonly "mfaEnrolled": MfaEnrolledEventInput;
  readonly "mfaRemoved": MfaRemovedEventInput;
  readonly "sessionCreated": SessionCreatedEventInput;
  readonly "sessionRevoked": SessionRevokedEventInput;
  readonly "passwordResetRequested": PasswordResetRequestedEventInput;
  readonly "passwordResetCompleted": PasswordResetCompletedEventInput;
  readonly "authorizationAllowed": AuthorizationAllowedEventInput;
  readonly "authorizationDenied": AuthorizationDeniedEventInput;
  readonly "roleAssigned": RoleAssignedEventInput;
  readonly "roleRemoved": RoleRemovedEventInput;
  readonly "privilegeElevated": PrivilegeElevatedEventInput;
  readonly "impersonationStarted": ImpersonationStartedEventInput;
  readonly "impersonationEnded": ImpersonationEndedEventInput;
  readonly "sensitiveResourceViewed": SensitiveResourceViewedEventInput;
  readonly "sensitiveResourceCreated": SensitiveResourceCreatedEventInput;
  readonly "sensitiveResourceModified": SensitiveResourceModifiedEventInput;
  readonly "sensitiveResourceDeleted": SensitiveResourceDeletedEventInput;
  readonly "sensitiveDataExported": SensitiveDataExportedEventInput;
  readonly "securityConfigurationChanged": SecurityConfigurationChangedEventInput;
  readonly "tenantContextViolationDetected": TenantContextViolationDetectedEventInput;
};
