# Design — outcome and commit-state agreement

Decision source: owner decision, 2026-10-13, via plan-mode questions, grilling and triage in local Claude Code session 2db6f6fa-b531-4e63-8651-4ea851fd76be

## Design Pattern Assessment

The full machine-readable assessment is `assessment.json`; this is direct implementation, not catalog-pattern conformance. Security-sensitive lifecycle semantics and the added capability requirement require a full assessment. All 15 security dimensions are justified there.

## Context and forces

- Every path must refuse contradictory outcome/commit evidence before sink handoff.
- Contract-defined diagnostics must retain precedence, except the accepted success-before-authorization shift.
- Preserve frozen contract `2.1.0`, operation authority, defaults, public surface and unrelated outcomes.

All four paths already converge on `validateBaseSemantics`. No wrapper, generator change or additional module is necessary. A transaction-bound event has `committed` among its catalog commit values. Four sanctioned handle transitions span its reachable commit states.

## Selection and alternatives

Select `approach-shared-semantics`: two small domain-typed checks in the existing semantic module, with phase-to-success-state and commit-asserting-state tables at module scope. This gives one implementation for named methods, `emit()`, `redeliver()` and `validateSecurityAuditEvent()`.

Reject `approach-entry-wrappers`: duplicated entry-point checks drift and cannot give the free validator identical ordering without additional coupling. Reject `approach-contract-expansion`: changing the frozen contract or collector violates ownership and would conflate an existing contract conformance correction with the separately tracked SDK-only denial policy (#817). Reject `approach-early-denial`: although fail-fast is plausible, it masks approved authorization/provenance diagnostics and breaks the precedence force.

No new module, type export, code, state store or delivered-event ledger is introduced. Re-evaluate only under a separately governed contract change, new lifecycle phase or new sanctioned transition, never by silently expanding these rules.

## Placement and invariants

### `implementation-success-first`

Inside `validateCommit`, preserve pending/undefined/catalog-membership behavior and enforce `completed` + `success` only with `committed`/`not_applicable`, and `compensating` + `success` only with `compensated`. Return exact `PREMATURE_SUCCESS` / `validation` / `/event/commit_state`. `validateCommit` remains first in `validateEventSemantics`; `deny` + `success` + `not_committed` intentionally takes this error before `AUTHORIZATION_OUTCOME_CONFLICT`.

### `implementation-denial-last`

After successful `validateDerivedFieldProvenance`, as the very last check in `validateBaseSemantics`, reject `denied` + `committed`/`partially_committed`/`compensated` with `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/event/outcome`. This rule is SDK-only. The approved negative `authorization-outcome-conflation` retains `AUTHORIZATION_OUTCOME_CONFLICT`; derived-field defects retain their contract diagnostic.

### `implementation-preserved-boundaries`

Do not judge `failure`, `partial`, `cancelled`, or `success` in other phases. Do not refuse catalog-permitted `denied` + `not_committed`/`not_started`/`not_applicable`/`unknown`. Preserve no-handle and pending-handle `/operation/state` failures and derived defaults. No exemption for historical complete events on `redeliver()`. No sink calls on refusal. Retain all #811-specific artifacts and canonical requirements byte-identically; append only the enumerated shared documentation and update the explicit ADR inventory pins.

## Verification and task mapping

- `1.1`–`1.2`: assessment and strict proposal validation before the proposal-only commit.
- `2.1`–`2.2`: the sole production edit, build/typecheck and existing runtime regressions.
- `3.1`: derive 15 transaction-bound events and 141 unique named-method rows from catalog phases/outcomes/handle-reachable commit values: 24 success refusals, 21 denial refusals, 96 accepted. Fresh same-instance bound handles, aligned authorization evidence, exact safe results, zero sink calls on refusal, one on acceptance preserving explicit outcome/state.
- `3.2`: every transaction-bound positive fixture mutated both ways through complete-event paths; all five issue controls, unjudged outcomes, all terminal defaults including `markCancelled()`, catalog-permitted unaffected phases/states, no/pending handle and authorization/provenance precedence. All approved positive fixtures and original negative first codes. Independent rule-removal and precedence sensitivity is performed by the orchestrator, not an author approval claim; no mutants are committed.
- `4.1`: appended docs, `ADR-SDK-016`, inventory through `016`, Node causes without undeclared internal references.
- `5.1`–`5.2`: complete supplied eight-command chain including unchanged full `test:verification` and CodeScene delta; observed evidence only, empty index, exact ownership/subjects, LF/final-newline/whitespace checks and lightweight evidence-edit/committed-head rechecks. Local results do not imply remote CI approval.

## Delivery and boundaries

Baseline: `2660984bbf1a956b8246c4d2cd874f53c0c31a43`. Five primary commits in proposal/runtime/tests/docs/evidence order with `Refs #812` and co-author footers. Authorized in-scope gate repairs get additional conventional corrective commits before evidence, each separately tasked; made commits are never rewritten. Functions stay at complexity <=9 and <=70 lines without bumpy road; tables stay module-scoped.

Only the 15 exact paths in `assessment.json` are owned. No edits to #811's change or source/test/ADR artifacts, `contracts/`, generated code, generator, package manifests, verification lifecycle/tests, canonical specs, governance-core files, CI, CodeScene configuration or collector. `ADR-SDK-007` and `ADR-SDK-014` are refinement targets, not edit targets. Required CI, maintainer review, merge, fold and archive remain pending. An out-of-scope gate diagnostic fails the story; no gate is bypassed.
