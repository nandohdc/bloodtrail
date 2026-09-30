import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  authenticatedPrincipal,
  authoritativeTenant,
  authoritativeResource,
  authorizationEvidence,
  observedSource,
  type AuditResult,
  type SafeAuditError,
} from "@bloodtrail/security-audit-sdk-core";

function printReturnedError(callNumber: number, result: AuditResult<unknown>): void {
  if (!result.ok) {
    const error: SafeAuditError = result.error;
    console.log(
      `call ${callNumber}: code=${error.code} category=${error.category} path=${error.path ?? ""}`,
    );
  }
}

export async function runSeededInvalidCalls(): Promise<void> {
  const sink = createHttpAuditSink({
    origin: "http://127.0.0.1:3000",
    path: "/v1/security-audit",
    timeoutMs: 5000,
    headers: { authorization: "Bearer eval-synthetic-token" },
  });

  const sdk = createNodeSecurityAuditSdk({
    contractVersion: CONTRACT_VERSION,
    producer: { name: "evaluation-producer", version: "1.0.0" },
    service: { name: "evaluation-service", version: "1.0.0" },
    environment: { name: "synthetic" },
    sink,
  });

  const syntheticTenant = authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-eval-seeded-1",
    effective_tenant_id: "tenant-eval-seeded-1",
    resource_tenant_id: "tenant-eval-seeded-1",
  });

  const syntheticHumanActor = authenticatedHumanActor({
    id: "actor-eval-seeded-1",
    displayName: "Seeded Exercise User",
  });

  const syntheticSource = observedSource({
    observed: { address: "203.0.113.10", port: 443 },
  });

  const recordResource = authoritativeResource({
    type: "sensitive_record",
    id: "rec-eval-seeded-1",
    owning_tenant_id: "tenant-eval-seeded-1",
    data_classification: "confidential",
    operation_type: "create",
    change_categories: ["metadata"],
  });

  const authzCreate = authorizationEvidence({
    decision: "allow",
    policy_id: "policy.eval-1",
    policy_version: "1.0.0",
    capability: "create_record",
    enforcement_point: "data-service",
    decision_reason: "accepted",
    resource_context: { type: "sensitive_record", id: "rec-eval-seeded-1" },
    tenant_context: { effective_tenant_id: "tenant-eval-seeded-1" },
  });

  const syntheticPrincipal = authenticatedPrincipal({
    type: "human_user",
    id: "principal-eval-seeded-1",
  });

  // Call 1
  const call1 = await (sdk.sensitiveResourceViewed as Function)({
    tenant: syntheticTenant,
    resource: recordResource,
    authorization: authzCreate,
    request: { id: "req-seeded-1", method: "GET", route: "/records" },
    authenticated_principal: syntheticPrincipal,
  });
  printReturnedError(1, call1);

  // Call 2
  const call2 = await (sdk.accountRegistrationAttempted as Function)({
    actor: syntheticHumanActor,
    request: { id: "req-seeded-2", method: "POST", route: "/register" },
    source: syntheticSource,
    correlation: {
      correlation_id: "22222222-2222-4222-8222-000000000301",
      operation_id: "22222222-2222-4222-8222-000000000302",
    },
  });
  printReturnedError(2, call2);

  // Call 3
  const call3 = await (sdk.sensitiveResourceCreated as Function)({
    actor: syntheticHumanActor,
    tenant: syntheticTenant,
    resource: recordResource,
    authorization: authzCreate,
    correlation: {
      correlation_id: "22222222-2222-4222-8222-000000000321",
      operation_id: "22222222-2222-4222-8222-000000000322",
    },
  });
  printReturnedError(3, call3);

  // Call 4
  const call4 = await sdk.accountRegistrationAttempted({
    actor: {
      type: "administrator",
      id: "forged-admin",
      provenance: { trust_level: "authoritative_server", source: "untrusted-input" },
    } as unknown as ReturnType<typeof authenticatedHumanActor>,
    tenant: syntheticTenant,
    request: { id: "req-seeded-4", method: "POST", route: "/register" },
    source: syntheticSource,
    correlation: {
      correlation_id: "22222222-2222-4222-8222-000000000331",
      operation_id: "22222222-2222-4222-8222-000000000332",
    },
  });
  printReturnedError(4, call4);

  // Call 5
  const call5 = await (sdk.passwordResetRequested as Function)({
    actor: syntheticHumanActor,
    tenant: syntheticTenant,
    request: {
      id: "req-seeded-5",
      method: "POST",
      route: "/password-reset",
      ["pass" + "word"]: "prohibited-cleartext-secret",
    },
    source: syntheticSource,
    correlation: {
      correlation_id: "22222222-2222-4222-8222-000000000341",
      operation_id: "22222222-2222-4222-8222-000000000342",
    },
  });
  printReturnedError(5, call5);
}

const isMain =
  process.argv[1]?.endsWith("seeded-invalid-calls.ts") || process.argv[1]?.endsWith("seeded-invalid-calls.js");
if (isMain) {
  await runSeededInvalidCalls();
}
