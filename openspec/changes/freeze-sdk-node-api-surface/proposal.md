## Why

#109's vertical-slice evidence now passes, which per PLAN-047/PLAN-064/PLAN-066 is the gate for freezing the Node platform binding's public API — `compatibility.json` already pre-declared this exact issue (`freezeOwnership: "governed-issue-111-after-109"`) as the mechanism that would flip `apiFrozen` to `true`. #111 asks for that freeze: an explicit, versioned export list, a mechanical check that fails on any unapproved mutation, confirmation that the surface reuses core semantic types rather than duplicating them, and a record naming the passing evidence this freeze depends on. This mirrors #110's freeze of `security-audit-sdk-core`, done separately per #111's own out-of-scope line ("changing core API scope").

## What Changes

- `packages/security-audit-sdk-node/scripts/check-exports.mjs` (new file — this package has no prior export-surface check) enumerates and freezes the package's complete public surface: all 13 runtime value exports (from the built module) and all 24 type-only exports (parsed from `src/index.ts`, where types are marked inline with the `type` keyword inside mixed `export { ... }` blocks — a different syntactic style than sdk-core's separate `export type {...}` blocks). It fails closed on any addition, removal, or rename, and separately confirms no frozen name collides with `@bloodtrail/security-audit-sdk-core`'s own frozen surface (proving reuse, not duplication).
- `packages/security-audit-sdk-node/package.json` gains a `test:exports` script, wired into `validate`.
- `packages/security-audit-sdk-node/adr/001-frozen-public-api-surface.md` (new file — this package has no prior ADR directory) records the freeze decision and the exact evidence commit.
- `packages/security-audit-sdk-node/compatibility.json` flips `apiFrozen: false` → `true`, `apiStability: "provisional"` → `"frozen"`, `package.status` → `"frozen-not-published"`, and adds a `freezeRecord` naming the issue, ADR, evidence commit/path, and frozen export counts.
- `openspec/specs/security-audit-sdk-node/spec.md` gains a new requirement, "The public export surface is frozen after vertical-slice evidence" (added, not modifying any existing requirement — this package has no founding-requirement immutability mechanism like sdk-core's `check-coherence.mjs`, but the same clean pattern is used for consistency and because the freeze is genuinely a distinct concern from the package's existing requirements).

## Capabilities

### New Capabilities
- `security-audit-sdk-node` (new requirement within the existing capability): "The public export surface is frozen after vertical-slice evidence" — the package's complete public surface is frozen, referencing the exact evidence commit, and mechanically checked, with no name collision against the core's frozen surface.

### Modified Capabilities
- `security-audit-sdk-node`: "Package boundaries enforce standalone topology and zero third-party dependencies" — discovered during fold review: the existing requirement hardcoded the API surface as "explicitly provisional, unfrozen," which this change makes false. The requirement and its provisional/unfrozen scenario are corrected to instead require that the declared stability state (provisional or frozen) match whatever the new frozen-surface requirement's conditions actually are, rather than asserting a fixed state. The other two scenarios (dependency inspection, packed-install) are unchanged.

## Impact

- `packages/security-audit-sdk-node/scripts/check-exports.mjs`: new file.
- `packages/security-audit-sdk-node/package.json`: one new script, wired into `validate`.
- `packages/security-audit-sdk-node/adr/001-frozen-public-api-surface.md`: new file (and new `adr/` directory).
- `packages/security-audit-sdk-node/compatibility.json`: freeze fields flipped, per its own pre-declared `freezeOwnership`.
- `openspec/specs/security-audit-sdk-node/spec.md`: one new requirement added; one existing requirement corrected (see Modified Capabilities above).
- No behavior change to any exported symbol — this freezes what already exists and ships today; it adds no new export and removes none.
- Out of scope (per #111 itself): freezing browser or React Native adapter APIs (deferred, tier 10, not authorized), publishing the Node SDK, changing core API scope (#110, already done separately).
