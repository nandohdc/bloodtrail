## Context

See `proposal.md` for motivation and the delta specification for the normative behavior. Repository evidence establishes that `context.ts` uses a module-private `WeakMap`; its brand functions and membership checks take no SDK instance, so same-copy cross-instance acceptance is current behavior. The owner selected option C on 2026-08-23. The SDK ADR inventory contains exactly ADR-SDK-001 through ADR-SDK-011, and `docs/adr/` is the existing repository decision-record location with ADRs 0001 through 0008.

The canonical audit contract is frozen and unaffected. The SDK remains an isolated technical candidate: this change records authority and verification constraints only and does not authorize production integrations.

## Goals / Non-Goals

**Goals:**

- Make option C's authority boundary and falsifiable consumer-graph invariant normative without changing current brand ownership.
- Preserve a complete decision record by extending ADR-SDK-004 and using root ADR 0010 for the A/B/C comparison and revisit trigger.
- Give #86 exact proof obligations for Core uniqueness and the first-party-only runtime-dependency allowance.
- Keep #79 intact while identifying its future diagnostic ownership.

**Non-Goals:**

- Implement #78, alter `context.ts`, relocate the registry, bind brands to SDK instances, or create a global singleton.
- Implement #79's diagnostic, rewrite any GitHub issue body, or claim that duplicate installations cannot occur.
- Create or authorize a Core package, Node binding, transport, exporter, collector, queue, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, release, or real-user processing.
- Modify the canonical contract or generated artifacts.

## Decisions

### D1 — Option C is the settled model

Brands are scoped to a `context.ts` module copy. Same-copy cross-instance acceptance remains because the registry has no instance input. A consumer graph supported after the Core split must resolve Core exactly once; the Node binding depends on and re-exports Core so it does not duplicate `context.ts`.

Option A (formalize module-copy scope without the Core uniqueness invariant) is rejected because it leaves the Core split's duplication hazard unspecified. Option B (instance scope) is rejected because it changes current behavior and requires an API-breaking redesign of 35 exported brand constructors. The decision is recorded, not re-litigated.

### D2 — Registry insertion remains module-private and global state is rejected

Only constructors within the `context.ts` module copy may insert an entry in its private registry. Casts and plain objects remain structurally unable to enter it. A `globalThis` registry is explicitly rejected: arbitrary process code could reach and mutate it, weakening the constructor-only insertion boundary.

The rejected alternative is a process singleton. It would make ambient process reachability, rather than the module-private constructor boundary, the authority mechanism.

### D3 — Cross-copy behavior is fail-closed; #79 owns its distinct diagnostic

A value from a different module copy is foreign and must never be accepted. This ratification does not change today's safe rejection behavior. #79 retains ownership of the distinct bounded duplicate-Core diagnostic and its remediation wording; no #79 body rewrite is permitted.

The rejected alternative is accepting or auto-sharing foreign brands to improve composition. It would weaken forge resistance and conceal a supported-graph invariant violation.

### D4 — #86 owns executable split proof and narrow dependency allowance

The future #86 implementation must prove both arms of the Core-resolution control: an intentionally duplicated Core fails closed with bounded deduplication remediation, while the same fixture with exactly one Core instance passes. It must also update `check-dependencies.mjs` and `check-coherence.mjs`'s `lock-runtime-dependencies` rule together so an exact first-party Core runtime dependency may be allowlisted and every third-party runtime dependency remains rejected.

The rejected alternative is changing an empty-dependency assertion into a general permission for runtime dependencies. That would weaken the existing supply-chain and scope boundary without proving the exception is limited.

### D5 — Decision records use existing ADR locations and preserve numbering

ADR-SDK-004 is the existing authority-context decision record and must be extended rather than creating ADR-SDK-012. `docs/adr/` is the established repository-wide ADR location; root ADR 0010 is therefore the correct non-SDK record and must preserve the A/B/C table, F3's 35-constructor sizing, F4's single-copy-Core reasoning, global-singleton rejection, and the exact revisit condition.

The rejected alternative is a new SDK ADR. It violates the 11-ADR inventory constraint and separates the selected scope from the ADR that already defines authority context.

## Migration Plan

1. Land the proposal, full assessment, delta, design, and all-unchecked tasks as a proposal-only commit.
2. After the required exact-commit owner authorization, update ADR-SDK-004 and root ADR 0010, and add only the documentation/specification/task material authorized by that later phase; do not implement #78 or #79.
3. Fold the capability delta into `openspec/specs/security-audit-sdk-core/spec.md` in a separate active-change canonical-fold commit, prove a second semantic application is a no-op, then obtain the later exact-commit governance record required for merge.
4. After identity-preserving merge and all required approval evidence, archive in a separate pure-relocation commit.

Before merge, rollback is removal of the unmerged proposal/documentation candidate. After the delta is folded, a different scope model requires a new governed change; it must not be introduced as an ADR-only exception.

## Risks / Trade-offs

- [A supported graph cannot deduplicate Core] → Treat the result as the exact revisit trigger; reopen the choice between A-with-a-mechanism and B rather than adding a local workaround.
- [The first-party dependency exception broadens silently] → Require an exact allowlist and third-party mutation failures from both named controls.
- [A fixture only proves failure] → Require the identical non-duplicate null control to pass.
- [Duplicate-copy rejection is called an attack] → Preserve #79's separate diagnostic ownership and align later #79/#86 wording.
- [ADR duplication or numbering drift] → Inventory ADR locations and numbers before edits; extend ADR-SDK-004 and allocate only root ADR 0010.
- [Prose is mistaken for implementation approval] → Keep implementation, owner approval, merge, and archive tasks unchecked and state their exact-commit gates.

## Open Questions

None. The owner-selected model, diagnostic ownership, and revisit condition are settled; package topology and implementation mechanics remain #86 work within the stated invariants.
