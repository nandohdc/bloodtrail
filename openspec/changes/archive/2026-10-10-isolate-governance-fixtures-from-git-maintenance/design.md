# Design

## Context

See `proposal.md` for #775's triage measurements and #772's observed sdk-core
clone/repack race. Both governance helpers prepend identity and
`commit.gpgsign=false` entries from `GIT_IDENTITY` in `DisposableRepository#git()`;
`commit()` and fixture merges use that method. They inherit global configuration
and ambient `GIT_CONFIG_*`. Unlike sdk-core's helper, they do not isolate those
sources, but command-line `-c` wins over them as #772's probe c demonstrated.

Both helper directories are `governance_core` in `design-pattern-policy.json`.
The assessment is therefore full, with `governance_core_path` matched and a
non-sensitive justification for each of the 15 security dimensions. Neither
helper belongs to another active change. Exact helper ownership avoids unrelated
OpenSpec association. No specification requirement changes.

## Goals / Non-Goals

**Goals:**

- Governance suites fail only for reasons about the gates under test, never
  because of a Git housekeeping race.
- No Git command run through either helper in a fixture repository starts a
  background writer, including when inherited configuration enables maintenance.
- Preserve fixture behavior, existing assertions, cleanup and signed-change-bound
  files outside these helpers.

**Non-Goals:**

- Editing `mutation-assurance.test.mjs`,
  `normative-precedence-repository.test.mjs`, or
  `openspec/scripts/verify-normative-precedence-mutations.mjs`: the active
  `define-normative-precedence-lifecycle` signed record binds these files, and
  #780 tracks their direct Git calls for later work.
- Editing `normative-precedence-debt-retirement-controls.mjs`, which only runs
  `git clone --shared` and `git show` and starts no maintenance.
- Configuring `core.fsmonitor`, isolating all global or ambient Git configuration,
  changing any individual test file, or adding a test, helper, module or control.
- Changing any specification, CI workflow or production code; archiving this
  change during this run.

## Decisions

### Decision 1: Command-line fixture configuration in both helpers (task 2.1)

Rename `GIT_IDENTITY` to `GIT_FIXTURE_CONFIG` in each declaration and its single
spread use in `git()`. Append `"-c", "maintenance.auto=false"` and
`"-c", "gc.auto=0"` after the existing identity/signing entries. Every helper
command then carries both flags, including commits and real merges. A test that
clones a helper repository outside the helper and commits through a new
`DisposableRepository` is covered too; clone and rebase themselves start no
maintenance.

Add one plain-sentence comment above each constant: a fixture repository must
never start Git's background maintenance because a detached repack could still
rewrite its `.git` while a test clones from or removes it, citing #775 and
#772's sdk-core fix. Change nothing else: methods, constructors, exports,
environment handling, identity/signing values and removal remain unchanged.
No persistent Git configuration is written.

### Rejected alternatives

- **CI `GIT_CONFIG_*` settings.** Supplying both settings in CI edits
  `.github/workflows/ci.yml`, also `governance_core`, and leaves local executions
  exposed. It fails the forces that gates never fail from housekeeping races,
  that helper fixture commands never start a background writer, and that
  inherited configuration cannot re-enable one.
- **One shared fixture-Git module.** A shared module adds a new `governance_core`
  file and refactors both helpers to fix a two-line defect in two parallel
  copies. It fails the gate-only-failure force by expanding the change to
  fixture wiring rather than just removing the housekeeping cause.
- **Isolate all global and ambient Git configuration.** Copying sdk-core's
  environment isolation changes how every governance test behaves for reasons
  beyond this defect, when `-c` already wins over inherited settings. It fails
  the gate-only-failure force by introducing unrelated fixture behavior changes.
- **Also edit the direct-Git test files.** Their active
  `define-normative-precedence-lifecycle` signed record binds exact contents.
  This fails the force that signed-change-bound files stay untouched; #780
  deliberately waits for that change's archive.

## Risks / Trade-offs

- **[Risk] Direct-Git files still start maintenance.** → The scope deliberately
  excludes #780's signed files, and one of them,
  `normative-precedence-repository.test.mjs`, was seen running a cruft repack.
  The census must show starts only in those two test files for fixed and
  inherited-override runs, and record work counts without hiding unexpected
  results.
- **[Risk] Disabling maintenance could affect fixture behavior.** → Keep every
  existing assertion and require CI-style suite counts equal to the base:
  contract reuse 73 tests/pass, design-pattern governance 370 tests/pass, zero
  failures. No new test or control is introduced.
- **[Risk] Future helper calls bypass configuration.** → Keep the settings in
  the existing shared flag list and use the full helper diff plus the per-file
  Trace2 census to verify coverage, including inherited `maintenance.auto=true`.

## Migration Plan

Commit this proposal before changing either helper. Commit the bounded fix
separately, then amend verification ticks into that implementation commit.
Record the fixed, proposal-commit reverted and inherited-override censuses on
clean detached worktrees outside the repository; never run the census in the
working tree. Preserve full commands and analysis externally and remove those
worktrees afterwards. Run the final governance chain on the final commit.
Contributors need no migration because the flags apply only to fixture commands.
Reverting the helper fix restores the prior behavior and is the census control.
Archive only after implementation merges, in a separate pull request.
