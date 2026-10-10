# Proposal

## Why

Three normative-precedence files build throwaway Git repositories without
suppressing auto-maintenance in their own wrappers. #780's triage measured on
`5368abed9a4a971ce049cb3f90df335c0caa0dc7` with Git 2.54.0 that
`normative-precedence-repository.test.mjs` starts detached maintenance 175 times
per run, `mutation-assurance.test.mjs` starts it 4 times, and the clean mutation
script starts it 5 times, all from the mutation-assurance controls it launches.
The script commits its own scratch overlay only when the working tree is dirty.
Commits and real merges start maintenance; clone, rebase and read-only commands
do not.

A maintenance run started by `normative-precedence-repository.test.mjs` sometimes
does a real cruft repack while the test still uses the same fixture repository.
In one of five triage runs it ran `repack -d -l --cruft
--cruft-expiration=2.weeks.ago --quiet --write-midx` while the test's own `add -A`
and `commit` ran there; the test passed. #775 saw two more such repacks. Across
13 traced runs, 3 of 2,275 maintenance starts repacked in 2 runs. No CI failure
from this race has been found yet. The same race failed a required sdk-core
check in #772, whose disposable-clone helper fix prevents the detached writer.

After #775's governance helper fix, these two tests are the only remaining
maintenance sources across all 19 openspec test files: with both settings
supplied to every Git process through the environment, there were zero starts.
#772's probe showed that command-line `-c` wins over an inherited
`GIT_CONFIG_*`.

All three files are pinned by the signed record of the active change
`define-normative-precedence-lifecycle`, which is why #775's triage first left
them to wait until that change is archived. They no longer wait: the writer is
real, and with this correction committed on top of an empty control commit, the
normative-precedence checker gave identical results at all five stages.

## What Changes

- Add a per-file frozen `GIT_FIXTURE_CONFIG` carrying exactly
  `-c maintenance.auto=false -c gc.auto=0` to every Git wrapper invocation in
  the two test files and mutation script, following #775 and #772.
- Add a one-sentence comment above each, explaining the detached-repack race
  and citing #780, #775 and #772.
- Preserve all call sites, assertions, test names, fixtures, identity settings,
  other functions and environment handling; write no persistent configuration.
- Provide a full, non-sensitive governance-core assessment, existing-suite
  coverage, an external fixed/reverted/inherited Trace2 census, and a five-stage
  empty-control comparison. Nothing is re-signed or re-pinned: the next owner
  review of `define-normative-precedence-lifecycle` re-pins these files with the
  rest of its record.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement of `software-design-pattern-governance` changes. No spec
under `openspec/specs/` mentions these fixtures, `maintenance.auto` or Git's
auto-maintenance. This bounded fixture correction opts out of spec deltas with
`skip_specs: true` and adds or modifies no requirement.

## Impact

- `openspec/tests/design-pattern-governance/normative-precedence-repository.test.mjs`
- `openspec/tests/design-pattern-governance/mutation-assurance.test.mjs`
- `openspec/scripts/verify-normative-precedence-mutations.mjs`
