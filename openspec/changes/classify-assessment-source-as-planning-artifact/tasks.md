# Tasks: Classify an assessment's source as a planning artifact

## 1. Proposal

- [ ] 1.1 Author the proposal, design and tasks, and mark `.openspec.yaml` with `skip_specs: true`. Verify that
  `openspec validate classify-assessment-source-as-planning-artifact --strict` passes.
- [ ] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change classify-assessment-source-as-planning-artifact --check`
  and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change classify-assessment-source-as-planning-artifact`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [ ] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here.

## 2. Test that exposes the gap

- [ ] 2.1 Add `openspec/tests/design-pattern-governance/assessment-source-ordering.test.mjs`. It seeds a disposable
  repository from the live governance artifacts and builds a history with four commits:
  - an assessment commit that records the baseline and writes `assessment.source.json`;
  - an implementation commit;
  - a commit that deletes the source again;
  - the ordering record.

  Assert that the checker passes in the assessment phase, and in the final phase with the fixture's baseline as its
  base. Verify that the test fails on the unchanged policy with `assessment-shares-implementation-commit`, and record
  the failure.
- [ ] 2.2 In the same file, add three more tests:
  - a null control that removes the new pattern from the fixture's policy before building the same history, and
    asserts `assessment-shares-implementation-commit` in both phases;
  - the association reader under the live policy. `requiresOpenSpecAssociation` is false for
    `openspec/changes/<id>/assessment.source.json`, and true for `openspec/changes/<id>/notes.mjs` and for an
    archived change's `assessment.source.json`;
  - a check that the live policy lists `openspec/changes/*/assessment.source.json` next to
    `openspec/changes/*/assessment.json`.

## 3. Policy

- [ ] 3.1 In `openspec/governance/design-pattern-policy.json`, add `openspec/changes/*/assessment.source.json` to
  `planning_artifact_patterns` after `openspec/changes/*/assessment.json`. In `planning_artifact_note`, also name the
  generator's source. Verify that every test from group 2 passes.

## 4. Integration checks

- [ ] 4.1 Verify that `node --test openspec/tests/design-pattern-governance/` passes, and that `git diff --check` is
  clean.
- [ ] 4.2 Run `make governance-gates`, then the post-commit governance battery (`--phase final`, the dual check in
  both phases). Verify that every step passes.
- [ ] 4.3 In a disposable copy of the implementation head, verify that #913's ordering can now be recorded. Build the
  governed set as `orderingGovernedPatterns` does:
  - include every `governed_implementation` and `governance_core` pattern;
  - exclude every `planning_artifact_patterns` entry from the new policy.

  With `assessment_commit` set to `520f70e` and the earliest commit derived from that set by
  `findEarliestGovernedImplementationCommit`, `verifyAssessmentOrdering` must report no failure. Record the derived
  earliest commit. As a control, derive with the old policy's list and confirm that `520f70e` comes back.
- [ ] 4.4 Run `/code-review xhigh` on the implementation range. Verify that no correctness finding is left open, and
  that the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.

## 5. Merge and archive

- [ ] 5.1 Verify that every required context plus DeepScan is green on the implementation PR head.
- [ ] 5.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here.
- [ ] 5.3 In a separate archive PR, merged with a merge commit after the implementation lands, archive the change.
  There is no fold, because the change has no spec delta. Verify that the archived directory carries the UTC date of
  the archive.
