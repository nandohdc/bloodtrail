# ADR-NODE-001: Frozen public API surface after vertical-slice evidence

- Status: Accepted for SDK-node implementation
- Date: 2026-09-08

## Decision

The public export surface of `src/index.ts` is frozen at exactly 13 value exports and 24 type-only exports, enumerated in `scripts/check-exports.mjs`. This freeze follows the first passing producer-to-collector vertical-slice evidence recorded in `openspec/changes/archive/2026-09-08-verify-delivery-vertical-slice/harness/evidence.md` (`main` at `2833852489e162954bdd495a4c466cbdc75fee84`), per the plan obligations that gated this decision (PLAN-047, PLAN-064, PLAN-066), and mirrors the same freeze already applied to `@bloodtrail/security-audit-sdk-core` (ADR-SDK-012). `compatibility.json`'s `apiFrozen`/`freezeOwnership` fields, which pre-declared this issue as the freeze's owner, are updated to `true` and this ADR's reference in the same change.

`scripts/check-exports.mjs` (`npm run test:exports`) enumerates the built module's runtime value exports and the source's declared exports (value and type-only, the latter marked inline with the `type` keyword within mixed `export { ... }` blocks — a different syntactic style than sdk-core's separate `export type {...}` blocks), and fails closed on any addition, removal, or rename in either set. It additionally confirms the frozen surface introduces no name that collides with `@bloodtrail/security-audit-sdk-core`'s own frozen surface, satisfying #111's acceptance criterion that the Node surface reuse core semantic types rather than duplicate them: this package's exports are exclusively new, Node-specific concerns (HTTP delivery handoff, bounded retry, bounded backpressure, deadline-bounded shutdown, and the Node platform-provider implementations) built *on* the core's types, not restatements of them.

Adding, removing, or renaming any export is a public API change: the frozen lists in `check-exports.mjs` must be updated in the same governed change that makes the change, through this repository's ordinary OpenSpec/design-pattern-governance process.

## Alternatives

Freezing only the value exports (as sdk-core's original 3-symbol smoke check did before its own freeze) was considered and rejected: type-only exports are the majority of this package's surface (24 of 37 total names) and are exactly as capable of an unreviewed breaking change (a renamed or removed options/result type) as a value export is.

Deferring this freeze until the browser or React Native adapters exist, so all Node-family surfaces could be frozen together, was considered and rejected: #111 explicitly scopes this freeze to the Node package alone, and #109's evidence is Node-specific (it exercises this exact package), so there is no reason to wait on unrelated, unbuilt adapters.

## Boundary

This ADR freezes only `@bloodtrail/security-audit-sdk-node`'s public export surface. It does not freeze browser or React Native adapter APIs (deferred, tier 10, not authorized), publish this package, or authorize production deployment.
