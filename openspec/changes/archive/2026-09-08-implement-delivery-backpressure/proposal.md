## Why

The Node delivery path has no governed capacity boundary: nothing bounds how many occurrences may be in flight at once, so unbounded concurrent submission could cause unbounded resource use. Issue #105 requires an explicit, bounded admission gate with a counted, never-silent overload outcome, matching the delivery-conformance-contract's `rejected_overload` state, as pre-approved execution work under PLAN-052.

## What Changes

- Add `createBoundedDeliveryBackpressure`, a new module that gates admission to any injected async delivery operation (independent of what that operation does — HTTP handoff, retry-wrapped delivery, or otherwise) by a bounded in-flight capacity.
- An admission attempted while at capacity is rejected immediately and synchronously with a `rejected_overload` outcome, counted via an observable counter, and never silently dropped.
- Capacity is released exactly once when an admitted operation settles (success or failure), with no counter drift, verified under concurrent submission.
- Optional observability hooks expose admission, rejection, and current depth without ever including event content.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: gains a new requirement for bounded delivery admission backpressure, composing with (but independent of) the existing single-attempt handoff and retry-scheduling requirements.

## Impact

- `packages/security-audit-sdk-node/src/delivery-backpressure.ts` (new)
- `packages/security-audit-sdk-node/src/index.ts` (exports)
- `packages/security-audit-sdk-node/tests/delivery-backpressure.test.ts` (new)
- `packages/security-audit-sdk-node/README.md`
- `openspec/specs/security-audit-sdk-node/spec.md`
