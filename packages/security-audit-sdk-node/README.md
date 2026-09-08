# @bloodtrail/security-audit-sdk-node

Provisional first-party Node.js platform binding for Bloodtrail security audit events.

## API Stability: Provisional and Unfrozen

> **PROVISIONAL STATUS NOTICE (PLAN-047):**
> The public API surface of this package is **explicitly provisional and unfrozen**. It is designed to implement concrete Node.js host capabilities for `@bloodtrail/security-audit-sdk-core` while the SDK vertical delivery contracts (#102–#109) are materialized. Final freezing of this surface is governed by issue #111.

## Overview

Following the platform-neutral extraction of `@bloodtrail/security-audit-sdk-core` (issue #86), this package supplies concrete Node.js built-in implementations of all Core platform Service Provider Interfaces (SPIs):

- **Clock (`nodeClock`):** Implements `AuditClock` using `new Date()`.
- **Identifiers (`nodeIdentifiers`):** Implements `AuditIdentifierProvider` using `node:crypto.randomUUID()`.
- **Byte Length (`nodeByteLength`):** Implements `AuditByteLengthProvider` using `Buffer.byteLength(val, "utf8")`.
- **Timers (`nodeTimers`):** Implements `AuditTimerProvider` supporting `unref()` handles without registering process signal handlers or recurring intervals.
- **Context (`nodeContextProvider`):** Implements `ContextProvider` using `node:async_hooks.AsyncLocalStorage` for strict asynchronous execution isolation.
- **Schema Runtime (`nodeSchemaRuntime`):** Implements `AuditSchemaRuntime` delegating to canonical contract schema validation.

## Package Boundaries

Per ADR 0009:
- Standalone workspace topology with dedicated `package.json` and `package-lock.json`.
- Private, unlicensed (`private: true`, `license: "UNLICENSED"`).
- **Zero third-party runtime dependencies**; depends strictly on first-party `@bloodtrail/security-audit-sdk-core`.
- Supported engines: Node `>=24 <25 || >=26 <27`.

## Single-attempt HTTP handoff (provisional)

`createHttpDeliveryHandoff` projects one canonical occurrence into a bounded
`POST` request descriptor and delegates the exchange to caller-owned code. It
does not open sockets, use `fetch` or `node:http`, schedule retries, manage a
queue, drain during shutdown, or claim durable or exactly-once delivery.

```typescript
import { createHttpDeliveryHandoff } from "@bloodtrail/security-audit-sdk-node";

const handoff = createHttpDeliveryHandoff({
  path: "/v1/security-audit",
  exchange: async (request) => {
    // The application owns the actual HTTP client and credential lifecycle.
    await sendWithApplicationOwnedClient(request);
    return {
      kind: "response",
      status: 202,
      acknowledgments: [{ event_id: request.event_id, outcome: "accepted" }],
    };
  },
});
```

Only a 2xx response with exactly one matching accepted acknowledgment produces
`acknowledged`. Retryable responses, timeouts, and exchange failures are
classified as `retryable`; permanent responses are `non_retryable`; malformed
or ambiguous acknowledgments are terminal `protocol_error`. Capacity and
shutdown behavior remain separately governed work.

## Bounded delivery retry (provisional)

`createBoundedDeliveryRetry` composes a `HttpDeliveryHandoff` with a bounded,
jittered retry schedule. Only a `retryable` outcome is ever retried; any other
terminal outcome — or a spent retry budget — stops scheduling immediately and
never exceeds the configured maximum number of attempts.

```typescript
import { createHttpDeliveryHandoff, createBoundedDeliveryRetry, nodeTimers } from "@bloodtrail/security-audit-sdk-node";

const retry = createBoundedDeliveryRetry({
  handoff: createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange }),
  maxAttempts: 5,
  baseDelayMs: 200,
  maxDelayMs: 10_000,
  jitterSource: Math.random,
  timers: nodeTimers,
});

const result = await retry.deliver(event);
// result.status: "acknowledged" | "non_retryable" | "protocol_error" | "exhausted"
```

Each retried attempt carries the occurrence's unchanged `event.id` and an
incrementing zero-based `correlation.retry_attempt`, matching the delivery
conformance contract's attempt-identity requirement. Delay before each retry is
a jittered, capped exponential backoff: `floor(min(baseDelayMs * 2^attempt,
maxDelayMs) * jitterSource())`. An optional `observability` hook exposes
`onAttemptScheduled` and `onExhausted` for callers that need retry-exhaustion
alerting.

## Bounded delivery backpressure (provisional)

`createBoundedDeliveryBackpressure` gates admission to any async delivery
operation by a bounded in-flight capacity, independent of what that operation
does. It composes above either the raw handoff or the retry-wrapped delivery —
wrap whichever one call should count as one admitted slot.

```typescript
import { createBoundedDeliveryBackpressure } from "@bloodtrail/security-audit-sdk-node";

const gate = createBoundedDeliveryBackpressure({ capacity: 64 });

const outcome = await gate.submit(() => retry.deliver(event));
// outcome.status: "admitted" (outcome.result is retry's own result) | "rejected_overload"
```

An admission attempted at capacity is rejected immediately and synchronously
with `rejected_overload` — the wrapped operation is never invoked and never
queued. Capacity is released exactly once per admitted operation when it
settles, whether it resolves or rejects, so a failure never leaks a slot. An
optional `observability` hook exposes `onAdmitted`, `onRejectedOverload`, and
`onReleased`, each receiving only numeric depth and capacity values.

## Deadline-bounded delivery shutdown (provisional)

`createDeliveryShutdown` gates admission to any async delivery operation with
a lifecycle boundary, independent of what that operation does. It composes
above the raw handoff, the retry-wrapped delivery, or the backpressure gate.

```typescript
import { createDeliveryShutdown, nodeTimers } from "@bloodtrail/security-audit-sdk-node";

const lifecycle = createDeliveryShutdown({ deadlineMs: 5000, timers: nodeTimers });

const outcome = await lifecycle.submit(() => gate.submit(() => retry.deliver(event)));
// outcome.status: "admitted" (outcome.result is the wrapped call's own result) | "rejected_shutting_down"

// At process shutdown:
const report = await lifecycle.shutdown();
// report: { accepted, completed, abandoned }
```

Once `shutdown()` is called, every subsequent `submit()` is rejected
immediately and synchronously with `rejected_shutting_down` — no wrapped
operation is invoked and no window exists for a concurrent submission to
cross the boundary. `shutdown()` drains every operation admitted before that
boundary against the configured deadline; anything still outstanding when the
deadline expires is counted `abandoned` and never reported delivered, but its
own `submit()` call still resolves once it eventually settles — shutdown
never causes an admitted operation to be lost. `shutdown()` is idempotent:
repeated calls return the identical accounting from the first call.

## Usage

```typescript
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import { CONTRACT_VERSION } from "@bloodtrail/security-audit-sdk-core";

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { id: "auth-service", name: "Authentication Service" },
  service: { id: "auth-svc", name: "Auth Svc", version: "1.0.0" },
  environment: { name: "production", region: "us-east-1" },
  sink: {
    async emit(event) {
      // Custom sink emission logic
      return { ok: true, value: { eventId: event.event.id, status: "delivered" } };
    },
  },
});
```
