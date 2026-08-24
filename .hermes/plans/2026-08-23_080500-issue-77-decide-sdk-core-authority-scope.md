# Issue #77 — Decide sdk-core Authority Scope — Decision Packet

> **For Hermes:** **DECIDED 2026-08-23 — bounded module-copy scope with a single-copy Core (option C).**
> This packet was revised on 2026-08-23 after the Task 0.4 measurement was resolved by inspection. The
> revision matters: the earlier version recommended **instance scope** and described it as "the registry
> moves into the instance". That understated it by an order of magnitude — the brand constructors are
> **35 exported functions of the public API** (F3), so instance scope is a breaking change to the entire
> authority surface, not an internal refactor. The revision also names a third option the original packet
> missed, which resolves #86's forcing function without any API break (F4). Your job now is Task 2:
> record the decision. **Do not implement #78.**

**Goal:** One recorded scope model with explicit invariants for forge resistance, duplicate-copy
behaviour, cross-instance and cross-copy semantics and errors, and migration/split implications.

**Status at this baseline:** **DECIDED** — option C, bounded module-copy scope with a single-copy Core,
adopted by the owner on 2026-08-23. Task 0 is complete; Task 1 is superseded; Task 2 is the open work.

**Blast radius if unanswered:** #78, #79 directly; #83 and #86 declare #78 as a dependency; #87 depends on
#86; #88 depends on #86 and #87. **Six issues.**

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #77, OPEN, labels `enhancement` `question` `security-audit-sdk` `openspec-change-needed` `area:core` `ready-for-human` |
| Native GitHub blockers | `blocked_by` is `0`; declared dependency #66 CLOSED |
| Mechanism | `packages/security-audit-sdk-core/src/context.ts:41` — `const brandRegistry = new WeakMap<object, AuditBrandKind>();` |
| Brand kinds | 19, from `authoritative_actor` to `registered_extension` |
| Why a WeakMap and not symbols | the file's own comment: `structuredClone` silently drops non-enumerable symbols, which is why the earlier approach was abandoned |
| Rejection sites | `context.ts:363` (`failure("AUTHORITY_ESCALATION", "authority", …)`) and `:407` (`throw new SecurityAuditSdkError(...)`) |
| Governing ADR | `adr/004-authority-context.md` — documents the model, **does not select a scope** |
| Related closed work | S-1 withdrawal: `provenance.trust_level` is pinned by the generated schema to `downstream_enrichment`, so trust escalation is structurally rejected |
| Diagnostic gap | #79 — a duplicate installation reports `AUTHORITY_ESCALATION`, indistinguishable from an attack |
| Registry read site | `context.ts:400-402` — `isBranded(value, ...kinds)` reads `brandRegistry.get(value)`; **takes no instance** |
| Instance state | `SecurityAuditSdk` holds only `#config` (`sdk.ts:54`); it never reads or writes the registry |
| Public brand constructors | **35 `export function` in `context.ts`**, re-exported from `index.ts` (`authoritativeActor`, `claimedTenant`, `sessionEvidence`, …) |
| ADR sequence | pinned at exactly 11 (`check-coherence.mjs:190-191`) |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Today's scope is a consequence of the mechanism, not a decision

`brandRegistry` is a module-level `WeakMap`. Its lifetime and identity are the **module copy's**. Two
installed copies of the package each get their own registry, so a value branded by copy A is unbranded
from copy B's perspective and is rejected at `:363`/`:407`. Nobody chose module-copy scope; it fell out of
"put the registry in a module".

The sharper statement, which the issue body and the 2026-08-16 brief both get wrong: brands are not
"bound to an instance" in any sense today. `brand()` writes to the module map and `isBranded()` reads it;
**neither takes an instance**, and `SecurityAuditSdk` never touches the registry. The unit of authority is
the module copy and nothing else. The brief's phrase "a value branded by another instance of the package"
conflates instance with copy and should not be reused.

### F2 — The failure is safe, and that is exactly why it has survived

A cross-copy value is rejected, not accepted. There is no security hole here. What there *is* is a
**diagnostic** problem (#79) and an **ergonomics** problem: legitimate composition across two copies —
which is what a dependency tree produces routinely — is reported as an attack. #77's own summary says so.

### F3 — Instance scope is a breaking change to the public authority API, not a registry relocation

Binding brands to one SDK instance means cross-*instance* values are foreign even inside one module copy.
That is a behaviour change from today: two SDK instances in one process currently share a registry and
therefore accept each other's brands.

**The cost of that change was understated in the original packet.** The brand constructors are not
internal helpers whose backing map can be moved. `context.ts` exports **35 `export function`
constructors** — `authoritativeActor`, `claimedTenant`, `sessionEvidence`, `authoritativeTenant`,
`credentialReference`, and thirty more — and `index.ts` re-exports them as public API. They are free
module functions. There is no instance in scope at the point a brand is minted.

Instance scope therefore requires one of:

- making every one of the 35 a method on the SDK instance, or
- returning them from a per-instance factory, or
- adding an instance parameter to each.

All three are breaking changes across the whole authority surface, and `semverClassification.major`
already lists "public API removal". Whether the sharing is desirable is a real question; it is not worth
a break of that size when option C reaches the same architectural goal for free.

Arguments that remain valid either way:

- **For instance scope:** an SDK instance is the configured trust boundary — it holds the authority
  providers. Two instances may be configured with different authority sources; letting one accept the
  other's branded values crosses a boundary the configuration drew.
- **Against:** it breaks legitimate patterns (a request-scoped instance reading context minted by an
  application-scoped one) and pushes callers toward a single global instance, which is worse.

### F4 — Core extraction forces a *single-copy Core*, not instance scope

#86 moves the semantic core into its own package with a `ContextProvider` SPI, and #87 adds a Node
binding. The original packet concluded from this that "module-copy scope, left implicit, breaks the
split", and recommended instance scope on that strength. **That inference does not hold.**

The split produces two *packages*. It produces two *module copies of `context.ts`* only if the binding
**duplicates** Core's context module. If the Node binding instead **depends on** Core and re-exports it,
there is exactly one resolved copy of `context.ts` in the graph, one registry, and no cross-copy value
ever exists. Module-copy scope survives the split untouched, with no cross-package brand mechanism and no
API break.

That is option **C**, and it is what makes the decision cheap. The invariant it introduces is stated
positively and is testable: **Core resolves to exactly one module instance in any supported consumer
graph.** #86 must prove it; a duplicate-Core fixture must fail.

The one real cost is honest and belongs to #86 anyway: the Node binding needs Core as a runtime
`dependency`, and `check-dependencies.mjs` plus `check-coherence.mjs`'s `lock-runtime-dependencies` rule
currently assert an **empty** `dependencies` object. That rule was written for a single package. Splitting
requires rescoping it from "no runtime dependencies" to "no *third-party* runtime dependencies", with the
first-party Core dependency declared and allowlisted. Record that as a required #86 task, not as an
argument against C.

### F5 — A process singleton must be evaluated against the same invariants, and it fails one

`globalThis`-anchored registries are reachable and mutable by any code in the process. The SDK's entire
authority model rests on "only the constructors in this file can insert entries". A process singleton
weakens that to "only code that can reach the global can insert entries", which is all code.
**Recommend explicit rejection**, recorded with the reason, so it is not re-proposed.

### F6 — Forge resistance must be stated in words, and under option C it carries over unchanged

The current guarantee is: a TypeScript cast or a hand-written plain object can claim the `Brand<...>` type
but can never appear in the registry. Any change to registry ownership must preserve that. Option C
changes no registry ownership, so the guarantee carries over intact and needs **no re-proof from
scratch** — but it does need **stating**, because #78's acceptance criteria demand forged/copied/foreign
fixtures and they need an invariant in words to test against. What *is* net-new under option C, and does
need proving, is the single-copy Core invariant (F4), which #86 owns.

*(Had option B been selected, this finding would have required a full re-proof: instance scope changes
registry ownership.)*

### F7 — Recording the decision hits the same ADR pin as #75

Eleven SDK ADRs, pinned. `adr/004-authority-context.md` is the natural host — it already documents the
model and merely omits the scope selection. Extend it; do not add a twelfth.

### F8 — Task 0.4 is resolved, and it resolves against the original recommendation

The original packet listed Task 0.4 — "do two SDK instances in one module copy currently share brands?" —
as the one measurement that could change the answer, and flagged the possibility that the SDK might
already be instance-scoped in effect, making this a ratification like #75.

**It is not.** Resolved by inspection on 2026-08-23, and the code is unambiguous rather than merely
suggestive: `isBranded(value, ...kinds)` at `context.ts:400-402` reads a module-scoped `WeakMap` and takes
no instance argument; `brand()` at `:394-396` writes the same map; `SecurityAuditSdk` holds only `#config`
and never reaches either. There is no place for instance identity to enter, so two instances in one copy
necessarily share brands — indeed *no* brand is associated with an instance at all.

The consequence runs the opposite way from the flagged risk: instance scope is not a ratification but a
**net-new association** that does not exist today, and creating it means touching all 35 public
constructors (F3). A runtime two-instance fixture would confirm this and costs little, but it can only
agree with the read — there is no branch for it to take.

---

## The decision, as the owner should see it

| | **A. Formalize module-copy** | **B. Instance scope** | **C. Module-copy + single-copy Core** (**adopted**) |
| --- | --- | --- | --- |
| Public API change | none | **35 exported constructors** (F3) | none |
| Behaviour change from today | none | two instances in one copy stop sharing brands | none |
| Effect on #86 Core split | needs a designed cross-package brand mechanism | clean — brand belongs to the instance | clean — one resolved `context.ts`, so no cross-copy value exists (F4) |
| Duplicate-installation UX | needs #79's diagnostic | duplicates become a non-event | needs #79's diagnostic |
| Forge resistance | unchanged | must be re-proved for the new ownership | unchanged |
| New obligation | scope an unscoped mechanism | a major-version break | prove Core is single-copy; rescope the zero-dependency gate (F4) |
| Process singleton | rejected (F5) | rejected (F5) | rejected (F5) |

**Decision: option C — bounded module-copy scope with a single-copy Core.** Adopted by the owner on
2026-08-23.

The reasoning, in the order it should be read:

1. **The forcing function is #86, and #86 forces single-copy Core, not instance scope** (F4). Once the
   Node binding depends on Core rather than duplicating it, the cross-copy case the split was supposed to
   create simply does not arise.
2. **Instance scope pays a break across 35 public constructors** (F3) to buy a property that C obtains
   structurally. That is the wrong trade for an unpublished candidate whose authority surface is its most
   security-sensitive API.
3. **C changes no behaviour today** (F8), so forge resistance carries over unchanged and nothing must be
   re-proved from scratch — only the new single-copy invariant must be proved, and it is proved by a
   fixture rather than by argument.
4. **A is C without the invariant.** The difference is that C states the property #86 must maintain, so
   the split cannot silently reintroduce a second copy. Choosing A would leave exactly the gap the
   original packet was right to worry about.

**What C commits to, and what must therefore be written down:**

- Brands are scoped to the module copy of `context.ts`. This is now chosen, not accidental.
- **Core resolves to exactly one module instance in any supported consumer graph.** #86 owns proving it;
  a duplicate-Core fixture must fail closed with a diagnostic, not silently.
- A genuine duplicate installation remains a real, detectable category, so **#79 survives intact** — its
  current body stands and does not need rewriting.
- The zero-runtime-dependency gate is rescoped to "no third-party runtime dependencies" as part of #86,
  with the first-party Core dependency declared and allowlisted.
- The process singleton stays explicitly rejected (F5).

**Revisit condition:** if a supported consumer graph is ever found in which Core cannot be deduplicated,
C's invariant fails and the choice reopens between A-with-a-mechanism and B. Record that as the trigger,
so a future reader knows what would falsify the decision.

---

## Task 0: Re-verify (read-only)

- [ ] 0.1 Re-read `src/context.ts` end to end. Confirm the registry is module-level and the two rejection
      sites are as pinned.
- [ ] 0.2 Confirm `adr/004-authority-context.md` documents the model but selects no scope (F1, F7).
- [ ] 0.3 Build a genuine two-copy fixture in a **disposable clone** and confirm the cross-copy rejection
      and the `AUTHORITY_ESCALATION` code (F2). Do not write to the live tree — sibling verification tests
      snapshot the live package in parallel.
- [x] 0.4 **Resolved by inspection, 2026-08-23 (F8).** `isBranded` reads a module-scoped `WeakMap` and
      takes no instance; `SecurityAuditSdk` never touches it. Two instances in one copy share brands
      because no brand is instance-associated at all. A runtime fixture may still be built alongside 0.3
      for the record, but it can only agree.
- [x] 0.5 **Measured, 2026-08-23.** 35 `export function` brand constructors in `context.ts`, re-exported
      from `index.ts`. This is the fact that sized option B correctly (F3).

## Task 1: Post the decision brief — SUPERSEDED

The 2026-08-16 brief stands as the record of the surface. Task 1 is superseded by the 2026-08-23
correction comment, which carries F3, F4 and F8 and records the adopted option. Do not re-post the
original brief.

## Task 2: Record the decision — THE OPEN WORK

- [ ] 2.1 OpenSpec change `ratify-sdk-core-authority-scope`. This is `security_sensitive_behavior`, so it
      needs the full assessment even though it writes only prose.
- [ ] 2.2 Extend `adr/004-authority-context.md` with option C and all four required invariants (forge
      resistance, duplicate behaviour, cross-instance/cross-copy semantics and errors, migration).
      **No twelfth SDK ADR** (F7).
- [ ] 2.3 Root ADR for the options analysis, carrying the A/B/C table, F3's sizing, F4's reasoning, and
      the revisit condition.
- [ ] 2.4 State the single-copy Core invariant in the ADR in testable words, and add it to #86 as an
      acceptance criterion with a duplicate-Core fixture that must fail.
- [ ] 2.5 Add the zero-dependency rescoping ("no *third-party* runtime dependencies") to #86 as a required
      task, naming `check-dependencies.mjs` and `check-coherence.mjs`'s `lock-runtime-dependencies` rule.
- [ ] 2.6 Confirm on #79 that its current body **stands** — option C keeps duplicate copies a real
      category. Do not rewrite it.
- [ ] 2.7 Comment on #86 that the blocker is resolved and on #78 that it is formalization plus #79's
      diagnostic, with no registry relocation.

## Task 3: Close

- [ ] 3.1 Close #77 naming option C and the ADR paths. **Not before the ADRs land** — the decision
      comment records the selection, the ADRs are the binding artefacts.
- [ ] 3.2 Tick #77 in #132's Wave 2 checklist, and note that the decision surface shrank to #117, #114
      and #129.

---

## Validation matrix

| Acceptance criterion (#77) | Where satisfied |
| --- | --- |
| One authority scope selected | **satisfied** — option C, owner, 2026-08-23; ADR pending |
| Forge resistance and duplicate behaviour explicit | ADR-SDK-004 extension (F6); unchanged under C |
| Cross-instance/cross-copy semantics and errors defined | ADR extension; **#79 stands as written**, no re-scope |
| Migration and split implications recorded | ADR extension citing F4 — single-copy Core + dependency-gate rescoping, both landing on #86 |

## Risks and open questions

- **C's invariant is a claim about consumer graphs, and the repository cannot test all of them.** "Core
  resolves to exactly one module instance" holds for a well-formed dependency tree and fails for a
  consumer who pins two Core versions. The mitigation is a duplicate-Core fixture in #86 that fails
  closed with a clear diagnostic — not a promise that duplication cannot happen.
- **Rescoping the zero-dependency gate is the moment a real weakening could slip in.** "No third-party
  runtime dependencies" must be enforced as an allowlist of exactly one first-party specifier, not as a
  relaxed check. Prove the rescoped gate can still fail on a third-party dependency before trusting it.
- **This decision is security-shaped**, so the change recording it will fire `security_sensitive_behavior`
  and needs the full assessment even though it writes only prose.
- **Superseded risk (kept for the record).** The original packet warned that Task 0.4 might show the SDK
  already instance-scoped, making this a ratification. F8 falsifies that: no brand is instance-associated,
  so instance scope would have been net-new work, not ratification.

## What this does not authorize

Implementing the scope (#78), the diagnostic (#79), any global fallback, ambient authority, or any
weakening of the brand invariant.

## What this plan did not verify

- The two-copy runtime fixture (Task 0.3). The cross-copy rejection is read from the code and from the
  archived remediation packet, not reproduced at this baseline.
- That a Node binding depending on Core actually deduplicates under every supported install topology.
  F4's claim is structural; #86 must measure it, with a null control on every arm.
- What the rescoped dependency gate costs to implement. That belongs to #86 and was not estimated.

Task 0.4 was previously listed here. It is now resolved — see F8.
