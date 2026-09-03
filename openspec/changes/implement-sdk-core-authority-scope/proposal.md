A TypeScript cast or a hand-written plain object can claim the `Brand<...>` type but can never appear in the registry, because only the constructors in this file can insert entries. That sentence is the load-bearing invariant of the SDK-core authority model, and this change turns it from an implementation accident into a chosen, regression-guarded, compatibility-classified scope.

## Why

The project owner selected **option C — bounded module-copy scope with a single-copy Core** on 2026-08-23 (issue #77, recorded in `docs/adr/0010-sdk-core-authority-scope.md` and ADR-SDK-004). The canonical `security-audit-sdk-core` capability spec already carries the ratified authority requirement from change `ratify-sdk-core-authority-scope`. What remains for issue #78 is **formalization**: state module-copy scope as a *chosen* invariant rather than an accident, regression-guard it with a mutation-sensitive test matrix, pin the insertion surface by enumeration, and classify the compatibility impact — without changing any runtime behavior, any public API, or any registry ownership.

## What Changes

- Name the module-copy scope in `src/context.ts` comments as a chosen invariant: the registry stays a module-level `WeakMap`, only the exported brand constructors in that file insert entries, and `structuredClone` cannot carry a brand (identity-keyed WeakMap). Comment-only — no runtime change, no registry relocation, no public API change.
- Add a nine-arm authority-scope regression matrix (`same`, `foreign`, `forged`, `cloned`, `copy`, `nested`, `concurrent`, `cleanup`, `null`) to the SDK verification suite, each arm with a null control and demonstrable mutation sensitivity so a green arm can never hide drift.
- Add the insertion-surface enumeration control asserting **both** counts: 35 exported brand constructors and 19 `AuditBrandKind` members, derived from `src/context.ts` itself so a forgotten constructor or kind fails loudly.
- Add a genuine two-copy fixture for the `copy` arm: two independently installed copies of the package in an isolated `mkdtemp` fixture built by the test-local `copyPackageStable` helper, never one module imported twice.
- Classify the chosen scope in `compatibility.json` against `semverClassification`: no public API change, no runtime behavior change, no new error code, while recording the decision and the future obligations.
- Preserve the bounded `AUTHORITY_ESCALATION` shape (code, category, bounded path only — never caller data). No duplicate-Core diagnostic is added here.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Add observable requirements for the authority-scope formalization — the mutation-sensitive regression matrix, the 35/19 insertion-surface enumeration, the genuine two-copy fixture, and the compatibility classification of the chosen scope. The ratified authority requirement (registry membership, same-copy acceptance, cross-copy fail-closed behavior, single-copy Core) is already canonical and is not duplicated.

## Impact

This is a full-assessment, material modification of the `security-audit-sdk-core` capability triggered by `security_sensitive_behavior` and `public_api` (the 35 exported brand constructors are public API). The proposal itself is specification and planning work; the apply phase touches only `src/context.ts` comments, SDK verification tests, and `compatibility.json`.

The single-copy Core obligation is **#86's**: this change states and points to it, but #86 owns the duplicated-Core fixture, the null control, and the dependency-gate rescoping. The distinct duplicate-Core diagnostic is **#79's**: it stays in scope unchanged, is not rewritten by this change, and is not implemented here. The frozen canonical contract, generated artifacts, package surface, and current runtime behavior are unchanged. Nothing in this change authorizes a global fallback, ambient authority, delivery, browser, or collector work, or any production integration.
