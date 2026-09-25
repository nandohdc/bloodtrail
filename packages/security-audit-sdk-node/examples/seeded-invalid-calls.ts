import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  authoritativeTenant,
  authoritativeResource,
  authorizationEvidence,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find error catalog path whether running from within package or installed kit
function locateErrorCatalog(): string {
  const candidatePaths = [
    resolve(__dirname, "../docs/error-catalog.md"),
    resolve(__dirname, "../../docs/error-catalog.md"),
    resolve(process.cwd(), "docs/error-catalog.md"),
  ];
  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Unable to locate error-catalog.md from candidates: ${candidatePaths.join(", ")}`);
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

  // Call 1: Missing Required Actor in sensitiveResourceViewed
  const call1 = await (sdk.sensitiveResourceViewed as Function)({
    tenant: syntheticTenant,
    resource: recordResource,
    authorization: authzCreate,
    request: { id: "req-seeded-1", method: "GET", route: "/records" },
  });
  assert(!call1.ok, "Call 1 should fail with missing required actor");
  assert.equal(call1.error.code, "MISSING_REQUIRED_ACTOR", "Call 1 code mismatch");
  assert.equal(call1.error.path, "/actor", "Call 1 path mismatch");
  console.log("seeded:call-1:pass (MISSING_REQUIRED_ACTOR at /actor)");

  // Call 2: Missing Tenant Context in accountRegistrationAttempted
  const call2 = await (sdk.accountRegistrationAttempted as Function)({
    actor: syntheticHumanActor,
    request: { id: "req-seeded-2", method: "POST", route: "/register" },
    source: syntheticSource,
    correlation: {
      correlation_id: "22222222-2222-4222-8222-000000000301",
      operation_id: "22222222-2222-4222-8222-000000000302",
    },
  });
  assert(!call2.ok, "Call 2 should fail with missing tenant context");
  assert.equal(call2.error.code, "MISSING_TENANT_CONTEXT", "Call 2 code mismatch");
  assert.equal(call2.error.path, "/tenant", "Call 2 path mismatch");
  console.log("seeded:call-2:pass (MISSING_TENANT_CONTEXT at /tenant)");

  // Call 3: Premature Success in sensitiveResourceCreated without operation handle
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
  assert(!call3.ok, "Call 3 should fail with premature success");
  assert.equal(call3.error.code, "PREMATURE_SUCCESS", "Call 3 code mismatch");
  assert.equal(call3.error.path, "/operation/state", "Call 3 path mismatch");
  console.log("seeded:call-3:pass (PREMATURE_SUCCESS at /operation/state)");

  // Call 4: Plain-object authority escalation in accountRegistrationAttempted
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
  assert(!call4.ok, "Call 4 should fail with authority escalation");
  assert.equal(call4.error.code, "AUTHORITY_ESCALATION", "Call 4 code mismatch");
  assert.equal(call4.error.path, "/actor", "Call 4 path mismatch");
  console.log("seeded:call-4:pass (AUTHORITY_ESCALATION at /actor)");

  // Call 5: Prohibited key in request metadata for passwordResetRequested
  const call5 = await (sdk.passwordResetRequested as Function)({
    actor: syntheticHumanActor,
    tenant: syntheticTenant,
    request: {
      id: "req-seeded-5",
      method: "POST",
      route: "/password-reset",
      password: "prohibited-cleartext-secret",
    },
    source: syntheticSource,
    correlation: {
      correlation_id: "22222222-2222-4222-8222-000000000341",
      operation_id: "22222222-2222-4222-8222-000000000342",
    },
  });
  assert(!call5.ok, "Call 5 should fail with prohibited data");
  assert.equal(call5.error.code, "PROHIBITED_DATA", "Call 5 code mismatch");
  assert.equal(call5.error.path, "/request/password", "Call 5 path mismatch");
  console.log("seeded:call-5:pass (PROHIBITED_DATA at /request/password)");

  // Verify that the error catalog documents every code returned by the seeded calls
  const catalogPath = locateErrorCatalog();
  const catalogContent = await readFile(catalogPath, "utf8");
  const seededCodes = [
    "MISSING_REQUIRED_ACTOR",
    "MISSING_TENANT_CONTEXT",
    "PREMATURE_SUCCESS",
    "AUTHORITY_ESCALATION",
    "PROHIBITED_DATA",
  ];

  for (const code of seededCodes) {
    assert(
      catalogContent.includes(`### \`${code}\``) || catalogContent.includes(`### ${code}`),
      `Error catalog (${catalogPath}) must document code: ${code}`,
    );
  }
  console.log("seeded:error-catalog-check:pass (all 5 codes documented)");

  console.log("seeded-invalid-calls:all-passed:5/5");
}

const isMain =
  process.argv[1]?.endsWith("seeded-invalid-calls.ts") || process.argv[1]?.endsWith("seeded-invalid-calls.js");
if (isMain) {
  await runSeededInvalidCalls();
}
