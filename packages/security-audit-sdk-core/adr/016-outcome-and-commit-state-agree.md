# ADR-SDK-016: Outcome and commit state agree

- Status: Accepted for SDK-core implementation
- Date: 2026-10-14
- Issue: https://github.com/nandohdc/bloodtrail/issues/812
- Owning change: `openspec/changes/fix-core-outcome-commit-consistency/`
- Decision source: owner decision, 2026-10-13, via plan-mode questions, grilling and triage in local Claude Code session 2db6f6fa-b531-4e63-8651-4ea851fd76be

## Context

A `Contradictory outcome` is an outcome that the event's commit state disproves. Existing operation authority prevents invented evidence, but explicit outcomes could contradict a legitimate handle. Complete-event validation accepted the same false success pairs. The contract already defines phase-aware success; denial is an additional SDK rule, not a change to frozen contract `2.1.0`.

This decision refines `ADR-SDK-007` in `007-transaction-operations.md` and `ADR-SDK-014` in `014-transaction-bound-commit-state-requires-operation-evidence.md`. Both remain unchanged. #811's provider-fault correction is already merged and remains unchanged.

## Decision

Implement both rules in shared `validateBaseSemantics` in `src/validation/semantic.ts`, reached by named methods, `emit()`, `redeliver()` and free `validateSecurityAuditEvent()`:

| Rule | Refusal | Exact code / category / path |
|---|---|---|
| Contract success | `completed` + `success` unless `committed`/`not_applicable`; `compensating` + `success` unless `compensated` | `PREMATURE_SUCCESS` / `validation` / `/event/commit_state` |
| SDK-only denial | `denied` with `committed`, `partially_committed` or `compensated` | `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/event/outcome` |

Success runs inside first-position `validateCommit`, before every other semantic check. The accepted precedence consequence is `deny` + `success` + `not_committed` returning `PREMATURE_SUCCESS` instead of `AUTHORIZATION_OUTCOME_CONFLICT`. Preserve existing pending/undefined/catalog-membership diagnostics.

Denial runs as the very last semantic check, after `validateDerivedFieldProvenance`. It never masks contract-defined diagnostics; approved `authorization-outcome-conflation` keeps `AUTHORIZATION_OUTCOME_CONFLICT`, and a derived-field defect wins over otherwise valid `denied` + `committed`. The denial rule exists only in the SDK. Its adoption or rejection by the contract is separate: https://github.com/nandohdc/bloodtrail/issues/817.

Refused events never reach the sink. Historical events receive no redelivery exemption: the SDK retains no delivered-event ledger or provenance proof with which to identify one. Complete-event producers must supply contract-valid pairs and obey SDK-only denial consistency.

## Alternatives and consequences

Direct shared validation answers every path without duplication. Entry-point wrappers risk drift and inconsistent free validation. Early denial would conceal approved authorization/provenance diagnostics. Changing the frozen contract or collector conflates this bounded SDK correction with separately governed policy. New codes, public types, exports or a ledger are unnecessary.

Keep both lookup tables at module scope. `failure`, `partial`, `cancelled`, catalog-permitted non-committing denial and success in other phases are unjudged. Sanctioned transition defaults remain accepted, including cancellation. Existing no-handle and pending-handle `PREMATURE_SUCCESS` / `validation` / `/operation/state` refusals remain unchanged. Outcome does not change operation state or establish commit evidence.

This is a non-breaking `fix(sdk-core)`, `severity:medium`, with `MIGRATION.md` guidance and no release/version change. Report `failure` when work did not commit; genuinely denied operations use `markNotCommitted()` with explicit `denied` and authorization decision `deny`. Report actual evidence rather than relabeling state to pass validation.

## Evidence strategy

The new top-level `tests/outcome-commit-consistency.test.ts` derives 141 unique rows across 15 transaction-bound catalog events, every allowed phase/outcome and four handle-reachable states: 24 success refusals, 21 denial refusals, 96 accepted. Every refusal deep-equals the complete safe result and has zero sink calls; acceptance preserves the caller outcome and handle commit state with exactly one sink call. Fresh instances prevent duplicate-success interference.

Every transaction-bound positive fixture is mutated both ways through `emit()`, `redeliver()` and `validateSecurityAuditEvent()`. Controls cover the five issue rows, unjudged outcomes, all terminal defaults, unaffected phases/states, handle-less and pending-handle refusal, authorization/provenance precedence and all approved fixture first codes. Independent rule-removal/ordering sensitivity belongs to the orchestrator; no mutants or verification-test changes are committed. Full supplied gates include unchanged `test:verification`, `make test`, `make governance-gates`, strict OpenSpec, final design-pattern governance and CodeScene delta; observed results belong to the owning change's `tasks.md` and `assessment.json`, not an approval claim.

## Non-goals and trust limits

No judgement of operation state versus outcome, #797 redesign, #811 provider change, #816 runtime-selection change, public surface/error-code change, generated artifact or contract change, collector admission change, producer-truth proof, database introspection, durability, atomicity or delivery guarantee. Passing local gates does not authorize release, production, merge, folding or archival; required PR checks and maintainer review remain pending.
