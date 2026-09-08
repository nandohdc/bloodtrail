## 1. Assessment and deterministic test boundary

- [x] 1.1 Create the governance assessment covering the handoff ordinal parameterization, the new retry module, exports, tests, documentation, and this change; record the explicit proposal baseline and all 15 security dimensions, then verify the assessment phase passes.
- [x] 1.2 Add deterministic RED-equivalent tests for the parameterized attempt ordinal (wire correlation carries the supplied ordinal, out-of-bounds ordinal rejected before any exchange) and for bounded retry scheduling (only-retryable-retries, max-attempts boundary, exhaustion, deterministic capped-jittered delay, permanent-outcome mutation stops retrying, construction-time bounds validation) using injected fake timers and a scripted handoff; verify the focused tests fail before implementation.

## 2. Attempt ordinal parameterization

- [x] 2.1 Widen `HttpDeliveryHandoff.handoff`'s attempt type from the literal `0` to a caller-supplied `number` defaulting to `0`, validated bounded and non-negative before any request is constructed; verify the new and existing handoff tests pass unchanged for the default case.
- [x] 2.2 Thread the supplied ordinal into the projected request's `attempt` field and the wire `correlation.retry_attempt`, and into the result's `attempt` field; verify the wire-correlation test passes.

## 3. Bounded delivery retry module

- [x] 3.1 Implement `createBoundedDeliveryRetry` composing a `HttpDeliveryHandoff`: only a `retryable` outcome schedules another attempt, attempts never exceed the configured maximum, and any other terminal outcome (or exhaustion) returns immediately with an attempt counter; verify the only-retries-retryable, max-attempts, and outcome-mutation tests pass.
- [x] 3.2 Implement deterministic capped-exponential jittered delay computation against the injected timer provider and jitter source, with construction-time bounds validation (`maxAttempts` 1-1000, non-negative delays, `maxDelayMs >= baseDelayMs`) and runtime jitter-source range validation; verify the delay-computation, boundary (`maxAttempts: 1`), and invalid-construction tests pass.
- [x] 3.3 Export the additive provisional API (`createBoundedDeliveryRetry` and its types) and document it in the package README; verify package typecheck, scope, dependency, and packed-package checks pass, updating the scope-mutation baseline file/reference counts for the new source file.

## 4. Verification and delivery

- [ ] 4.1 Run the Node package validation chain (`npm run validate --prefix packages/security-audit-sdk-node`), the full product loop (`make`), strict OpenSpec validation, and `git diff --check`.
- [ ] 4.2 Commit, open the #104 PR with the complete governance posture, and merge only after exact-head CI has no failures.
