# @bloodtrail/security-audit-sdk-node

Provisional first-party Node.js platform binding for Bloodtrail security audit events.

## API Stability: Frozen

The public API surface of this package is **frozen** (governed by issue #111, with amendments #112, #113, and #589). All exports, types, and runtime behaviours are locked.

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
queue, drain during shutdown, or claim durable or exactly-once delivery. The
request body is the occurrence exactly as supplied. The attempt ordinal travels
in the descriptor and the result, never in the occurrence.

```typescript
import {
  createHttpDeliveryHandoff,
  type HttpExchangeRequest,
} from "@bloodtrail/security-audit-sdk-node";

declare function sendWithApplicationOwnedClient(request: HttpExchangeRequest): Promise<void>;

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

## Fetch delivery adapter (governed, #113)

`createFetchHttpExchange` is the one delivery adapter the governed inventory approves. It supplies the
`exchange` that `createHttpDeliveryHandoff` needs, over the Node runtime's `fetch`, and maps every native
outcome onto the handoff's closed set:

| Native outcome | Exchange outcome | Handoff classification |
|---|---|---|
| response with a body | `response` + parsed `acknowledgments` | decided by the handoff (acknowledged, retryable, permanent, protocol error) |
| per-attempt deadline elapsed | `timeout` | `retryable` |
| connection refused, reset, DNS failure | `transport_failure` | `retryable` |
| unparseable, empty, shapeless, or oversized 2xx body | `response` with an unacceptable acknowledgment | `protocol_error` |
| redirect | the 3xx itself, never followed | `protocol_error` |

```ts
import { createFetchHttpExchange, createHttpDeliveryHandoff } from "@bloodtrail/security-audit-sdk-node";

const handoff = createHttpDeliveryHandoff({
  path: "/v1/security-audit",
  exchange: createFetchHttpExchange({ origin: "http://127.0.0.1:8080", timeoutMs: 2_000 }),
});
```

The origin is a scheme, host, and optional port only; a path, query, fragment, credentials in the URL,
or a non-HTTP scheme fails construction. Response bodies are read to at most `maxResponseBytes`
(default 65536). Caller-supplied headers are the caller's credentials and the adapter never logs or
echoes them. The scope gate lets `src/fetch-exchange.ts`, and nothing else, reach `fetch` and
`AbortSignal`. **Non-production:** the adapter authorizes no deployment and no delivery infrastructure;
it proves mapped observable behavior, not the peer's durability or security.

## Bounded delivery retry (provisional)

`createBoundedDeliveryRetry` composes a `HttpDeliveryHandoff` with a bounded,
jittered retry schedule. Only a `retryable` outcome is ever retried; any other
terminal outcome — or a spent retry budget — stops scheduling immediately and
never exceeds the configured maximum number of attempts.

```typescript
import {
  createHttpDeliveryHandoff,
  createBoundedDeliveryRetry,
  createFetchHttpExchange,
  nodeTimers,
} from "@bloodtrail/security-audit-sdk-node";
import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

declare const event: SecurityAuditEvent;
const exchange = createFetchHttpExchange({ origin: "http://127.0.0.1:8080", timeoutMs: 2_000 });

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

Every attempt sends the identical occurrence, byte for byte, so its `event.id`
and its `correlation.retry_attempt` are the same on every attempt. The
total attempt count is reported through the result's `attempts`, the
attempt ordinal travels in the request descriptor and `observability` hooks,
and the attempt is never written into the event (#577). This matches the
delivery conformance contract's attempt-identity requirement. Delay before each retry is
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
import {
  createBoundedDeliveryBackpressure,
  createBoundedDeliveryRetry,
  createFetchHttpExchange,
  createHttpDeliveryHandoff,
  nodeTimers,
} from "@bloodtrail/security-audit-sdk-node";
import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

declare const event: SecurityAuditEvent;
const exchange = createFetchHttpExchange({ origin: "http://127.0.0.1:8080", timeoutMs: 2_000 });
const retry = createBoundedDeliveryRetry({
  handoff: createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange }),
  maxAttempts: 5,
  baseDelayMs: 200,
  maxDelayMs: 10_000,
  jitterSource: Math.random,
  timers: nodeTimers,
});

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
import {
  createDeliveryShutdown,
  createBoundedDeliveryBackpressure,
  createBoundedDeliveryRetry,
  createFetchHttpExchange,
  createHttpDeliveryHandoff,
  nodeTimers,
} from "@bloodtrail/security-audit-sdk-node";
import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

declare const event: SecurityAuditEvent;
const exchange = createFetchHttpExchange({ origin: "http://127.0.0.1:8080", timeoutMs: 2_000 });
const retry = createBoundedDeliveryRetry({
  handoff: createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange }),
  maxAttempts: 5,
  baseDelayMs: 200,
  maxDelayMs: 10_000,
  jitterSource: Math.random,
  timers: nodeTimers,
});
const gate = createBoundedDeliveryBackpressure({ capacity: 64 });

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
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import { CONTRACT_VERSION } from "@bloodtrail/security-audit-sdk-core";

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
  headers: {
    authorization: "Bearer fixture-token",
  },
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "evaluation-producer", version: "0.1.0" },
  // service: { id: "evaluation-service", name: "Evaluation Service", version: "1.0.0" },
  service: { name: "evaluation-service", version: "0.1.0" },
  environment: { name: "synthetic" },
  sink,
});
```
