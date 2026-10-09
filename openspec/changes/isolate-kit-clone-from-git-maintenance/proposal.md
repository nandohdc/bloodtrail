## Why

The kit gate commits the tree under test in a disposable clone before removing
that clone. As reproduced for #734, that commit can start detached Git
auto-maintenance; its geometric repack can still write in the clone's `.git`
when the existing remover runs and fails with `ENOTEMPTY`. The same failure was
seen during the #709 run.

#734 corrects this disposable-clone hygiene defect without changing the
evaluation-kit requirements.

## What Changes

- Create every kit-tree clone with `maintenance.auto=false` and `gc.auto=0` in
  its local Git configuration before later clone commands run.
- Pass the same settings directly to the clone commit so ambient
  `GIT_CONFIG_*` values cannot re-enable maintenance for the command that can
  trigger it.
- Preserve the existing loud one-shot removal so a regression or another
  background writer remains observable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This bounded correction changes only disposable-clone Git hygiene, so
it opts out of spec deltas and makes no requirement changes.

## Impact

- `packages/security-audit-sdk-node/scripts/evaluation-kit-source-copy.mjs`
