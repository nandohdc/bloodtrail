# Design

## Context

See `proposal.md` for #780's measurements, #775's governance helper precedent
and #772's sdk-core clone/repack correction and command-line precedence probe.
These three files bypass the helpers. `normative-precedence-repository` has
`git(root, args)` and `gitText(root, args)`, `mutation-assurance` has generic
`run(rootDir, args)`, and the script has git-only `run(cwd, args, failure)` plus
`command(cwd, executable, args)`. Their commits and real merges can detach
maintenance; clone, rebase and read-only commands cannot.

All three paths are `governance_core` under `design-pattern-policy.json`, so this
is a full assessment with `governance_core_path` matched and a non-sensitive
justification for each of the 15 dimensions. The capability is
`software-design-pattern-governance`, with no requirement delta.
`define-normative-precedence-lifecycle` owns all three paths and its signed record
pins them; `correct-sequential-authorization-lifecycle` also owns
`mutation-assurance.test.mjs`. This change lists all three in its own exact
`owned_paths` rather than relying on either owner's association.

## Goals / Non-Goals

**Goals:**

- Governance suites fail only for reasons about the gates under test, never
  because of a Git housekeeping race.
- No Git wrapper command in a constructed fixture repository starts a
  background writer, even under inherited configuration enabling maintenance.
- The small edit to active signed-record-pinned files changes no
  normative-precedence result and stays bounded for the next owner review.
- Preserve every existing test, assertion, fixture, identity setting and cleanup.

**Non-Goals:**

- Editing the signed record, lifecycle evidence, pin sets or every other file
  `define-normative-precedence-lifecycle` owns; nothing is re-signed or re-pinned.
- Editing `normative-precedence-debt-retirement-controls.mjs`, which starts no
  maintenance, or `openspec/scripts/normative-precedence/shared.mjs`.
- Renaming `run()`, editing any call site or other function, or adding a helper,
  module, test or control.
- Isolating global or ambient Git configuration beyond the two settings,
  persistent configuration writes, or CI environment changes.
- Specification, CI or production edits, and archiving before the
  implementation merges.

## Decisions

### Decision 1: Per-file command-line fixture configuration (task 2.1)

Near the module-level declarations in each file add exactly:

```js
const GIT_FIXTURE_CONFIG = Object.freeze(["-c", "maintenance.auto=false", "-c", "gc.auto=0"]);
```

Above it add one plain-sentence comment saying a fixture repository must never
start Git's background maintenance because a detached repack could still be
rewriting its `.git` while the test uses or removes it, citing #780, #775 and #772.

- In `normative-precedence-repository.test.mjs`, both `git()` and `gitText()`
  spawn `git` with `[...GIT_FIXTURE_CONFIG, ...args]`.
- In `mutation-assurance.test.mjs`, `run()` spawns `args[0]` with
  `args[0] === "git" ? [...GIT_FIXTURE_CONFIG, ...args.slice(1)] : args.slice(1)`.
  Non-Git executables retain their original arguments. The direct read-only
  `git show` is unchanged.
- In `verify-normative-precedence-mutations.mjs`, git-only `run()` calls
  `command(cwd, "git", [...GIT_FIXTURE_CONFIG, ...args])`. `command()` and its
  direct clone/config/read-only calls remain unchanged.

Change nothing else. Command-line `-c` wins over inherited `GIT_CONFIG_*`, as
#772 demonstrated; no persistent or environment configuration change is needed.
Both flags apply to every wrapper command, including scratch-overlay commits.

### Decision 2: Preserve precedence results without touching signed evidence

#780's triage committed the probe fix on top of an empty control commit and
compared diagnostics and observations at candidate, merge, fold, activation and
release: all five stages were identical. The freshness check fires only for
paths exclusive to the owning change: its directory, its records, or paths added
since its candidate base. These three files are none of those. Fold always
requires a fresh review independently. Adding a proposal-only change directory
also left checker output unchanged, as tested with #775's proposal commit.

16 of the signed record's 36 pinned objects already differ on `main`. The next
owner review of `define-normative-precedence-lifecycle` re-pins these three files
with the rest. That review has not happened, and this change neither re-pins nor
re-signs anything. Task 3.4 repeats the five-stage proof against this change's
final commit and an unsigned empty control on
`5368abed9a4a971ce049cb3f90df335c0caa0dc7`.

### Rejected alternatives

- **Wait for the owner's archive.** A real writer races a required check for an
  unbounded time while the pinned set is already stale. It fails the gate-only
  failure and no-background-writer forces; the demonstrated null-control result
  removes the reason to defer this bounded edit.
- **CI `GIT_CONFIG_*` settings.** Local runs remain exposed and the change edits
  `.github/workflows/ci.yml`, owned by both active changes. It fails the gate-only
  failure, no-background-writer and inherited-override forces, and the bounded
  pinned-edit force by broadening the owner-review surface.
- **Shared fixture-Git module.** `shared.mjs` is itself pinned, and a new module
  adds a `governance_core` path and new wiring. It fails the gate-only failure
  and bounded pinned-edit forces by expanding the failure surface and the
  next review's re-pin scope for a defect needing only three local constants.
- **Write `git config` after each `git init`.** Unlike #772 and #775's mechanism,
  this misses the script's scratch clone and inherited values can override
  repository configuration. It fails the gate-only failure, no-background-writer
  and inherited-override forces.

## Risks / Trade-offs

- **[Risk] A wrapper misses the flags.** → Inspect the complete three-file diff
  and record the supplied per-file Trace2 census of all 19 tests plus the script
  on clean detached worktrees: fixed and inherited-override runs have zero
  starts, while the proposal-commit control has only the expected three sources.
  Record every work count; a reverted repack is expected, not a stop condition.
- **[Risk] Fixture behavior changes.** → Retain assertions and require both
  CI-style suites' counts to match the measured base, with zero failures, and
  the script to apply and kill 33 mutants with clean null controls and
  byte-identical restoration.
- **[Risk] Pinned-file edits change precedence.** → Require identical sorted
  diagnostic/observation code-path lists and matching exit codes at all five
  stages against the empty control; stop on any difference. Existing fold,
  activation or release failures on the base are not new successes or regressions.

## Migration Plan

The six proposal artifacts land in their own commit, before the wrappers change.
The fix lands in a separate implementation commit that also ticks tasks 2.1
through 3.4. The census and the comparison run only in detached worktrees on the
final clean commit, never in a working checkout. The checker's JSON goes to a
file, because piping its output can truncate it when the checker calls
`process.exit`. Contributors need no migration. Reverting the fix restores the
prior behavior, and the proposal commit is the census's reverted control. The
archive follows in a separate pull request after the implementation merges.
