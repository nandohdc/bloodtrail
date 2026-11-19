# Proposal

## Why

R10, "Assessment ordering is proven by Git ancestry", promises that an assessment precedes the implementation it
approves. The checker proves that only when an author records `ordering.assessment_commit`, and on `main` at `9acf995`
only 6 of 131 committed assessments do. When the commit is recorded, the checker takes the earliest implementation
commit as written, so a later commit, or none, passes. #896's change shipped its implementation commit `d1a875e`
before its assessment commit `3a8338f`, and every gate passed (#943).

The fix the issue suggested is not sound either. Deriving the earliest implementation commit by walking forward from
the proposal baseline picks up other changes' commits once `main` has moved. For #957's change, the walk from
`4650bb1` stops at #963's `021e643`, which would fail a correctly ordered change.

The owner triaged #943 on 2026-11-17 and refined the design on 2026-11-18, after a one-off audit of every range that
reached `main` since governance activation.

## What Changes

- **Derived ordering at the final phase.** For each change that owns a governed commit in the checked range, the
  checker derives the change's anchor from history: the first commit that adds `openspec/changes/<id>/assessment.json`.
  - The anchor must be a strict ancestor of every governed commit in the range that the change owns.
  - A commit owned by several changes passes if any owner's anchor strictly precedes it.
  - A change whose anchor cannot be found fails closed.
  - The check never walks shared `main` from the proposal baseline.
- **Amendment rule, within the range.** A commit that changes a change's `assessment.json` after one of that change's
  own governed commits in the same range fails. The comparison is on parsed JSON with `ordering`,
  `invariant_evidence`, `verification_task_ids` and `owned_paths` removed. Evidence recorded after implementation and
  owned-path bookkeeping stay allowed, and the decision content does not change after implementation starts.
- **Recorded ordering fields stay optional and get consistency checks.** Nothing in them is trusted:
  - `assessment_commit` must change the assessment, be the anchor or come after it, and precede the change's governed
    commits in the range;
  - `earliest_governed_implementation_commit` must be a governed commit the change owns, coming after the anchor, and
    no owned governed commit in the range may precede it;
  - `final_technical_commit` must come after the anchor.

  All six existing records pass the checks that need no range. At the final phase, five pass over their own merged
  ranges. The sixth, in #423's archived change, names an assessment commit that its implementation does not descend
  from; design D6 lists it.
- **Policy.** `openspec/changes/*/contract-reuse.json` joins `planning_artifact_patterns`. The contract-reuse record is
  an assessment-like record written with the proposal. Today it makes every contract-touching proposal look like
  implementation.
- **R10, MODIFIED.** The requirement states that ordering is derived from history and that recorded commits are
  checked, not trusted. It adds scenarios for derived ordering, another change's commit, shared ownership and an
  inconsistent record. It qualifies the amendment scenario as checked within the reviewed range, and states openly
  that an amendment in a later pull request is not tied back to the change.
- **Audit record.** `design.md` records a one-off, read-only replay of these rules over the 546 ranges since
  activation `ee6fb3c`. Under these rules it finds 28 historical findings and none in an active change. The
  recorded-field checks add one more, #423's archived record. It names #896.

Nothing changes in the assessment schema, the archived changes, or discovery, which still skips `archive/`. The
ordering fields stay optional.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `software-design-pattern-governance`: R10 changes to derive ordering from history, scoped to each change's own
  commits in the checked range. It checks recorded ordering commits for consistency instead of trusting them, and it
  states the limit of the amendment check.

## Impact

- **Governance core.** These files change:
  - `openspec/scripts/design-pattern-governance/ancestry.mjs`;
  - `openspec/scripts/check-design-pattern-governance.mjs`, so the final phase passes its range and the changes'
    ownership to the ordering check;
  - `openspec/governance/design-pattern-policy.json`.

  `check-design-pattern-governance.mjs` and `design-pattern-policy.json` are also owned by the active
  `define-normative-precedence-lifecycle`. Workstream F (#972) re-freezes against `main` only after this change
  lands, and this change discloses the overlap.
- **Tests.** A new test file under `openspec/tests/design-pattern-governance/` builds real histories for each rule,
  each with a null control.
- **Authors.** Changes stop recording their ordering by hand, the workaround used by #913, #932, #945 and #957.
  Within one pull request, an edit to an assessment's decision content after implementation commits now fails.
- **Diagnostics.** These stay: `assessment-follows-implementation`, `assessment-shares-implementation-commit` and
  `history-unavailable`. These are new: `assessment-anchor-missing`, `assessment-amended-after-implementation` and
  `assessment-ordering-record-inconsistent`.
- **Out of scope:**
  - editing any archived change, and any gate over `archive/`;
  - a schema version move;
  - treating other change-directory records as planning artifacts, such as decision notes, inventories or
    authorization documents (they belong in `design.md` or in a commit after the assessment);
  - amendments made in a later pull request after the implementation merged, which is a disclosed limit.
