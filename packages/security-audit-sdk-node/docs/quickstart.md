# Quickstart: Bloodtrail Security Audit SDK (Node.js)

Get from the evaluation kit to your first accepted audit event delivered over HTTP in 15 minutes or less.

## Runtime & Prerequisites

- **Supported Node versions:** Node 24 and Node 26 (`>=24 <25 || >=26 <27`).
- **Recommended Node version:** A current Node 24.x release (such as 24.8.x or later). Node 24.2.0 prints an experimental type-stripping warning when executing TypeScript files directly.
- **Loopback and synthetic data only:** All evaluation data must remain synthetic, and evaluation network traffic stays strictly on loopback (`127.0.0.1`).
- **Non-production environments:** `environment.name` must never be set to a production value. Use `"development"`, `"test"`, or `"synthetic"`.

## Installation

Inside the evaluation kit directory, install the local tarballs:

```bash
npm install
```

The generated manifest pins `@bloodtrail/security-audit-sdk-core` to the kit's own tarball via npm and pnpm overrides, ensuring exactly one core copy is installed.

## Package Responsibilities

- **`@bloodtrail/security-audit-sdk-node`** provides:
  - The runtime factory: `createNodeSecurityAuditSdk`.
  - Default Node platform implementations: `nodeClock`, `nodeIdentifiers`, `nodeByteLength`, `nodeTimers`, `nodeContextProvider`, `nodeSchemaRuntime`, and `nodePlatformProvider`.
  - The non-production HTTP audit sink: `createHttpAuditSink`.
- **`@bloodtrail/security-audit-sdk-core`** provides:
  - Authority constructors: `authenticatedHumanActor`, `serviceAccountActor`, `authoritativeTenant`, `observedSource`, `authoritativeSubject`, `authoritativeResource`, `authorizationEvidence`, etc.
  - Frozen types: `SecurityAuditEvent`, `AuditResult`, `AuditDeliveryResult`, `AuditEventSink`, etc.
  - Event contract schema validation: `validateSecurityAuditEvent`.
  - In-memory capturing and testing sink interfaces.

## Error and Return Conventions

- **Authority constructors throw synchronously:** Functions like `authoritativeTenant`, `authenticatedHumanActor`, or `observedSource` validate their inputs at call time and throw a synchronous `Error` or `TypeError` immediately if inputs violate contract rules.
- **Named SDK methods return results and never throw:** Methods such as `sdk.authenticationSucceeded` or `sdk.accountRegistrationAttempted` return an `AuditResult<AuditDeliveryResult>` object (`{ ok: true, value: ... }` or `{ ok: false, error: ... }`) and never reject or throw asynchronously.

## Creating the SDK and HTTP Sink

Initialize the SDK with an HTTP delivery sink directed at your local receiver:

```typescript
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

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
  headers: {
    authorization: "Bearer fixture-token-a",
  },
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: "2.1.0",
  producer: { name: "quickstart-service", version: "0.1.0" },
  environment: { name: "synthetic" },
  service: { name: "quickstart-service" },
  sink,
});
```

## Emitting Authentication Success

Construct authoritative contexts and emit an authentication-success event:

```typescript
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

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
  headers: {
    authorization: "Bearer fixture-token-a",
  },
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: "2.1.0",
  producer: { name: "quickstart-service", version: "0.1.0" },
  environment: { name: "synthetic" },
  service: { name: "quickstart-service" },
  sink,
});

const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-quickstart-1",
  effective_tenant_id: "tenant-quickstart-1",
  resource_tenant_id: "tenant-quickstart-1",
});

const actor = authenticatedHumanActor({
  id: "actor-quickstart-1",
  displayName: "Quickstart User",
});

const result = await sdk.authenticationSucceeded({
  actor,
  tenant,
  authenticated_principal: authenticatedPrincipal({
    type: "human_user",
    id: "principal-quickstart-1",
    issuer: "https://idp.synthetic.test",
  }),
  authentication: authenticationEvidence({
    method: "password_mfa",
    assurance_level: "aal2",
    mfa_state: "satisfied",
    credential_type: "session",
    authenticated_at: "2026-09-25T12:00:00.000Z",
    identity_provider: "https://idp.synthetic.test",
    delegated: false,
    impersonated: false,
  }),
  credential: credentialReference({
    type: "session",
    reference: "cred-quickstart-1",
    key_id: "pseudonym-key-v1",
  }),
  session: sessionEvidence({
    id: "session-quickstart-1",
    created_at: "2026-09-25T12:00:00.000Z",
    age_seconds: 60,
    assurance_level: "aal2",
  }),
  source: observedSource({
    observed: {
      address: "127.0.0.1",
      port: 443,
    },
  }),
});

// Authority constructors throw synchronously on invalid input;
// named SDK methods return AuditResult and never throw.
if (result.ok) {
  assert.equal(result.value.status, "accepted");
} else {
  console.error("Audit emit failed:", result.error.code, result.error.path);
}

// Drain in-flight sends and shut down the SDK cleanly
await sdk.flush();
await sdk.shutdown();
```

## Authentication Failure and Per-Request Context Scope

When authentication fails, emit `authenticationFailed` before a session or context is created. For authenticated requests, establish a per-request context scope using `sdk.runWithContext`. The active scope's `actor` and `tenant` automatically apply to all audit calls inside the callback, even after asynchronous operations (`await`), eliminating boilerplate and preventing identity drifting:

```typescript
import {
  createNodeSecurityAuditSdk,
  nodeContextProvider,
} from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeTenant,
  authoritativeResource,
  authorizationEvidence,
  observedSource,
  authenticationEvidence,
} from "@bloodtrail/security-audit-sdk-core";
import assert from "node:assert/strict";

const sdk = createNodeSecurityAuditSdk({
  contractVersion: "2.1.0",
  producer: { name: "quickstart-service", version: "0.1.0" },
  environment: { name: "synthetic" },
  service: { name: "quickstart-service" },
  sink: {
    async emit() {
      return { status: "accepted" };
    },
  },
});

// 1. Handling authentication failure
const authFailedResult = await sdk.authenticationFailed({
  actor: authenticatedHumanActor({
    id: "actor-failed-login",
    displayName: "Unknown User",
  }),
  tenant: authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-quickstart-1",
    effective_tenant_id: "tenant-quickstart-1",
    resource_tenant_id: "tenant-quickstart-1",
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
    id: "req-failed-login-1",
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
assert.equal(authFailedResult.ok, true);

// 2. Establishing per-request context scope across asynchronous operations
const requestActor = authenticatedHumanActor({
  id: "actor-quickstart-user",
  displayName: "Quickstart User",
});

const requestTenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-quickstart-1",
  effective_tenant_id: "tenant-quickstart-1",
  resource_tenant_id: "tenant-quickstart-1",
});

await sdk.runWithContext({ actor: requestActor, tenant: requestTenant }, async () => {
  // Asynchronous calls inside this callback inherit the active context
  await new Promise((resolve) => setTimeout(resolve, 10));

  // The active context frame survives the await across asynchronous continuations
  const activeContext = nodeContextProvider.get();
  assert.ok(activeContext?.actor);
  assert.ok(activeContext?.tenant);

  // Emitting authorization denial after async work
  const authzResult = await sdk.authorizationDenied({
    actor: activeContext.actor,
    tenant: activeContext.tenant,
    resource: authoritativeResource({
      type: "authorization_policy",
      id: "policy-quickstart-1",
      owning_tenant_id: "tenant-quickstart-1",
      data_classification: "confidential",
      operation_type: "execute",
      change_categories: ["metadata"],
    }),
    authorization: authorizationEvidence({
      decision: "deny",
      policy_id: "policy.quickstart-1",
      policy_version: "1.0.0",
      capability: "evaluate_authorization",
      enforcement_point: "policy-enforcement-point",
      decision_reason: "policy_denied",
      resource_context: {
        type: "authorization_policy",
        id: "policy-quickstart-1",
      },
      tenant_context: {
        effective_tenant_id: "tenant-quickstart-1",
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
  assert.equal(authzResult.ok, true);
});

await sdk.shutdown();
```

## Running the Example Receiver

To see audit events arriving and passing validation over HTTP:

1. Start the receiver in one terminal:
   ```bash
   node examples/evaluation-receiver.ts 3000
   ```
2. Run the evaluation service in a second terminal:
   ```bash
   node examples/evaluation-service.ts http://127.0.0.1:3000
   ```
The receiver authenticates the request, validates the event structure, asserts that the received body is byte-identical to what the SDK validated, and responds with the wire-protocol acknowledgment.
