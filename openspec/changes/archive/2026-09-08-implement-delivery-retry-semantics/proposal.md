## Why

The Node HTTP delivery handoff (#103) classifies a single attempt but has no scheduling policy on top of it: a `retryable` outcome today just stops, with no governed retry budget, delay calculation, or terminal exhaustion behavior. Issue #104 requires that bounded, deterministic retry scheduling as pre-approved execution work under the already-ratified delivery conformance contract (#102) and PLAN-052.

## What Changes

- Parameterize `createHttpDeliveryHandoff`'s single-attempt `handoff()` with a caller-supplied zero-based attempt ordinal (defaulting to `0`), so the projected request and result carry the correct `correlation.retry_attempt` for whichever attempt is being made. The handoff itself still performs exactly one exchange per call and still does not schedule anything.
- Add `createBoundedDeliveryRetry`, a new composing module that wraps a `HttpDeliveryHandoff` with a bounded, jittered exponential-backoff retry schedule: only `retryable` outcomes are retried, attempts never exceed a configured maximum, delay computation is deterministic under an injected timer provider and jitter source, and budget exhaustion produces a terminal `exhausted` result with an attempt counter and an optional observability hook.
- Document both in the package README.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: the single-attempt handoff requirement gains a caller-supplied attempt ordinal instead of a hardcoded `0`, and a new requirement governs the bounded retry-scheduling module composed on top of it.

## Impact

- `packages/security-audit-sdk-node/src/http-handoff.ts` (attempt ordinal parameterization)
- `packages/security-audit-sdk-node/src/delivery-retry.ts` (new)
- `packages/security-audit-sdk-node/src/index.ts` (exports)
- `packages/security-audit-sdk-node/tests/http-handoff.test.ts`, `tests/delivery-retry.test.ts` (new), `tests/scope-mutations.test.ts` (baseline file/reference counts)
- `packages/security-audit-sdk-node/README.md`
- `openspec/specs/security-audit-sdk-node/spec.md`
