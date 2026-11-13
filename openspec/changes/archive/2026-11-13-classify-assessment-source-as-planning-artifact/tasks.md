# Tasks: Classify an assessment's source as a planning artifact

## 1. Proposal

- [x] 1.1 Author the proposal, design and tasks, and mark `.openspec.yaml` with `skip_specs: true`. Verify that
  `openspec validate classify-assessment-source-as-planning-artifact --strict` passes.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change classify-assessment-source-as-planning-artifact --check`
  and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change classify-assessment-source-as-planning-artifact`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [x] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here. Merged: #947, proposal commit `5971ebc`, merge commit
  `c4bfa75`, with all ten required contexts and DeepScan green.

## 2. Test that exposes the gap

- [x] 2.1 Add `openspec/tests/design-pattern-governance/assessment-source-ordering.test.mjs`. It seeds a disposable
  repository from the live governance artifacts and builds a history with four commits:
  - an assessment commit that records the baseline and writes `assessment.source.json`;
  - an implementation commit;
  - a commit that deletes the source again;
  - the ordering record.

  Assert that the checker passes in the assessment phase, and in the final phase with the fixture's baseline as its
  base. Verify that the test fails on the unchanged policy with `assessment-shares-implementation-commit`, and record
  the failure.

  Recorded: commit `03a6aa6` adds the file on the unchanged policy. There, 3 of its 4 tests fail and the null control
  passes. The ordering test fails in the assessment phase with `assessment-shares-implementation-commit`.
- [x] 2.2 In the same file, add three more tests:
  - a null control that removes the new pattern from the fixture's policy before building the same history, and
    asserts `assessment-shares-implementation-commit` in both phases;
  - the association reader under the live policy. `requiresOpenSpecAssociation` is false for
    `openspec/changes/<id>/assessment.source.json`, and true for `openspec/changes/<id>/notes.mjs` and for an
    archived change's `assessment.source.json`;
  - a check that the live policy lists `openspec/changes/*/assessment.source.json` next to
    `openspec/changes/*/assessment.json`.

  On the unchanged policy, the association test and the live-policy test fail, and the null control passes.

## 3. Policy

- [x] 3.1 In `openspec/governance/design-pattern-policy.json`, add `openspec/changes/*/assessment.source.json` to
  `planning_artifact_patterns` after `openspec/changes/*/assessment.json`. In `planning_artifact_note`, also name the
  generator's source. Verify that every test from group 2 passes.
  Done in `5698637`: 4 of 4 pass.

## 4. Integration checks

- [x] 4.1 Verify that `node --test openspec/tests/design-pattern-governance/` passes, and that `git diff --check` is
  clean.
  On `be307e6`: 374 of 374 pass.
- [x] 4.2 Run `make governance-gates`, then the post-commit governance battery (`--phase final`, the dual check in
  both phases). Verify that every step passes.
  On `be307e6`: `make governance-gates` passed on every workspace. The final phase passed from base `c4bfa75`, over 3
  commits and 2 paths. The dual check passed for candidate and baseline in both phases.
- [x] 4.3 In a disposable copy of the implementation head, verify that #913's ordering can now be recorded. Build the
  governed set as `orderingGovernedPatterns` does:
  - include every `governed_implementation` and `governance_core` pattern;
  - exclude every `planning_artifact_patterns` entry from the new policy.

  With `assessment_commit` set to `520f70e` and the earliest commit derived from that set by
  `findEarliestGovernedImplementationCommit`, `verifyAssessmentOrdering` must report no failure. Record the derived
  earliest commit. As a control, derive with the old policy's list and confirm that `520f70e` comes back.

  Done in a disposable clone of `5698637`. The derived earliest commit is `ae29cbe`, and `verifyAssessmentOrdering`
  reports no failure. With the old policy's list the derivation returns `520f70e`, and the same record fails
  `assessment-shares-implementation-commit`.

  A further check, beyond this task: in the same clone, #913's ordering (`520f70e`, `ae29cbe`, `b98537c`) was written
  to its `assessment.source.json`, regenerated and committed. The checker passed in both phases and the dual check
  passed. The test in 2.1 does not cover that shape, because its fixture deletes the source before the checker runs.
- [x] 4.4 Run `/code-review xhigh` on the implementation range. Verify that no correctness finding is left open, and
  that the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.
  Run on `c4bfa75..5698637`: 6 findings, none a correctness defect. Three are fixed, two in `be307e6` (the unused
  helper branch and the assertion order) and one by these task records. Three are left: helpers shared with
  `ancestry.test.mjs`, which this change does not own; the fixture shape noted in 4.3; and `03a6aa6` being red by
  design, which the owner accepted on 2026-11-13.

## 5. Merge and archive

- [x] 5.1 Verify that every required context plus DeepScan is green on the implementation PR head. On #948's head
  `87f7354`, all ten required contexts and DeepScan were green. `sonar` passed on a rerun, after its first attempt
  could not reach the SonarQube server (HTTP 530).
- [x] 5.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here. Merged: #948,
  merge commit `3f88b28`.
- [x] 5.3 In a separate archive PR, merged with a merge commit after the implementation lands, archive the change.
  There is no fold, because the change has no spec delta. Verify that the archived directory carries the UTC date of
  the archive. Archived to `openspec/changes/archive/2026-11-13-classify-assessment-source-as-planning-artifact/`
  after #948 merged. `TZ=UTC date +%F` gave `2026-11-13`, the archive day. This PR merges with a merge commit.
