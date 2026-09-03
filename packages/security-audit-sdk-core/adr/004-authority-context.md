# ADR-SDK-004: Authority and context propagation

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

Configured server-side authority providers mint immutable runtime-provenance values and opaque TypeScript-branded types. Request/client parsers produce claims only. Runtime checks enforce provenance/value combinations and tenant/resource conflicts even when TypeScript is bypassed. `AsyncLocalStorage` carries immutable explicit frames with field-specific inheritance and override rules; nested and concurrent scopes are tested.

The SDK cannot prove producer truthfulness. Documentation identifies configured authority providers as trust boundaries and forbids adapters from merely relabeling request data.

## Alternatives

A flat context object was rejected because it conflates claims with authority. Global mutable context was rejected because it leaks across asynchronous work.

## Scope selection (2026-08-23)

On 2026-08-23 the project owner selected **option C — bounded module-copy scope with a single-copy Core** (issue #77, recorded by OpenSpec change `ratify-sdk-core-authority-scope`). This section records the selected authority scope and its invariants. It changes no runtime behavior, no public API, and no registry ownership; it makes the existing scope explicit.

Brands are scoped to the `context.ts` module copy that mints them. `brandRegistry` is a module-level `WeakMap`; `brand()` writes to it and `isBranded()` reads it, and neither takes an SDK instance. `SecurityAuditSdk` holds only its configuration and never touches the registry. The unit of authority is therefore the module copy and nothing else — chosen, not accidental.

## Invariants

1. **Forge resistance.** A TypeScript cast, a structurally equivalent plain object, a copied object, or ambient process state cannot add a value to the registry. Registry insertion remains module-private: only the brand constructors within the resolved `context.ts` module copy may insert entries.

2. **Module-copy scope.** A value is recognized as authoritative only by the registry private to the `context.ts` module copy that minted it.

3. **Same-copy cross-instance acceptance.** Values branded through the same module copy remain acceptable across SDK instances; instance identity is not an authority discriminator. This is current behavior and does not change.

4. **Cross-copy fail-closed behavior.** A value branded by a different module copy is foreign and is never accepted as authority. Cross-copy values fail closed with `AUTHORITY_ESCALATION`, and no global registry, acceptance fallback, or auto-sharing mechanism may be introduced. The distinct bounded duplicate-Core diagnostic for the genuine duplicate-installation category is owned by issue #79, which stays in scope unchanged and is not rewritten.

5. **Single-copy Core.** Every supported consumer graph produced by the future Core split SHALL resolve Core to exactly one module instance. The Node binding SHALL depend on and re-export Core rather than duplicating `context.ts`. Issue #86 owns proving this with a deliberately duplicated-Core fixture that fails closed with bounded deduplication remediation and an otherwise identical non-duplicate null control that passes.

6. **Dependency allowance.** The zero-runtime-dependency gate is rescoped as part of #86 to "no third-party runtime dependencies": `check-dependencies.mjs` and `check-coherence.mjs`'s `lock-runtime-dependencies` rule SHALL be updated together, permitting only an exact allowlisted first-party Core runtime dependency, and every third-party runtime dependency SHALL still fail both controls.

7. **Global-singleton rejection.** A `globalThis`-anchored registry is explicitly rejected: any code in the process could reach and mutate it, weakening the constructor-only insertion boundary.

8. **Revisit condition.** If a supported consumer graph is found in which Core cannot be deduplicated, C's invariant fails and the choice reopens between A-with-a-mechanism and B. No local global, registry-sharing, or auto-hoisting workaround may be introduced instead.

## Amendment (2026-09-03) — duplicate-Core diagnostic (#79)

The decision above is unchanged. Issue #79's distinct bounded duplicate-Core diagnostic landed as `DUPLICATE_AUTHORITY`: a value branded by another installed copy — a sibling two-copy install or a genuine nested duplicate — now fails closed with `DUPLICATE_AUTHORITY` at every brand-miss rejection site, while forged, cast, and cloned values keep `AUTHORITY_ESCALATION`. The thrown diagnostic's canonical wording — "Core resolves to exactly one module instance in any supported consumer graph. A duplicate installed copy branded this value: deduplicate the @bloodtrail/security-audit-sdk-core dependency so a single copy resolves before continuing." — is the single coordinated #79/#86 wording for the single-copy invariant and the deduplication remediation. The distinction is diagnostic-only: a diagnostic-only sibling probe (append-only boolean predicates under `Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1")` on `globalThis`) observes which copy recognizes the value; the rejection itself is unchanged, and no global registry, brand sharing, or foreign-authority acceptance is introduced (invariant 7 stands). Issue #86's single-copy Core proof and dependency-gate rescoping remain #86's.

## Consequences

This ADR gains the scope selection without a twelfth SDK ADR: the SDK ADR inventory remains exactly ADR-SDK-001 through ADR-SDK-011. #78 becomes formalization plus #79's diagnostic, with no registry relocation. #86 carries the single-copy-Core fixture, the null control, and the dependency-gate rescoping obligations; none of that work is performed by this ADR. The frozen canonical contract, generated artifacts, package surface, and current runtime behavior are unchanged.

## Boundary

This ADR records decisions and proof obligations only. It implements none of #78, #79, or #86, and it authorizes no production integration, transport, exporter, collector, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, publication, or real-user processing.
