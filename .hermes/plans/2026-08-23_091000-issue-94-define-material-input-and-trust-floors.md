# Issue #94 — Define Material-Input and Trust-Floor Semantics for Derived Fields — Decision Packet

> **For Hermes:** `P3_DEFERRED`. The body says implementation is **NOT AUTHORIZED** until every named
> prerequisite and governance gate is complete. This issue is nonetheless *startable in one narrow sense*:
> it produces a **decision artifact**, not code, and one of its two declared dependencies (#93) is closed.
> The other (#75) is an unanswered owner decision. Do not open a change; do not touch the contract. What
> you can do today is sharpen the decision surface so the owner can answer it in one sitting — and correct
> one thing the issue does not say: **the S-1 withdrawal already made trust escalation structurally
> impossible**, which changes what a trust floor is for.

**Goal:** A governed decision recording which derivation inputs are material, how ordering, duplicates,
unknown fields and transitive derivation behave, and a deterministic function computing an output's
maximum trust from its inputs' trust and the transformation's authority.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Decision surface can be sharpened; nothing else.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #94, OPEN, labels `question` `openspec-change-needed` `area:core` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #93 **CLOSED**; #75 open and unanswered |
| Native GitHub blockers | `blocked_by` is `0` |
| S-1 outcome (recorded) | `provenance.trust_level` is pinned by the generated schema to `downstream_enrichment`, so producer trust escalation is **structurally rejected** — the reason #89–#93 were closed as superseded |
| Contract | frozen at `1.0.0`; `registries.trust_levels` exists; `authority_matrix.claimed_identity` covers `source.client_reported.*` (PLAN-042, ALREADY_SATISFIED) |
| Transform SPI | `src/config.ts` defines it; `src/events.ts` supplies tenant/purpose and validates output (PLAN-023, ALREADY_SATISFIED) |
| Immutability literals | `check-contract-immutability.mjs` pins `contractVersion` and `normativeTechnicalTarget` |
| Downstream | #95 (contract representation), #96 (enforcement) — both `P3_DEFERRED` |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — S-1's outcome narrows what a trust floor can be for, and the issue predates it

`provenance.trust_level` is pinned by the generated schema to `downstream_enrichment`. A producer cannot
assert a higher trust level at all — the schema rejects it. So the attack #94 guards against ("omission of
material low-trust inputs manufacturing higher assurance") cannot be executed by *asserting* a trust level.

What remains is subtler and still real: a derived field whose **value** implies more assurance than its
inputs support, while its declared trust level stays honest. Example: a `risk.score` computed from one
server-authoritative signal and one client-reported one, published without saying the client signal was
material. Nothing lies about trust; the *derivation* hides a weak input.

**That is the actual subject, and it should be stated that way in the decision.** Otherwise the decision
solves a problem the schema already solved.

### F2 — The four sub-decisions are independent and only one is hard

| Sub-decision | Difficulty | Note |
| --- | --- | --- |
| Which inputs are material | **hard** | "material" is a judgement; the decision must give a rule, not a list |
| Ordering | easy | canonical: sorted by code point, matching the generators' existing discipline |
| Duplicates | easy | reject, don't dedupe — silence hides a mistake |
| Unknown fields | easy | reject, fail closed, consistent with every other validation layer |
| Transitive derivation | medium | either flatten to material leaves or forbid transitivity; flattening is the honest one |

The materiality rule is the whole decision. A defensible formulation: **an input is material if changing
it could change the derived value.** That is testable in principle and states the obligation without
enumerating fields.

### F3 — The trust-floor function is a `min` over a partial order, and the ordering must be declared data

Output trust ≤ min(input trusts), further capped by the transformation's own authority. Two things must be
declared rather than coded: the **ordering** over `registries.trust_levels`, and each transformation's
**authority ceiling**. Both belong in the contract source if they are contract semantics, which makes #95
their carrier — but the *decision* about their shape is this issue.

Note the ordering may be **partial**: two trust levels can be incomparable. `min` over a partial order is
undefined for incomparable elements. **Decide fail-closed on incomparability**, exactly as #203 does for
path classes.

### F4 — Deciding this without #75 is possible; implementing it is not

#95 (the contract change) adds fields to a frozen contract, which forces a version increment, which is
governed by #75's policy. So #94's *decision* can be recorded now and #95 waits. Say so: it decouples a
decision from an unanswered decision.

### F5 — This decision cannot be recorded in the contract's ADRs

`contracts/security-audit/adr/` files are **generated** from `contract.source.json`. They are read, never
edited. So the decision record goes in `docs/adr/` (root, unpinned, `documentation_only`) or in an
OpenSpec change's design. Root ADR is the right home for a decision that precedes a contract change.

### F6 — Two canonical examples are required and they must be concrete

#94's acceptance criteria demand "at least one invalid provenance example and one excessive output-trust
example" with deterministic outcomes. Write them against real registry values, not placeholders — an
example using invented trust levels proves nothing about the actual ordering.

---

## The decision, as the owner should see it

Five questions, each with a recommendation:

1. **Materiality rule** — recommend: *an input is material if changing it could change the derived value.*
   Alternative (enumeration per derived field) is more precise and does not generalise.
2. **Ordering of `derived_from`** — recommend: canonical, sorted by code point, matching the generators.
3. **Duplicates** — recommend: reject.
4. **Unknown input references** — recommend: reject, fail closed.
5. **Transitive derivation** — recommend: flatten to material leaves; a derived input contributes its own
   material inputs, not itself.

Plus two structural decisions: the trust ordering is **declared data**, and incomparable levels **fail
closed** (F3).

---

## Task 0: What is available today

- [ ] 0.1 Confirm the S-1 outcome (F1) by reading the generated schema's `provenance.trust_level` pin.
      If it has changed, F1 is void and the decision reverts to its original framing.
- [ ] 0.2 Read `registries.trust_levels` and record the actual values and whether any pair is
      incomparable (F3).
- [ ] 0.3 Read the transform SPI in `src/config.ts` and record what authority a transformation currently
      carries — today, probably none explicitly, which is itself the finding.

## Task 1: Sharpen and post the decision surface

- [ ] 1.1 Post a brief on #94 leading with F1 — the schema pin narrows the problem, and the decision
      should address what remains.
- [ ] 1.2 Include the five questions with recommendations and the two structural decisions.
- [ ] 1.3 State F4: the decision can be recorded now; the contract change waits on #75.
- [ ] 1.4 Restate the NOT AUTHORIZED framing. Carry the AI-triage disclaimer. Keep `needs-triage`.

## Task 2: When the owner answers — record only

- [ ] 2.1 Root ADR `docs/adr/000N-material-input-and-trust-floor-semantics.md` (F5).
- [ ] 2.2 The ADR records: the materiality rule, ordering, duplicates, unknown fields, transitivity, the
      trust-floor function with the incomparability rule, the declared ordering's home, the compatibility
      and version treatment, and the two canonical examples (F6).
- [ ] 2.3 The ADR must state that implementation remains NOT AUTHORIZED until #95's prerequisites
      (including #75) are complete.
- [ ] 2.4 Comment on #95 and #96 with the recorded semantics. **Do not promote either.**

## Task 3: Close

- [ ] 3.1 Close #94 naming the ADR.
- [ ] 3.2 Tick #94 in #132's Wave 3 checklist.

---

## Validation matrix

| Acceptance criterion (#94) | Where satisfied |
| --- | --- |
| Governed decision records materiality, ordering, duplicate, unknown-field, transitive rules | ADR, five questions |
| Deterministic trust-floor function with examples | ADR, F3 + F6 |
| Selected compatibility/version treatment recorded | ADR, bound to #75's answer |
| One invalid provenance and one excessive-trust example with deterministic outcomes | F6, against real registry values |
| Implementation remains NOT AUTHORIZED | Task 2.3 |

## Risks and open questions

- **Solving the wrong problem** (F1) is the main risk: the schema pin already blocks the obvious attack.
- **A materiality rule that cannot be checked** makes #96 unimplementable. Test the recommended rule
  against a real derived field before recording it.
- **Incomparable trust levels** (F3) will be discovered during implementation if not decided now.
- **Open question:** does a transformation have its own authority ceiling today? If not, introducing one
  is a contract addition beyond `derived_from`, and #95's scope grows. Measure in Task 0.3.

## What this does not authorize

Changing contract schemas or generated validators, implementing trust-floor enforcement, or beginning any
work before the prerequisite governance is complete.

## What this plan did not verify

Whether `registries.trust_levels` is totally or partially ordered (Task 0.2) — the answer decides whether
the `min` function is well defined.
