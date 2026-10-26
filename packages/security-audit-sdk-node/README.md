# @bloodtrail/security-audit-sdk-node

First-party Node.js platform binding for Bloodtrail security audit events.

## API Stability: Frozen

The public API surface of this package is **frozen** under ADR-NODE-001 (#111), which fixed it at 13 value
exports and 24 type-only exports. It widens only additively, each time through a governed change that records
an amendment: ADR-NODE-002 (#112), ADR-NODE-003 (#113) and ADR-NODE-004 (#589), which added the HTTP audit
sink. It now has 19 value exports and 44 type-only exports. `npm run test:exports` fails on any export added,
removed or renamed outside such a change. ADR-NODE-005 (#859, #860) widened two result unions without adding
an export.

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

## Delivery primitives outside the evaluated path

The evaluation alpha delivers through `createHttpAuditSink`: one attempt per event over the fetch delivery
adapter below, with no retry, no queue and no ordering. The other four primitives below, the single-attempt
handoff, bounded retry, bounded backpressure and deadline-bounded shutdown, are frozen exports of this
package, but no evaluated path uses them, and the evaluation does not exercise them.

## Single-attempt HTTP handoff

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
| body-read error other than deadline | `transport_failure` | `retryable` |
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

## Bounded delivery retry

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

## Bounded delivery backpressure

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

## Deadline-bounded delivery shutdown

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

## Transaction-critical delivery

`createTransactionCriticalDelivery` orders audit durability around the caller's business commit for
`transaction_critical` events. It probes audit durability, runs the caller's commit gate, and only then hands
the occurrence to the durability point, in one attempt (ADR-NODE-005).

| Situation | Result |
|---|---|
| The probe returns anything but `true`, or rejects | `failed_closed` / `audit_durability_unreachable`; the gate never runs |
| The gate returns `"declined"` | `failed_closed` / `business_commit_declined` |
| The gate returns anything but `"committed"` or `"declined"`, or rejects | `failed_closed` / `business_commit_unconfirmed` |
| The occurrence's commit state is `not_committed` | the gate never runs; `durable_without_commit` once acknowledged |
| The occurrence's commit state is `partially_committed` | the gate runs; `partially_committed_and_durable` once committed and acknowledged (#869) |
| The occurrence's commit state is `compensated` | the gate runs; `compensated_and_durable` once committed and acknowledged (#869) |
| The handoff fails or rejects for a `not_committed` occurrence | `failed_closed` / `audit_durability_unreachable`, with `durabilityAttempted: true` |
| The handoff fails or rejects after the gate committed | `failed_closed` / `audit_durability_failed_after_commit` |
| The gate committed and the handoff acknowledged (and commit state is `committed`) | `committed_and_durable` |

`deliver()` returns one of these results and does not reject because a probe, gate or handoff did. Every
failure also records `commitGateInvoked` and `durabilityAttempted`.

`audit_durability_failed_after_commit` means the business change has committed. `business_commit_unconfirmed`
means the gate ran, so the change may have committed. Calling `deliver()` again for the same pair runs the commit
gate again, so reconcile the business change first (#870).

The result is not commit evidence: read whether the business change committed from the occurrence's own
`event.commit_state`. The binding does not provide the following, which are not implemented:

- **business and audit atomicity.** `failsClosedBeforeCommit` covers failures before the commit gate runs. A
  failure after it is reported, but the business commit has already happened;
- **persistent retry.** It makes one handoff attempt and holds nothing for later;
- **deduplication across instances.** The event id and transaction id pair is remembered in memory, inside
  one binding instance only.

### Migration (#859, #860, #869)

- **Qualified durable values (#869).** `TransactionCriticalDeliveryResult` gains the statuses
  `partially_committed_and_durable` and `compensated_and_durable`. An occurrence whose commit state is
  `partially_committed` or `compensated` runs the commit gate and reports the corresponding qualified outcome
  once committed and acknowledged, rather than over-claiming `committed_and_durable`.
- **New values (#859, #860).** `TransactionCriticalDeliveryResult` gains the status `durable_without_commit`, and
  `DeliveryClassRefusalCode` gains `business_commit_unconfirmed` and `audit_durability_failed_after_commit`. A
  host that switches exhaustively over the status or the code gets a type error until it handles them.
- **Stricter values.** A probe or gate result outside its declared type used to continue. It now fails closed.
- **After the commit.** A handoff failure after the gate committed used to be `audit_durability_unreachable`.
  It is now `audit_durability_failed_after_commit`, so a host that compensates a committed business change
  should key on that code.
- **Uncommitted occurrences.** A `not_committed` occurrence used to run the gate and report
  `committed_and_durable`. It now skips the gate and reports `durable_without_commit`.

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
