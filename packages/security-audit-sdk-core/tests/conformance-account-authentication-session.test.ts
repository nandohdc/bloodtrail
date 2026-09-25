import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  authenticatedHumanActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeResource,
  authoritativeSubject,
  authoritativeTenant,
  authorizationEvidence,
  credentialReference,
  observedSource,
  sessionEvidence,
} from "../dist/index.js";
import {
  assertInvalidConformanceRow,
  assertValidConformanceRow,
  createCommittedOperation,
  createConformanceSdk,
  createDeterministicClock,
  createDeterministicProviders,
  type InvalidConformanceRow,
  type ValidConformanceRow,
} from "./conformance-harness.js";

const syntheticTenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-conformance-1",
  effective_tenant_id: "tenant-conformance-1",
  resource_tenant_id: "tenant-conformance-1",
});

const syntheticHumanActor = authenticatedHumanActor({
  id: "actor-human-conformance-1",
  displayName: "User One",
});

const syntheticPrincipal = authenticatedPrincipal({
  type: "human_user",
  id: "principal-conformance-1",
  issuer: "https://idp.example.test",
});

const syntheticAuthEvidence = authenticationEvidence({
  method: "password_mfa",
  assurance_level: "aal2",
  mfa_state: "satisfied",
  credential_type: "session",
  authenticated_at: "2026-07-31T11:55:00.000Z",
  identity_provider: "https://idp.example.test",
  delegated: false,
  impersonated: false,
});

const syntheticSession = sessionEvidence({
  id: "session-conformance-1",
  created_at: "2026-07-31T11:55:00.000Z",
  age_seconds: 300,
  assurance_level: "aal2",
});

const syntheticCredential = credentialReference({
  type: "session",
  reference: "cred-conformance-1",
  key_id: "pseudonym-key-v1",
});

const syntheticSource = observedSource({
  observed: {
    address: "203.0.113.10",
    port: 443,
  },
});

const syntheticSubject = authoritativeSubject({
  type: "account",
  id: "account-conformance-1",
  tenant_id: "tenant-conformance-1",
});

const syntheticResource = authoritativeResource({
  type: "account",
  id: "account-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "create",
  change_categories: ["metadata"],
});

const syntheticAuthz = authorizationEvidence({
  decision: "allow",
  policy_id: "policy.conformance-1",
  policy_version: "1.0.0",
  capability: "admin",
  enforcement_point: "gateway",
  decision_reason: "accepted",
});

export const ACCOUNT_AUTH_SESSION_VALID_ROWS: readonly ValidConformanceRow[] = Object.freeze([
  {
    name: "account.registration.attempted",
    method: "accountRegistrationAttempted",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      request: {
        id: "req-reg-attempt",
        method: "POST",
        route: "/api/v1/accounts/register",
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000001",
        operation_id: "22222222-2222-4222-8222-000000000002",
      },
    },
  },
  {
    name: "account.registration.completed",
    method: "accountRegistrationCompleted",
    operation: {
      boundEvent: "accountRegistrationCompleted",
      operationId: "22222222-2222-4222-8222-000000000010",
      transactionId: "22222222-2222-4222-8222-000000000011",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      subject: syntheticSubject,
      resource: syntheticResource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000012",
        causation_id: "22222222-2222-4222-8222-000000000001",
        original_event_id: "22222222-2222-4222-8222-000000000001",
      },
    },
  },
  {
    name: "account.password_reset.requested",
    method: "passwordResetRequested",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      request: {
        id: "req-pwd-reset-req",
        method: "POST",
        route: "/api/v1/auth/password-reset/request",
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000021",
        operation_id: "22222222-2222-4222-8222-000000000022",
      },
    },
  },
  {
    name: "account.password_reset.completed",
    method: "passwordResetCompleted",
    operation: {
      boundEvent: "passwordResetCompleted",
      operationId: "22222222-2222-4222-8222-000000000030",
      transactionId: "22222222-2222-4222-8222-000000000031",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      subject: syntheticSubject,
      authentication: syntheticAuthEvidence,
      session: syntheticSession,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000032",
        causation_id: "22222222-2222-4222-8222-000000000021",
        original_event_id: "22222222-2222-4222-8222-000000000021",
      },
    },
  },
  {
    name: "authentication.succeeded",
    method: "authenticationSucceeded",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      authenticated_principal: syntheticPrincipal,
      authentication: syntheticAuthEvidence,
      credential: syntheticCredential,
      session: syntheticSession,
      source: syntheticSource,
    },
  },
  {
    name: "authentication.failed",
    method: "authenticationFailed",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      authentication: syntheticAuthEvidence,
      source: syntheticSource,
      request: {
        id: "req-auth-failed",
        method: "POST",
        route: "/api/v1/auth/login",
      },
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000041",
        operation_id: "22222222-2222-4222-8222-000000000042",
      },
      event: {
        outcome_reason: {
          code: "credential_invalid",
        },
      },
    },
  },
  {
    name: "authentication.mfa.enrolled",
    method: "mfaEnrolled",
    operation: {
      boundEvent: "mfaEnrolled",
      operationId: "22222222-2222-4222-8222-000000000050",
      transactionId: "22222222-2222-4222-8222-000000000051",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      subject: syntheticSubject,
      authentication: syntheticAuthEvidence,
      authorization: syntheticAuthz,
      resource: syntheticResource,
    },
  },
  {
    name: "authentication.mfa.removed",
    method: "mfaRemoved",
    operation: {
      boundEvent: "mfaRemoved",
      operationId: "22222222-2222-4222-8222-000000000060",
      transactionId: "22222222-2222-4222-8222-000000000061",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      subject: syntheticSubject,
      authentication: syntheticAuthEvidence,
      authorization: syntheticAuthz,
      resource: syntheticResource,
    },
  },
  {
    name: "session.created",
    method: "sessionCreated",
    input: {
      actor: syntheticHumanActor,
      authenticated_principal: syntheticPrincipal,
      authentication: syntheticAuthEvidence,
      session: syntheticSession,
      tenant: syntheticTenant,
      source: syntheticSource,
    },
  },
  {
    name: "session.revoked",
    method: "sessionRevoked",
    operation: {
      boundEvent: "sessionRevoked",
      operationId: "22222222-2222-4222-8222-000000000070",
      transactionId: "22222222-2222-4222-8222-000000000071",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      subject: syntheticSubject,
      authorization: syntheticAuthz,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000072",
        operation_id: "22222222-2222-4222-8222-000000000070",
      },
    },
  },
]);

export const ACCOUNT_AUTH_SESSION_INVALID_ROWS: readonly InvalidConformanceRow[] = Object.freeze([
  {
    name: "accountRegistrationAttempted missing tenant context",
    method: "accountRegistrationAttempted",
    input: {
      actor: syntheticHumanActor,
      request: {
        id: "req-invalid",
        method: "POST",
        route: "/register",
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000091",
        operation_id: "22222222-2222-4222-8222-000000000092",
      },
    },
    expectedCode: "MISSING_TENANT_CONTEXT",
    expectedPath: "/tenant",
  },
  {
    name: "accountRegistrationCompleted missing correlation ids",
    method: "accountRegistrationCompleted",
    operation: {
      boundEvent: "accountRegistrationCompleted",
      operationId: "22222222-2222-4222-8222-000000000093",
      transactionId: "22222222-2222-4222-8222-000000000094",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      subject: syntheticSubject,
      resource: syntheticResource,
    },
    expectedCode: "BAD_CAUSALITY",
    expectedPath: "/correlation",
  },
]);

for (const row of ACCOUNT_AUTH_SESSION_VALID_ROWS) {
  test(`conformance valid: ${row.name} (${row.method})`, async () => {
    const context = createConformanceSdk();
    await assertValidConformanceRow(row, { sdkContext: context });
  });
}

for (const row of ACCOUNT_AUTH_SESSION_INVALID_ROWS) {
  test(`conformance invalid: ${row.name}`, async () => {
    const context = createConformanceSdk();
    await assertInvalidConformanceRow(row, { sdkContext: context });
  });
}

test("conformance harness: supports standalone assertion and custom options", async () => {
  const customClock = createDeterministicClock("2026-08-01T00:00:00.000Z");
  const customProviders = createDeterministicProviders(100);
  const context = createConformanceSdk({ clock: customClock, identifiers: customProviders });
  const row = ACCOUNT_AUTH_SESSION_VALID_ROWS[0];
  if (!row) throw new Error("Expected at least one valid row");
  await assertValidConformanceRow(row);
  await assertValidConformanceRow(row, { sdkContext: context });
});

test("conformance harness: guards invalid rows and operations", async () => {
  const { sdk } = createConformanceSdk();
  createCommittedOperation(sdk, { operationId: "22222222-2222-4222-8222-000000000001" });
  assert.throws(
    () => createCommittedOperation(sdk, { operationId: "22222222-2222-4222-8222-000000000001" }),
    /Failed to begin operation: SDK_INVALID_IDENTIFIER/,
  );
  await assert.rejects(
    () => assertValidConformanceRow({ name: "missing", method: "authenticationFailed" }),
    /must provide either input or buildInput/,
  );
  await assert.rejects(
    () =>
      assertInvalidConformanceRow({
        name: "missing-invalid",
        method: "authenticationFailed",
        expectedCode: "X",
        expectedPath: "Y",
      }),
    /must provide either input or buildInput/,
  );
});
