# Integration and Testing

This page shows how to add the kit to your own service and map the example service onto it: wiring the SDK into an
Express or Fastify handler, testing with the core's test sinks, and making events deterministic in tests.

Every value on this page is synthetic, and no snippet sets a production environment.

## Adding the Kit to Your Own Service

M2 integrates the SDK into your own service, outside the kit directory. Your service needs both SDK packages from
the kit's tarballs and the kit's core pin, so that every dependency resolves to the kit's single core copy.
Installing the Node binding on its own is unsupported, so always add both packages and the pin together.

These steps cover a standalone service, one that is not part of an npm or pnpm workspace. A service inside a
workspace is not covered, so use a standalone test service for M2. The supported installers are npm, as bundled
with Node 24 and Node 26, and pnpm 10, 11 and 12.

The snippets below assume that the kit directory sits next to your service's directory, as `../evaluation-kit`.
If it is elsewhere, replace `../evaluation-kit` in every path with the path from your service's directory to the
kit directory. Keep the kit directory in place while your service uses its tarballs.

**Add both packages and the npm pin** to your service's `package.json`, merging them into any entries it already
has:

```json
{
  "dependencies": {
    "@bloodtrail/security-audit-sdk-core": "file:../evaluation-kit/bloodtrail-security-audit-sdk-core-0.4.0.tgz",
    "@bloodtrail/security-audit-sdk-node": "file:../evaluation-kit/bloodtrail-security-audit-sdk-node-0.4.0.tgz"
  },
  "overrides": {
    "@bloodtrail/security-audit-sdk-core": "file:../evaluation-kit/bloodtrail-security-audit-sdk-core-0.4.0.tgz"
  }
}
```

**With pnpm, also add the pnpm pin.** pnpm does not read npm's `overrides` field, and pnpm 11 and later no longer
read the `pnpm` field in `package.json`, so the pin goes in your service's `pnpm-workspace.yaml`. Create the file
if your service has none, or merge the entry into its `overrides`:

```yaml
overrides:
  "@bloodtrail/security-audit-sdk-core": "file:../evaluation-kit/bloodtrail-security-audit-sdk-core-0.4.0.tgz"
```

**Install** from your service's directory:

```bash
npm install
```

or:

```bash
pnpm install
```

## Wiring a Framework Handler by Hand

Framework adapters are planned, as `docs/supported-and-planned.md` records, and the alpha ships
none. You wire the SDK into a handler yourself:

1. Resolve the authenticated actor and tenant, as your authentication middleware already does.
2. Open a per-request context scope with `sdk.runWithContext`.
3. Emit the event inside the scope, then reply.

Each snippet below declares the few request and response members it uses as a small structural type, named
as the framework names them. The snippet therefore type-checks with no framework dependency, and an Express
or Fastify object has those members. Each snippet ends by calling its handler once with a synthetic request,
so it runs on its own.

### Express

```typescript
import assert from "node:assert/strict";
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeResource,
  authoritativeTenant,
  authorizationEvidence,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";
import { createCapturingAuditSink } from "@bloodtrail/security-audit-sdk-core/testing";

// The members of an Express request and response that this handler uses.
interface ExpressLikeRequest {
  readonly ip?: string;
  get(name: string): string | undefined;
}
interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  json(body: unknown): unknown;
}

const sink = createCapturingAuditSink();
const sdk = createNodeSecurityAuditSdk({
  contractVersion: "2.1.0",
  producer: { name: "express-example", version: "0.1.0" },
  environment: { name: "synthetic" },
  service: { name: "express-example" },
  sink,
});

// In your application: app.post("/api/v1/actions/denied", deniedHandler)
async function deniedHandler(req: ExpressLikeRequest, res: ExpressLikeResponse): Promise<void> {
  // Your authentication middleware resolves these. Here they are synthetic.
  const actor = authenticatedHumanActor({ id: "actor-express-user", displayName: "Express User" });
  const tenant = authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-express-1",
    effective_tenant_id: "tenant-express-1",
    resource_tenant_id: "tenant-express-1",
  });

  await sdk.runWithContext({ actor, tenant }, async () => {
    // The scope supplies actor and tenant at runtime; the input type still requires them.
    const result = await sdk.authorizationDenied({
      actor,
      tenant,
      resource: authoritativeResource({
        type: "authorization_policy",
        id: "policy-express-1",
        owning_tenant_id: "tenant-express-1",
        data_classification: "confidential",
        operation_type: "execute",
        change_categories: ["metadata"],
      }),
      authorization: authorizationEvidence({
        decision: "deny",
        policy_id: "policy.express-1",
        policy_version: "1.0.0",
        capability: "evaluate_authorization",
        enforcement_point: "policy-enforcement-point",
        decision_reason: "policy_denied",
        resource_context: { type: "authorization_policy", id: "policy-express-1" },
        tenant_context: { effective_tenant_id: "tenant-express-1" },
      }),
      source: observedSource({ observed: { address: req.ip ?? "127.0.0.1", port: 443 } }),
      request: { id: req.get("x-request-id") ?? "req-express-1", method: "POST", route: "/api/v1/actions/denied" },
      event: { outcome_reason: { code: "policy_denied" } },
    });
    res.status(result.ok ? 403 : 500).json({ error: "policy_denied" });
  });
}

// One synthetic request, so the snippet runs on its own.
let statusCode = 0;
const response: ExpressLikeResponse = {
  status(code) {
    statusCode = code;
    return response;
  },
  json: (body) => body,
};
await deniedHandler({ ip: "127.0.0.1", get: () => "req-express-synthetic-1" }, response);
assert.equal(statusCode, 403);
assert.equal(sink.events.length, 1);
assert.equal(sink.events[0]?.event.name, "bloodtrail.audit.authorization.denied");
await sdk.shutdown();
```

### Fastify

```typescript
import assert from "node:assert/strict";
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeResource,
  authoritativeTenant,
  authorizationEvidence,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";
import { createCapturingAuditSink } from "@bloodtrail/security-audit-sdk-core/testing";

// The members of a Fastify request and reply that this route uses.
interface FastifyLikeRequest {
  readonly ip: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}
interface FastifyLikeReply {
  code(statusCode: number): FastifyLikeReply;
  send(payload?: unknown): unknown;
}

const sink = createCapturingAuditSink();
const sdk = createNodeSecurityAuditSdk({
  contractVersion: "2.1.0",
  producer: { name: "fastify-example", version: "0.1.0" },
  environment: { name: "synthetic" },
  service: { name: "fastify-example" },
  sink,
});

// In your application: fastify.post("/api/v1/actions/denied", deniedRoute)
async function deniedRoute(request: FastifyLikeRequest, reply: FastifyLikeReply): Promise<unknown> {
  // Your authentication hook resolves these. Here they are synthetic.
  const actor = authenticatedHumanActor({ id: "actor-fastify-user", displayName: "Fastify User" });
  const tenant = authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-fastify-1",
    effective_tenant_id: "tenant-fastify-1",
    resource_tenant_id: "tenant-fastify-1",
  });
  const requestId = request.headers["x-request-id"];

  return sdk.runWithContext({ actor, tenant }, async () => {
    // The scope supplies actor and tenant at runtime; the input type still requires them.
    const result = await sdk.authorizationDenied({
      actor,
      tenant,
      resource: authoritativeResource({
        type: "authorization_policy",
        id: "policy-fastify-1",
        owning_tenant_id: "tenant-fastify-1",
        data_classification: "confidential",
        operation_type: "execute",
        change_categories: ["metadata"],
      }),
      authorization: authorizationEvidence({
        decision: "deny",
        policy_id: "policy.fastify-1",
        policy_version: "1.0.0",
        capability: "evaluate_authorization",
        enforcement_point: "policy-enforcement-point",
        decision_reason: "policy_denied",
        resource_context: { type: "authorization_policy", id: "policy-fastify-1" },
        tenant_context: { effective_tenant_id: "tenant-fastify-1" },
      }),
      source: observedSource({ observed: { address: request.ip, port: 443 } }),
      request: {
        id: typeof requestId === "string" ? requestId : "req-fastify-1",
        method: "POST",
        route: "/api/v1/actions/denied",
      },
      event: { outcome_reason: { code: "policy_denied" } },
    });
    return reply.code(result.ok ? 403 : 500).send({ error: "policy_denied" });
  });
}

// One synthetic request, so the snippet runs on its own.
let statusCode = 0;
const reply: FastifyLikeReply = {
  code(code) {
    statusCode = code;
    return reply;
  },
  send: (payload) => payload,
};
await deniedRoute({ ip: "127.0.0.1", headers: { "x-request-id": "req-fastify-synthetic-1" } }, reply);
assert.equal(statusCode, 403);
assert.equal(sink.events.length, 1);
assert.equal(sink.events[0]?.event.name, "bloodtrail.audit.authorization.denied");
await sdk.shutdown();
```

## Testing with the Core's Test Sinks

The core's `testing` entry point, `@bloodtrail/security-audit-sdk-core/testing`, provides two sinks for
tests. Neither sends anything anywhere.

- `createCapturingAuditSink()` keeps every event it receives, in order, in its `events` list. With
  `failWith`, it instead answers every event with that delivery result, or throws that error, so you can
  test how your code handles a failed delivery.
- `createInMemoryAuditSink({ capacity })` keeps only the most recent `capacity` events, 100 by default,
  dropping the oldest first.

Each captured event is a frozen copy of the event the SDK validated, so a test asserts on exactly what a
real sink would have received.

```typescript
import assert from "node:assert/strict";
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeResource,
  authoritativeTenant,
  authorizationEvidence,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";
import { createCapturingAuditSink, createInMemoryAuditSink } from "@bloodtrail/security-audit-sdk-core/testing";
import type { AuditEventSink } from "@bloodtrail/security-audit-sdk-core";

const actor = authenticatedHumanActor({ id: "actor-test-user", displayName: "Test User" });
const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-test-1",
  effective_tenant_id: "tenant-test-1",
  resource_tenant_id: "tenant-test-1",
});

function sdkWith(sink: AuditEventSink) {
  return createNodeSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "test-sink-example", version: "0.1.0" },
    environment: { name: "test" },
    service: { name: "test-sink-example" },
    sink,
  });
}

function denyPolicy(sdk: ReturnType<typeof sdkWith>) {
  return sdk.authorizationDenied({
    actor,
    tenant,
    resource: authoritativeResource({
      type: "authorization_policy",
      id: "policy-test-1",
      owning_tenant_id: "tenant-test-1",
      data_classification: "confidential",
      operation_type: "execute",
      change_categories: ["metadata"],
    }),
    authorization: authorizationEvidence({
      decision: "deny",
      policy_id: "policy.test-1",
      policy_version: "1.0.0",
      capability: "evaluate_authorization",
      enforcement_point: "policy-enforcement-point",
      decision_reason: "policy_denied",
      resource_context: { type: "authorization_policy", id: "policy-test-1" },
      tenant_context: { effective_tenant_id: "tenant-test-1" },
    }),
    source: observedSource({ observed: { address: "127.0.0.1", port: 443 } }),
    event: { outcome_reason: { code: "policy_denied" } },
  });
}

// The capturing sink keeps the event the SDK validated, so a test asserts on it.
const captured = createCapturingAuditSink();
const capturingSdk = sdkWith(captured);
const result = await denyPolicy(capturingSdk);
assert.equal(result.ok, true);
assert.equal(captured.events.length, 1);
const event = captured.events[0];
assert.equal(event?.event.name, "bloodtrail.audit.authorization.denied");
assert.equal(event?.actor?.id, "actor-test-user");
assert.equal(event?.tenant?.effective_tenant_id, "tenant-test-1");
await capturingSdk.shutdown();

// The in-memory sink keeps only the most recent events.
const recent = createInMemoryAuditSink({ capacity: 2 });
const recentSdk = sdkWith(recent);
for (let attempt = 0; attempt < 3; attempt += 1) {
  await denyPolicy(recentSdk);
}
assert.equal(recent.events.length, 2);
await recentSdk.shutdown();
```

## Deterministic Clock and Identifiers

By default, the Node binding reads the time from `new Date()` and generates every identifier with
`node:crypto.randomUUID()`. In a test, pass the `clock` and `identifiers` configuration options instead, so
that an event's timestamp and identifiers are the same on every run.

- `clock` is an `AuditClock`: one method, `now()`, returning a `Date`.
- `identifiers` is an `AuditIdentifierProvider`: one method per identifier the SDK generates, each returning
  a UUID string. The SDK rejects an event identifier it generated recently, so return a new value on each
  call, for example from a counter.

```typescript
import assert from "node:assert/strict";
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  authenticatedHumanActor,
  authoritativeResource,
  authoritativeTenant,
  authorizationEvidence,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";
import type { AuditClock, AuditIdentifierProvider } from "@bloodtrail/security-audit-sdk-core";
import { createCapturingAuditSink } from "@bloodtrail/security-audit-sdk-core/testing";

// A fixed synthetic instant.
const fixedClock: AuditClock = { now: () => new Date("2026-01-01T00:00:00.000Z") };

// A counter per identifier kind, each formatted as a UUID that names its kind in the first group.
function sequentialIdentifiers(): AuditIdentifierProvider {
  const counters = new Map<number, number>();
  const next = (kind: number): string => {
    const count = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, count);
    return `0000000${kind}-0000-4000-8000-${String(count).padStart(12, "0")}`;
  };
  return {
    eventId: () => next(1),
    operationId: () => next(2),
    correlationId: () => next(3),
    causationId: () => next(4),
    requestId: () => next(5),
    messageId: () => next(6),
    transactionId: () => next(7),
  };
}

const sink = createCapturingAuditSink();
const sdk = createNodeSecurityAuditSdk({
  contractVersion: "2.1.0",
  producer: { name: "deterministic-example", version: "0.1.0" },
  environment: { name: "test" },
  service: { name: "deterministic-example" },
  sink,
  clock: fixedClock,
  identifiers: sequentialIdentifiers(),
});

const result = await sdk.authorizationDenied({
  actor: authenticatedHumanActor({ id: "actor-deterministic-user", displayName: "Deterministic User" }),
  tenant: authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "tenant-deterministic-1",
    effective_tenant_id: "tenant-deterministic-1",
    resource_tenant_id: "tenant-deterministic-1",
  }),
  resource: authoritativeResource({
    type: "authorization_policy",
    id: "policy-deterministic-1",
    owning_tenant_id: "tenant-deterministic-1",
    data_classification: "confidential",
    operation_type: "execute",
    change_categories: ["metadata"],
  }),
  authorization: authorizationEvidence({
    decision: "deny",
    policy_id: "policy.deterministic-1",
    policy_version: "1.0.0",
    capability: "evaluate_authorization",
    enforcement_point: "policy-enforcement-point",
    decision_reason: "policy_denied",
    resource_context: { type: "authorization_policy", id: "policy-deterministic-1" },
    tenant_context: { effective_tenant_id: "tenant-deterministic-1" },
  }),
  source: observedSource({ observed: { address: "127.0.0.1", port: 443 } }),
  event: { outcome_reason: { code: "policy_denied" } },
});
assert.equal(result.ok, true);

// The same identifier and timestamp on every run.
const event = sink.events[0];
assert.equal(event?.event.id, "00000001-0000-4000-8000-000000000001");
assert.equal(event?.event.timestamp, "2026-01-01T00:00:00.000Z");
await sdk.shutdown();
```
