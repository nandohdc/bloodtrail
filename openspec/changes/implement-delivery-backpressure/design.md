## Context

Node is single-threaded with cooperative scheduling: no `await` occurs between a capacity check and its increment, so admission accounting needs no lock or atomic primitive — only careful ordering. `delivery-retry.ts` already establishes the pattern of a small composing module with its own construction-time validation and an optional `observability` hook. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Gate admission to *any* async delivery operation by a bounded in-flight count, decoupled from HTTP/retry specifics so it composes above either the raw handoff or the retry-wrapped delivery.
- Reject overload synchronously and deterministically — no queueing, no waiting.
- Guarantee capacity release exactly once per admitted operation regardless of success or failure.

**Non-Goals:**
- Shutdown draining (#106) — out of scope per the issue.
- Auto-scaling or dynamic capacity adjustment — the issue explicitly excludes it.
- Retrying anything — this module wraps whatever delivery operation it's given; retry behavior, if any, belongs to that operation.

## Decisions

**Generic over the wrapped operation's result type, not specialized to HTTP.** Unlike `http-handoff.ts` (necessarily HTTP-specific) and `delivery-retry.ts` (necessarily coupled to `HttpDeliveryHandoff`'s result shape for retry classification), backpressure only needs "an async function that eventually settles" — it never inspects the result to decide anything. A generic `<TResult>` type parameter avoids coupling backpressure to any one delivery mechanism, matching the issue's framing of admission control as an independent concern.

**Synchronous check-then-increment, no locks.** JavaScript's run-to-completion semantics mean the capacity check and increment are already atomic as long as no `await` sits between them. This is simpler and more obviously correct than any queue-based or promise-chaining admission scheme, and it directly satisfies "concurrent enqueue tests cannot over-admit work" without extra machinery.

**Release via `finally`, not by trusting the caller.** The wrapped operation's promise is always awaited inside a `try/finally` that decrements in-flight count in `finally`, so a rejection (thrown or rejected promise) still releases capacity — this is what prevents counter drift on the failure path, which is explicitly called out as an acceptance criterion.

**No queueing on overload.** The issue's acceptance criteria describe a *deterministic* overload result at capacity, and "Out of scope: implementing... shutdown draining" plus never dropping admitted work together imply overload must be an immediate synchronous decision, not a delayed one — queueing would reintroduce exactly the unbounded-memory risk backpressure exists to prevent.

## Risks / Trade-offs

- **[A capacity of 0 or a negative/non-integer capacity would make the gate meaningless or nonsensical]** → Mitigated by construction-time validation rejecting non-positive or non-integer capacity with `TypeError`, mirroring `delivery-retry.ts`'s validation style.
- **[Composing backpressure outside vs. inside retry scheduling changes what "one admission" means]** → Left to the caller: this module wraps whatever function it's given, so a caller who wants "one backpressure slot per retried delivery" wraps the retry module's `deliver`, while a caller who wants "one slot per HTTP attempt" wraps the raw handoff. The module itself is agnostic and documents both compositions.

## Migration Plan

Purely additive: a new module and export, no changes to existing handoff or retry code. Ship as one PR chain (propose+implement → fold → archive), consistent with #104.
