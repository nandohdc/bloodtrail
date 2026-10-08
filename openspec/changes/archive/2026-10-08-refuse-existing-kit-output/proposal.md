## Why

A distributable evaluation-kit build currently accepts an existing destination.
Foreign regular files at that destination are sealed into `checksums.sha256`
and shipped in the archive. If sealing later finds a non-regular file, cleanup
can delete the existing destination and its foreign files. A distributable
archive beside the destination is also silently overwritten, even though its
digest may already be published and archive digests differ between rebuilds.

#760 corrects these three reproduced output-ownership hazards without changing
the evaluation-kit requirements.

## What Changes

- Refuse every existing requested kit destination before the builder creates
  anything, including an empty directory, a file, and a symlink.
- Refuse an existing distributable archive before creating its kit destination.
- Prove both refusals through the distributable clone gate and two measured
  planted-defect controls, while documenting the kit-destination term.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This bounded correction enforces the existing tracked-sources
requirement without changing requirement text, so the change opts out of spec
deltas.

## Impact

- `packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-clone-controls.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-controls.mjs`
- `packages/security-audit-sdk-node/CONTEXT.md`
- `CONTEXT-MAP.md`
