## Context

`packages/security-audit-sdk-node/src/index.ts` is the package's sole entry point, re-exporting from `clock.ts`, `identifiers.ts`, `byte-length.ts`, `timers.ts`, `context.ts`, `schema.ts`, `http-handoff.ts`, `delivery-retry.ts`, `delivery-backpressure.ts`, `delivery-shutdown.ts`, and `platform.ts`. Unlike `security-audit-sdk-core`, this package has no existing export-surface check, no `adr/` directory, and no `check-coherence.mjs`-style founding-requirement immutability mechanism — its `validate` chain is `typecheck && build && test:runtime && test:scope && test:dependencies && test:package`, all lighter-weight than sdk-core's. `compatibility.json` already pre-declares this freeze's ownership (`freezeOwnership: "governed-issue-111-after-109"`). See proposal.md for why #109's evidence makes freezing appropriate now, and #110 (already archived) for the sibling freeze this mirrors.

## Goals / Non-Goals

**Goals:**
- Freeze the package's *complete* public surface (13 value exports, 24 type-only exports, enumerated from the actual built module and source respectively) as of this change, changing no exported symbol's existence or shape.
- Prove the surface reuses `security-audit-sdk-core`'s semantic types rather than duplicating them, mechanically (no name collision), not merely by inspection.
- Flip `compatibility.json`'s pre-declared freeze fields to reflect the completed freeze.

**Non-Goals:**
- Not freezing browser or React Native adapter APIs (deferred, tier 10, not authorized).
- Not changing any exported symbol's name, shape, or behavior.
- Not re-freezing or touching `security-audit-sdk-core`'s own surface (#110, already done).
- Not publishing a package or authorizing production use.

## Decisions

**New `check-exports.mjs`, not an extension of an existing script.** Unlike sdk-core, this package has no prior export check to extend — the new script is written from scratch, following the same two-frozen-array pattern (for consistency and because it is already proven to work and to have caught real mutations in #110's implementation).

**Parse mixed `export { value, type X }` blocks, not separate `export type {...}` blocks.** This package's source style differs from sdk-core's: types are marked inline with the `type` keyword within the same `export { ... }` statement as value exports (e.g. `export { createHttpDeliveryHandoff, type HttpDeliveryHandoffResult, ... } from "./http-handoff.js"`), rather than in a dedicated `export type {...}` block. The parser must split each block's comma-separated items and classify by the presence of a leading `type ` token, not by which kind of `export` statement contains it.

**Verify "reuses core types, not duplicates them" as a mechanical collision check**, not by manual inspection. `check-exports.mjs` holds a copy of sdk-core's frozen export names (both value and type-only) and asserts no overlap with this package's own frozen names. This was verified by direct comparison before writing the check (zero collisions today), and the check makes that a standing, enforced invariant rather than a one-time observation.

**Add the freeze as a new requirement, not a modification of an existing one — for consistency with #110's corrected pattern, even though this package has no enforcement mechanism that would catch a modification.** #110's fold PR discovered, the hard way, that sdk-core's founding requirements are protected; sdk-node has no equivalent `check-coherence.mjs` today, so nothing would currently catch a modification here. Adding a new requirement anyway keeps the two packages' specs structurally consistent and doesn't foreclose sdk-node gaining an equivalent protection later.

## Risks / Trade-offs

- **[Risk]** A future rename-on-export (`export { x as y }`) would not be classified correctly by the block-splitting parser. → **Mitigation:** no current export in either package uses this form; a future one would need the parser extended, which is a visible, reviewable change to the check itself, matching the same accepted trade-off ADR-SDK-012 already made for sdk-core's parser.
- **[Risk]** `compatibility.json`'s new `freezeRecord` object has no schema validation anywhere in this package (confirmed: `check-package-contents.mjs` only checks the file's existence, not its shape). → **Mitigation:** acceptable — the same is true of every other field already in this file (`apiFrozen`, `spiImplementations`, etc.); this is a documentation/record field, not an enforcement mechanism, and the enforcement is `check-exports.mjs` itself.

## Open Questions

None — #111's acceptance criteria and #110's already-corrected pattern fully determine this design.
