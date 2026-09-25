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

## Per-Request Context Scope

Use `sdk.runWithContext` to bind contextual information like tenant context across asynchronous operations:

```typescript
import {
  createNodeSecurityAuditSdk,
} from "@bloodtrail/security-audit-sdk-node";
import {
  authoritativeTenant,
} from "@bloodtrail/security-audit-sdk-core";

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

const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-quickstart-1",
  effective_tenant_id: "tenant-quickstart-1",
  resource_tenant_id: "tenant-quickstart-1",
});

await sdk.runWithContext({ tenant }, async () => {
  // Asynchronous calls inside this callback inherit the active context
  await sdk.flush();
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
