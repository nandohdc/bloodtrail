## Why

A facilitator who builds an evaluation kit with `--dest` under a missing parent
gets a bare `realpath` `ENOENT`. The failure names neither the destination
problem nor the way to recover, even though the builder's later recursive
`mkdir` can create those parent directories.

The current guard checks only the destination parent. As a result,
`--dest <repository root>` passes, because the root's parent is outside the
repository, despite the requirement that the builder write the kit only
outside the repository tree. #757 needs both holes corrected without changing
the evaluation-kit requirements.

## What Changes

- Find the nearest existing destination path, prove it is outside the
  repository before writing, then let the existing recursive directory creation
  make missing destination parents.
- Refuse a destination in the repository, including the repository root,
  before creating any part of it, with a destination-specific diagnostic.
- Extend the distributable-clone gate and its planted-defect controls to prove
  missing-parent creation and inside-repository refusal fail closed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This bounded correction enforces existing evaluation-kit requirements
without changing requirement text, so the change opts out of spec deltas.

## Impact

- `packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs`
- `packages/security-audit-sdk-node/scripts/evaluation-kit-source-copy.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-clone-controls.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-controls.mjs`

#760 remains out of scope: a failed build still deletes a destination that
already existed. This correction leaves that behaviour unchanged, so that a
build whose destination parent already exists behaves exactly as before.
