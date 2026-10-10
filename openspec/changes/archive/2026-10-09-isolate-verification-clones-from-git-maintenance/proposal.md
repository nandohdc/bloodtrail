## Why

The sdk-core verification suite runs Git in its disposable clones through one
shared helper, `runDisposableGit()`, and removes those clones when each test
finishes. As confirmed with Trace2 during #772's triage, a commit through the
helper in a `git clone --no-hardlinks` of the repository starts Git's detached
background maintenance, whose geometric repack writes into the clone's
`.git/objects/pack`. A removal that overlaps that writer fails with
`ENOTEMPTY`, the race #734 fixed for the kit gate's clone. A `--no-hardlinks`
clone taken from a repository whose loose objects the repack is pruning fails
too: on this change's base, `test:verification` failed twice in a row at P-00
with `failed to copy file to …/.git/objects/…: No such file or directory`.
That failure is intermittent, and it passed on a later run without the fix.

#734 corrects that disposable-clone hygiene defect without changing the
evaluation-kit requirements. This change does the same for the verification
suite's clones.

## What Changes

- Add `maintenance.auto=false` and `gc.auto=0` to the helper's fixed
  `boundedConfig`, so every Git command the helper runs carries them, `clone`
  and `commit` included.
- Keep `disposableGitEnvironment()` unchanged: it already strips ambient
  `GIT_CONFIG_*` variables and points global and system configuration at the
  null device, so an inherited setting cannot re-enable maintenance for a
  helper command.
- Preserve the existing loud one-shot removal so a regression or another
  background writer remains observable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This bounded correction changes only disposable-clone Git hygiene in the
verification suite's test fixture, so it opts out of spec deltas and makes no
requirement changes.

## Impact

- `packages/security-audit-sdk-core/tests/verification/disposable-git.mjs`
