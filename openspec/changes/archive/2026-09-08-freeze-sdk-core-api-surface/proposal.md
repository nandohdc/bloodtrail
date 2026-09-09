## Why

#109's vertical-slice evidence now passes, which per PLAN-064/PLAN-066 is the gate for freezing the extracted platform-neutral core's public API. Until now the core's responsibilities remained provisional and nothing mechanically prevented an unreviewed addition, removal, or rename in its public export surface. #110 asks for that freeze: an explicit, versioned export list, a mechanical check that fails on any unapproved mutation, confirmation that no Node-specific symbol is present, and a record naming the passing evidence this freeze depends on.

## What Changes

- `packages/security-audit-sdk-core/scripts/check-exports.mjs` is extended from its existing 3-symbol smoke check to enumerate and freeze the package's **complete** public surface: all 61 runtime value exports (from the built module) and all 92 type-only exports (parsed from `src/index.ts`). It fails closed on any addition, removal, or rename in either set, and separately confirms no frozen name is Node-prefixed (the platform-neutrality boundary).
- `packages/security-audit-sdk-core/adr/012-frozen-public-api-surface.md` records the freeze decision, names the passing vertical-slice evidence and its exact commit, and states that any future public-surface change (including generated per-event types growing with the catalog) must update the frozen list in the same governed change.
- `openspec/specs/security-audit-sdk-core/spec.md` gains a new requirement, "The public export surface is frozen after vertical-slice evidence," stating the surface is frozen post-evidence and mechanically enforced, with three scenarios (explicit/versioned freeze referencing evidence, mutation detected and rejected, no Node-specific symbol present). This is a new requirement, not a change to the original "SDK package has an explicit supported runtime and public surface" requirement from the package's founding implementation — that requirement is governed by `check-coherence.mjs`'s `original-capability-*` rules, which require its body and scenarios to remain byte-identical to the archived original; this change leaves it untouched and adds the freeze as its own requirement instead.

## Capabilities

### New Capabilities
- `security-audit-sdk-core` (new requirement within the existing capability): "The public export surface is frozen after vertical-slice evidence" — the package's complete public surface is frozen, referencing the exact evidence commit, and mechanically checked.

### Modified Capabilities
(none — the original founding requirement is left byte-identical; see Why above)

## Impact

- `packages/security-audit-sdk-core/scripts/check-exports.mjs`: extended, still wired into the existing `test:exports` script and `validate` chain — no new npm script, no new CI job.
- `packages/security-audit-sdk-core/adr/012-frozen-public-api-surface.md`: new file.
- `openspec/specs/security-audit-sdk-core/spec.md`: one new requirement added; the original founding requirement is unchanged.
- No behavior change to any exported symbol — this freezes what already exists and ships today; it adds no new export and removes none.
- Out of scope (per #110 itself): freezing `security-audit-sdk-node`'s surface (#111, a separate issue), adding new behavior, publishing a package.
