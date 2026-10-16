# ADR-SDK-014: A commit state requires operation evidence for every outcome

- Status: Accepted for SDK-core implementation
- Date: 2026-10-13
- Issue: https://github.com/nandohdc/bloodtrail/issues/797
- Owning change: `openspec/changes/archive/2026-10-13-fix-core-transaction-bound-commit-state/`
- Decision source: owner decision, 2026-10-13, via grilling in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## Context

A transaction-bound event has catalog commit values including `committed`. That is not the `transaction_critical` delivery class: some transaction-bound events are policy-critical. Handle-less non-success named calls previously selected the first catalog commit value, `committed`, inventing evidence for 35 combinations across 15 events. Directly supplying that terminal state without a handle already failed. Outcome describes what happened, not proof of transaction disposition.

## Decision

This decision refines ADR-SDK-007; ADR-SDK-007 remains unchanged. Every transaction-bound outcome requires operation evidence for its terminal commit state: the same-instance SDK-issued handle from `beginOperation()`, advanced through sanctioned transitions. No handle and no direct commit state returns bounded `PREMATURE_SUCCESS`, category `validation`, path `/operation/state` before sink invocation for success, failure, denied, partial and cancelled. Never infer terminal commit state from outcome.

Preserve the existing direct-state and operation-state checks, including pending-success refusal. Preserve handle-less `not_applicable` resolution. Failed/refused operations use `markNotCommitted()`, cancelled operations use `markCancelled()`, partial commitments use `markPartiallyCommitted()`. Recording denial retains explicit outcome `denied` and authorization decision `deny`.

This is runtime refusal only, a non-breaking `fix(sdk-core)` with migration guidance. Generated types, generator, public surface and frozen error registry remain unchanged.

## Alternatives

- Infer `not_committed` for failure, denied and cancelled: these outcomes cannot prove no transaction committed.
- Infer for denied only: authorization refusal is not transaction disposition evidence.
- Introduce a new error code: unnecessary change to the frozen contract when existing `PREMATURE_SUCCESS` already identifies absent operation-state evidence.
- Use `SDK_MISSING_AUTHORITATIVE_CONTEXT`: the Node error catalog documents it as reserved and never returned, not the operation-state failure.
- Require `operation` in generated types: changes the public surface rather than making the bounded runtime correction.

## Consequences and verification

The catalog-derived test matrix includes non-vacuity assertions and all 35 paired handle controls; old-code sensitivity is subject to independent verification, not a committed mutation replica.

Callers relying on invented commit states must retain and transition a handle. All 35 catalog-allowed non-success calls without evidence are refused without sink calls; their paired sanctioned-handle inputs remain accepted with matching state. Every not_applicable fixture remains accepted. API, migration and glossary document the rule; coherence adds ADR-SDK-014 to the consecutive inventory.

Passing tests and AI review are not approval, production authorization, release, merge, folding or archival.

## Boundary

Generated types and the public surface, the Node binding (including `committed_and_durable`, #795), contradictory outcome/commit pairs through handles (#812), complete-event `emit()`/`redeliver()`, the contract and the collector are unchanged. Stage P probe P-D (#801) remains out of scope.
