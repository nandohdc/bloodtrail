import process from "node:process";
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeTenant,
  authenticatedPrincipal,
  authenticationEvidence,
  credentialReference,
  sessionEvidence,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";
import assert from "node:assert/strict";

export async function runEvaluationService(origin: string = "http://127.0.0.1:3000") {
  let outcomeReceived: unknown = null;
  const sink = createHttpAuditSink({
    origin,
    path: "/v1/security-audit",
    timeoutMs: 5000,
    headers: {
      authorization: "Bearer fixture-token-a",
    },
    onOutcome: (outcome) => {
      outcomeReceived = outcome;
    },
  });

  const sdk = createNodeSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "evaluation-service", version: "0.1.0" },
    environment: { name: "synthetic" },
    service: { name: "evaluation-service" },
    sink,
  });

  assert.equal(sdk.state, "ready", "SDK must be in ready state");

  const actor = authenticatedHumanActor({
    id: "actor-eval-user-1",
    displayName: "Eval User",
  });

  const tenant = authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-eval-1",
    effective_tenant_id: "tenant-eval-1",
    resource_tenant_id: "tenant-eval-1",
  });

  const principal = authenticatedPrincipal({
    type: "human_user",
    id: "principal-eval-1",
    issuer: "https://idp.synthetic.test",
  });

  const authEvidence = authenticationEvidence({
    method: "password_mfa",
    assurance_level: "aal2",
    mfa_state: "satisfied",
    credential_type: "session",
    authenticated_at: "2026-09-25T12:00:00.000Z",
    identity_provider: "https://idp.synthetic.test",
    delegated: false,
    impersonated: false,
  });

  const session = sessionEvidence({
    id: "session-eval-1",
    created_at: "2026-09-25T12:00:00.000Z",
    age_seconds: 120,
    assurance_level: "aal2",
  });

  const credential = credentialReference({
    type: "session",
    reference: "cred-eval-1",
    key_id: "pseudonym-key-v1",
  });

  const source = observedSource({
    observed: {
      address: "127.0.0.1",
      port: 443,
    },
  });

  const result = await sdk.authenticationSucceeded({
    actor,
    tenant,
    authenticated_principal: principal,
    authentication: authEvidence,
    credential,
    session,
    source,
  });

  if (!result.ok) {
    throw new Error(`Emit failed: ${JSON.stringify(result.error)}`);
  }
  assert.equal(result.value.status, "accepted", "Delivery status must be accepted");

  await sdk.shutdown();
  assert.equal(sdk.state, "shut_down", "SDK must be shut down");

  console.log("service:emitted:authentication.succeeded");
  return { ok: true, result, outcome: outcomeReceived };
}

const isMain =
  process.argv[1]?.endsWith("evaluation-service.ts") || process.argv[1]?.endsWith("evaluation-service.js");
if (isMain) {
  const originArg = process.argv[2] || process.env.RECEIVER_ORIGIN || "http://127.0.0.1:3000";
  await runEvaluationService(originArg);
}
