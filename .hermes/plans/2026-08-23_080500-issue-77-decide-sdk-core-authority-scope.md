# Issue #77 — Decide sdk-core Authority Scope — Decision Packet

> **For Hermes:** Owner decision, `ready-for-human`, brief posted 2026-08-16 and unanswered. **Do not
> implement.** This one is genuinely harder than #75: unlike the version policy, the status quo here is
> described in the issue itself as *accidental* — module-copy scoping that nobody chose. #78
> (implementation) and #79 (diagnostic) both presuppose the answer, and #86 (Core extraction) cannot
> proceed until the scope is explicit, because Core extraction changes how many module copies exist.
> Your job: re-read `src/context.ts`, state precisely what today's behaviour is, present the two models
> with their real consequences, and recommend.

**Goal:** One recorded scope model with explicit invariants for forge resistance, duplicate-copy
behaviour, cross-instance and cross-copy semantics and errors, and migration/split implications.

**Status at this baseline:** BLOCKED ON OWNER.

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
| ADR sequence | pinned at exactly 11 (`check-coherence.mjs:190-191`) |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Today's scope is a consequence of the mechanism, not a decision

`brandRegistry` is a module-level `WeakMap`. Its lifetime and identity are the **module copy's**. Two
installed copies of the package each get their own registry, so a value branded by copy A is unbranded
from copy B's perspective and is rejected at `:363`/`:407`. Nobody chose module-copy scope; it fell out of
"put the registry in a module".

### F2 — The failure is safe, and that is exactly why it has survived

A cross-copy value is rejected, not accepted. There is no security hole here. What there *is* is a
**diagnostic** problem (#79) and an **ergonomics** problem: legitimate composition across two copies —
which is what a dependency tree produces routinely — is reported as an attack. #77's own summary says so.

### F3 — Instance scope is strictly stronger and strictly less convenient

Binding brands to one SDK instance means cross-*instance* values are foreign even inside one module copy.
That is a behaviour change from today: two SDK instances in one process currently share a registry and
therefore accept each other's brands.

Whether that sharing is desirable is the actual question. Arguments:

- **For instance scope:** an SDK instance is the configured trust boundary — it holds the authority
  providers. Two instances may be configured with different authority sources; letting one accept the
  other's branded values crosses a boundary the configuration drew.
- **Against:** it breaks legitimate patterns (a request-scoped instance reading context minted by an
  application-scoped one) and pushes callers toward a single global instance, which is worse.

### F4 — Core extraction is the reason this cannot stay implicit

#86 moves the semantic core into its own package with a `ContextProvider` SPI, and #87 adds a Node binding.
After the split there are **two** module copies by construction — Core and the binding — and any value
branded in one and read in the other crosses the boundary that today's accidental scope rejects. **Module
-copy scope, left implicit, breaks the split.** That is the concrete, dated reason #86 lists #78 as a
dependency.

This is the single most decision-relevant fact and it is not in the issue body. Put it in the brief.

### F5 — A process singleton must be evaluated against the same invariants, and it fails one

`globalThis`-anchored registries are reachable and mutable by any code in the process. The SDK's entire
authority model rests on "only the constructors in this file can insert entries". A process singleton
weakens that to "only code that can reach the global can insert entries", which is all code.
**Recommend explicit rejection**, recorded with the reason, so it is not re-proposed.

### F6 — Whatever is chosen, forge resistance must be re-proved, not assumed

The current guarantee is: a TypeScript cast or a hand-written plain object can claim the `Brand<...>` type
but can never appear in the registry. Any change to registry ownership must preserve that. #78's
acceptance criteria already demand forged/copied/foreign fixtures; #77 must state the invariant in words so
#78 has something to test against.

### F7 — Recording the decision hits the same ADR pin as #75

Eleven SDK ADRs, pinned. `adr/004-authority-context.md` is the natural host — it already documents the
model and merely omits the scope selection. Extend it; do not add a twelfth.

---

## The decision, as the owner should see it

| | **Explicit module-copy scope** (formalize today's behaviour) | **Instance scope** |
| --- | --- | --- |
| Code change | small — mostly naming the invariant + #79's diagnostic | moderate — registry moves into the instance |
| Behaviour change from today | **none** | two instances in one copy stop sharing brands |
| Effect on #86 Core split | **breaks it** unless a cross-package brand-sharing mechanism is designed | clean — a brand belongs to the instance regardless of which package minted it |
| Duplicate-installation UX | needs #79's dedicated diagnostic to be usable | duplicates become a non-event; foreignness is by instance, not by copy |
| Forge resistance | unchanged | must be re-proved for the new ownership |
| Process singleton | n/a | n/a — **rejected** (F5) |

**Recommendation: instance scope**, on the strength of F4. Module-copy scope is the model that the
architecture is about to invalidate: #86 deliberately creates a second module copy, and formalizing a rule
that rejects cross-copy values would mean designing a brand-sharing mechanism between Core and the binding
— exactly the "module-resolution accident" #78's summary says Core extraction cannot rely on.

Instance scope also dissolves #79: a duplicate installation stops being a special case, because copies
stop being the unit of authority. #79 would then narrow to "diagnose a *foreign instance* clearly", which
is a smaller and more honest problem.

**Counter-consideration the owner should weigh:** instance scope makes a request-scoped SDK instance
unable to consume an application-scoped instance's context, which may be a real usage pattern. If it is,
say so — and then the answer is module-copy scope plus a designed cross-package mechanism for #86, which
is more work but preserves composition.

---

## Task 0: Re-verify (read-only)

- [ ] 0.1 Re-read `src/context.ts` end to end. Confirm the registry is module-level and the two rejection
      sites are as pinned.
- [ ] 0.2 Confirm `adr/004-authority-context.md` documents the model but selects no scope (F1, F7).
- [ ] 0.3 Build a genuine two-copy fixture in a **disposable clone** and confirm the cross-copy rejection
      and the `AUTHORITY_ESCALATION` code (F2). Do not write to the live tree — sibling verification tests
      snapshot the live package in parallel.
- [ ] 0.4 Build a two-*instance*, one-copy fixture and confirm brands **are** currently shared. This is the
      measurement that makes F3 concrete, and nothing in the repository records it today.

## Task 1: Post the decision brief

- [ ] 1.1 Lead with F4 — the Core split is the forcing function.
- [ ] 1.2 Include the comparison table and both measurements from Task 0.3/0.4.
- [ ] 1.3 Explicitly reject the process singleton with its reason (F5).
- [ ] 1.4 State the forge-resistance invariant in words (F6) so the decision binds #78.
- [ ] 1.5 Carry the AI-triage disclaimer. Keep `ready-for-human`.

## Task 2: When the owner answers

- [ ] 2.1 OpenSpec change `ratify-sdk-core-authority-scope`.
- [ ] 2.2 Extend `adr/004-authority-context.md` with the selected scope and all four required invariants
      (forge resistance, duplicate behaviour, cross-instance/cross-copy semantics and errors, migration).
      **No twelfth SDK ADR** (F7).
- [ ] 2.3 Root ADR for the options analysis.
- [ ] 2.4 Re-scope #78 and #79 against the answer **before** either starts. If instance scope wins, #79
      shrinks substantially — re-write its body rather than implementing the old scope.
- [ ] 2.5 Comment on #86 that the blocker is resolved.

## Task 3: Close

- [ ] 3.1 Close #77 naming the model and the ADR paths.
- [ ] 3.2 Tick #77 in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#77) | Where satisfied |
| --- | --- |
| One authority scope selected | owner's recorded answer |
| Forge resistance and duplicate behaviour explicit | ADR-SDK-004 extension (F6) |
| Cross-instance/cross-copy semantics and errors defined | ADR extension + #79 re-scope |
| Migration and split implications recorded | ADR extension, citing F4 |

## Risks and open questions

- **The measurement in Task 0.4 may surprise everyone.** If two instances in one copy currently *reject*
  each other's brands, then the SDK is already instance-scoped in effect and this decision is a
  ratification like #75. Measure before writing the brief.
- **Choosing module-copy scope creates work in #86** that nobody has scoped: a cross-package brand
  mechanism. If the owner leans that way, #86 needs re-estimating before Wave 2 proceeds.
- **This decision is security-shaped**, so the change recording it will fire `security_sensitive_behavior`
  and needs the full assessment even though it writes only prose.

## What this does not authorize

Implementing the scope (#78), the diagnostic (#79), any global fallback, ambient authority, or any
weakening of the brand invariant.

## What this plan did not verify

Task 0.4 — whether two SDK instances in one module copy currently share brands. That single measurement
could change the recommendation.
