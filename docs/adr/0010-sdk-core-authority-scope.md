# ADR 0010: SDK-core authority scope is bounded module-copy scope with a single-copy Core

- Status: Accepted
- Date: 2026-08-23
- Decision owners: Project owner

## Context

Issue #77 required the project owner to choose exactly one authority scope model with explicit invariants for forge resistance, duplicate behavior, cross-instance/cross-copy semantics and errors, and migration/split implications. The owner selected **option C — bounded module-copy scope with a single-copy Core** on 2026-08-23 (decision comment on issue #77). This ADR is the repository-wide record of the options analysis, the measurements that decided it, and the revisit condition. The operative authority invariants live in the extended ADR-SDK-004, and the same authority terms become a normative `security-audit-sdk-core` capability requirement through OpenSpec change `ratify-sdk-core-authority-scope`.

The authority registry is a module-level `WeakMap` in `src/context.ts`. `brand()` writes to it and `isBranded()` reads it; neither takes an SDK instance, and `SecurityAuditSdk` never touches the registry. The unit of authority is the module copy and nothing else. Two installed copies of the package each get their own registry, so a value branded by one copy is unbranded from the other copy's perspective and is rejected. Today that rejection is safe but reports a legitimate dependency-tree condition as `AUTHORITY_ESCALATION`; the distinct bounded duplicate-Core diagnostic is owned by #79 and remains in scope unchanged by this decision.

## Decision

Adopt option C. The three options, as measured and decided:

| | **A. Formalize module-copy** | **B. Instance scope** | **C. Module-copy + single-copy Core** (**adopted**) |
| --- | --- | --- | --- |
| Public API change | none | **35 exported constructors** (F3) | none |
| Behaviour change from today | none | two instances in one copy stop sharing brands | none |
| Effect on #86 Core split | needs a designed cross-package brand mechanism | clean — brand belongs to the instance | clean — one resolved `context.ts`, so no cross-copy value exists (F4) |
| Duplicate-installation UX | needs #79's diagnostic | duplicates become a non-event | needs #79's diagnostic |
| Forge resistance | unchanged | must be re-proved for the new ownership | unchanged |
| New obligation | scope an unscoped mechanism | a major-version break | prove Core is single-copy; rescope the zero-dependency gate (F4) |
| Process singleton | rejected (F5) | rejected (F5) | rejected (F5) |

The full measurement record is the issue #77 decision comment; the load-bearing findings are:

**F3 — instance scope is a breaking change to the public authority API, not a registry relocation.** `context.ts` exports **35 `export function` constructors** (`authoritativeActor`, `claimedTenant`, `sessionEvidence`, `authoritativeTenant`, `credentialReference`, and thirty more), re-exported from `index.ts` as public API. They are free module functions: no SDK instance is in scope at the point a brand is minted. Instance scope is therefore not "the registry moves into the instance". It requires making every one of the 35 constructors instance-bound, factory-returned, or instance-parameterized — a breaking change across the entire authority surface, which `semverClassification.major` already classifies as public API removal. Option C obtains the same split safety structurally, without that break.

**F4 — the Core split forces a single-copy Core, not instance scope.** #86 moves the semantic core into its own package behind a `ContextProvider` SPI and adds a Node binding. The split produces two *packages*. It produces two module copies of `context.ts` only if the Node binding **duplicates** Core's context module. If the binding instead **depends on** Core and re-exports it, there is exactly one resolved copy of `context.ts` in the graph, one registry, and no cross-copy value ever exists. Module-copy scope survives the split untouched — no cross-package brand mechanism and no API break.

**F5 — a process singleton is explicitly rejected.** A `globalThis`-anchored registry is reachable and mutable by any code in the process. The authority model rests on "only the constructors in this file can insert entries"; a process singleton weakens that to "only code that can reach the global can insert entries", which is all code. It is rejected for every option so that it is not re-proposed.

**What option C commits to:**

- Brands are scoped to the module copy of `context.ts` that mints them — chosen, not accidental.
- Core resolves to exactly one module instance in any supported consumer graph. #86 owns proving it: a deliberately duplicated-Core fixture must fail closed with bounded deduplication remediation, and the otherwise identical non-duplicate null control must pass.
- A genuine duplicate installation remains a real, detectable category. #79 stays in scope as written and owns its distinct bounded duplicate-Core diagnostic; it is not rewritten.
- The zero-runtime-dependency gate is rescoped to "no third-party runtime dependencies" as part of #86. `check-dependencies.mjs` and `check-coherence.mjs`'s `lock-runtime-dependencies` rule are updated together; only an exact allowlisted first-party Core runtime dependency passes, and every third-party runtime dependency still fails.
- Forge resistance carries over unchanged: a cast or a hand-written plain object can claim the `Brand<...>` type but can never appear in the registry.
- Same-copy cross-instance acceptance is unchanged: two SDK instances resolving the same module copy accept each other's brands, because no brand is associated with an instance.

**Revisit condition.** If a supported consumer graph is found in which Core cannot be deduplicated, C's invariant fails and the choice reopens between A-with-a-mechanism and B. That is the exact falsification trigger. A future reader must treat it as such rather than introducing a local global, registry-sharing, or auto-hoisting workaround.

## Consequences

- The decision changes no runtime behavior, no public API, no generated artifacts, and no contract surface; the canonical Security Audit Event Contract remains frozen at version `1.0.0`.
- The SDK ADR inventory remains exactly ADR-SDK-001 through ADR-SDK-011: the operative invariants extend the existing authority ADR (ADR-SDK-004) instead of adding a twelfth SDK ADR.
- #78 becomes formalization plus #79's diagnostic, with no registry relocation. #86 carries the single-copy-Core fixture and null control, the dependency-gate rescoping, and the escalation trigger.
- The capability delta of change `ratify-sdk-core-authority-scope` makes the same authority terms normative for the `security-audit-sdk-core` capability; its canonical fold is a later, separately committed step.

## Alternatives considered

### A — Formalize module-copy scope without the Core uniqueness invariant

Rejected. A is C without the invariant. It leaves the Core split's duplication hazard unspecified: the split could silently reintroduce a second `context.ts` copy, recreating exactly the cross-copy condition the decision is meant to prevent.

### B — Instance scope

Rejected. Instance scope would make cross-instance values foreign even inside one module copy — a behavior change from today — and requires a breaking redesign of all 35 exported brand constructors (F3) without obtaining any split safety that C does not obtain structurally.

### Process singleton

Rejected. A `globalThis`-anchored registry is reachable and mutable by any process code, replacing the constructor-only insertion boundary with ambient process reachability, and it would accept cross-copy values by weakening authority provenance instead of proving Core resolution.

## Boundary

This ADR records a decision and proof obligations. It implements none of #78, #79, or #86, and it authorizes no production integration, transport, exporter, collector, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, publication, or real-user processing. AI analysis informed the options measurement; it is not review, approval, or assurance, and the decision is the project owner's.
