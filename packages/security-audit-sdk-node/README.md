# @bloodtrail/security-audit-sdk-node

First-party Node.js platform binding for Bloodtrail security audit events.

## API Stability: Frozen

The public API surface of this package is **frozen** under ADR-NODE-001 (#111), which fixed it at 13 value
exports and 24 type-only exports. It widens only additively, each time through a governed change that records
an amendment: ADR-NODE-002 (#112), ADR-NODE-003 (#113) and ADR-NODE-004 (#589), which added the HTTP audit
sink. It now has 19 value exports and 44 type-only exports. `npm run test:exports` fails on any export added,
removed or renamed outside such a change. ADR-NODE-005 (#859, #860) widened two result unions without adding
an export, and ADR-NODE-007 (#913) widened `DeliveryClassRefusalCode` the same way.

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

The report counts admissions, not promises. Each admitted `submit()` call is
counted exactly once, so `completed + abandoned` always equals `accepted`, even
when two calls' operations return the same promise. `completed` means settled,
whether the operation resolved or rejected. An operation that throws
synchronously instead of returning a promise, and a submission that is not a
function, count as an operation that rejected with that error: the admission
is accepted, its `submit()` call rejects with the error, and it counts as
completed once the module observes that rejection.

Both counts are taken in one synchronous step, at the first of: `shutdown()`
being called with nothing outstanding, the timer provider calling the deadline
callback, or the module observing the last outstanding operation settle. An
operation counts as completed only if the module has observed it settle by that
step, and the module observes a settlement at least one microtask turn after
the operation's promise settles. So an operation that settles in the same
synchronous run as the deadline callback, before or after it, counts as
`abandoned`; its own `submit()` call still resolves with its result.

The report resolves a few promise reactions after that step, never in it.
When the step is the last outstanding operation's settlement, that operation's
`submit()` call has settled before the report resolves, so code awaiting that
call directly runs before code awaiting the report. The binding promises no
ordering further along a chain of awaits. A host that needs every outcome
before it acts on the report, for example before it exits, awaits the
`submit()` calls themselves.

A `shutdown()` called from inside an admitted operation counts that operation
as outstanding, like any other. An operation that calls `shutdown()` and then
awaits the report waits for the deadline timer: the report waits for the
operation, so only the timer ends the wait, and the operation is counted
`abandoned`. To shut down from inside an operation without that wait, call
`shutdown()` there without awaiting it.

`deadlineMs` is not a bound on when the shutdown report resolves. It is the
delay `shutdown()` passes to the injected timer provider, and the shutdown
module reads no clock or timer of its own. While admitted work is still
outstanding, nothing is counted `abandoned` and the report does not resolve
before that timer fires. If work is still outstanding when it fires, the report
resolves after it, and the binding states no bound on how long after: that
depends on the timer provider and on whatever else the event loop is running.
With `nodeTimers`, measured on a clock, the report can resolve after
`deadlineMs`, or slightly before it, because a Node timer can fire early.

A host with its own outer shutdown deadline should therefore pass a smaller
`deadlineMs` and keep the difference for the report to return. How much to
keep depends on the host. One observation, not a recommended value or a bound:
Stage 2's reference composition passed 180 ms inside a 200 ms outer deadline
(#899), and on one workstation its reports returned 0.58 to 2.73 ms after the
180 ms.

## Transaction-critical delivery

`createTransactionCriticalDelivery` orders audit durability around the caller's business commit for
`transaction_critical` events. It probes audit durability, runs the caller's commit gate, and only then hands
the occurrence to the durability point, in one attempt (ADR-NODE-005).

When `deliver()` is called, the binding takes one snapshot of the occurrence: its JSON serialization, parsed back
and frozen at every depth. It checks, delivers and reports only that snapshot, so a change the caller makes to its
own object afterwards reaches neither the durable bytes nor the result (ADR-NODE-007). Before anything runs, it
refuses, in this order:
- an occurrence it cannot serialize;
- an occurrence whose serialization is larger than the contract's event size limit, 65,536 UTF-8 bytes
  (ADR-NODE-008);
- an event outside the catalog, or one of another class;
- an empty transaction identifier;
- a commit state that the event's own catalog entry does not allow.

A refused occurrence is not recorded for deduplication, so a corrected one can be offered under the same pair.

| Situation | Result |
|---|---|
| The occurrence has no JSON serialization, such as one holding a BigInt or a cycle | `refused` / `occurrence_not_serializable`; nothing runs (#913) |
| The occurrence's JSON serialization is larger than 65,536 UTF-8 bytes, whatever its commit state | `refused` / `occurrence_too_large`; nothing runs (#945) |
| The event name is not in the catalog, or the value is not an occurrence object | `refused` / `unknown_event_name`; nothing runs |
| The event's catalog entry declares another delivery class | `refused` / `delivery_class_mismatch`; nothing runs |
| The transaction identifier is empty | `refused` / `transaction_id_required`; nothing runs |
| The occurrence's commit state is absent, or its event's catalog entry does not allow it | `refused` / `commit_state_not_allowed`; nothing runs (#913) |
| The probe returns anything but `true`, or rejects | `failed_closed` / `audit_durability_unreachable`; the gate never runs |
| The gate returns `"declined"` | `failed_closed` / `business_commit_declined` |
| The gate returns anything but `"committed"` or `"declined"`, or rejects | `failed_closed` / `business_commit_unconfirmed` |
| The occurrence's commit state is `not_committed` | the gate never runs; `durable_without_commit` once acknowledged |
| The occurrence's commit state is `partially_committed` | the gate runs; `partially_committed_and_durable` once committed and acknowledged (#869) |
| The occurrence's commit state is `compensated` | the gate runs; `compensated_and_durable` once committed and acknowledged (#869) |
| The handoff fails or rejects for a `not_committed` occurrence | `failed_closed` / `audit_durability_unreachable`, with `durabilityAttempted: true` |
| The handoff fails or rejects after the gate committed | `failed_closed` / `audit_durability_failed_after_commit` |
| The occurrence's commit state is `committed`, the gate committed and the handoff acknowledged | `committed_and_durable` |
| The pair already reached durability through this binding instance | `already_delivered`; nothing runs |
| The pair is still being delivered through this binding instance | `refused` / `duplicate_transaction_delivery`; nothing runs |

`deliver()` returns one of these results and does not reject, whether a probe, gate or handoff rejects or the
occurrence cannot be read. Every `failed_closed` result also records `commitGateInvoked` and `durabilityAttempted`.
A refusal records neither, because nothing has run.

The result is not commit evidence: read whether the business change committed from the occurrence's own
`event.commit_state`. The binding does not provide the following, which are not implemented:

- **business and audit atomicity.** `failsClosedBeforeCommit` covers failures before the commit gate runs. A
  failure after it is reported, but the business commit has already happened;
- **persistent retry.** It makes one handoff attempt and holds nothing for later;
- **deduplication across instances.** The event id and transaction id pair is remembered in memory, inside
  one binding instance only.

### Redelivering after a failure following the commit

A pair that failed closed is not recorded as delivered, so the host can offer it again. Two failures after the
commit gate ran leave a business change that has, or may have, committed, and they tell the host different things:

| Result | What the host knows |
|---|---|
| `audit_durability_failed_after_commit` | The gate returned `"committed"`: the business change has committed, and its record is not durable |
| `business_commit_unconfirmed` | The gate ran but confirmed nothing: the change may or may not have committed |

Calling `deliver()` again for the same event id and transaction id runs the whole order again: the durability
probe; once it returns `true`, the commit gate; and once the gate returns `"committed"`, the handoff. The binding
does not skip the gate because an earlier attempt ran it, and it cannot tell what that gate did. A gate that
commits every time it runs therefore commits the business change a second time. The same holds through a new
binding instance, which remembers nothing of the first.

The redelivery is durability-only when the gate is a **reconciling commit gate**, one that confirms a business
change that already committed instead of committing it again:

- **Built for one transaction.** The binding calls the gate with no arguments, so the host builds a gate for one
  transaction identifier on each delivery, closing over that identifier. A single gate shared across transactions
  cannot know which one a call concerns, so it cannot reconcile.
- **`"committed"`** only for a business change it confirms committed, whether it commits the change on that call
  or finds it already committed. It never commits the change twice, including for two occurrences that share the
  transaction identifier. The binding refuses only a concurrent delivery of the same pair, so two such occurrences
  can reach the gate at once. The gate's check and its commit must therefore be atomic against any other gate call
  for the same transaction identifier, so that two calls cannot both find the change uncommitted and both commit it.
- **`"declined"`** for a change that has not committed and will not be. The record then never becomes durable
  (`business_commit_declined`), which is correct, because the occurrence claims a commit that did not happen.
- **A rejection** when it cannot tell. The binding reports `business_commit_unconfirmed` again.

The host also:

- **bounds** how many times it redelivers one pair;
- **alerts** while the record of a committed change is still not durable. That is the `transaction_critical`
  row's backlog alert after commit, and the binding raises none itself;
- **keeps its own durable record for crashes.** The binding retains nothing of a failed delivery: in memory, it
  records only the pairs that reached durability. To redeliver after the process stops, the host keeps the
  occurrence in its own durable store (G5), such as an outbox, and relays it from there.

The fraud evidence profile's requirement "Host redelivery after a failure following the commit" states these
obligations, and ADR-NODE-006 records the decision (#870).

### Migration (#859, #860, #869, #913, #945)

- **Size refusal (#945).** `DeliveryClassRefusalCode` gains `occurrence_too_large`. An occurrence whose JSON
  serialization is larger than the contract's event size limit, 65,536 UTF-8 bytes, used to run the commit gate and
  then fail as `audit_durability_failed_after_commit`, because the handoff was the first to measure it. It is now
  refused before the probe runs, whatever its commit state, and before every other refusal except
  `occurrence_not_serializable`. An occurrence of exactly 65,536 bytes is delivered as before. Occurrences that
  sdk-core built get the same results, because sdk-core never returns an event over the limit. A host that switches
  exhaustively over the code gets a type error until it handles the new value.

  The binding still does not check an occurrence's depth, array lengths, string lengths or schema validity. A
  host-built occurrence that the collector rejects for one of those still runs the gate and fails afterwards.
- **Admission refusals (#913).** `DeliveryClassRefusalCode` gains `commit_state_not_allowed` and
  `occurrence_not_serializable`. Both are refused before the probe runs:
  - An occurrence whose commit state is absent, or not one its event's catalog entry allows, used to run the gate
    and claim a commit. Examples are `pending`, `unknown`, `not_started`, `not_applicable`, and `compensated` for
    an event other than `bloodtrail.audit.data.sensitive_resource.modified`. Such an occurrence is now refused as
    `commit_state_not_allowed`.
  - An occurrence with no JSON serialization used to run the gate and fail as
    `audit_durability_failed_after_commit`. It is now refused as `occurrence_not_serializable`.

  `null` and other values that are not occurrence objects used to make `deliver()` reject. They are now refused as
  `unknown_event_name`. Occurrences that sdk-core built get the same results, but the handoff now receives a
  frozen copy rather than the object passed to `deliver()`. A host that switches exhaustively
  over the code gets a type error until it handles both values.
- **One snapshot (#913).** The binding delivers and reports the occurrence as it was when `deliver()` was called.
  A change the caller made to its object during delivery used to reach the durable bytes or the status. It no
  longer does.
- **Equality on `committed_and_durable` (#869).** Since #869, a check that the status equals
  `committed_and_durable` no longer matches a `partially_committed` or `compensated` occurrence that reached
  durability. A host that means "reached durability" tests for any of the four durable statuses.

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
