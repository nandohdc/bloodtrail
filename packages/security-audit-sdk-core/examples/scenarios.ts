import { setTimeout as delay } from "node:timers/promises";
import {
  administratorActor,
  anonymousActor,
  apiCredentialActor,
  authoritativeResource,
  authoritativeTenant,
  claimedTenant,
  impersonationContext,
  registeredEnrichmentExtension,
} from "@bloodtrail/security-audit-sdk-core";
import {
  createExampleHarness,
  requireSuccess,
  syntheticActor,
  syntheticAuthentication,
  syntheticAuthorization,
  syntheticCredential,
  syntheticPrincipal,
  syntheticRequest,
  syntheticResource,
  syntheticSession,
  syntheticSource,
  syntheticSubject,
  syntheticTenant,
} from "./support.js";

export async function authenticationSuccess() {
  const { audit, sink } = createExampleHarness(100);
  requireSuccess(await audit.authenticationSucceeded(authenticationInput()));
  return requiredLastEvent(sink.events);
}

export async function authorizationDenial() {
  const { audit, sink } = createExampleHarness(200);
  const resource = syntheticResource("authorization_policy", "synthetic-policy-resource", "execute");
  requireSuccess(await audit.authorizationDenied({
    actor: apiCredentialActor({ id: "synthetic-api-credential", tenantId: "tenant-alpha" }),
    tenant: syntheticTenant(),
    resource,
    authorization: syntheticAuthorization(
      "deny",
      "evaluate_authorization",
      "authorization_policy",
      "synthetic-policy-resource",
    ),
    source: syntheticSource("192.0.2.20"),
  }));
  return requiredLastEvent(sink.events);
}

export async function crossTenantDenial() {
  const { audit, sink } = createExampleHarness(300);
  const targetTenant = "tenant-beta";
  requireSuccess(await audit.tenantContextViolationDetected({
    actor: anonymousActor("synthetic-request-boundary"),
    tenant: authoritativeTenant({
      scope: "cross_tenant",
      actor_tenant_id: "tenant-platform",
      effective_tenant_id: targetTenant,
      resource_tenant_id: targetTenant,
    }),
    claimedTenant: claimedTenant("tenant-alpha"),
    resource: syntheticResource("tenant", targetTenant, "execute", targetTenant),
    source: syntheticSource("192.0.2.30"),
    authorization: syntheticAuthorization(
      "deny",
      "detect_tenant_violation",
      "tenant",
      targetTenant,
      targetTenant,
    ),
  }));
  return requiredLastEvent(sink.events);
}

export async function roleAssignment() {
  const { audit, sink } = createExampleHarness(400);
  const operation = requireSuccess(audit.beginOperation({ boundEvent: "roleAssigned" }));
  requireSuccess(operation.markCommitted());
  requireSuccess(await audit.roleAssigned({
    actor: administratorActor({ id: "synthetic-administrator", tenantId: "tenant-alpha" }),
    subject: syntheticSubject("role", "synthetic-role-subject"),
    tenant: syntheticTenant(),
    resource: syntheticResource("role", "synthetic-role", "administer", "tenant-alpha", {
      change_categories: ["metadata"],
    }),
    authorization: syntheticAuthorization("allow", "assign_role", "role", "synthetic-role"),
    operation,
    event: { outcome_reason: { code: "completed" } },
  }));
  return requiredLastEvent(sink.events);
}

export async function administrativeImpersonation() {
  const { audit, sink } = createExampleHarness(500);
  const targetTenant = "tenant-beta";
  const operation = requireSuccess(audit.beginOperation({ boundEvent: "impersonationStarted" }));
  requireSuccess(operation.markCommitted());
  requireSuccess(await audit.impersonationStarted({
    actor: administratorActor({ id: "synthetic-platform-administrator", tenantId: "tenant-platform" }),
    subject: syntheticSubject("impersonation_session", "synthetic-impersonated-session", targetTenant),
    tenant: authoritativeTenant({
      scope: "cross_tenant",
      actor_tenant_id: "tenant-platform",
      effective_tenant_id: targetTenant,
      resource_tenant_id: targetTenant,
    }),
    delegation: impersonationContext({
      principal_id: "synthetic-impersonated-principal",
      scope: ["start_impersonation"],
      reason_code: "operator_requested",
      expires_at: "2026-07-31T13:00:00.000Z",
    }),
    session: syntheticSession("synthetic-impersonation-session-reference"),
    authentication: syntheticAuthentication({ impersonated: true }),
    resource: syntheticResource(
      "impersonation_session",
      "synthetic-impersonated-session",
      "administer",
      targetTenant,
    ),
    authorization: syntheticAuthorization(
      "allow",
      "start_impersonation",
      "impersonation_session",
      "synthetic-impersonated-session",
      targetTenant,
    ),
    operation,
  }));
  return requiredLastEvent(sink.events);
}

export async function sensitiveResourceModification() {
  const { audit, sink } = createExampleHarness(600);
  const operation = requireSuccess(audit.beginOperation({ boundEvent: "sensitiveResourceModified" }));
  requireSuccess(operation.markCommitted());
  requireSuccess(await audit.sensitiveResourceModified({
    actor: syntheticActor("synthetic-editor"),
    tenant: syntheticTenant(),
    resource: authoritativeResource({
      type: "sensitive_record",
      id: "synthetic-record",
      owning_tenant_id: "tenant-alpha",
      data_classification: "confidential",
      operation_type: "update",
      change_categories: ["metadata"],
    }),
    authorization: syntheticAuthorization("allow", "modify", "sensitive_record", "synthetic-record"),
    operation,
  }));
  return requiredLastEvent(sink.events);
}

export async function sensitiveDataExport() {
  const { audit, sink } = createExampleHarness(700);
  const operation = requireSuccess(audit.beginOperation({ boundEvent: "sensitiveDataExported" }));
  requireSuccess(operation.markCommitted());
  requireSuccess(await audit.sensitiveDataExported({
    actor: apiCredentialActor({ id: "synthetic-export-credential", tenantId: "tenant-alpha" }),
    tenant: syntheticTenant(),
    resource: authoritativeResource({
      type: "sensitive_collection",
      id: "synthetic-collection",
      owning_tenant_id: "tenant-alpha",
      data_classification: "confidential",
      operation_type: "export",
      bulk: { count: 12, scope: "synthetic-bounded-scope", child_event_policy: "aggregate_only" },
      export: {
        destination_class: "tenant_authorized_download",
        size_class: "small",
        record_count: 12,
      },
    }),
    authorization: syntheticAuthorization("allow", "export", "sensitive_collection", "synthetic-collection"),
    operation,
  }));
  return requiredLastEvent(sink.events);
}

export async function asynchronousCompletion() {
  const { audit, sink } = createExampleHarness(800);
  const operation = requireSuccess(audit.beginOperation({ boundEvent: "accountRegistrationCompleted" }));
  requireSuccess(operation.markCommitted());
  requireSuccess(await audit.accountRegistrationCompleted({
    actor: syntheticActor("synthetic-registration-actor"),
    tenant: syntheticTenant(),
    subject: syntheticSubject("account", "synthetic-account-subject"),
    resource: syntheticResource("account", "synthetic-account", "create", "tenant-alpha", {
      change_categories: ["metadata"],
    }),
    correlation: {
      causation_id: "44444444-4444-4444-8444-000000000001",
      original_event_id: "44444444-4444-4444-8444-000000000001",
    },
    operation,
  }));
  return requiredLastEvent(sink.events);
}

export async function retryReexecution() {
  const { audit, sink } = createExampleHarness(900);
  const input = authenticationInput("tenant-alpha", "synthetic-retry-actor");
  requireSuccess(await audit.authenticationSucceeded(input));
  const original = requiredLastEvent(sink.events);
  requireSuccess(await audit.authenticationSucceeded({
    ...input,
    retry: {
      retry_attempt: 1,
      original_event_id: original.event.id,
      causation_id: original.event.id,
    },
  }));
  const retried = requiredLastEvent(sink.events);
  return { original, retried };
}

export async function transactionAwareSuccess() {
  const { audit, sink } = createExampleHarness(1_000);
  const operation = requireSuccess(audit.beginOperation({ boundEvent: "sensitiveResourceCreated" }));
  requireSuccess(operation.markCommitted());
  requireSuccess(await audit.sensitiveResourceCreated({
    actor: syntheticActor("synthetic-creator"),
    tenant: syntheticTenant(),
    resource: syntheticResource("sensitive_record", "synthetic-created-record", "create", "tenant-alpha", {
      change_categories: ["metadata"],
    }),
    authorization: syntheticAuthorization("allow", "create", "sensitive_record", "synthetic-created-record"),
    operation,
  }));
  return requiredLastEvent(sink.events);
}

export async function authorizationAllowThenFailure() {
  const { audit, sink } = createExampleHarness(1_100);
  const operation = requireSuccess(audit.beginOperation({ boundEvent: "sensitiveResourceCreated" }));
  requireSuccess(operation.markNotCommitted());
  requireSuccess(await audit.sensitiveResourceCreated({
    actor: syntheticActor("synthetic-failing-creator"),
    tenant: syntheticTenant(),
    resource: syntheticResource("sensitive_record", "synthetic-failed-record", "create", "tenant-alpha", {
      change_categories: ["metadata"],
    }),
    authorization: syntheticAuthorization("allow", "create", "sensitive_record", "synthetic-failed-record"),
    operation,
    event: { outcome_reason: { code: "commit_failed" } },
  }));
  return requiredLastEvent(sink.events);
}

export async function privacyTransformation() {
  const { audit, sink } = createExampleHarness(1_200, [{
    path: "actor.id",
    transform: ({ value, purpose, tenantId }) => ({
      value: `pseudonym-${tenantId ?? "none"}-${purpose}-${value}`,
      key_id: "synthetic-key-version-1",
    }),
  }]);
  requireSuccess(await audit.authenticationSucceeded(authenticationInput("tenant-alpha", "synthetic-private-actor")));
  return requiredLastEvent(sink.events);
}

export async function registeredExtension() {
  const { audit, sink } = createExampleHarness(1_300);
  requireSuccess(await audit.authenticationSucceeded({
    ...authenticationInput(),
    extensions: registeredEnrichmentExtension({
      "bloodtrail.audit.enrichment.v1": {
        provenance: {
          trust_level: "downstream_enrichment",
          source: "synthetic-enricher",
          version: "1.0.0",
        },
        risk: { level: "low", reason_codes: ["policy_baseline"] },
      },
    }),
  }));
  return requiredLastEvent(sink.events);
}

export async function concurrentContexts() {
  const { audit, sink } = createExampleHarness(1_400);
  await Promise.all([
    audit.runWithContext({ tenant: syntheticTenant("tenant-alpha") }, async () => {
      await delay(5);
      requireSuccess(await audit.passwordResetRequested({
        actor: syntheticActor("synthetic-context-actor-alpha", "tenant-alpha"),
        request: syntheticRequest("synthetic-context-request-alpha"),
        source: syntheticSource("192.0.2.41"),
        correlation: { correlation_id: "synthetic-correlation-alpha", operation_id: "synthetic-operation-alpha" },
      }));
    }),
    audit.runWithContext({ tenant: syntheticTenant("tenant-beta") }, async () => {
      requireSuccess(await audit.passwordResetRequested({
        actor: syntheticActor("synthetic-context-actor-beta", "tenant-beta"),
        request: syntheticRequest("synthetic-context-request-beta"),
        source: syntheticSource("192.0.2.42"),
        correlation: { correlation_id: "synthetic-correlation-beta", operation_id: "synthetic-operation-beta" },
      }));
    }),
  ]);
  return sink.events;
}

export async function deterministicTesting() {
  const { audit, sink } = createExampleHarness(1_500);
  requireSuccess(await audit.authenticationSucceeded(authenticationInput()));
  return requiredLastEvent(sink.events);
}

function authenticationInput(tenantId = "tenant-alpha", actorId = "synthetic-authenticated-actor") {
  return {
    actor: syntheticActor(actorId, tenantId),
    tenant: syntheticTenant(tenantId),
    authenticated_principal: syntheticPrincipal(`synthetic-principal-${tenantId}`),
    authentication: syntheticAuthentication(),
    credential: syntheticCredential(`synthetic-credential-${tenantId}`),
    session: syntheticSession(`synthetic-session-${tenantId}`),
    source: syntheticSource(),
  } as const;
}

function requiredLastEvent<T>(events: readonly T[]): T {
  const event = events.at(-1);
  if (event === undefined) throw new Error("example emitted no event");
  return event;
}
