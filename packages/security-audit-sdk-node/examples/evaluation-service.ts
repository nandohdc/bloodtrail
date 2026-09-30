import process from "node:process";
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
  nodeContextProvider,
} from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeTenant,
  authenticatedPrincipal,
  authenticationEvidence,
  credentialReference,
  sessionEvidence,
  observedSource,
  authoritativeResource,
  authorizationEvidence,
  type AuditEventSink,
} from "@bloodtrail/security-audit-sdk-core";
import assert from "node:assert/strict";

// Prints each event exactly as the SDK validated it, then hands it to the HTTP audit sink unchanged. The
// receiver prints each event exactly as it arrived, so the two outputs show the same bytes.
function printValidatedEvents(sink: AuditEventSink): AuditEventSink {
  return {
    ...sink,
    emit(event) {
      console.log(`service:validated ${JSON.stringify(event)}`);
      return sink.emit(event);
    },
  };
}

interface RecordAuthorizationOptions {
  readonly policyId: string;
  readonly capability: string;
  readonly recordId: string;
}

function createRecordAuthorization(options: RecordAuthorizationOptions) {
  return authorizationEvidence({
    decision: "allow",
    policy_id: options.policyId,
    policy_version: "1.0.0",
    capability: options.capability,
    enforcement_point: "data-service",
    decision_reason: "accepted",
    resource_context: {
      type: "sensitive_record",
      id: options.recordId,
    },
    tenant_context: {
      effective_tenant_id: "tenant-eval-scoped",
    },
  });
}

function createRecordResource(id: string, operationType: "read" | "update") {
  return authoritativeResource({
    type: "sensitive_record",
    id,
    owning_tenant_id: "tenant-eval-scoped",
    data_classification: "confidential",
    operation_type: operationType,
    change_categories: ["metadata"],
  });
}

export async function runEvaluationService(origin: string = "http://127.0.0.1:3000") {
  const outcomesReceived: unknown[] = [];
  const httpSink = createHttpAuditSink({
    origin,
    path: "/v1/security-audit",
    timeoutMs: 5000,
    headers: {
      authorization: "Bearer fixture-token-a",
    },
    onOutcome: (outcome) => {
      outcomesReceived.push(outcome);
    },
  });
  const sink = printValidatedEvents(httpSink);

  const sdk = createNodeSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "evaluation-service", version: "0.1.0" },
    environment: { name: "synthetic" },
    service: { name: "evaluation-service" },
    sink,
  });

  assert.equal(sdk.state, "ready", "SDK must be in ready state");

  // 1. Flow: Authentication failure handler
  // When authentication credentials fail validation, emit authenticationFailed.
  // The tenant is bound in the request scope, and authenticationFailed inherits it.
  const authFailedResult = await sdk.runWithContext(
    {
      tenant: authoritativeTenant({
        scope: "tenant",
        actor_tenant_id: "tenant-eval-1",
        effective_tenant_id: "tenant-eval-1",
        resource_tenant_id: "tenant-eval-1",
      }),
    },
    async () => {
      return await sdk.authenticationFailed({
        actor: authenticatedHumanActor({
          id: "actor-eval-failed-user",
          displayName: "Failed Login User",
        }),
        authentication: authenticationEvidence({
          method: "password_mfa",
          assurance_level: "aal1",
          mfa_state: "not_used",
          credential_type: "password",
          identity_provider: "https://idp.synthetic.test",
          delegated: false,
          impersonated: false,
        }),
        source: observedSource({
          observed: {
            address: "127.0.0.1",
            port: 443,
          },
        }),
        request: {
          id: "req-auth-failed-1",
          method: "POST",
          route: "/api/v1/auth/login",
        },
        correlation: {
          correlation_id: "22222222-2222-4222-8222-000000000041",
        },
        event: {
          outcome_reason: {
            code: "credential_invalid",
          },
        },
      });
    },
  );

  if (!authFailedResult.ok) {
    throw new Error(`authenticationFailed emit failed: ${JSON.stringify(authFailedResult.error)}`);
  }
  assert.equal(authFailedResult.value.status, "accepted", "authenticationFailed must be accepted");
  console.log("service:emitted:authentication.failed");

  // 2. Flow: Authenticated request context scope with async work and authorization denial
  // Resolve authenticated principal, actor, and tenant, and establish a context scope.
  const scopedActor = authenticatedHumanActor({
    id: "actor-eval-scoped-user",
    displayName: "Scoped User",
  });
  const scopedTenant = authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-eval-scoped",
    effective_tenant_id: "tenant-eval-scoped",
    resource_tenant_id: "tenant-eval-scoped",
  });

  const authzDeniedResult = await sdk.runWithContext(
    {
      actor: scopedActor,
      tenant: scopedTenant,
    },
    async () => {
      // Simulate asynchronous work (e.g. database lookup, policy evaluation)
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Context survives the await: resolve active actor and tenant from the scope
      const activeContext = nodeContextProvider.get();
      assert.ok(activeContext?.actor, "active context actor must survive await");
      assert.ok(activeContext?.tenant, "active context tenant must survive await");

      return await sdk.authorizationDenied({
        actor: activeContext.actor,
        tenant: activeContext.tenant,
        resource: authoritativeResource({
          type: "authorization_policy",
          id: "policy-eval-denied-1",
          owning_tenant_id: "tenant-eval-scoped",
          data_classification: "confidential",
          operation_type: "execute",
          change_categories: ["metadata"],
        }),
        authorization: authorizationEvidence({
          decision: "deny",
          policy_id: "policy.eval-1",
          policy_version: "1.0.0",
          capability: "evaluate_authorization",
          enforcement_point: "policy-enforcement-point",
          decision_reason: "policy_denied",
          resource_context: {
            type: "authorization_policy",
            id: "policy-eval-denied-1",
          },
          tenant_context: {
            effective_tenant_id: "tenant-eval-scoped",
          },
        }),
        source: observedSource({
          observed: {
            address: "127.0.0.1",
            port: 443,
          },
        }),
        event: {
          outcome_reason: {
            code: "policy_denied",
          },
        },
      });
    },
  );

  if (!authzDeniedResult.ok) {
    throw new Error(`authorizationDenied emit failed: ${JSON.stringify(authzDeniedResult.error)}`);
  }
  assert.equal(authzDeniedResult.value.status, "accepted", "authorizationDenied must be accepted");
  console.log("service:context-survives-await:pass");
  console.log("service:emitted:authorization.denied");

  // 3. Flow: Authentication success
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

  const authSucceededResult = await sdk.authenticationSucceeded({
    actor,
    tenant,
    authenticated_principal: principal,
    authentication: authEvidence,
    credential,
    session,
    source,
  });

  if (!authSucceededResult.ok) {
    throw new Error(`authenticationSucceeded emit failed: ${JSON.stringify(authSucceededResult.error)}`);
  }
  assert.equal(authSucceededResult.value.status, "accepted", "Delivery status must be accepted");
  console.log("service:emitted:authentication.succeeded");

  // 4. Flow: Sensitive resource viewed
  const recordResourceView = createRecordResource("record-eval-view-1", "read");
  const authzView = createRecordAuthorization({
    policyId: "policy.eval-view-1",
    capability: "read_record",
    recordId: "record-eval-view-1",
  });

  const viewResult = await sdk.sensitiveResourceViewed({
    actor: scopedActor,
    authenticated_principal: principal,
    tenant: scopedTenant,
    resource: recordResourceView,
    authorization: authzView,
    request: {
      id: "req-view-rec-1",
      method: "GET",
      route: "/api/v1/records/record-eval-view-1",
    },
  });

  if (!viewResult.ok) {
    throw new Error(`sensitiveResourceViewed emit failed: ${JSON.stringify(viewResult.error)}`);
  }
  assert.equal(viewResult.value.status, "accepted", "sensitiveResourceViewed must be accepted");
  console.log("service:emitted:data.sensitive_resource.viewed");

  // 5. Flow: Sensitive resource modified with beginOperation and commit
  // Assert: commit state comes from the operation handle, never from caller input.
  const recordResourceModify = createRecordResource("record-eval-modify-1", "update");
  const authzModify = createRecordAuthorization({
    policyId: "policy.eval-modify-1",
    capability: "update_record",
    recordId: "record-eval-modify-1",
  });

  // Verify negative case: direct caller-supplied commit_state without a matching operation handle fails closed
  const forgedCommitAttempt = await (sdk.sensitiveResourceModified as (input: unknown) => Promise<{ ok: boolean; error: { code: string } }>)({
    actor: scopedActor,
    tenant: scopedTenant,
    resource: recordResourceModify,
    authorization: authzModify,
    event: {
      commit_state: "committed",
    },
  });
  assert.equal(forgedCommitAttempt.ok, false, "direct commit_state without operation handle must fail");
  assert.equal(forgedCommitAttempt.error.code, "PREMATURE_SUCCESS");
  console.log("service:direct-commit-prevented:pass");

  // Start real operation
  const op = sdk.beginOperation({
    operationId: "22222222-2222-4222-8222-000000000301",
    transactionId: "22222222-2222-4222-8222-000000000302",
    boundEvent: "sensitiveResourceModified",
    transactional: true,
  });
  if (!op.ok) {
    throw new Error(`beginOperation failed: ${JSON.stringify(op.error)}`);
  }

  // Simulate transactional modification
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Mark committed on the handle
  op.value.markCommitted();

  // Commit state is not passed by caller; it originates from op.value
  const modifyResult = await sdk.sensitiveResourceModified({
    actor: scopedActor,
    tenant: scopedTenant,
    resource: recordResourceModify,
    authorization: authzModify,
    correlation: {
      correlation_id: "22222222-2222-4222-8222-000000000303",
      operation_id: op.value.operationId,
    },
    operation: op.value,
  });

  if (!modifyResult.ok) {
    throw new Error(`sensitiveResourceModified emit failed: ${JSON.stringify(modifyResult.error)}`);
  }
  assert.equal(modifyResult.value.status, "accepted", "sensitiveResourceModified must be accepted");
  console.log("service:operation-commit:pass");
  console.log("service:emitted:data.sensitive_resource.modified");

  await sdk.shutdown();
  assert.equal(sdk.state, "shut_down", "SDK must be shut down");

  return {
    ok: true,
    authFailedResult,
    authzDeniedResult,
    authSucceededResult,
    viewResult,
    modifyResult,
    outcomes: outcomesReceived,
  };
}

const isMain =
  process.argv[1]?.endsWith("evaluation-service.ts") || process.argv[1]?.endsWith("evaluation-service.js");
if (isMain) {
  const originArg = process.argv[2] || process.env.RECEIVER_ORIGIN || "http://127.0.0.1:3000";
  await runEvaluationService(originArg);
}
