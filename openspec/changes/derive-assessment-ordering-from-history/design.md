# Design

## Context

See `proposal.md` (Why). The checker parts that matter here, as they stand on `main` at `bdd4c47` (unchanged since
`9acf995`):

- **`verifyAssessmentOrdering`** (`openspec/scripts/design-pattern-governance/ancestry.mjs`) runs from
  `checkAssessments` in every phase. It returns as soon as `ordering.assessment_commit` is absent, and otherwise
  takes the recorded earliest commit as written.
- **`findEarliestGovernedImplementationCommit`** in the same file has no caller. It walks forward from the proposal
  baseline. On shared `main` that walk returns other changes' commits: for #957 it returns #963's `021e643`.
- **`checkPerimeter`** (`check-design-pattern-governance.mjs`, final phase) already holds what a derived check needs:
  - the range's commits, and the paths each commit changed (`collectRangePaths`);
  - every change that could cover the range, with its owned paths (`collectOpenSpecChanges`, the same ownership the
    association check uses).
- **The ordering governed set** (`orderingGovernedPatterns`) is the `governed_implementation` and `governance_core`
  patterns, minus `planning_artifact_patterns`.

Decision sources:
- the owner's triage of #943 on 2026-11-17 (issuecomment-6967405391, decisions 2 to 5);
- the owner's plan decisions of 2026-11-18: Q1–Q3, Q12, Q13 as revised after the audit below, Q14, Q18 and Q19.

## Goals / Non-Goals

**Goals:**
- The ordering verdict comes from history alone, so an assessment that records nothing is still checked.
- The check looks at a change's own commits, in the range under review, and never at other changes' commits on
  shared `main`.
- Recorded ordering commits are cross-checked and never used as a substitute for derivation.
- Every new rule is shown, on a real Git history, to fail on a planted defect and pass on its null control.

**Non-Goals:**
- Re-checking merged history in the gate. The audit below is a one-off and read-only.
- Rewording the actor-neutral documents. `docs/design-pattern-governance.md` and `CONTRIBUTING.md` describe the rule
  as "the assessment commit precedes the earliest governed implementation commit". The derived check enforces exactly
  that, with the assessment commit now taken from history, and R10 carries the scoping and the amendment limit.
- Detecting an amendment made in a later pull request after implementation merged. This is a disclosed limit (D5).
- Changing the assessment schema, the generator or discovery.

## Decisions

**D1. The anchor is the first commit that adds the assessment.** A change's anchor is the oldest commit, reachable
from the checked head, that adds `openspec/changes/<id>/assessment.json`. The checker finds it with
`git log --diff-filter=A --reverse`, and does not read it from the assessment.
- *Alternative:* the last edit to the assessment before implementation. That needs the change's earliest
  implementation commit across all history, which brings back the shared-`main` walk.
- *Alternative:* trust `ordering.assessment_commit`. That is the gap itself.
- *Limit:* a change id reused after an earlier change with that id was archived inherits the first incarnation's add
  as its anchor. Within one range the amendment rule (D5) still fails a later add, and association still requires an
  owner, but reusing an archived change's id is not supported.

**D2. Ordering is checked over the reviewed range, per owning change.**
- **Where it runs.** At the final phase, after association, `checkPerimeter` passes its range and its changes to a
  new ordering check in `ancestry.mjs`.
- **Owned governed commit.** For each commit in the range, take the paths it changed in the ordering governed set.
  A change owns the commit when one of those paths matches the change's owned paths (`matchesAny`, as association
  uses).
- **The test.** For each owned commit, the change's anchor must be a strict ancestor.
- **No anchor.** If a change has no anchor but owns a commit, the check fails `assessment-anchor-missing`, unless
  the assessment records a retrospective exception, which skips ordering as it does today. This holds whatever other
  owners of the commit show: D3 relaxes the order of assessments that exist, never their absence. In CI every change
  on disk has a committed assessment, so this fires on a local run with an uncommitted one.
- **Relocated changes** own only their archive directory, as in association, and are skipped.
- **Missing history** fails `history-unavailable`, as it does today.
- *Alternative:* walk from the proposal baseline (history B; #957).
- *Alternative:* walk from the branch's merge base. That has no meaning once the range has merged.

**D3. A commit with several owners passes if any owner's anchor precedes it (Q19).** Of the owners that have an
anchor, one preceding the commit is enough; an owner without one still fails as D2 says. This mirrors association, where
any change in the range covers a path. Without it, the CB-018 commit `d749dc8` fails. That commit is
`define-normative-precedence-lifecycle`'s work, but it touches paths that `correct-sequential-authorization-lifecycle`
also owns, and that change was assessed later.
- *Alternative:* every owner's anchor must precede the commit, which fails the active change above.
- *Interplay with D5:* D3 decides the commit's order, not the later owner's assessment. If that owner's assessment is
  first added after the shared commit in the same range, the add counts as an amendment after its own governed commit
  and fails `assessment-amended-after-implementation`. D3 therefore matters across ranges, as in `d749dc8`'s case, or
  when the later owner's assessment lands on a parallel branch.

**D4. The anchor commit must carry no governed implementation path (unchanged).** The existing
`assessment-shares-implementation-commit` diagnostic now also fires on the derived anchor, not only on a recorded
commit.

**D5. The amendment rule is checked only within the range (Q1, Q13 revised, Q14).**
- **The rule.** A commit in the range that changes a change's `assessment.json` fails
  `assessment-amended-after-implementation` when another commit in the same range is one of that change's owned
  governed commits and is an ancestor of it. Adding the assessment counts as a change, so an assessment first added
  after the change's own implementation in the range reports this as well as `assessment-follows-implementation`, as
  #896's `3a8338f` does in the audit.
- **Exempt fields.** The comparison is between the commit's assessment and its first parent's: each is parsed, the
  top-level `ordering`, `invariant_evidence`, `verification_task_ids` and `owned_paths` are dropped, and the rest is
  serialized and compared. The serialization keeps key order, so reordering keys reads as a change; the generator
  writes keys in a fixed order, and the audit compared the same way. A deletion is an archive move and is skipped.
- **Why those fields.** Each one changes in the normal lifecycle. Evidence is recorded after implementation, and owned
  paths are widened when a gate demands it. The audit found these four fields behind 40 of the 50 historical
  post-implementation edits.
- **The limit.** An amendment in a later pull request, after the implementation merged, is not tied back to the
  change. The R10 delta says so.
- *Alternative:* exempt only `ordering`. That fails 50 historical edits, 7 of them in active changes.
- *Alternative:* a whole-history amendment check, which needs the shared-`main` walk.

**D6. Recorded ordering fields are checked for consistency, not equality (Q12).** The checks run in every phase where
an anchor exists, and apply only to fields that are present:
- **`assessment_commit`** must change the assessment, must be the anchor or a descendant of it, and must change no
  governed implementation path. At the final phase it must also precede every owned governed commit in the range.
- **`earliest_governed_implementation_commit`** must be a governed commit the change owns, and a strict descendant of
  the anchor. At the final phase, no owned governed commit in the range may be its strict ancestor.
- **`final_technical_commit`** must be a descendant of the anchor.

A violation fails `assessment-ordering-record-inconsistent`. A recorded `assessment_commit` with no derivable anchor
also fails. The existing ancestry relations between the recorded commits stay. Every recorded commit is now resolved
whether or not an assessment commit is recorded, and each unresolvable one fails with its existing diagnostic; before
this change an unresolvable earliest or final technical commit went unreported when no assessment commit was recorded.

Against the six records on `main`:
- **All six** pass the checks that need no range: each recorded commit changes the assessment, is or descends from the
  anchor, and carries no governed path.
- **Five** also pass at the final phase, replayed over their changes' own merged ranges. Four name the first add.
  #957's `43d10aa` names a later edit that precedes all of #957's implementation, which equality with the anchor would
  have rejected.
- **#423's** archived `fix-derived-input-code-point-order` records `4921d39`, a decision-content edit that reached
  `main` through #435 in parallel with the implementation. Its implementation commit `ee430bc`, merged in #436, does
  not descend from `4921d39`, so the record is inconsistent. Its anchor `b9f4a77` does precede `ee430bc`, so the
  derived ordering holds. The change is archived, so no gate re-checks it. The audit below lists it.

**D7. `contract-reuse.json` is a planning artifact (Q18).** `planning_artifact_patterns` gains
`openspec/changes/*/contract-reuse.json`. The contract-reuse record is written with the proposal, as the assessment
is. Five proposal commits on `main` added it beside the assessment, and every one of them would otherwise read as an
assessment sharing a commit with implementation.
- **Association.** `requiresOpenSpecAssociation` stops requiring an owning change for the record, exactly as it already
  does not for `assessment.json`. In practice nothing changes: an active change's own directory is always covered by
  that change, and the pattern's single-segment wildcard does not match an archived change's path. Contract-reuse
  attribution (`openspec/scripts/contract-reuse/check.mjs`) is separate and does not change.
- Other change-directory documents stay governed implementation and belong in `design.md` or in a later commit.
- *Alternative:* exempt a change's whole directory. #947 rejected that, because it would cover executable files.

**D8. The unused baseline walk is removed.** `findEarliestGovernedImplementationCommit` has no caller, and its
baseline walk is the trap in history B. Ordering derivation now runs over the range (D2), so the helper is deleted
rather than reused.

**D9. No schema, generator or rule-registry change.** Everything happens in `ancestry.mjs` and at its two call sites
in `check-design-pattern-governance.mjs`: `checkAssessments`, which in every phase now passes the change id and its
owned paths for the recorded-field checks, and the final phase's `checkPerimeter`, which runs the derived check.
The rule `assessment-ordering-distinct-commits` in `rules.mjs` stays as it is: a recorded assessment commit still may
not equal a recorded earliest commit. The ordering fields stay optional, so there is no schema
version move (triage decision 3).

**D10. The overlap with workstream F is disclosed (Q3).** `check-design-pattern-governance.mjs` and
`design-pattern-policy.json` are also owned by the active `define-normative-precedence-lifecycle`, and this change
lists both in its own `owned_paths`. F's re-freeze (#972) starts only after this change's archive merges, so it binds
the updated files.
- **The canonical spec.** The R10 fold edits `openspec/specs/software-design-pattern-governance/spec.md`. Its blob is
  not bound by any normative-precedence pin: those pins bind the contract-applicable capabilities only (checked on
  `9acf995`; no governance script, policy, pin or this spec changed between `9acf995` and `bdd4c47`).
- **The collector live PoC change.** `add-collector-live-poc-deployment`, active since `8d4e411`, owns none of the
  files this change edits.
- **F's delta.** F's delta for this capability only adds requirements and does not touch R10.

## Audit of the ranges since activation (Q2)

**Method.** A read-only script replayed D1–D5 and D7 over every range that reached `main` since activation
`ee6fb3c` (2026-08-14), up to `bdd4c47`:
- a merge commit's range is `M^1..M^2`;
- a direct push is a range of one commit.

It used `main`'s own `git.mjs` and `paths.mjs` helpers and `main`'s current policy, plus the D7 pattern. Ownership
came from each change's `assessment.json` at the range head. A change with a retrospective exception was skipped.
That makes 546 ranges.

**Runs.** All three runs report the same 28 findings, commit for commit:
- 2026-11-18, at `9acf995`: 544 ranges;
- 2026-11-19, at `8d4e411`, after #989 proposed `add-collector-live-poc-deployment`: 545 ranges;
- 2026-11-19, at `bdd4c47`, after #991 archived the three landed dependency changes (Track 1, #990): 546 ranges.

**Result by rule set.**

| Rule set | Findings | In active changes |
|---|---|---|
| Amendment exemption `ordering` only, no D3, no D7 | 74 | 7 |
| D1–D5 and D7 as designed | 28 | 0 |

The 28 findings, all in archived changes, which cannot be edited:

| Kind | Changes (commit) |
|---|---|
| Assessment added in the same commit as code (7) | `classify-unclassified-governance-paths` (`e12a3c5`), `execute-node-24-matrix-and-pin-26` (`df9b89a`), `provide-root-command-surface` (`6cfa167`), `implement-collector-idempotency-and-deduplication` (`5771f66`), `reconcile-tracker-and-workspace-docs` (`b0820c0`), `delegate-collector-deduplication-to-storage` (`93e4f49`), `run-non-production-delivery-pilot` (`ed52313`) |
| Another change-directory record added with the assessment (7) | `fix-terminal-named-retry` README (`df49da8`), `add-client-evidence-capability` decisions (`aac6958`), `implement-fetch-delivery-adapter` inventory (`e16249e`), `revise-mode-a-envelope-size-budget` decision and harness (`efda512`), `deliver-sdk-evaluation-alpha` authorization (`ffc732b`), `deliver-sdk-evaluation-kit-v2` authorization (`de94202`), `fix-core-default-identifiers-uniqueness` assessment test (`47d54f5`) |
| Implementation before the assessment (6) | **#896** `correct-transaction-critical-partial-and-compensated-claims`: `d1a875e`, `30622ea`, `04f6039` before `3a8338f`, and `3a8338f` itself as an amendment. `harden-evaluation-kit-gate`: `77dbad5` (`CONTEXT.md`) before `7cb15d4`, and `7cb15d4` itself |
| Decision content changed after implementation in the same range (8) | `fix-terminal-named-retry` (`269bbb7`, `859b1bf`, `6ccdfa0`), `reconcile-tracker-and-workspace-docs` (`4596049`), `fix-derived-input-code-point-order` (`afe566b`), `align-sonar-scope-with-declared-packages` (`38ffa25`), `deliver-sdk-evaluation-alpha` (`bbc4e8a`), `fix-core-provider-fault-containment` (`df6a61a`) |

**Recorded-field checks (D6).** The 28 findings come from D1–D5 and D7. Replaying D6's final-phase checks over the
same 546 ranges adds one finding, also in an archived change: #423's record names `4921d39` as its assessment commit,
and `ee430bc` in #436's range does not descend from it (see D6). The replay ran the checker change built for the
implementation PR, at `bdd4c47`, through the checker's own derived-ordering function rather than the audit script.
Task 4.2 repeats it on the implementation head.

No change active at any run has a finding under the designed rules, so no in-flight change needs editing. Since #991
archived `upgrade-fast-uri-3-1-9`, `upgrade-contract-fast-uri-3-1-9` and `fix-contract-dependabot-ci`, three changes
remain active besides this one:
- `add-collector-live-poc-deployment`;
- `correct-sequential-authorization-lifecycle`;
- `define-normative-precedence-lifecycle`.

## Risks / Trade-offs

- **[An amendment in a later pull request goes undetected.]** Mitigation: R10 states the limit. Archive and
  signed-review checks are unchanged.
- **[Ownership is prefix-based, so a change that owns broad prefixes owns more commits.]** Mitigation: these are the
  same owned paths association already enforces. A wrong attribution can only add failures, and D3 bounds the
  shared-ownership case.
- **[D3 accepts a later change's commit on a path that an older change already owns.]** Mitigation: association
  covers the path either way, and the commit is still preceded by an assessment of that path.
- **[Exempting `owned_paths` lets scope widen after implementation without a fresh assessment.]** Mitigation:
  association still requires every governed path to be owned. The decision content (forces, approaches, security
  justification) stays frozen.
- **[The dual check runs the baseline checker on candidate data.]** The baseline checker only checks recorded fields,
  so it passes this change. The candidate checker is the one that gains the derived rule.
- **[Cost.]** The check adds one `git log --diff-filter=A` per owning change and one ancestry test per owned commit in
  the range. The audit replayed all 545 ranges in 86 s.

## Migration Plan

1. **Proposal** (this PR). The artifacts and the audit. The checker does not change yet.
2. **Implementation.** First the real-history tests, red against the unchanged checker. Then the policy pattern, the
   derived check, the recorded-field consistency checks, and the removal of the unused helper.
3. **Fold.** R10 MODIFIED into the canonical spec.
4. **Archive.**

Authors stop recording ordering by hand from the implementation merge onward. Existing records stay, and are
cross-checked whenever a range touches their change. Rollback is a revert of the implementation PR, which restores
the recorded-only check.
