## Context

See `proposal.md` for motivation. The package already projects and validates contract `1.0.0` exactly: `compatibility.json` names one supported version and an equal minimum/maximum, generated types are an exact contract projection, and construction rejects unsupported versions before readiness. Those controls preserve the current binding, but the canonical capability does not yet establish exact-one support as the enduring policy and `MIGRATION.md` still reopens the cardinality decision for a future adaptation.

The contract remains frozen, the SDK remains a private unpublished isolated candidate, and collector implementation is outside the authorization boundary. Root ADRs are documentation-only; capability and package documentation paths are governed implementation even when runtime behavior does not change.

## Goals / Non-Goals

**Goals:**

- Establish one precise normative definition spanning the complete package compatibility surface.
- Distinguish many-to-one package support from exact-version producer-instance construction binding.
- Align canonical requirements, glossary, compatibility ADR, migration guidance, and decision rationale without runtime drift.
- Preserve the collector migration asymmetry as optional future intent subject to separate authorization.
- Keep proposal, documentation implementation, canonical fold, and archive as separate governed commits.

**Non-Goals:**

- Change runtime source, generated output, the frozen contract, compatibility values, package version, dependencies, or exports.
- Publish the package or authorize a release, collector, transport, storage, production integration, or real-user processing.
- Design `EXPLICIT_SET`, multi-version generated projections, version negotiation, or collector mechanics.
- Add a twelfth SDK ADR or modify the coherence pin of eleven SDK ADRs.

## Decisions

### D1 — Exact-one support covers one indivisible compatibility surface

One SDK package version has exactly one outgoing support edge to a canonical contract version. That edge governs the manifest, generated public types, generated validator projection, construction-time version check, and event-validation semantics together. It is many-to-one rather than bijective: several package versions may retain the same contract baseline.

The rejected alternative is manifest-only cardinality. It would allow generated or runtime semantics to drift from the declared version and would turn the policy into metadata rather than a compatibility guarantee.

### D2 — Instance binding is a construction invariant

A producer SDK instance can become ready only for the contract version supported by its package version. Unsupported versions fail closed before readiness. The wording deliberately excludes negotiation, coercion, downgrade, fallback, best-effort interpretation, and live version switching.

The rejected alternative is to describe instances as merely "accepting one version." That wording obscures when the invariant is established and can imply post-construction negotiation that the SDK neither provides nor authorizes.

### D3 — Ratify `EXACT_ONE`; do not implement `EXPLICIT_SET`

`EXACT_ONE` matches the existing exact projection and cardinality gates. `EXPLICIT_SET` would require multiple generated type/validator projections or a weaker union/discriminated public API, plus generator, compatibility, and runtime changes. Those costs are immediate while the private unpublished package receives no present migration benefit.

The choice may be reconsidered only when both a second canonical contract version and an authorized collector exist. Either condition alone is insufficient.

### D4 — Support-baseline replacement is SDK compatibility-major

An additive canonical contract minor remains contract-minor. Under `EXACT_ONE`, adapting the SDK replaces its sole supported-contract baseline and public contract-version literal, so existing callers bound to the prior literal are incompatible. That makes the SDK adaptation compatibility-major; generated type incompatibility remains an additional trigger when it actually occurs, not an assumption about every optional field.

This classification does not force `1.0.0`, authorize publication, or change the current `0.1.0` package version. During private unpublished `0.x` development, any separately authorized release would express the major classification through the existing `0.x` policy; the first published release inherits the classification, and from `1.0.0` onward a baseline replacement requires an SDK major.

### D5 — Capability owns the rule; ADRs explain it

The delta adds the normative rule to `security-audit-sdk-core`. ADR-SDK-009 will record the package compatibility consequences without adding ADR-SDK-012. Root ADR 0007 will preserve the `EXACT_ONE` versus `EXPLICIT_SET` analysis, rejected alternative, authorization boundaries, and conjunctive revisit condition. `CONTEXT.md` will define the two terms without implementation mechanics, and `MIGRATION.md` will apply rather than reopen the decision.

An ADR-only alternative was rejected because advisory rationale cannot close the canonical requirement gap and would leave migration guidance contradictory.

### D6 — Collector asymmetry is intent, not implementation authority

A separately authorized collector may support an explicitly enumerated finite version set for migration. That set never broadens producer package support or instance binding. No collector surface, transport, persistence, queueing, SIEM integration, analytics, or real-user processing is created or authorized by this change.

The rejected alternative is a collector `MUST` requirement. No collector exists or is authorized, so mandatory mechanism language would claim implementation scope the decision does not grant.

## Migration Plan

1. Land this proposal, Full assessment, capability delta, design, and unchecked task plan as the proposal commit.
2. In a separately authorized apply phase, update only `CONTEXT.md`, ADR-SDK-009, `MIGRATION.md`, root ADR 0007, and task state; run read-only verification before an explicit-allowlist implementation commit.
3. While the active change remains present, fold the added requirement into `openspec/specs/security-audit-sdk-core/spec.md` in a dedicated canonical-fold commit and prove a second semantic application is a no-op.
4. Treat the canonical-fold commit as the final normative technical commit and obtain one later signed governance record containing both technical review and the project-owner decision, bound to that exact commit and to a content object covering every reviewed normative path. Any later normative change makes that record stale.
5. Have the project owner merge the exact technical and signed-record commit identities into the protected mainline by an identity-preserving merge commit or fast-forward. Squash, rebase, amendment, force-push, and any intervening normative change are prohibited.
6. Re-verify dependent issue #76 against the ratified policy and complete issue evidence as authorized without creating an intervening repository commit.
7. Relocate the active change in a separate archive commit directly following the identity-preserving mainline merge, without repeating the canonical fold.

Before merge, rollback is removal of the unmerged proposal or documentation commit. After canonical folding, changing the policy requires a new governed capability change; reverting prose alone must not leave the canonical requirement and migration guidance inconsistent.

## Risks / Trade-offs

- ["Exactly one" is misread as bijective] → State explicitly that multiple SDK package versions may point to the same canonical contract version.
- [Collector `MAY` is mistaken for authorization] → Co-locate the allowance with explicit separate-authorization and no-implementation boundaries in the spec and ADRs.
- [Contract-minor and SDK-major are conflated] → Name the two SemVer axes and ground SDK-major in support-baseline/public-literal replacement.
- [Generated incompatibility is overstated] → Keep it as an additional trigger when present rather than the universal rationale.
- [Documentation drifts after a normative fold] → Verify all authored surfaces together and keep the delta active until the dedicated fold lands.
- [A verified candidate is mutated during governance work] → Run semantic verification before staging, freeze verified bytes, and use explicit allowlists for each separate commit.
