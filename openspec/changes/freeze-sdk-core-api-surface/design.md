## Context

`packages/security-audit-sdk-core/src/index.ts` is the package's sole entry point, re-exporting from `context.ts`, `sdk.ts`, `config.ts`, `operations.ts`, `errors.ts`, `providers.ts`, `sink.ts`, `validation/index.ts`, and the generated `generated/contract.generated.js`. An existing script, `scripts/check-exports.mjs` (wired as `test:exports` in the `validate` chain), already checks the package's export-map subpaths and three hardcoded runtime symbols (`createSecurityAuditSdk`, `validateSecurityAuditEvent`, `CONTRACT_VERSION`) — a smoke check covering roughly 2% of the actual surface, not a freeze. See proposal.md for why #109's evidence makes freezing the rest appropriate now.

## Goals / Non-Goals

**Goals:**
- Freeze the package's *complete* public surface (61 value exports, 92 type-only exports, enumerated from the actual built module and source respectively) as of this change, changing no exported symbol's existence or shape.
- Make the freeze mechanically enforced, reusing the existing `test:exports` script and `validate` wiring rather than adding a new CI job or npm script.
- Confirm, mechanically, that the frozen surface contains no Node-specific symbol.

**Non-Goals:**
- Not freezing `security-audit-sdk-node`'s surface (#111).
- Not changing any exported symbol's name, shape, or behavior.
- Not publishing a package or authorizing production use — this ADR states that explicitly, matching every other ADR in this package.

## Decisions

**Extend `check-exports.mjs` in place, as two literal frozen arrays, rather than a separate snapshot file or a new script.** This package's existing coherence and compatibility checks (`check-coherence.mjs`, `check-compatibility.mjs`) already pin literal constants directly in script source; a second artifact format (e.g., a JSON snapshot) would duplicate that established pattern without a concrete benefit, and keeps the frozen list and the enforcement logic reviewable in one file/diff.

**Freeze every export uniformly, including generated per-event types.** The generated `*EventInput` type aliases (and related catalog-derived types) scale with `EVENT_METHODS`/`EVENT_CATALOG`'s size, which `test:coherence` already pins by count. Freezing their exact *names* here too is not redundant with that: `test:coherence` catches a count change, but this freeze additionally catches a *rename* of an existing generated type with the count held constant, and requires the same explicit acknowledgment (updating this list) for either kind of change — consistent with the acceptance criterion that any public-surface change needs the approved governance process, generated or not.

**Verify value exports by importing the built module; verify type-only exports by parsing `src/index.ts`'s `export type {...}` blocks.** Type-only exports do not exist at runtime, so there is no way to enumerate them by importing the compiled output; parsing the source's own export statements is the only way to check them without invoking the full TypeScript compiler API for what is, structurally, a handful of regular re-export statements.

**Denylist a Node-name prefix, rather than an allowlist of "safe" prefixes.** The platform-neutrality boundary this freeze must prove is "no Node-specific symbol here," which a denylist states directly; an allowlist of acceptable name shapes would need to anticipate every non-Node-specific naming convention this package might use in the future and would drift.

## Risks / Trade-offs

- **[Risk]** A legitimate future addition to the core (a genuinely new, non-Node-specific capability) now requires a governed change to update the frozen list, adding friction to what might otherwise be a routine addition. → **Mitigation:** this is the explicit intent of "frozen" per #110's acceptance criteria — friction here is the point, and the update is a one-line addition to an explicit array, not a redesign.
- **[Risk]** Parsing `export type {...}` blocks with a regular expression rather than the TypeScript compiler is less robust to an unusual future syntax (e.g., a re-export with an `as` rename). → **Mitigation:** every current export in `src/index.ts` uses the plain `{ name, name }` form; a future rename-on-export would need this parser extended, which is a visible, reviewable change to the check itself, not a silent gap.

## Open Questions

None — #110's acceptance criteria and the repository's existing coherence/compatibility check conventions fully determine this design.
