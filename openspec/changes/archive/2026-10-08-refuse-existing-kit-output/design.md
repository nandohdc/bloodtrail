## Context

The builder resolves its clean distributable Git state before it creates a kit,
but it currently permits a requested destination that already exists. The
builder then copies and seals files in that directory, so a foreign regular
file can enter a distributable kit and its archive. A later sealing failure
can clean up the entire existing directory. `tar -czf` also silently replaces
a same-named distributable archive beside the destination.

The existing requirements already say that untracked and non-regular files
present on disk SHALL NOT vary or reach a kit, and that every kit-gate check
has a stable identity, run-specific clause, and planted-defect controls. This
change implements those requirements without a requirement delta.

## Goals / Non-Goals

**Goals:**

- Refuse an existing destination before `mkdir`, including a dangling symlink.
- Refuse an existing distributable archive before creating a destination.
- Ensure failed-build cleanup can remove only a temporary parent or a directory
  created by this build.
- Prove both refusals with one clone-gate check and two measured controls.

**Non-Goals:**

- Changing a public API, a requirement, kit identity, or release authorization.
- Offering a way to reuse or overwrite existing output.
- Making distributable archive digests reproducible across builds.
- Changing a build without `--dest` or other kit-gate checks.

## Decisions

### Refuse output that predates the build before creation

The existing inside-repository guard remains first and unchanged. Once the
builder has resolved the clean distributable state, it uses `lstat` before
`mkdir` to reject any existing requested destination, including a dangling
symlink. `lstat` errors other than `ENOENT` propagate. For a distributable
build that will create an archive, one unexported archive-path helper derives
the archive path for both the preflight refusal and archive creation. An
existing archive is refused before any destination is created.

The cleanup target is the temporary parent when one exists, otherwise the
first directory recursive `mkdir` created. There is no fallback to `kitDir`:
the destination is now necessarily created by the build. A build without
`--dest` retains its fresh temporary parent and current behaviour.

### Prove the two output refusals in the clone gate

A new `existing-output-refusal` check runs after `destination-refusal` and
before `dirty-tree-refusal`, while the clone is clean. It performs independent
temporary-directory probes for an existing destination and for an existing
archive beside an absent destination. Each probe verifies the refusal,
unchanged known bytes, and the absence of output the builder must not create.

Two measured clone controls remove exactly one guard each: one permits writing
into an existing destination and one permits overwriting an archive. Each must
make the gate fail at `existing-output-refusal`, and must itself fail when the
check is disabled. The stable identity, check order, summary clause, expected
build identities, and control count advance together. The glossary defines
"Kit destination" and the context map indexes that vocabulary.

## Rejected

- **Accept an existing empty destination.** This fails the force that a failed
  build must never delete anything it did not create, because a failed build's
  cleanup would then reach a directory the build did not create.
- **Build into an existing destination but delete only files the build
  created.** This fails the force that present files must never be sealed into
  a kit or archive, because foreign regular files are already eligible for
  sealing.
- **Provide an overwrite option such as `--force`.** This fails both the
  no-foreign-output and no-unowned-deletion forces whenever the option is
  requested, and also fails the force that an existing published archive is
  never overwritten.

## Risks / Trade-offs

The new preflight probes add two local metadata checks, but make ownership
explicit before copying, sealing, archiving, or cleanup. Refusing all existing
destinations avoids ambiguous empty-directory and selective-cleanup rules.
The clone gate adds bounded disposable probes and two controls that directly
show both guards fail closed.

## Migration Plan

Merge the bounded correction. Facilitators must select a destination that does
not yet exist and move a same-named archive or choose another parent before a
distributable build. Archive this change after the implementation merges in a
separate pull request.
