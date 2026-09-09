# ADR-SDK-012: Frozen public API surface after vertical-slice evidence

- Status: Accepted for SDK-core implementation
- Date: 2026-09-08

## Decision

The public export surface of `src/index.ts` is frozen at exactly 61 value exports and 92 type-only exports, enumerated in `scripts/check-exports.mjs`. This freeze follows the first passing producer-to-collector vertical-slice evidence recorded in `openspec/changes/archive/2026-09-08-verify-delivery-vertical-slice/harness/evidence.md` (`main` at `2833852489e162954bdd495a4c466cbdc75fee84`), per the plan obligations that gated this decision (PLAN-064, PLAN-066) — the extracted core's responsibilities are no longer provisional once real delivery evidence exists.

`scripts/check-exports.mjs` (`npm run test:exports`) enumerates the built module's runtime value exports and the source's declared type-only exports, and fails closed on any addition, removal, or rename in either set — mutation-tested against both an unapproved addition and a removal (see the corresponding OpenSpec change's task evidence). Adding, removing, or renaming any export is a public API change: the frozen lists in `check-exports.mjs` and this ADR's export count must be updated in the same governed change that makes the change, through this repository's ordinary OpenSpec/design-pattern-governance process. No exported symbol confirmed absent from this freeze — checked against the Node-prefix denylist in `check-exports.mjs` — is a Node-runtime-specific implementation; those live exclusively in `@bloodtrail/security-audit-sdk-node`.

Generated per-event types (the `*EventInput` aliases and related catalog-derived types) are included in the frozen type-export count like any other export: growing the event catalog changes the public surface and must update this freeze in the same change, in addition to the existing generation-drift and coherence checks that already gate the catalog's own size.

## Alternatives

A snapshot stored as a separate JSON file (rather than a literal array in `check-exports.mjs`) was considered and rejected: this package's existing coherence and compatibility checks (`check-coherence.mjs`, `check-compatibility.mjs`) already pin equivalent literal constants directly in script source, and a second artifact format would duplicate that pattern without a concrete benefit — a PR that changes the surface shows the frozen-list diff inline in the same file as the enforcement logic.

Deriving the frozen type-export list purely from `EVENT_METHODS`'s count (rather than naming every generated type) was considered and rejected: it would leave hand-authored, non-generated type exports (context, provider, and operation types) completely unchecked, which is the majority of this freeze's value.

## Boundary

This ADR freezes only `@bloodtrail/security-audit-sdk-core`'s public export surface. It does not freeze `@bloodtrail/security-audit-sdk-node`'s surface (#111, a separate issue and a separate ADR), authorize any behavior change, or authorize production deployment or publication.
