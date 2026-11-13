# Proposal

## Why

R10, "Assessment ordering is proven by Git ancestry", requires an `assessment_commit` to contain no governed
implementation-path change. It also requires a generated assessment to take its proposal baseline from
`assessment.source.json`. So the commit that writes a generated assessment necessarily adds that source file.

The ordering check does not treat the source file as part of the assessment. `orderingGovernedPatterns` removes the
policy's `planning_artifact_patterns` from the governed set, and that list names `assessment.json` but not
`assessment.source.json`. Since `openspec/changes/` is `governed_implementation`, the checker counts the source file
as implementation. The policy's own `planning_artifact_note` gives the reason the exclusion exists: counting the
assessment as implementation "would make every correctly ordered assessment fail as though it had shipped code
alongside itself".

On `main` at `e729cbc`, measured for `correct-transaction-critical-commit-state-claims` (#913):
- recording its proposal commit `520f70e` as `assessment_commit` fails `assessment-shares-implementation-commit`,
  although `520f70e` changes only the change's own directory;
- `findEarliestGovernedImplementationCommit`, walking from the proposal baseline `1a365e7`, returns `520f70e`
  itself.

The one active change that records an assessment commit, `fix-contract-dependabot-ci`, passes only because it has no
`assessment.source.json`. So no change written with the generator can record its ordering today. That blocks task
6.1 of the #913 change. On 2026-11-11, in the #913 Claude Code session, the owner chose to fix the policy before
recording that ordering.

## What Changes

- **Policy.** `planning_artifact_patterns` gains `openspec/changes/*/assessment.source.json`, next to
  `openspec/changes/*/assessment.json`. The `planning_artifact_note` names the generator's source too.
- **Test.** A new governance test builds a real commit history whose assessment commit writes
  `assessment.source.json`, followed by an implementation commit, and records the ordering:
  - the checker accepts the recorded assessment commit;
  - with the new pattern removed from the fixture's policy, the same history fails
    `assessment-shares-implementation-commit`.
- **Nothing else.** R10's text, the checker code, the optional ordering fields and archived changes are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement changes: the policy now classifies paths the way R10 already requires, so the change carries no
spec delta.

## Impact

- **Governance core:** `openspec/governance/design-pattern-policy.json`.
- **Tests:** a new file, `openspec/tests/design-pattern-governance/assessment-source-ordering.test.mjs`.
- **Readers of the list:**
  - The ordering check stops counting an assessment's source as a governed path of the recorded assessment commit.
    It still takes the earliest implementation commit as recorded (#943). The unused helper that would derive that
    commit reads the same set, so a derivation would no longer return the assessment commit itself.
  - The association check (`requiresOpenSpecAssociation`) stops requiring an owning change for the file. That
    changes nothing in practice. An active change's directory is always covered by that change, and the pattern's
    single-segment wildcard does not match an archived change's path, exactly as for `assessment.json`.
- **Unblocks:** task 6.1 of `correct-transaction-critical-commit-state-claims` (#913), which can then record its
  ordering.
- **Out of scope:**
  - the broader trust gap in #943, where the checker takes recorded ordering commits as given;
  - making the ordering fields required;
  - re-checking archived changes;
  - recording this change's own ordering. Its assessment commit also adds a source file, so it would fail the very
    gate this change fixes until the fix lands.
