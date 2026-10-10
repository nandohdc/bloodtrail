# Proposal

## Why

The two openspec governance suites create throwaway repositories through parallel
`DisposableRepository` helpers whose Git configuration omits `maintenance.auto`
and `gc.auto`. As #775's triage measured on `c145e4a` with Git 2.54.0, commits and
real merges start detached background maintenance; clones and rebases do not.
A detached writer can overlap a test cloning from or removing its fixture.

Each of the 19 test files passed when run independently with Trace2 in all three
triage runs. Unchanged main started maintenance 1,021 times across 15 files.
Adding `-c maintenance.auto=false -c gc.auto=0` to both helpers left 179 starts:
4 in `mutation-assurance.test.mjs` and 175 in
`normative-precedence-repository.test.mjs`, which run Git directly (#780).
The helpers account for 842 starts across 13 files. Supplying both settings to
every Git process through the environment left zero starts.

No maintenance run started through either helper did any work, in triage or in
this change's own census: each entered only the detach region, so the risk the
helpers carry is latent. The direct-Git files are different. In the census run
with the helpers unfixed, 2 of the 175 maintenance runs started by
`normative-precedence-repository.test.mjs` ran a cruft repack, which #780 now
tracks. In sdk-core, the same mechanism repacked and a `--no-hardlinks` clone
failed mid-copy in a required check; #772 fixed it in that verification helper.
This change applies that bounded prevention to the two governance helpers.

## What Changes

- Rename each helper's `GIT_IDENTITY` constant to `GIT_FIXTURE_CONFIG` and append
  `-c maintenance.auto=false -c gc.auto=0`, so every helper `git()` invocation
  carries the settings, commits and real merges included.
- Document why a fixture must never start detached maintenance, citing #775
  and the sdk-core precedent #772.
- Preserve methods, constructors, exports, identity/signing entries, environment
  handling, and all individual test files. Command-line `-c` overrides inherited
  configuration, including `GIT_CONFIG_*`, as #772's probe c demonstrated.
- Provide a full, non-sensitive assessment for the two `governance_core` paths
  and verification through the existing suites and a recorded external census.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement of `software-design-pattern-governance` or
`contract-reuse-assessment` changes. No spec mentions these helpers,
`maintenance.auto`, or Git auto-maintenance; this fixture-only correction opts
out of spec deltas with `skip_specs: true`.

## Impact

- `openspec/tests/design-pattern-governance/support/disposable-repo.mjs`
- `openspec/tests/contract-reuse/support/disposable-repo.mjs`
