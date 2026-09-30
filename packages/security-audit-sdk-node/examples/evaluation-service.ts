import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
  nodeContextProvider,
  type HttpAuditSinkOutcome,
} from "@bloodtrail/security-audit-sdk-node";
import {
  anonymousActor,
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

function jsonReply(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function createDispatchHandler(sdk: ReturnType<typeof createNodeSecurityAuditSdk>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";

    if (method === "GET" && url === "/health") {
      jsonReply(res, 200, { status: "healthy" });
      return;
    }

    if (method === "POST" && url === "/api/v1/auth/login-failure") {
      // 1. Flow: Authentication failure handler
      // When authentication credentials fail validation, emit authenticationFailed.
      // Per acceptance criteria, the failed login uses anonymousActor(), never an authenticated actor.
      const failureTenant = authoritativeTenant({
        scope: "tenant",
        actor_tenant_id: "tenant-eval-1",
        effective_tenant_id: "tenant-eval-1",
        resource_tenant_id: "tenant-eval-1",
      });
      const anonActor = anonymousActor("request_boundary");

      await sdk.runWithContext(
        {
          tenant: failureTenant,
          actor: anonActor,
        },
        async () => {
          // Scope supplies actor and tenant at runtime; the static input types still require them
          const authFailedResult = await sdk.authenticationFailed({
            actor: anonActor,
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
          if (!authFailedResult.ok) {
            throw new Error(`authenticationFailed emit failed: ${JSON.stringify(authFailedResult.error)}`);
          }
          assert.equal(authFailedResult.value.status, "accepted", "authenticationFailed must be accepted");
          console.log("service:emitted:authentication.failed");
          jsonReply(res, 401, { error: "invalid_credentials" });
        },
      );
      return;
    }

    if (method === "POST" && url === "/api/v1/auth/login-success") {
      // 2. Flow: Authentication success handler
      // Resolve authenticated principal, actor, and tenant, and establish a context scope.
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

      await sdk.runWithContext(
        { actor, tenant },
        async () => {
          // Scope supplies actor and tenant at runtime; the static input types still require them
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
          jsonReply(res, 200, { ok: true, status: "authenticated" });
        },
      );
      return;
    }

    if (method === "GET" && url === "/api/v1/records/record-eval-view-1") {
      // 3. Flow: Sensitive resource viewed handler
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
      const principal = authenticatedPrincipal({
        type: "human_user",
        id: "principal-eval-1",
        issuer: "https://idp.synthetic.test",
      });
      const recordResourceView = createRecordResource("record-eval-view-1", "read");
      const authzView = createRecordAuthorization({
        policyId: "policy.eval-view-1",
        capability: "read_record",
        recordId: "record-eval-view-1",
      });

      await sdk.runWithContext(
        { actor: scopedActor, tenant: scopedTenant },
        async () => {
          // Scope supplies actor and tenant at runtime; the static input types still require them
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
          jsonReply(res, 200, { id: "record-eval-view-1", classification: "confidential" });
        },
      );
      return;
    }

    if (method === "POST" && url === "/api/v1/actions/denied") {
      // 4. Flow: Denied action / authorization denial handler
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

      await sdk.runWithContext(
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

          // Scope supplies actor and tenant at runtime; the static input types still require them
          const authzDeniedResult = await sdk.authorizationDenied({
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
          if (!authzDeniedResult.ok) {
            throw new Error(`authorizationDenied emit failed: ${JSON.stringify(authzDeniedResult.error)}`);
          }
          assert.equal(authzDeniedResult.value.status, "accepted", "authorizationDenied must be accepted");
          console.log("service:context-survives-await:pass");
          console.log("service:emitted:authorization.denied");
          jsonReply(res, 403, { error: "policy_denied" });
        },
      );
      return;
    }

    if (method === "POST" && url === "/api/v1/records/record-eval-modify-1") {
      // 5. Flow: Sensitive resource modified with beginOperation and commit
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
      const recordResourceModify = createRecordResource("record-eval-modify-1", "update");
      const authzModify = createRecordAuthorization({
        policyId: "policy.eval-modify-1",
        capability: "update_record",
        recordId: "record-eval-modify-1",
      });

      await sdk.runWithContext(
        { actor: scopedActor, tenant: scopedTenant },
        async () => {
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

          // Scope supplies actor and tenant at runtime; commit state originates from op.value
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
          jsonReply(res, 200, { ok: true, status: "modified" });
        },
      );
      return;
    }

    jsonReply(res, 404, { error: "not_found" });
  };
}

export interface EvaluationServiceOptions {
  readonly port?: number;
  readonly host?: string;
  readonly receiverOrigin?: string;
}

export function startEvaluationService(options: EvaluationServiceOptions = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const receiverOrigin = options.receiverOrigin ?? "http://127.0.0.1:3000";

  const httpSink = createHttpAuditSink({
    origin: receiverOrigin,
    path: "/v1/security-audit",
    timeoutMs: 5000,
    headers: {
      authorization: "Bearer fixture-token-a",
    },
    onOutcome: (outcome: HttpAuditSinkOutcome) => {
      console.log(`service:outcome ${outcome.eventId} ${outcome.outcome} ${outcome.status ?? "none"}`);
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

  const server = createServer(createDispatchHandler(sdk));

  return new Promise<{
    server: ReturnType<typeof createServer>;
    origin: string;
    port: number;
    sdk: typeof sdk;
    close: () => Promise<void>;
  }>((resolvePromise) => {
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      const origin = `http://${host}:${actualPort}`;
      console.log(`service:ready ${origin}`);
      resolvePromise({
        server,
        origin,
        port: actualPort,
        sdk,
        close: async () => {
          await sdk.shutdown();
          await new Promise<void>((closeResolve) => server.close(() => closeResolve()));
        },
      });
    });
  });
}

const isMain =
  process.argv[1]?.endsWith("evaluation-service.ts") || process.argv[1]?.endsWith("evaluation-service.js");
if (isMain) {
  let portArg = 0;
  let receiverOrigin = "http://127.0.0.1:3000";
  if (process.argv[2]) {
    if (process.argv[2].startsWith("http://") || process.argv[2].startsWith("https://")) {
      receiverOrigin = process.argv[2];
      portArg = process.argv[3] ? Number(process.argv[3]) : 0;
    } else {
      portArg = Number(process.argv[2]);
      receiverOrigin = process.argv[3] || receiverOrigin;
    }
  }
  if (!portArg && process.env.PORT) {
    portArg = Number(process.env.PORT);
  }
  if (process.env.RECEIVER_ORIGIN) {
    receiverOrigin = process.env.RECEIVER_ORIGIN;
  }
  const running = await startEvaluationService({ port: portArg, receiverOrigin });

  const shutdown = async () => {
    await running.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
