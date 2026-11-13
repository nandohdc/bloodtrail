# Design: Classify an assessment's source as a planning artifact

Decision source: the owner, 2026-11-11, in the #913 Claude Code session. Offered two ways to unblock #913's
ordering record, the owner chose to fix the policy first. This design makes the remaining choices and says so.

## Context

See `proposal.md` - Why.

Two readers use `planning_artifact_patterns`:
- `orderingGovernedPatterns` (`openspec/scripts/check-design-pattern-governance.mjs`). It builds the governed set
  for ordering from the `governed_implementation` and `governance_core` patterns, and excludes the planning
  artifacts. `verifyAssessmentOrdering` uses that set in one place: to check that the recorded assessment commit
  changes no governed path. It takes the earliest implementation commit as recorded and never derives it. The helper
  that would derive it, `findEarliestGovernedImplementationCommit`, takes the same set but has no caller (#943).
- `requiresOpenSpecAssociation` (`openspec/scripts/design-pattern-governance/perimeter.mjs`). It exempts planning
  artifacts from needing an owning active change.

The list dates from 2026-08-13, when governance was established. `assessment.source.json` came later, with the
generator in #303 on 2026-09-04. The generator writes `assessment.json` from the source, so an author commits the two
together, as #913's proposal commit `520f70e` did.

## Goals / Non-Goals

**Goals:**
- An assessment commit that writes a generated assessment, its source included, is accepted as the assessment
  commit, and is not taken for the earliest implementation commit.
- Show the fix with a test that runs the real checker on a real history and fails on the unchanged policy.

**Non-Goals:**
- #943: the checker still trusts the recorded ordering commits.
- Making `assessment_commit` or the other ordering fields required.
- Changing R10's text or the checker's code.
- Archived changes.

## Decisions

### Decision 1: The policy list gains exactly one pattern

`planning_artifact_patterns` gains `openspec/changes/*/assessment.source.json`, written beside
`openspec/changes/*/assessment.json` and with the same single-segment wildcard. The `planning_artifact_note` gains
one clause naming the generator's source.

*Alternatives considered:*
- *Hard-code the exclusion in `orderingGovernedPatterns`.* Rejected. Classification lives in the policy, and both
  readers would then disagree about one path.
- *Exclude the whole `openspec/changes/*/` directory.* Rejected. It would exempt any file an author places there,
  including executable files, where today only the named planning files are exempt.
- *Exclude every JSON file in a change directory.* Rejected for the same reason, more narrowly: it covers files
  nobody has reviewed as planning artifacts.
- *Record the ordering as evidence in `tasks.md` and leave the policy unchanged.* This was option A, which the owner
  did not choose. It would leave every later change written with the generator unable to record its ordering.

### Decision 2: No spec delta

R10 already says that the assessment commit SHALL contain a valid approved assessment and no governed
implementation-path change, and that a generated assessment SHALL take its baseline from `assessment.source.json`.
A conforming generated assessment commit therefore contains the source file, so R10 cannot count that file as
implementation. The policy failed to implement the requirement as written, and the requirement itself does not
change. The change is marked `skip_specs: true`, and its assessment declares `software-design-pattern-governance`
with `material_capability_modification: false`.

### Decision 3: The test runs the real checker on a real history

The new test file follows the R10 fixtures in `ancestry.test.mjs`. It seeds a disposable repository from the live
governance artifacts, so its policy is the candidate policy, then builds four commits:
1. the assessment commit, which records the baseline and writes `assessment.source.json` beside the seeded
   `assessment.json`;
2. an implementation commit under `packages/example/src/`;
3. a commit that deletes the source file again;
4. the commit that records the ordering.

Deleting the source keeps the fixture valid. For an active change directory that holds an `assessment.json`, the
checker regenerates it from a source file in the working tree and fails on drift, and a minimal fixture source would
not regenerate the seeded assessment. The ordering check, though, reads the paths each commit changed, so commit 1
still carries the source.

The assertions:
- **With the candidate policy, the checker passes** in the assessment phase, and in the final phase with the
  fixture's baseline as its base, the phase CI runs.
- **The null control.** The same history, built after the pattern is removed from the fixture's policy, fails
  `assessment-shares-implementation-commit` in both phases. This is the failure #913 hit, so the control shows the
  test measures the pattern and nothing else.
- **The association reader.** Under the live policy, `requiresOpenSpecAssociation` is false for a change
  directory's `assessment.source.json`. It stays true for another file in a change directory, such as
  `notes.mjs`, and for an archived change's source. So the pattern cannot widen into the rejected directory-wide
  exemption unnoticed.
- **The live policy** lists the pattern next to `assessment.json`.

The test is shown to fail on the unchanged policy before the policy changes. A prototype of these fixtures, run
before this proposal against the unchanged policy and against a fixture policy carrying the pattern, gave exactly
these results in both phases.

### Decision 4: Association needs no compensating change

Exempting the file from association could only matter for a source file that no active change covers. That cannot
arise for a live change, because `ownedPathsFor` always grants the change's own directory. Nor can it arise for an
archived one, whose path has one more segment than the wildcard matches. `assessment.json` has been in the same
position since the list was written.

### Decision 5: This change does not record its own ordering

Its proposal commit adds `assessment.source.json`, so before the policy changes, recording that commit would fail
`assessment-shares-implementation-commit`. That is the very gap this change fixes. The change leaves `ordering` at
its proposal baseline. Recording orderings, this change's included, is for #913's task 6.1 and for #943.

### Decision 6: Pull requests and merges

The change lands as three pull requests, with no fold because there is no spec delta:
1. the proposal;
2. the implementation;
3. the archive.

The owner merges each one with a merge commit. Each says `Refs #943` and `Refs #913` and uses no closing keyword.
Neither issue closes with this change. Once the implementation is on `main`, #913's ordering record follows in that
change's own lane.

## Risks / Trade-offs

- **[Risk] A commit that only edits an assessment's source no longer counts as governed implementation.**
  - *Mitigation:* `assessment.json` has been treated this way from the start. The source is the generator's input
    and has no runtime effect. Wherever a change directory also holds an `assessment.json`, the checker's drift rule
    binds the two byte for byte. A source with no assessment beside it is never generated into one, so the gate
    reads nothing from it.
- **[Risk] A future file named `assessment.source.json` that is not a generator input.**
  - *Mitigation:* the pattern matches only a file directly inside a change directory, where the generator reads it.
- **[Trade-off] The gap remains for archived changes.**
  - Discovery skips `archive/`, so their recorded orderings are never checked, either before or after this change.
