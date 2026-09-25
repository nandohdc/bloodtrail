import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeTenant,
  observedSource,
  type AuditEventSink,
  type SecurityAuditEvent,
} from "@bloodtrail/security-audit-sdk-core";
import assert from "node:assert/strict";

const captured: SecurityAuditEvent[] = [];
const capturingSink: AuditEventSink = {
  async emit(event: SecurityAuditEvent) {
    captured.push(event);
    return { status: "accepted" };
  },
};

const sdk = createNodeSecurityAuditSdk({
  contractVersion: "2.1.0",
  producer: { name: "evaluation-service", version: "0.1.0" },
  environment: { name: "synthetic" },
  service: { name: "evaluation-harness" },
  sink: capturingSink,
});

assert.equal(sdk.state, "ready", "SDK must be ready");

const result = await sdk.accountRegistrationAttempted({
  actor: authenticatedHumanActor({ id: "actor-human-1", displayName: "User One" }),
  tenant: authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-eval-1",
    effective_tenant_id: "tenant-eval-1",
    resource_tenant_id: "tenant-eval-1",
  }),
  source: observedSource({
    observed: {
      address: "203.0.113.10",
      port: 443,
    },
  }),
  request: {
    id: "req-first-event-1",
    method: "POST",
    route: "/api/v1/evaluation/first-event",
  },
  correlation: {
    correlation_id: "11111111-1111-4111-8111-000000000001",
    operation_id: "11111111-1111-4111-8111-000000000002",
  },
});

assert.equal(result.ok, true, `Emit must succeed: ${JSON.stringify(result)}`);
assert.equal(captured.length, 1, "Exactly one event must be captured");
assert.equal(captured[0]!.event.name, "bloodtrail.audit.account.registration.attempted");
assert.equal(captured[0]!.event.outcome, "success");

await sdk.shutdown();
assert.equal(sdk.state, "shut_down", "SDK must be shut down");

console.log("first-event:pass");
