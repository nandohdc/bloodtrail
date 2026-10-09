## Context

The sdk-core verification suite runs Git in its disposable clones through one
shared helper, `runDisposableGit()`. It prepends a fixed list of `-c` flags —
identity, `commit.gpgsign=false`, and a null-device `core.hooksPath` — and runs
in an environment from `disposableGitEnvironment()`, which strips ambient
`GIT_CONFIG_*` and points global and system config at the null device. Neither
function sets `maintenance.auto` or `gc.auto`, so Git's defaults apply. In Git
2.54, a commit through the helper in a `git clone --no-hardlinks` of the
repository can detach `git maintenance run --auto --quiet --detach`; its
geometric repack may still write under `.git/objects/pack` when a test removes
the clone, causing `ENOTEMPTY`. This is the race #734 fixed in the kit gate's
clone. The same writer can prune loose objects while a test takes a
`--no-hardlinks` clone from that repository, which then fails with
`failed to copy file … .git/objects/…`. P-00 failed that way twice on this
change's base.

No spec under `openspec/specs/` mentions the helper, `maintenance.auto`, or
Git's auto-maintenance, so this correction has no requirement delta.

## Goals / Non-Goals

**Goals:**

- Prevent every Git command the helper runs in a disposable repository from
  starting background maintenance or auto gc.
- Prevent ambient Git configuration from re-enabling maintenance for any
  helper command.
- Keep removal of disposable repositories loud and unchanged.

**Non-Goals:**

- Retrying or otherwise masking a failed removal.
- Configuring `core.fsmonitor` or controlling other background Git processes.
- Changing the kit gate's clone, already fixed by #734.
- Changing the openspec tests' and scripts' disposable repositories, tracked
  in #775.
- Changing any test file, the SDK's source, its public API, or its packed
  contents.

## Decisions

### Bounded `-c` configuration in the shared helper

Task 2.1 adds `-c maintenance.auto=false -c gc.auto=0` to the helper's fixed
`boundedConfig`, after the existing identity, signing and hooks entries. Every
command `runDisposableGit` runs therefore carries the two flags, `clone` and
`commit` included, and command-line `-c` wins over any remaining configuration
source. `disposableGitEnvironment()` stays unchanged: it already strips ambient
`GIT_CONFIG_*` values and redirects global and system configuration to the
null device, so an inherited setting cannot re-enable maintenance.

Removal of disposable repositories stays exactly the same plain one-shot
recursive removal. With no maintenance writer, an `ENOTEMPTY` or any other
removal error continues to show a regression or a different background writer.

## Rejected

- **Retry the removal of a disposable repository.** Retrying only makes the
  maintenance race less likely and hides a regression or a new background
  writer instead of showing it. It fails the forces that the verification
  suite must not fail because of Git housekeeping and that a failed removal
  stays loud rather than retried away.
- **Pass `--config` at each `git clone` call site.** This spreads one rule
  across 17 call sites in eleven files, including the `mutations.test.mjs`
  hotspot, and misses any repository a test creates another way. It fails the
  forces that no disposable-repository Git command may start a background
  writer and that ambient configuration cannot re-enable one.
- **Add the keys to `disposableGitEnvironment()` as `GIT_CONFIG_COUNT`
  entries.** This also changes the environment handed to the gate scripts run
  as child processes, which never commit, and couples the fix to a function
  that eight call sites spread into child environments. It fails the forces
  that no disposable-repository Git command may start a background writer and
  that ambient configuration cannot re-enable one.

## Risks / Trade-offs

The correction adds two configuration flags to every helper invocation. The
helper only ever runs in disposable repositories created by the suite, and no
test asserts the contents of `boundedConfig`, so nothing observable changes
except the absence of the background writer.

## Migration Plan

Merge the bounded correction. Existing contributors need no migration because
the settings apply only to helper commands in disposable repositories. Archive
this change after the implementation merges in a separate pull request.
