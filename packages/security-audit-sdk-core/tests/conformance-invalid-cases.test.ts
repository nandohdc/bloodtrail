import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  apiCredentialActor,
  authenticatedHumanActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeResource,
  authoritativeTenant,
  authorizationEvidence,
  observedSource,
  validateSecurityAuditEvent,
  type SecurityAuditEvent,
} from "../dist/index.js";
import {
  assertInvalidConformanceRow,
  createConformanceSdk,
  type InvalidConformanceRow,
} from "./conformance-harness.js";

const syntheticTenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-conformance-1",
  effective_tenant_id: "tenant-conformance-1",
  resource_tenant_id: "tenant-conformance-1",
});

const syntheticHumanActor = authenticatedHumanActor({
  id: "actor-conformance-1",
  displayName: "User One",
});

const syntheticApiActor = apiCredentialActor({
  id: "api-conformance-1",
  displayName: "API One",
});

const syntheticSource = observedSource({
  observed: {
    address: "203.0.113.10",
    port: 443,
  },
});

const syntheticPrincipal = authenticatedPrincipal({
  type: "human_user",
  id: "principal-conformance-1",
  issuer: "https://idp.example.test",
});

function createSyntheticResource(params: {
  readonly type: NonNullable<Parameters<typeof authoritativeResource>[0]["type"]>;
  readonly id: string;
  readonly operationType: Parameters<typeof authoritativeResource>[0]["operation_type"];
}) {
  return authoritativeResource({
    type: params.type,
    id: params.id,
    owning_tenant_id: "tenant-conformance-1",
    data_classification: "confidential",
    operation_type: params.operationType,
    change_categories: ["metadata"],
  });
}

const recordResource = createSyntheticResource({
  type: "sensitive_record",
  id: "rec-conformance-1",
  operationType: "create",
});

function createSyntheticAuthz(params: {
  readonly decision: "allow" | "deny";
  readonly capability: string;
  readonly enforcementPoint: string;
  readonly decisionReason: NonNullable<Parameters<typeof authorizationEvidence>[0]["decision_reason"]>;
  readonly resourceType: string;
  readonly resourceId: string;
}) {
  return authorizationEvidence({
    decision: params.decision,
    policy_id: "policy.conformance-1",
    policy_version: "1.0.0",
    capability: params.capability,
    enforcement_point: params.enforcementPoint,
    decision_reason: params.decisionReason,
    resource_context: {
      type: params.resourceType,
      id: params.resourceId,
    },
    tenant_context: {
      effective_tenant_id: "tenant-conformance-1",
    },
  });
}

const authzCreate = createSyntheticAuthz({
  decision: "allow",
  capability: "create_record",
  enforcementPoint: "data-service",
  decisionReason: "accepted",
  resourceType: "sensitive_record",
  resourceId: "rec-conformance-1",
});

const authzDenyPolicy = createSyntheticAuthz({
  decision: "deny",
  capability: "evaluate_authorization",
  enforcementPoint: "policy-enforcement-point",
  decisionReason: "policy_denied",
  resourceType: "authorization_policy",
  resourceId: "policy-conformance-1",
});

const policyResource = createSyntheticResource({
  type: "authorization_policy",
  id: "policy-conformance-1",
  operationType: "execute",
});

export const INVALID_CONFORMANCE_ROWS: readonly InvalidConformanceRow[] = Object.freeze([
  // 1. Missing required context
  {
    name: "missing required context: tenant in accountRegistrationAttempted",
    method: "accountRegistrationAttempted",
    input: {
      actor: syntheticHumanActor,
      request: {
        id: "req-missing-tenant",
        method: "POST",
        route: "/register",
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000301",
        operation_id: "22222222-2222-4222-8222-000000000302",
      },
    },
    expectedCode: "MISSING_TENANT_CONTEXT",
    expectedPath: "/tenant",
  },
  {
    name: "missing required context: actor in sensitiveResourceViewed",
    method: "sensitiveResourceViewed",
    input: {
      tenant: syntheticTenant,
      resource: recordResource,
      authorization: authzCreate,
      request: {
        id: "req-missing-actor",
        method: "GET",
        route: "/records",
      },
      authenticated_principal: syntheticPrincipal,
    },
    expectedCode: "MISSING_REQUIRED_ACTOR",
    expectedPath: "/actor",
  },

  // 2. Invalid registry value
  {
    name: "invalid registry value: unregistered outcome_reason code",
    method: "authenticationFailed",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      authentication: authenticationEvidence({
        method: "password_mfa",
        assurance_level: "aal2",
        mfa_state: "satisfied",
        credential_type: "session",
        authenticated_at: "2026-07-31T11:55:00.000Z",
        identity_provider: "https://idp.example.test",
        delegated: false,
        impersonated: false,
      }),
      source: syntheticSource,
      request: {
        id: "req-invalid-registry",
        method: "POST",
        route: "/login",
      },
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000311",
        operation_id: "22222222-2222-4222-8222-000000000312",
      },
      event: {
        outcome_reason: {
          code: "unregistered_outcome_reason_code_value",
        },
      },
    },
    expectedCode: "SDK_SCHEMA_VALIDATION_FAILED",
    expectedPath: "/event/outcome_reason/code",
  },

  // 3. Outcome or commit-state violation, including premature success without an operation handle
  {
    name: "premature success: sensitiveResourceCreated without operation handle",
    method: "sensitiveResourceCreated",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      resource: recordResource,
      authorization: authzCreate,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000321",
        operation_id: "22222222-2222-4222-8222-000000000322",
      },
    },
    expectedCode: "PREMATURE_SUCCESS",
    expectedPath: "/operation/state",
  },
  {
    name: "outcome violation: authorizationDenied declaring outcome success",
    method: "authorizationDenied",
    input: {
      actor: syntheticApiActor,
      tenant: syntheticTenant,
      resource: policyResource,
      authorization: authzDenyPolicy,
      source: syntheticSource,
      event: {
        outcome: "success",
        outcome_reason: {
          code: "policy_denied",
        },
      },
    },
    expectedCode: "SDK_SEMANTIC_VALIDATION_FAILED",
    expectedPath: "/event/outcome",
  },

  // 4. Plain-object authority or trust escalation
  {
    name: "plain-object authority escalation: unbranded actor object",
    method: "accountRegistrationAttempted",
    input: {
      actor: {
        type: "administrator",
        id: "forged-admin",
        provenance: {
          trust_level: "authoritative_server",
          source: "untrusted-input",
        },
      },
      tenant: syntheticTenant,
      request: {
        id: "req-escalation",
        method: "POST",
        route: "/register",
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000331",
        operation_id: "22222222-2222-4222-8222-000000000332",
      },
    },
    expectedCode: "AUTHORITY_ESCALATION",
    expectedPath: "/actor",
  },

  // 5. Prohibited key or value
  {
    name: "prohibited key: password field present in request object",
    method: "passwordResetRequested",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      request: {
        id: "req-prohibited-key",
        method: "POST",
        route: "/password-reset",
        password: "forbidden_cleartext_password",
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000341",
        operation_id: "22222222-2222-4222-8222-000000000342",
      },
    },
    expectedCode: "PROHIBITED_DATA",
    expectedPath: "/request/password",
  },
  {
    name: "prohibited value: synthetic prohibited token in scalar field",
    method: "passwordResetRequested",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      request: {
        id: "SYNTHETIC_PROHIBITED_TOKEN",
        method: "POST",
        route: "/password-reset",
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000343",
        operation_id: "22222222-2222-4222-8222-000000000344",
      },
    },
    expectedCode: "PROHIBITED_DATA",
    expectedPath: "/request/id",
  },

  // 6. Bounds
  {
    name: "bounds: string past maxLength of 128 characters fails",
    method: "passwordResetRequested",
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      request: {
        id: "req-past-bound",
        method: "POST",
        route: "/" + "x".repeat(128), // 129 characters total
      },
      source: syntheticSource,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000351",
        operation_id: "22222222-2222-4222-8222-000000000352",
      },
    },
    expectedCode: "FIELD_LIMIT_EXCEEDED",
    expectedPath: "/request/route",
  },
]);

for (const row of INVALID_CONFORMANCE_ROWS) {
  test(`conformance invalid: ${row.name}`, async () => {
    const context = createConformanceSdk();
    await assertInvalidConformanceRow(row, { sdkContext: context });
  });
}

test("bounds verification: value at bound passes, value past bound fails", async () => {
  const context = createConformanceSdk();
  const sdk = context.sdk;

  function buildPasswordResetInput(routeSuffixLength: number, requestId: string, seq: number) {
    return {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      request: {
        id: requestId,
        method: "POST" as const,
        route: "/" + "x".repeat(routeSuffixLength),
      },
      source: syntheticSource,
      correlation: {
        correlation_id: `22222222-2222-4222-8222-00000000036${seq * 2 - 1}`,
        operation_id: `22222222-2222-4222-8222-00000000036${seq * 2}`,
      },
    };
  }

  // At bound: exactly 128 characters in route
  const atBound = await sdk.passwordResetRequested(buildPasswordResetInput(127, "req-at-bound", 1));
  assert.equal(atBound.ok, true, "128 character route should pass at bound");

  // Past bound: exactly 129 characters in route
  const pastBound = await sdk.passwordResetRequested(buildPasswordResetInput(128, "req-past-bound", 2));
  assert.equal(pastBound.ok, false, "129 character route must fail past bound");
  if (!pastBound.ok) {
    assert.equal(pastBound.error.code, "FIELD_LIMIT_EXCEEDED");
    assert.equal(pastBound.error.path, "/request/route");
  }
});

function findContractRoot(): string {
  const candidates = [
    resolve(process.cwd(), "contracts/security-audit"),
    resolve(process.cwd(), "../../contracts/security-audit"),
    resolve(import.meta.dirname, "../../../contracts/security-audit"),
  ];
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "examples/positive/all-events.json"))) {
      return candidate;
    }
  }
  throw new Error("Could not find contract root containing canonical examples");
}

interface NegativeFixture {
  readonly name: string;
  readonly expected_errors: readonly string[];
  readonly event: SecurityAuditEvent;
}

test("contract canonical positive and negative examples through validateSecurityAuditEvent", async () => {
  const contractRoot = findContractRoot();
  const positiveJson = await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8");
  const positiveEvents = JSON.parse(positiveJson) as readonly SecurityAuditEvent[];

  assert.ok(positiveEvents.length > 0, "positive fixtures must not be empty");
  for (const fixture of positiveEvents) {
    const result = validateSecurityAuditEvent(fixture);
    assert.equal(result.ok, true, `positive fixture ${fixture.event.name} should pass validateSecurityAuditEvent`);
  }

  const negativeJson = await readFile(resolve(contractRoot, "examples/negative/all-negative.json"), "utf8");
  const negativeFixtures = JSON.parse(negativeJson) as readonly NegativeFixture[];

  assert.ok(negativeFixtures.length > 0, "negative fixtures must not be empty");
  for (const fixture of negativeFixtures) {
    const result = validateSecurityAuditEvent(fixture.event);
    assert.equal(result.ok, false, `negative fixture ${fixture.name} should fail validateSecurityAuditEvent`);
    if (!result.ok) {
      assert.equal(
        result.error.code,
        fixture.expected_errors[0],
        `negative fixture ${fixture.name}: expected error ${fixture.expected_errors[0]}, got ${result.error.code}`,
      );
    }
  }
});
