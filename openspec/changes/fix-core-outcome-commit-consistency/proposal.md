# Outcome and commit-state agreement — #812

## Why

A `Contradictory outcome` is an outcome that the event's commit state disproves. The SDK accepts 24 catalog-allowed `success` combinations rejected by the frozen contract and 21 `denied` combinations asserting committed work. All public validation paths must refuse them before sink handoff.

## What Changes

Implement both rules once in `validateBaseSemantics`, in `packages/security-audit-sdk-core/src/validation/semantic.ts`. The contract's phase-aware success rule belongs inside first-position `validateCommit`. The SDK-only denial rule runs last, after `validateDerivedFieldProvenance`. Reuse existing errors and add a catalog-derived matrix, complete-event cases, ordering controls, migration guidance and `ADR-SDK-016`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: add `Outcome and commit state agree with operation evidence`. Existing canonical requirements remain byte-identical; the delta is `ADDED` only.

## Impact

Non-breaking `fix(sdk-core)`, `severity:medium`, with migration guidance; no release/version change. Only one production source file changes. `failure`, `partial`, `cancelled`, handle-derived defaults and handle-less refusal remain unchanged. Old events have no redelivery exemption. Contract `2.1.0`, collector admission, generated artifacts, public types/exports/error codes and #811-specific artifacts remain unchanged. Shared docs receive appended guidance; the ADR inventory advances through `016`.

## Decided authority

Decision source: owner decision, 2026-10-13, via plan-mode questions, grilling and triage in local Claude Code session 2db6f6fa-b531-4e63-8651-4ea851fd76be

`D1`–`D4` and `Q1`–`Q11` are settled, not reopened. `Q5` is satisfied by #811's merge in PR #818 at `2660984bbf1a956b8246c4d2cd874f53c0c31a43`; the overnight stacking amendment is moot. No new decision approval is claimed.

| Decisions | Implementation |
|---|---|
| `D1`, `D3`, `Q2` | `completed` + `success` requires `committed`/`not_applicable`; `compensating` + `success` requires `compensated`. Refuse with `PREMATURE_SUCCESS` / `validation` / `/event/commit_state`. `denied` with `committed`/`partially_committed`/`compensated` returns `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/event/outcome`. |
| `D2`, `Q1` | Named methods, `emit()`, `redeliver()` and `validateSecurityAuditEvent()` share both rules; no historical exemption. |
| `Q3`, `Q10` | Success first; denial last after provenance. Preserve `authorization-outcome-conflation` -> `AUTHORIZATION_OUTCOME_CONFLICT`; accept the success-before-authorization diagnostic shift. |
| `Q4`, `Q6`, `Q11` | `ADR-SDK-016` refines unchanged `ADR-SDK-007`/`ADR-SDK-014`; denial remains SDK-only pending #817. |
| `Q7`–`Q9`, `D4` | One glossary term, one top-level test file, widened Node error catalog; `severity:medium`. |

Issue: https://github.com/nandohdc/bloodtrail/issues/812
Triage: https://github.com/nandohdc/bloodtrail/issues/812#issuecomment-6159287960
Authoritative brief: https://github.com/nandohdc/bloodtrail/issues/812#issuecomment-6159288194
Contract follow-up: https://github.com/nandohdc/bloodtrail/issues/817

## Non-goals

No judgement of `failure`, `partial`, `cancelled` or operation state versus outcome. No #797 handle-less redesign, #811 provider change, #816 schema-runtime selection change, contract/collector change, delivered-event ledger, new abstraction or public surface. No push, PR, GitHub comment, merge, fold, archive, approval or release authority.
