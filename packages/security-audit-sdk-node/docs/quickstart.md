# Quickstart: Bloodtrail Security Audit SDK (Node.js)

Get from the evaluation kit to your first accepted audit event delivered over HTTP in 15 minutes or less.

Follow **Your First Accepted Event** below, in order.

## Runtime & Prerequisites

- **Supported Node versions:** Node 24 and Node 26 (`>=24 <25 || >=26 <27`).
- **Recommended Node version:** A current Node 24.x release (such as 24.8.x or later). Node 24.2.0 prints an experimental type-stripping warning when executing TypeScript files directly.
- **Declared range:** The declared range for consumer projects is `>=5.9.2 <6`.
- **Measured compatibility:** The kit exhibits measured compatibility with TypeScript 6.0.x and 7.0.x (the example sources and all doc code blocks type-check successfully with TypeScript 6 and 7, outside the declared range). The runtime does not depend on the TypeScript version because Node strips types.
- **Loopback and synthetic data only:** All evaluation data must remain synthetic, and evaluation network traffic stays strictly on loopback (`127.0.0.1`).
- **Non-production environments:** `environment.name` must never be set to a production value. Use `"development"`, `"test"`, or `"synthetic"`.

## Installation

The supported installers are npm, as bundled with Node 24 and Node 26, and pnpm 10, 11 and 12. Inside the evaluation kit directory, install the local tarballs with one of them:

**Using npm:**
```bash
npm install
```

**Using pnpm:**
```bash
pnpm install
```

The kit pins `@bloodtrail/security-audit-sdk-core` to its own tarball, so exactly one core copy is resolved across all dependencies. npm reads the pin from the `overrides` field of the generated `package.json`. pnpm reads it from the kit's generated `pnpm-workspace.yaml`, because pnpm 11 and later no longer read the `pnpm` field in `package.json`.

> [!WARNING]
> **Unsupported installers and configurations:**
> - **Yarn is unsupported:** Yarn's hoisting algorithms do not honor the required single-copy Core resolution constraints and will lead to authority resolution failures.
> - **Standalone Node binding install is unsupported:** `@bloodtrail/security-audit-sdk-node` lists `@bloodtrail/security-audit-sdk-core` as a regular dependency, not a peer dependency. The kit provides that core as its own tarball and pins it, so installing the Node binding on its own has no core to resolve. Always install the complete kit through its generated `package.json`.

## Your First Accepted Event

Run every command on this page from the kit directory, the directory that holds the kit's `package.json`. Each TypeScript block on this page is a complete program. To run one, save it as a `.ts` file in the kit directory, so that its imports resolve to the installed packages, and run it with `node <file>.ts`. Node strips the types itself, so there is no build step.

To reach your first accepted event, follow these steps in order:

1. **Install** the kit, as described above.
2. **Start the example receiver** in a terminal of its own, and leave it running:
   ```bash
   node examples/evaluation-receiver.ts 3000
   ```
   It prints `receiver:ready` and its origin once it listens on `127.0.0.1` port 3000. It accepts the synthetic token `fixture-token-a`, which the authentication-success block sends.
3. **Run the authentication-success block.** Save the code block under **Emitting Authentication Success** below as `first-accepted-event.ts`, then run it from a second terminal:
   ```bash
   node first-accepted-event.ts
   ```
4. **See the event accepted.** The program prints `quickstart:accepted`. The receiver's terminal prints `receiver:accepted`, the event identifier, and the event exactly as it arrived.

If the program prints `Audit emit failed:` and an error code instead, the receiver is not running on port 3000. Start it, then run the program again.

### An Offline Check

`examples/first-event.ts` is an offline check that needs no receiver. Run `node examples/first-event.ts`: it emits one event into an in-memory sink, checks it, and prints `first-event:pass`. Nothing travels over HTTP and no receiver accepts anything, so it is not your first accepted event. Use it to confirm that the installed packages load and emit before you start the receiver.

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
  console.log(`quickstart:${result.value.status}`);
} else {
  console.error("Audit emit failed:", result.error.code, result.error.path);
}

// Drain in-flight sends and shut down the SDK cleanly
await sdk.flush();
await sdk.shutdown();
```

## Authentication Failure and Per-Request Context Scope

When authentication fails, emit `authenticationFailed` before a session or context is created. For authenticated requests, open a per-request context scope with `sdk.runWithContext`.

**What the scope supplies at runtime.** The SDK builds each event's context from three sources, each overriding the one before: the configuration's `authoritativeContext`, the active scope, and the call's own input. Inside the callback, including after `await`, the scope's `actor`, `tenant` and other context fields fill in whatever a call leaves out. The SDK generates the correlation identifier and the operation identifier when none of the three supplies them.

**What the types still require.** The named-method input types do not know about the scope. Each method's type requires its event's context: 23 of the 24 methods require `actor`, 20 require `tenant`, and 7, such as `accountRegistrationAttempted` and `authenticationFailed`, also require `correlation`. A call inside a scope therefore still passes them. Below, the call reads them back from the active scope with `nodeContextProvider.get()`. See the known issue on over-required input types.

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

## Sensitive Resource Operations: View and Committed Modification

The evaluation kit demonstrates five canonical events:
1. `authenticationFailed`
2. `authorizationDenied`
3. `authenticationSucceeded`
4. `sensitiveResourceViewed`
5. `sensitiveResourceModified`

State modifications that change security-sensitive data must use `sdk.beginOperation` to track the lifecycle of the change. The audit event's `commit_state` originates from the operation handle when transitioned via `markCommitted()`, never from arbitrary caller input:

```typescript
import {
  createNodeSecurityAuditSdk,
} from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeTenant,
  authoritativeResource,
  authorizationEvidence,
  authenticatedPrincipal,
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

const actor = authenticatedHumanActor({
  id: "actor-quickstart-user",
  displayName: "Quickstart User",
});

const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-quickstart-1",
  effective_tenant_id: "tenant-quickstart-1",
  resource_tenant_id: "tenant-quickstart-1",
});

const principal = authenticatedPrincipal({
  type: "human_user",
  id: "principal-quickstart-1",
  issuer: "https://idp.synthetic.test",
});

// 1. Sensitive resource viewed
const recordResourceView = authoritativeResource({
  type: "sensitive_record",
  id: "record-quickstart-1",
  owning_tenant_id: "tenant-quickstart-1",
  data_classification: "confidential",
  operation_type: "read",
  change_categories: ["metadata"],
});

const authzView = authorizationEvidence({
  decision: "allow",
  policy_id: "policy.quickstart-view",
  policy_version: "1.0.0",
  capability: "read_record",
  enforcement_point: "data-service",
  decision_reason: "accepted",
  resource_context: {
    type: "sensitive_record",
    id: "record-quickstart-1",
  },
  tenant_context: {
    effective_tenant_id: "tenant-quickstart-1",
  },
});

const viewResult = await sdk.sensitiveResourceViewed({
  actor,
  authenticated_principal: principal,
  tenant,
  resource: recordResourceView,
  authorization: authzView,
  request: {
    id: "req-view-1",
    method: "GET",
    route: "/api/v1/records/record-quickstart-1",
  },
});
assert.equal(viewResult.ok, true);

// 2. Sensitive resource modified with transaction commit
// Begin a transactional operation bound to the modification event
const op = sdk.beginOperation({
  operationId: "22222222-2222-4222-8222-000000000401",
  transactionId: "22222222-2222-4222-8222-000000000402",
  boundEvent: "sensitiveResourceModified",
  transactional: true,
});
assert.equal(op.ok, true);

const recordResourceModify = authoritativeResource({
  type: "sensitive_record",
  id: "record-quickstart-1",
  owning_tenant_id: "tenant-quickstart-1",
  data_classification: "confidential",
  operation_type: "update",
  change_categories: ["metadata"],
});

const authzModify = authorizationEvidence({
  decision: "allow",
  policy_id: "policy.quickstart-modify",
  policy_version: "1.0.0",
  capability: "update_record",
  enforcement_point: "data-service",
  decision_reason: "accepted",
  resource_context: {
    type: "sensitive_record",
    id: "record-quickstart-1",
  },
  tenant_context: {
    effective_tenant_id: "tenant-quickstart-1",
  },
});

// Mark the operation handle committed once the database transaction commits
op.value.markCommitted();

// Emit the modification event; commit_state originates from the operation handle, never caller input
const modifyResult = await sdk.sensitiveResourceModified({
  actor,
  tenant,
  resource: recordResourceModify,
  authorization: authzModify,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000403",
    operation_id: op.value.operationId,
  },
  operation: op.value,
});
assert.equal(modifyResult.ok, true);

await sdk.shutdown();
```

## Running the Example Service and Receiver

To see audit events arriving and passing validation over HTTP:

1. Start the receiver in one terminal, unless it is still running from your first accepted event:
   ```bash
   node examples/evaluation-receiver.ts 3000
   ```
2. Start the evaluation service in a second terminal:
   ```bash
   node examples/evaluation-service.ts 3001 http://127.0.0.1:3000
   ```
3. Run the driver in a third terminal:
   ```bash
   node examples/evaluation-driver.ts http://127.0.0.1:3001
   ```
The receiver authenticates the request, validates the event with `validateSecurityAuditEvent`, and responds with the wire-protocol acknowledgment.

Each side prints every event in full, one per line. The service prints `service:validated` and the event exactly as the SDK hands it to the HTTP audit sink, just before the sink sends it. The receiver prints `receiver:accepted`, the event identifier, and the event exactly as it arrived. The bytes the receiver received equal the bytes the SDK handed to the HTTP audit sink, and the kit's gate asserts that for every event.
