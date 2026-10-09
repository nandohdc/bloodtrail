## Why

During #766 triage, #769 found that a kit built without its npm core pin can
install successfully and pass the runtime one-copy probe. The Node binding's
packed `file:../security-audit-sdk-core` dependency links to the top-level
core under npm, so one copy loads even when the kit consumer manifest has no
`overrides`. Only `npm ls --all` reports that dependency invalid.

#769 therefore needs the kit gate to require a valid npm dependency tree
immediately after its own npm installation. The existing own-service npm
installation already makes this assertion, but the kit installation does not.

## What Changes

- Extract the existing own-service `npm ls --all` assertion into one shared
  installer helper without changing its failure message.
- Add the stable `npm-dependency-tree` kit-gate check after `npm-installation`
  and use the shared helper for the kit installation.
- Add a planted-defect control that removes the kit's core override and proves
  the new check alone detects the invalid npm dependency tree.
- Record the check identity and clause in the kit-gate control bookkeeping.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This bounded correction enforces the existing kit-contents clause that
the generated consumer manifest pins the core through npm overrides. It makes
no requirement changes and opts out of spec deltas.

## Impact

- `packages/security-audit-sdk-node/scripts/evaluation-kit-installers.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-installer-controls.mjs`
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-controls.mjs`
