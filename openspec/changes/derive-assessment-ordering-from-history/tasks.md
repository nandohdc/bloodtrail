# Tasks: Derive R10 assessment ordering from Git history (#943, #974)

## 1. Proposal

- [ ] 1.1 Author the proposal, design, R10 delta spec (`software-design-pattern-governance`) and tasks from the #943
  triage and the #974 spec. Verify that `openspec validate derive-assessment-ordering-from-history --strict` passes.
- [ ] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. The assessment is full and
  matches `governance_core_path`, `canonical_capability_requirement` and `security_sensitive_behavior`. Verify three
  things:
  - `node openspec/scripts/generate-assessment.mjs --change derive-assessment-ordering-from-history --check`
    passes;
  - `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change derive-assessment-ordering-from-history`
    passes;
  - the proposal commit changes no path outside this change's directory.
- [ ] 1.3 Re-run the one-off, read-only audit of design §"Audit of the ranges since activation" against the
  proposal's base, with every change active on that base. Verify that it reports 28 historical findings and none in an
  active change, and record the base, the range count and the active set in the design. If any active change has a
  finding, stop and report it to the owner before the proposal PR opens.
- [ ] 1.4 Once the Track 1 archive PR (#991, tracked by #990) has merged and every required context plus DeepScan is
  green, the owner merges the proposal PR as a merge commit. Record the proposal commit and the merge commit here.

## 2. Real-history tests, red first

Every test in this group builds a disposable real-history repository seeded from the live governance artifacts, runs
the checker as a process in the assessment phase or in the final phase with an explicit base, and asserts only
diagnostic identifiers and the exit status. Commit the tests before any checker or policy change, run them against
the unchanged checker, and record here which ones fail and with what.

- [x] 2.1 History A, implementation before the assessment. Baseline C0, C1 changes an owned governed path, C2 adds
  the assessment, C3 changes the governed path again; final phase with base C0. Every variant must fail
  `assessment-follows-implementation`:
  - nothing recorded;
  - `assessment_commit` C2 and earliest C1 (the truth);
  - `assessment_commit` C2 and earliest C3 (a later commit);
  - `assessment_commit` C2 and earliest omitted;
  - `assessment_commit` C0, which adds no assessment, and earliest C1.

  The four variants that record a commit must also fail `assessment-ordering-record-inconsistent`, because history
  contradicts each record: C2 does not precede C1, C1 does not follow C2, C1 precedes C3, and C0 adds no assessment.
  Null control: the same commits in the correct order (assessment, then C1, then C3) pass in both phases, with
  nothing recorded and with every field recorded consistently.

  Red on the unchanged checker, at the commit titled `test(governance): add real-history R10 ordering tests (#943, #974)`. Every variant failed:
  - nothing recorded, earliest C3 and earliest omitted reported no diagnostic at all;
  - earliest C1 reported `assessment-follows-implementation`, from the recorded relation, but no
    `assessment-ordering-record-inconsistent`;
  - assessment C0 reported only `assessment-shares-implementation-commit`, because C0 also changes the policy.

  The null control passed.
- [x] 2.2 One commit adds the assessment and changes an owned governed path, with nothing recorded: the final phase
  fails `assessment-shares-implementation-commit`. Red on the unchanged checker: no diagnostic.
- [x] 2.3 Stub, then rewrite. A placeholder assessment, then an owned governed commit, then a commit that rewrites the
  assessment's decision content, all in one range, fails `assessment-amended-after-implementation`. Null controls
  pass:
  - the same history where the later commit edits only `ordering`, `invariant_evidence`, `verification_task_ids` or
    `owned_paths`;
  - a decision-content edit in a later range that holds none of the change's governed commits (the disclosed limit);
  - an archive move of the change, which deletes the active assessment.

  Red on the unchanged checker: the rewrite reported no diagnostic. All six null controls passed.
- [x] 2.4 History B. The change's assessment lands, another change then lands a governed commit on the shared line
  that only it owns, and the first change then lands its implementation. Both changes' ranges pass with nothing
  recorded. A null control: it passed on the unchanged checker for both ranges, and the baseline walk the design
  rejects would fail it.
- [x] 2.5 Shared owners. A governed commit owned by two changes passes when one owner's assessment strictly precedes
  it, and fails `assessment-follows-implementation` when neither does. Both assessments land on side branches
  merged after the shared commit, so neither the amendment rule nor a merge commit's paths decide the result. Red on
  the unchanged checker: the neither-precedes case reported no diagnostic; the one-precedes case passed.
- [x] 2.6 No anchor. A change that owns a governed commit in the range and has no committed assessment fails
  `assessment-anchor-missing`, also when another change that owns the same commit has an assessment that precedes
  it (design D2). Red on the unchanged checker: no diagnostic in either case.
- [x] 2.7 Contract-reuse planning artifact. A proposal commit that adds `contract-reuse.json` beside the assessment,
  followed by implementation, passes in both phases. With `openspec/changes/*/contract-reuse.json` removed from the
  fixture's planning patterns, the same history fails `assessment-shares-implementation-commit`. The proposal commit
  is recorded as `assessment_commit`, so the assessment phase judges it too. Red on the unchanged checker: the
  accepting test failed in the assessment phase with `assessment-shares-implementation-commit`; the null control
  passed.
- [x] 2.8 Recorded fields. Each inconsistent recorded field fails `assessment-ordering-record-inconsistent`, and each
  consistent one passes:
  - `assessment_commit` that does not change the assessment, that precedes the anchor, or that changes an owned
    governed path;
  - `earliest_governed_implementation_commit` that is not an owned governed commit, or that has an owned governed
    commit in the range before it;
  - `final_technical_commit` that does not descend from the anchor;
  - consistent: the anchor itself, a later pre-implementation edit (the #957 shape), and the true earliest commit.

  Red on the unchanged checker: none of the six reported `assessment-ordering-record-inconsistent`. The empty
  commit, the earliest commit that is not owned, the final technical commit and the earliest commit preceded by
  another reported nothing; the commit preceding the anchor and the commit carrying implementation reported only
  `assessment-shares-implementation-commit`. Both consistent null controls passed.

## 3. Implementation

- [ ] 3.1 Add `openspec/changes/*/contract-reuse.json` to `planning_artifact_patterns` in
  `openspec/governance/design-pattern-policy.json`, beside the assessment patterns, and name it in
  `planning_artifact_note` (design D7).
- [ ] 3.2 In `openspec/scripts/design-pattern-governance/ancestry.mjs`, derive each change's anchor from history and
  check its owned governed commits, the amendment rule and the recorded fields (design D1–D6). Remove
  `findEarliestGovernedImplementationCommit` (D8).
- [ ] 3.3 In `openspec/scripts/check-design-pattern-governance.mjs`, run the derived check in the final phase after
  association, from the range and the changes' owned paths that the perimeter already collected, and run the
  recorded-field checks wherever an anchor exists (D2, D6). No assessment schema, generator or rule-registry change
  (D9).
- [ ] 3.4 Verify that every test of group 2 passes, and that `node --test openspec/tests/design-pattern-governance/*.test.mjs`
  and `node --test openspec/tests/contract-reuse/*.test.mjs` pass.

## 4. Verification

- [ ] 4.1 On the committed implementation head, run the final phase with the PR's merge base, the baseline and
  candidate dual check, the contract-reuse check for every active change, `openspec validate --all --strict`, `make`
  and `make governance-gates`. Verify each passes, and read the final phase's inspected counts.
- [ ] 4.2 Replay the audit at the implementation head with the real checker's rules. Verify that it still reports the
  same 28 historical findings, plus #423's archived record inconsistency from the recorded-field checks (design D6),
  and none in an active change, and that every active change passes the final phase over its own ranges. Report any
  failure to the owner before the implementation lands; none is waived.
- [ ] 4.3 Once every required context plus DeepScan is green, the owner merges the implementation PR as a merge
  commit. Record the implementation commits and the merge commit here.

## 5. Fold

- [ ] 5.1 In a separate PR, fold the MODIFIED R10 into `openspec/specs/software-design-pattern-governance/spec.md`.
  Verify that every existing scenario name is kept, that `openspec validate --all --strict` passes, and that the
  owner merges it as a merge commit.

## 6. Archive

- [ ] 6.1 After the fold merges, archive the change in a separate PR with `TZ=UTC openspec archive`, staging both
  sides of the move. The owner merges it as a merge commit, and #943 and #974 stay open for the owner to close by
  hand.
