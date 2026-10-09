## Context

The kit gate clones the repository into a disposable temporary directory,
overlays the tracked tree under test, commits any overlay or planted change,
and then removes the clone with a plain recursive `rm`. In Git 2.54, that
commit can detach `git maintenance run --auto --quiet --detach`; its geometric
repack may still write under `.git/objects/pack` when removal starts, causing
`ENOTEMPTY`. The #734 probes show that the clone commit is the only current
command in this clone that can start maintenance.

The Node binding specification already requires a distributable kit from a
disposable clean clone of the tree under test and requires the result to be
independent of local Git configuration. This correction has no requirement
delta.

## Goals / Non-Goals

**Goals:**

- Prevent every later Git command in a kit-tree clone from reading an enabled
  local auto-maintenance or auto-gc setting.
- Prevent ambient `GIT_CONFIG_*` configuration from re-enabling maintenance
  for the clone commit.
- Keep clone-removal failure loud and unchanged.

**Non-Goals:**

- Retrying or otherwise masking a failed clone removal.
- Configuring `core.fsmonitor` or controlling other background Git processes.
- Changing the other disposable repositories tracked in #772.
- Changing kit contents, identity, digests, checks, controls, or requirements.

## Decisions

### Clone-local configuration plus commit flags

Task 2.1 adds `--config maintenance.auto=false --config gc.auto=0` to `git
clone`, before its `--` separator. Git writes those keys into the new clone's
local configuration before fetching, so every later Git command in that clone,
including the clone builder, reads them. The same task also adds `-c
maintenance.auto=false -c gc.auto=0` beside the fixed identity and signing
flags on the clone commit. Command-line `-c` wins over an ambient
`GIT_CONFIG_*` override for the one command that can trigger maintenance.

The existing `remove()` call stays exactly one plain recursive removal. With no
maintenance writer, an `ENOTEMPTY` or any other removal error continues to
show a regression or a different background writer.

## Rejected

- **Retry the clone's removal.** Retrying only makes the maintenance race less
  likely and hides a regression or a new background writer instead of showing
  it. It fails the forces that the kit gate must not fail because of Git
  housekeeping and that a failed removal stays loud rather than retried away.
- **Set the keys only at clone time.** An ambient `GIT_CONFIG_*` setting
  overrides clone-local configuration for the commit. This fails the forces
  that no disposable-clone command starts a writer and ambient configuration
  cannot re-enable one.
- **Pass `-c` only on the commit.** This protects the current commit but leaves
  every later Git command in the clone, including a future builder command,
  free to start maintenance. It fails the forces that no disposable-clone
  command starts a writer and ambient configuration cannot re-enable one.

## Risks / Trade-offs

The correction records two local settings in an otherwise disposable clone and
repeats them as commit flags. This deliberately duplicates the protection at
the two Git configuration precedence points, while changing no kit output or
live repository configuration.

## Migration Plan

Merge the bounded correction. Existing contributors need no migration because
the settings are written only in temporary clones. Archive this change after
the implementation merges in a separate pull request.
