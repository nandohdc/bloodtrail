## Why

A completed `authenticationSucceeded` operation currently rejects a caller-supplied named re-execution with a positive `retry` relationship as `SDK_DUPLICATE_SUCCESS`. The terminal reservation decision reads `correlation.retry_attempt` before event construction, while the documented named input carries that relationship under `retry`; the valid re-execution is therefore misclassified before its canonical retry metadata exists.

## What Changes

- Admit a positive safe-integer input-level `retry.retry_attempt` to the existing pre-construction terminal-success decision, ahead of correlation values inherited from input or context.
- Add an F-11 public-behavior regression that proves a completed operation permits one explicit named re-execution with a new event ID and preserved causal links.
- Prove that a subsequent ordinary terminal success for the same operation remains rejected with `SDK_DUPLICATE_SUCCESS`.
- Preserve the existing validation and operation authority model: malformed, missing, zero, or non-positive retry attempts remain ordinary terminal attempts; canonical causality validation still owns relationship validity.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The canonical SDK requirement already defines retry/re-execution as a new occurrence with a new event ID and retained original-event, operation, correlation, and causation links. This change corrects the implementation to conform to that existing behavior without changing the requirement.

## Impact

The technical implementation is confined to `packages/security-audit-sdk-core/src/sdk.ts` and `packages/security-audit-sdk-core/tests/f11-delivery-intent.test.ts`. It changes no contract source, generated artifact, SDK public method, package metadata, dependency, sink interface, transport, collector, queue, storage, telemetry, browser integration, production authorization, or automatic delivery retry behavior.

Refs #215
