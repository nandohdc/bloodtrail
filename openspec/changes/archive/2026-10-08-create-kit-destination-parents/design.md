## Context

The builder currently calls `assertOutsideRepository(dirname(kitDir))` before
its recursive `mkdir`. The assertion resolves that parent, so a missing parent
throws a bare `ENOENT` before the builder can create it. Conversely, checking
only the parent lets a destination equal to the repository root pass: that
parent is outside the repository.

The existing requirements already require the builder to write only outside the
repository tree and require every kit-gate check to have a stable identity,
run-specific clause, and planted-defect control. This change implements those
requirements without adding a requirement delta.

## Goals / Non-Goals

**Goals:**

- Create missing `--dest` parents only after proving the nearest existing
  destination path is outside the repository.
- Refuse an in-repository destination before the builder creates anything.
- Prove both behaviours through the clone gate and its measured controls.

**Non-Goals:**

- Changing the public API, package contents, identity format, or release
  authorization.
- Changing a failed build's cleanup of an already existing destination; #760
  owns that hazard.
- Adding a new module, exported function, or requirement text.

## Decisions

### Guard the nearest existing destination path before `mkdir`

Starting at `kitDir`, the builder walks through `dirname` until `realpath`
succeeds, then passes that nearest existing path to the outside-repository
guard. For a missing kit directory below an existing parent, this is the same
parent checked today. For the repository root or another existing path inside
the repository, it is the destination itself. The guard runs before the
recursive `mkdir`, and `--dest` uses the exact destination-specific refusal
message while the temporary-parent caller keeps the current default message.

The builder retains `mkdir(kitDir, { recursive: true })` and its result. Its
cleanup target remains the temporary parent when one exists; otherwise it is
the first path recursive `mkdir` created, or `kitDir` when no path was
created. The guard and directory creation remain outside the build `try`, so a
refusal removes nothing.

### Prove missing-parent creation and refusal in the clone gate

The distributable clone build writes to an `absent/nested/evaluation-kit`
destination and checks both the reported kit path and archive parent. A new
`destination-refusal` check runs after that clean-clone check and before the
dirty-tree refusal. It directs the clone builder at a missing-parent path
inside the clone, requires a nonzero result and destination diagnostic, and
requires the missing parent not to exist afterward.

The check has a measured clone planted-defect control that inserts recursive
`mkdir` immediately before the destination guard. The kit gate must fail at
`destination-refusal` on that plant, and the control itself must fail when that
check is disabled. The stable check identity, control count, expected
build-check order, and verification-summary clauses are updated together so the
summary can claim only checks that ran.

## Rejected

- **Create the directories first and check afterwards.** This fails the
  inside-repository refusal force because it creates directories inside the
  repository before refusing.
- **Check upward from the parent while skipping missing ancestors.** This fails
  the inside-repository refusal force because it retains the current
  parent-only hole and lets `--dest` equal to the repository root pass.
- **Refuse a missing parent with a clearer message.** This fails the
  missing-parent kit-and-archive force because a facilitator still receives no
  kit.

## Risks / Trade-offs

The nearest-existing-path walk adds filesystem probes before a build, but it
preserves the existing guard for already-parented destinations and ensures the
first write occurs only after the repository boundary is proven. The clone
check adds one bounded builder invocation and one control, yielding direct
failure evidence for the new guard.

## Migration Plan

Merge the bounded correction. Existing destinations whose parent already
exists retain their current behaviour. A later, separate change for #760 may
change failed-build cleanup for destinations that predate the build.
