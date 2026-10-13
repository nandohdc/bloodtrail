## Why

Issue [#797](https://github.com/nandohdc/bloodtrail/issues/797) records that a transaction-bound named event with a non-success outcome, no operation handle and no direct commit state is accepted as `committed`. The confirmed fallback invents commit evidence for 35 catalog-allowed combinations across 15 events. A transaction-bound event has catalog commit values including `committed`; `transaction_critical` is a delivery class, not a synonym.

## What Changes

- Refuse handle-less transaction-bound named events for every outcome with `PREMATURE_SUCCESS`, category `validation`, path `/operation/state`, without sink invocation.
- Preserve `not_applicable` resolution and all existing direct-state and operation-evidence checks. Never infer a terminal commit state from an outcome.
- Add a catalog-driven regression matrix, paired sanctioned-handle controls, partition and non-vacuity assertions.
- Document migration, vocabulary and ADR-SDK-014, refining ADR-SDK-007 without editing it. Update only the Node error catalog's diagnostic explanation.

## Capabilities

### Modified Capabilities

- `security-audit-sdk-core`: require SDK-issued operation evidence for transaction-bound commit states for every outcome, without changing the generated types or public surface.

## Impact

This is a non-breaking `fix(sdk-core)` runtime correction. Callers previously relying on invented commit states must use `beginOperation()` and a sanctioned transition. Exact ownership is in `assessment.json`. Full, security-sensitive assessment selects direct implementation at the existing resolver seam. Planning is committed before implementation against baseline `02ce833c4e02f83441d086ed47aed1306d4217cc`.

## Owner decisions

Decision source: owner decision, 2026-10-13, via grilling in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

| # | Decision |
| --- | --- |
| Q1 | Refuse every non-success outcome on a transaction-bound event that has no operation handle and no direct commit state, as success already is. Never infer a commit state from the outcome. The honest path is `beginOperation()` plus `markNotCommitted()`, `markCancelled()` or `markPartiallyCommitted()`. |
| Q5 | The refusal is `PREMATURE_SUCCESS`, category `validation`, path `/operation/state`, the same as handle-less success. No new error code; the contract is frozen. |
| Q6 | Runtime refusal only. No change to generated types, the generator or the public surface. Classified as `fix(sdk-core)`, non-breaking, with a MIGRATION.md entry. |
| Q7 | A new ADR-SDK-014, "A commit state requires operation evidence for every outcome". It refines ADR-SDK-007; ADR-SDK-007 itself is not edited. |
| Q8 | Add the two prescribed glossary terms: Transaction-bound event and Operation evidence. |
| Q9 | A catalog-driven matrix test with a non-vacuity assertion. No committed mutation test: the orchestrator proves the test fails on the old code during verification. |
| Q2, Q3, Q4 | Out of scope: contradictory pairs through a handle (#812); the Node transaction-critical binding's `committed_and_durable` status (#795, G5); Stage P probe P-D (#801). |

## Scope and Non-goals

Do not change generated types, generators, public exports, Node binding runtime, contracts, collector, complete events through `emit()`/`redeliver()`, or #812 contradictory outcome/commit pairs through handles. Preserve founding and canonical requirements, ADR-SDK-007, governance_core files and analyzer configuration. No push, PR, comment, merge, folding, archival or approval is claimed. AI review is not authorization.
