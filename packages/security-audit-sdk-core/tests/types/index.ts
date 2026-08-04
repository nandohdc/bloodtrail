import {
  CONTRACT_ERROR_CODES,
  SDK_ERROR_CODES,
  createSecurityAuditSdk,
  type AuditEventSink,
  type AuthenticationSucceededEventInput,
  type EventName,
  type MfaEnrolledEventInput,
  type SecurityAuditEvent,
} from "../../src/index.js";

const sink: AuditEventSink = { async emit() { return { status: "accepted" }; } };
const sdk = createSecurityAuditSdk({
  contractVersion: "1.0.0",
  producer: { name: "producer", version: "1.0.0" },
  service: { name: "service", version: "1.0.0" },
  environment: { name: "test" },
  sink,
  retention: { recentGeneratedEventIds: 4096, recentIssuedOperationIds: 4096 },
});
// @ts-expect-error retention capacities are numeric, not strings
createSecurityAuditSdk({ contractVersion: "1.0.0", producer: { name: "p", version: "1.0.0" }, service: { name: "s" }, environment: { name: "e" }, sink, retention: { recentGeneratedEventIds: "4096" } });
const known: EventName = "bloodtrail.audit.authentication.succeeded";
void known;
// @ts-expect-error unsupported contract versions must not type-check
createSecurityAuditSdk({ contractVersion: "2.0.0", producer: { name: "p", version: "1.0.0" }, service: { name: "s" }, environment: { name: "e" }, sink });
// @ts-expect-error arbitrary event names must not type-check
const unknownName: EventName = "example.arbitrary";
void unknownName;

const acceptedTenant: SecurityAuditEvent["tenant"] = { scope: "tenant" };
void acceptedTenant;
declare const completeRedeliveryEvent: SecurityAuditEvent;
const redeliveryInput: Parameters<typeof sdk.redeliver>[0] = completeRedeliveryEvent;
const redeliveryArity: Parameters<typeof sdk.redeliver>["length"] = 1;
void redeliveryArity;
void sdk.redeliver(redeliveryInput);
// @ts-expect-error redelivery requires a complete canonical event
void sdk.redeliver({});
// @ts-expect-error redelivery has no retry, reconstruction, or transport options argument
void sdk.redeliver(redeliveryInput, { retry: true });
// @ts-expect-error generated controlled tenant scopes reject unknown values
const badTenant: SecurityAuditEvent["tenant"] = { scope: "caller_claimed" };
void badTenant;
// @ts-expect-error generated event type preserves required top-level fields
const missingRequiredFields: SecurityAuditEvent = {};
void missingRequiredFields;
// @ts-expect-error generated extension type rejects unregistered namespaces
const badExtensions: NonNullable<SecurityAuditEvent["extensions"]> = { "bloodtrail.audit.unregistered.v1": {} };
void badExtensions;

const actor: SecurityAuditEvent["actor"] = {
  type: "authenticated_human",
  id: "actor",
  tenant_id: "tenant",
  provenance: { trust_level: "authoritative_server", source: "test" },
};
const tenant: SecurityAuditEvent["tenant"] = {
  scope: "tenant",
  actor_tenant_id: "tenant",
  effective_tenant_id: "tenant",
  resource_tenant_id: "tenant",
};
const resource: SecurityAuditEvent["resource"] = { type: "credential", id: "credential", owning_tenant_id: "tenant", operation_type: "create" };
const authentication: SecurityAuditEvent["authentication"] = { method: "password", credential_type: "password", mfa_state: "satisfied" };
const credential: SecurityAuditEvent["credential"] = { type: "password", reference: "credential_ref" };
const session: SecurityAuditEvent["session"] = { id: "session_ref" };
const source: SecurityAuditEvent["source"] = { observed: { address: "203.0.113.1" } };
const authorization: SecurityAuditEvent["authorization"] = {
  decision: "allow",
  policy_id: "policy",
  policy_version: "1.0.0",
  capability: "enroll_mfa",
  enforcement_point: "pep",
};
const correlation: Partial<SecurityAuditEvent["correlation"]> = { correlation_id: "corr", operation_id: "op" };
const issuedOperation = sdk.beginOperation();
if (!issuedOperation.ok) throw new Error(issuedOperation.error.code);
const operation = issuedOperation.value;
const authenticationSucceededInput: Omit<AuthenticationSucceededEventInput, "operation"> = {
  actor,
  authenticated_principal: { type: "human_user", id: "principal" },
  authentication,
  credential,
  session,
  source,
  tenant,
  resource,
};
void authenticationSucceededInput;
sdk.authenticationSucceeded(authenticationSucceededInput);
sdk.accountRegistrationAttempted({ actor, tenant, request: { id: "request" }, source, correlation });
sdk.accountRegistrationCompleted({ actor, tenant, subject: { type: "account", id: "account" }, resource, correlation, operation });
sdk.authenticationFailed({ actor, authentication, source, request: { id: "request" }, correlation });
sdk.mfaEnrolled({ actor, subject: { type: "credential", id: "credential" }, tenant, authentication, authorization, resource, operation });
sdk.mfaRemoved({ actor, subject: { type: "credential", id: "credential" }, tenant, authentication, authorization, resource, operation });
sdk.sessionCreated({ authenticated_principal: { type: "human_user", id: "principal" }, authentication, session, tenant, source, actor, resource });
sdk.sessionRevoked({ actor, subject: { type: "session", id: "session" }, tenant, authorization, correlation, resource, operation });
sdk.passwordResetRequested({ actor, request: { id: "request" }, source, correlation, tenant, resource });
sdk.passwordResetCompleted({ actor, subject: { type: "credential", id: "credential" }, tenant, authentication, session, correlation, resource, operation });
sdk.authorizationAllowed({ actor, tenant, resource, authorization, request: { id: "request" } });
sdk.authorizationDenied({ actor, tenant, resource, authorization: { ...authorization, decision: "deny" }, source });
sdk.roleAssigned({ actor, subject: { type: "role", id: "role" }, tenant, resource, authorization, event: { outcome_reason: { code: "accepted" } }, operation });
sdk.roleRemoved({ actor, subject: { type: "role", id: "role" }, tenant, resource, authorization, event: { outcome_reason: { code: "accepted" } }, operation });
sdk.privilegeElevated({ actor, subject: { type: "privilege_grant", id: "grant" }, delegation: { mode: "delegated", principal_id: "principal", expires_at: "2026-07-31T13:00:00.000Z" }, tenant, authorization, event: { outcome_reason: { code: "break_glass" } }, resource, operation });
sdk.impersonationStarted({ actor, subject: { type: "impersonation_session", id: "imp" }, tenant, delegation: { mode: "impersonation", principal_id: "principal", expires_at: "2026-07-31T13:00:00.000Z" }, authorization, session, resource, operation });
sdk.impersonationEnded({ actor, subject: { type: "impersonation_session", id: "imp" }, correlation, event: { outcome_reason: { code: "operator_requested" } }, resource, delegation: { mode: "impersonation", principal_id: "principal", expires_at: "2026-07-31T13:00:00.000Z" }, operation });
sdk.sensitiveResourceViewed({ actor, authenticated_principal: { type: "human_user", id: "principal" }, tenant, resource, authorization, request: { id: "request" } });
sdk.sensitiveResourceCreated({ actor, tenant, resource, authorization, operation });
sdk.sensitiveResourceModified({ actor, tenant, resource: { ...resource, change_categories: ["metadata"] }, authorization, operation });
sdk.sensitiveResourceDeleted({ actor, tenant, resource: { ...resource, deletion_mode: "soft" }, authorization, operation });
sdk.sensitiveDataExported({ actor, tenant, resource: { ...resource, export: { record_count: 1, destination_class: "internal" } }, authorization });
sdk.securityConfigurationChanged({ actor, tenant, resource: { ...resource, change_categories: ["policy"] }, authorization });
sdk.tenantContextViolationDetected({ actor, tenant, claimedTenant: { claimed_tenant_id: "tenant_claim" }, resource, authorization: { ...authorization, decision: "deny" }, source });

const forgedOperation = { operation_id: "op", transaction_id: "txn", state: "committed", commit_state: "committed" } as const;
// @ts-expect-error named methods reject structural operation commit claims
sdk.sensitiveResourceCreated({ actor, tenant, resource, authorization, operation: forgedOperation });
// @ts-expect-error observational snapshots are not trusted named-method evidence
sdk.sensitiveResourceCreated({ actor, tenant, resource, authorization, operation: operation.snapshot() });

// @ts-expect-error event-specific outcome for authentication success is fixed to success
const badAuthenticationOutcome: AuthenticationSucceededEventInput = { ...authenticationSucceededInput, event: { outcome: "failure" } };
void badAuthenticationOutcome;
// @ts-expect-error mfa enrollment requires actor in the generated input type
const missingActorMfa: MfaEnrolledEventInput = { tenant, authentication, authorization, resource };
void missingActorMfa;
// @ts-expect-error no arbitrary named API exists
sdk.unregisteredCatalogEvent({});
const contractCode = CONTRACT_ERROR_CODES[0];
const sdkCode = SDK_ERROR_CODES[0];
const invalidInputCode: (typeof SDK_ERROR_CODES)[number] = "SDK_INVALID_INPUT";
const serializationFailureCode: (typeof SDK_ERROR_CODES)[number] = "FIELD_SERIALIZATION_FAILED";
void contractCode;
void sdkCode;
void invalidInputCode;
void serializationFailureCode;
