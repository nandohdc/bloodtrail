## Context

`@bloodtrail/security-audit-sdk-core`'s SDK already implements an analogous pattern for its own lifecycle: `shutdown()` is memoized (`#shutdownPromise ??= this.#performShutdown()`), and `createShutdownTimeout` returns `{ promise, cancel() }` racing `Promise.allSettled([...this.#inFlight])` against a cancellable timer. This module reuses that exact shape at the Node delivery layer, tracking whatever operation `delivery-retry.ts`/`delivery-backpressure.ts`/`http-handoff.ts` compose beneath it. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Close the admission boundary synchronously at the moment `shutdown()` is called — no `await` between setting the boundary and it taking effect.
- Drain in-flight work against a deadline using the injected `AuditTimerProvider`, properly cancelling the timer on the winning path (matching `createShutdownTimeout`, not just relying on `unref()`).
- Return exact, verifiable `accepted`/`completed`/`abandoned` counts.

**Non-Goals:**
- Forcibly cancelling a caller-supplied in-flight operation — JavaScript promises aren't natively cancellable, and the issue explicitly excludes guaranteeing anything about persistence after cancellation. "Abandoned" means shutdown stops waiting for it and counts it, not that the operation is killed.
- Process signal wiring (`SIGTERM`/`SIGINT`) — explicitly out of scope per the issue; this module only reacts to an explicit `shutdown()` call.
- Extending the deadline — the configured deadline is fixed at construction, matching the issue's exclusion of indefinite extension.

## Decisions

**A `Set<Promise<unknown>>` of in-flight operations, not a counter.** `delivery-backpressure.ts` only needs a depth counter because it never has to wait for specific operations later. Shutdown needs the actual promise references to race `Promise.allSettled` against the deadline and to know, after the race, exactly which ones remain outstanding (`inFlight.size` after the race is abandoned count) — a counter alone can't answer "how many are still running right now."

**Reuse the `{ promise, cancel() }` timeout shape from `sdk.ts`'s `createShutdownTimeout` rather than the bare `unref()`-only `wait()` helper in `delivery-retry.ts`.** Retry's wait is fire-and-forget (the delay always elapses). Shutdown's timer competes in a race it can lose, so leaving it uncancelled after the drain wins would hold a live timer (still `unref`'d, so harmless to process exit, but sloppier and inconsistent with the one place in this codebase that already solved this exact problem).

**Idempotency via a memoized promise field, exactly like `SecurityAuditSdk.shutdown()`.** `shutdownReport ??= drain(...)` guarantees every caller — sequential or concurrent — observes the same report and the drain logic runs exactly once.

**No new terminal status is added to the delivery-conformance-contract's state machine.** `rejected_shutting_down` is a Node-binding-specific implementation code (like `request_too_large` or `retry_exhausted` before it), not a contract-level state; the contract's `abandoned` state already covers what happens to work that doesn't finish before the deadline.

## Risks / Trade-offs

- **[A caller-supplied operation that never settles keeps its promise in the `Set` forever, growing unboundedly across repeated abandoned shutdowns]** → Out of scope for a single `shutdown()` call in this module's lifetime: `shutdown()` is intended to be called once at process end, not repeatedly against a live delivery pipeline, and it doesn't remove abandoned entries from the `Set` after reporting since nothing re-reads it after the memoized report exists.
- **[A negative or non-integer deadline would make the race meaningless]** → Mitigated by construction-time validation rejecting a non-integer or negative deadline with `TypeError`, matching the validation style already established in `delivery-retry.ts` and `delivery-backpressure.ts`.

## Migration Plan

Purely additive: a new module and export, no changes to existing handoff, retry, or backpressure code. Ship as one PR chain (propose+implement → fold → archive), consistent with #104 and #105.
