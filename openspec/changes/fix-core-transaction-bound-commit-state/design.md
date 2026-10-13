## Context

The confirmed `resolveCommitState` fallback chooses `commits[0]` for handle-less non-success calls. That is `committed` for transaction-bound events, even though callers cannot supply that terminal state without evidence. The existing resolver is the entire runtime seam; no new abstraction is needed.

## Design Pattern Assessment

`assessment.json` uses schema 1.1, full assessment, security-sensitive direct implementation and capability `security-audit-sdk-core`. It declares lifecycle/state, security behavior and canonical requirement triggers. The proposal baseline remains `02ce833c4e02f83441d086ed47aed1306d4217cc`; planning precedes implementation. Assessment is technical evidence, not approval.

### Architectural forces

1. Audit commit state must represent operation evidence rather than an outcome-derived guess.
2. Refusal must remain bounded and reuse the frozen diagnostic and public surface.
3. Preserve legitimate sanctioned transitions and non-transactional not_applicable behavior.
4. Bound the correction to the resolver, regression and documentation without changing adjacent behaviors.

## Decisions and alternatives

Decision source: owner decision, 2026-10-13, via grilling in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

- Q1 selects unconditional refusal after the existing `not_applicable` branch when there is no handle-derived state or direct state. Reject inferring `not_committed` for failure, denied and cancelled: an outcome is not proof of a transaction disposition. Reject inference for denied only for the same reason; authorization denial does not establish whether a transaction committed.
- Q5 selects existing `PREMATURE_SUCCESS` / `validation` / `/operation/state`. Reject a new code because the contract is frozen. Reject `SDK_MISSING_AUTHORITATIVE_CONTEXT`, which the Node catalog reserves and never returns: it is not the existing operation-state diagnostic.
- Q6 selects runtime refusal only, a non-breaking `fix(sdk-core)` with migration guidance. Reject requiring `operation` in generated types: it changes the frozen public surface and is broader than this runtime correction.
- Q7 selects ADR-SDK-014 refining ADR-SDK-007. Editing the founding ADR would erase historical rationale rather than record its refinement.
- Q8 selects the prescribed Transaction-bound event and Operation evidence glossary entries. Do not conflate transaction-bound events with the transaction_critical delivery class.
- Q9 selects catalog-driven coverage with exactly 35 non-success cases and paired controls. Reject hand-listed event membership, vacuous loops and committed mutation replicas; old-code sensitivity is subject to independent verification.
- Q2/Q3/Q4 exclude #812 handle-pair contradictions, #795 Node durability and #801 Stage P. No inference or validation change for those paths is proposed.

## Review follow-up (#797)

Decision source: owner decision, 2026-10-13, via code-review follow-up in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

R1 repairs the #796 assessment regression by deriving the final ADR and next extra number from the existing sequential inventory. R3 clarifies operation-evidence test names and domain-typed non-success rows without changing assertions. R4 aligns the glossary list, ADR sections, neutral verification wording and portable gate citations. R2 corrects evidence timing and labels. Append the prescribed five commits to the existing fix, preserving runtime, original decisions and proposal baseline; no further review finding or approval is selected.

## Implementation

Keep operation/direct-state handling byte-identical. Preserve `commits.includes("not_applicable")`, then return the fixed failure for every outcome. Update only the resolver comment and fallback in `src/events.ts`. Preserve F10/F11 mutation anchors. Generated types, dependencies and exports are unchanged.

## Implementation-specific invariants

| Invariant | Tasks | Observed evidence |
| --- | --- | --- |
| implementation-evidence-required | 2.1, 3.1, 5.1, 6.2, 6.4 | transaction-bound-commit-state.test.ts: exact bounded refusal and zero sink calls for 35 catalog cases and success |
| implementation-sanctioned-controls | 3.2, 5.1, 6.2, 6.4 | transaction-bound-commit-state.test.ts: every paired handle transition accepted with matching commit state; all not_applicable fixtures accepted |
| implementation-preserved-scope | 1.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4 | planning gates; documentation/coherence; generated, type, export, scope, final governance and Git boundary gates |

## Security implications

All 15 security dimensions are individually justified in the assessment. Audit integrity and fail posture improve by refusing absent evidence. Operation authority remains same-instance issued handles and sanctioned transitions. Fixed diagnostics disclose no supplied data. No new authentication, authorization, cryptographic, durability, concurrency, privacy, retention or redelivery guarantee is made.

## Test plan

Load the positive all-events fixture and brand context using Core constructors with a compact converter, not a copied named-input helper. Derive catalog membership, methods and outcomes dynamically from EVENT_CATALOG/EVENT_METHODS. Denied cases use authorization decision `deny`.

Assert every catalog entry includes exactly one of committed and not_applicable. For all catalog-allowed non-success outcomes on committed entries, assert the exact bounded failure and zero emissions; assert 35 cases spanning transaction_critical and policy_critical. Pair every input with a fresh same-instance, method-bound handle: failure/denied markNotCommitted, cancelled markCancelled, partial markPartiallyCommitted; assert successful transition, acceptance, exactly one event and matching state. Cover handle-less success and every not_applicable positive fixture unchanged. Use conformance harness context and valid-row checks where appropriate. Keep functions small and domain-typed, with module-scope transition tables.

Run assessment governance and strict OpenSpec before the planning-only commit. After runtime and documentation commits run build/typecheck, the entire supplied tamandua-test command (generated drift, Core matrix/coherence, contract and Node validation, final governance, empty-index Git, make test, CodeScene CLI 1.0.53 delta), strict OpenSpec and git diff --check. Record only observed output in tasks and invariant evidence. Merge/archive stay unchecked; no mutation, analyzer, remote CI or approval result is invented.
