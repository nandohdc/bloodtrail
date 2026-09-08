## Context

`createHttpDeliveryHandoff` (#103) classifies exactly one attempt and hardcodes attempt ordinal `0` in both the wire request (`correlation.retry_attempt`) and the result. `AuditClock`, `AuditTimerProvider`, and `AuditTimerHandle` already exist in `@bloodtrail/security-audit-sdk-core` and are bound to Node built-ins in this package (`clock.ts`, `timers.ts`) purely for injected, deterministic scheduling in tests. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Let one occurrence be retried across multiple HTTP handoff attempts while preserving `event.id` and advancing `correlation.retry_attempt` on the wire, per the delivery conformance contract's attempt-identity requirement.
- Keep retry scheduling (budget, backoff, jitter, timers) in a module separate from the single-attempt handoff, so the handoff's own scope stays exactly what #103 shipped: one exchange per call, no scheduling.
- Make delay computation fully deterministic under test: no `Date.now()`, no `Math.random()` inside the module — both come from injected providers.

**Non-Goals:**
- Backpressure / queue capacity (#105) and shutdown draining (#106) — out of scope per the issue and left to their own changes.
- Retrying anything other than the classified `retryable` status — validation failures and other non-retryable outcomes are terminal by construction (#103) and this change does not touch that classification.
- A generic retry abstraction reusable beyond HTTP delivery — nothing in the current backlog needs that yet, so the module is typed directly against `HttpDeliveryHandoff`.

## Decisions

**Attempt ordinal becomes a parameter on `handoff()`, not a new method.** The alternative — a second `handoffAttempt(event, ordinal)` method or a whole new factory — would duplicate the single-attempt module's projection and classification logic. Widening `attempt` from the literal type `0` to `number` and adding an optional parameter (default `0`) is additive: every existing caller and test that omits the argument is unaffected.

**Retry scheduling is a separate module (`delivery-retry.ts`) that composes the handoff, not a change to the handoff's own control flow.** This preserves the existing `security-audit-sdk-node` requirement that the single-attempt handoff module itself never schedules a retry, and keeps the new module's tests independent of HTTP-response classification detail — they only need a scriptable `HttpDeliveryHandoff` stub.

**Delay = `floor(min(baseDelayMs * 2^attempt, maxDelayMs) * jitterSource())`, full jitter, not "equal jitter" or "decorrelated jitter."** Full jitter is the simplest formula that still satisfies "deterministic under a fixed clock/random source and respects configured bounds" from the issue, and it's trivial to assert exact expected values in tests with a fixed `jitterSource`. Equal/decorrelated jitter add state (previous delay) for a marginal smoothing benefit not required by the acceptance criteria.

**No `AuditClock` dependency.** The module's only time-related behavior is "wait `N` milliseconds via the injected timer provider" — it never reads wall-clock time to compute anything. Requiring `AuditClock` here would be an unused dependency.

**`maxAttempts` bounded to `1..1000`, matching `contracts/security-audit/source/contract.source.json`'s `bounds.retry_attempt_max`.** The wire `correlation.retry_attempt` value is bound by the frozen contract; rejecting a caller-configured `maxAttempts` above that ceiling at construction time is a cheap, honest implementation-level guard, not a contract change.

## Risks / Trade-offs

- **[Caller misconfigures `maxAttempts`/delays into effectively unbounded retry pressure]** → Mitigated by construction-time bounds validation (`maxAttempts` 1-1000, non-negative integer delays, `maxDelayMs >= baseDelayMs`) that throws `TypeError` before any attempt is made.
- **[A poor `jitterSource` (e.g., always returns `0`) collapses backoff to no delay]** → Out of scope to prevent by construction (the source is caller-injected by design, matching how `AuditTimerProvider`/`AuditClock` are already caller-injected elsewhere); the module validates the *returned value* is in `[0, 1)` and rejects otherwise.
- **[Widening `attempt` from a literal `0` type to `number` slightly loosens the single-attempt handoff's public type]** → Acceptable: the delta spec now documents the parameter explicitly, and a bounds check at runtime still rejects invalid ordinals.

## Migration Plan

Purely additive: existing `handoff()` callers are unaffected by the default parameter, and `createBoundedDeliveryRetry` is a new, opt-in export. No existing behavior changes for a caller that doesn't adopt the new export. Ship as one PR chain (propose → implement → fold → archive) per the repo's established convention for this capability.
