import {
  authenticatedHumanActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeResource,
  authoritativeSubject,
  authoritativeTenant,
  authorizationEvidence,
  credentialReference,
  createSecurityAuditSdk,
  observedSource,
  sessionEvidence,
  type AuditFieldTransformationHook,
  type AuditIdentifierProvider,
  type AuditResult,
  type SecurityAuditSdk,
} from "@bloodtrail/security-audit-sdk-core";
import {
  createCapturingAuditSink,
  type CapturingAuditSink,
} from "@bloodtrail/security-audit-sdk-core/testing";

export const SYNTHETIC_TIME = "2026-07-31T12:00:00.000Z";

export interface ExampleHarness {
  readonly audit: SecurityAuditSdk;
  readonly sink: CapturingAuditSink;
}

export function createExampleHarness(
  seed = 1,
  transformations: readonly AuditFieldTransformationHook[] = [],
): ExampleHarness {
  const sink = createCapturingAuditSink();
  const audit = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: {
      name: "synthetic-audit-producer",
      version: "0.1.0",
      instance_id: "synthetic-producer-instance",
    },
    service: { name: "synthetic-service", version: "0.1.0" },
    environment: { name: "test" },
    deployment: { id: "synthetic-deployment", region: "local", zone: "local-a" },
    sink,
    clock: Object.freeze({ now: () => new Date(SYNTHETIC_TIME) }),
    identifiers: deterministicIdentifiers(seed),
    transformations,
    shutdownTimeoutMs: 100,
  });
  return { audit, sink };
}

export function deterministicIdentifiers(seed = 1): AuditIdentifierProvider {
  let counter = seed;
  const next = () => `33333333-3333-4333-8333-${String(counter++).padStart(12, "0")}`;
  return Object.freeze({
    eventId: next,
    operationId: next,
    correlationId: next,
    causationId: next,
    requestId: next,
    messageId: next,
    transactionId: next,
  });
}

export function syntheticActor(id = "synthetic-actor", tenantId = "tenant-alpha") {
  return authenticatedHumanActor({
    id,
    tenantId,
    source: "synthetic-server-authentication-authority",
  });
}

export function syntheticTenant(tenantId = "tenant-alpha") {
  return authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: tenantId,
    effective_tenant_id: tenantId,
    resource_tenant_id: tenantId,
  });
}

export function syntheticPrincipal(id = "synthetic-principal") {
  return authenticatedPrincipal({
    type: "human_user",
    id,
    issuer: "https://idp.example.test",
  });
}

export function syntheticAuthentication(overrides: Parameters<typeof authenticationEvidence>[0] = {}) {
  return authenticationEvidence({
    method: "password_mfa",
    assurance_level: "aal2",
    mfa_state: "satisfied",
    credential_type: "session",
    authenticated_at: SYNTHETIC_TIME,
    identity_provider: "https://idp.example.test",
    delegated: false,
    impersonated: false,
    ...overrides,
  });
}

export function syntheticCredential(reference = "synthetic-credential-reference") {
  return credentialReference({ type: "session", reference, key_id: "synthetic-key-version-1" });
}

export function syntheticSession(id = "synthetic-session-reference") {
  return sessionEvidence({
    id,
    created_at: SYNTHETIC_TIME,
    age_seconds: 60,
    assurance_level: "aal2",
  });
}

export function syntheticSource(address = "192.0.2.10") {
  return observedSource({
    observed: { address, port: 443 },
    client_reported: { user_agent_family: "SyntheticClient", user_agent_version: "1" },
  });
}

export function syntheticRequest(id = "synthetic-request") {
  return {
    id,
    message_id: `${id}-message`,
    method: "POST",
    route: "/synthetic/resources/{id}",
    user_agent: "SyntheticClient/1",
  } as const;
}

export function syntheticResource<const T extends Partial<Parameters<typeof authoritativeResource>[0]> = Record<never, never>>(
  type: NonNullable<Parameters<typeof authoritativeResource>[0]["type"]>,
  id: string,
  operationType: Parameters<typeof authoritativeResource>[0]["operation_type"],
  tenantId = "tenant-alpha",
  extra?: T,
) {
  return authoritativeResource({
    type,
    id,
    owning_tenant_id: tenantId,
    data_classification: "confidential",
    operation_type: operationType,
    ...extra,
  });
}

export function syntheticSubject(
  type: NonNullable<Parameters<typeof authoritativeSubject>[0]["type"]>,
  id: string,
  tenantId = "tenant-alpha",
) {
  return authoritativeSubject({ type, id, tenant_id: tenantId });
}

export function syntheticAuthorization(
  decision: NonNullable<Parameters<typeof authorizationEvidence>[0]["decision"]>,
  capability: string,
  resourceType: string,
  resourceId: string,
  tenantId = "tenant-alpha",
) {
  return authorizationEvidence({
    decision,
    policy_id: "synthetic-policy",
    policy_version: "1.0.0",
    capability,
    enforcement_point: "synthetic-policy-enforcement-point",
    decision_reason: decision === "deny" ? "policy_denied" : "accepted",
    resource_context: { type: resourceType, id: resourceId },
    tenant_context: { effective_tenant_id: tenantId },
    override: false,
    break_glass: false,
    policy_correlation_id: `synthetic-policy-${resourceId}`,
  });
}

export function requireSuccess<T>(result: AuditResult<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
