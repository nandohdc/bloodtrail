# Issue #117 — Establish a Distinct Purpose for Client-Side Evidence — Decision Packet

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, and the **gate for all fifteen Wave 5 issues**. It was
> retyped from `RESEARCH` to `GOVERNANCE` after an adversarial audit found it producing a *recommendation*
> where plan §FP-8 requires an **owner record** — a recommendation cannot displace a recorded owner
> decision. That correction is the whole character of this issue: the deliverable is a decision by a named
> person, not an analysis. The prior decision it must supersede is real, dated, and specific:
> `research/browser-telemetry/reviews/final-project-owner-outcome.md`, 2026-07-31, commit
> `e3f2f1f323a94a9fffe0f7ddfc6fcf8ec8bbd26f`, **no adoption at this time**. Supersede it *for this purpose
> only*, or not at all.

**Goal:** An owner record stating one bounded client-evidence purpose, why server evidence and lower-data
alternatives are insufficient, who the data subjects are, foreseeable misuse — and an explicit GO / NO-GO /
REVISE that supersedes the detection-domain reconsideration criteria for this purpose only.

**Status at this baseline:** BLOCKED ON OWNER. Gate for #118–#131.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #117, OPEN, labels `enhancement` `question` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependency | #66 — **CLOSED** |
| Native GitHub blockers | `blocked_by` is `0` |
| Correction | 2026-08-10 — retyped `RESEARCH` → `GOVERNANCE`; a recommendation cannot displace an owner decision |
| **Prior owner decision** | `research/browser-telemetry/reviews/final-project-owner-outcome.md` — reviewer Fernando Homem da Costa (`nandohdc`), 2026-07-31, commit `e3f2f1f323a94a9fffe0f7ddfc6fcf8ec8bbd26f`, **no adoption at this time** |
| That decision's authorizations | production: **none**; real-user collection: **none**; identity attribution, authentication use, risk-scoring input, customer enforcement: **none** |
| Its reconsideration criteria | measurable detection lift, false-positive limits, performance and conversion-impact limits, success and kill criteria, physical-device coverage, misuse resistance, dependency and outbound-network review, privacy restrictions |
| Its primary approach | server-observed behavioural correlation and commercial outcomes |
| Research workspace | `research/browser-telemetry/` — isolated investigation, **not shipping code** |
| Downstream | #118 → #119 → #120 → #121 → #122 → #123 → #124/#125 → #126 → #127 → #128 → #129 → #130/#131 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The supersession is narrow by construction, and the narrowness is the argument

The 2026-07-31 decision's reconsideration criteria are all **detection-domain** measures: detection lift,
false-positive rate, conversion impact, physical-device coverage. #117's stated grounds are that audit
correlation is a **materially different purpose with no detection lift to measure** — so those criteria do
not apply, rather than being waived.

That argument only works if the new purpose genuinely has no detection component. **If the proposed purpose
turns out to include risk scoring, identity attribution, or enforcement, the supersession collapses** and
the 2026-07-31 decision applies unchanged. Test the proposed purpose against those four prohibited uses
before writing the record.

### F2 — Six things the prior decision refuses, and the record must not reopen any of them

Production authorization, real-user collection, identity attribution, authentication use, risk-scoring
input, customer enforcement. #117's sixth acceptance criterion says the new record must not reopen, weaken,
or imply reconsideration of the 2026-07-31 no-adoption decision for the detection use case.

Practical test for the record's language: if a sentence would still read as true with "for detection"
appended, rewrite it.

### F3 — The privacy review is not discharged by this record

#117's assurance limitation says so explicitly: this record establishes purpose and supersession only, and
does **not** discharge the mandatory qualified privacy/legal review, which is #119. That review is also
mandated by the 2026-07-31 decision's own conditions.

### F4 — "Minimum necessary data" must be answered before fields are chosen, and #122/#123 depend on it

The purpose record identifies the minimum data the purpose requires. #122 (correlation field) and #123
(envelope) then implement within that bound. A purpose record that omits the minimum-data analysis leaves
#123 free to define whatever it likes — which is how bounded collection becomes unbounded.

### F5 — The record's format has a precedent in this repository

`final-project-owner-outcome.md` is the shape: reviewer name, handle, role, review type, date, **exact
commit reviewed**, material reviewed, decision, status, authorizations, conditions, concerns, follow-up
owner, reconsideration requirements, assurance limitation. Reuse it. It already forces every field #117
asks for, and it makes the supersession legible because the two documents have the same structure.

### F6 — Fifteen issues are behind this one

#117 gates #118–#131. A NO-GO here closes fourteen issues cleanly and is a perfectly good outcome —
arguably the cheapest one. Present it as a real option, not as failure.

---

## The decision, as the owner should see it

Three outcomes:

- **GO** — one bounded purpose, with the minimum-data analysis, superseding the detection criteria for
  that purpose only. Unblocks #118, which unblocks the rest, each behind its own gate.
- **NO-GO** — Wave 5 closes. Fourteen issues resolve as `wontfix` with the reasoning recorded, and
  `.out-of-scope/` gains its first entry.
- **REVISE** — the proposed purpose overlaps a prohibited use (F1); narrow it and return.

**No recommendation is offered here.** #117 was specifically retyped because a recommendation is the wrong
artefact for this decision. The agent's job is to present the surface, verify the prior decision's terms,
and record the answer.

---

## Task 0: Re-verify the prior decision (read-only)

- [ ] 0.1 Read `research/browser-telemetry/reviews/final-project-owner-outcome.md` in full. Confirm the
      date, the reviewed commit, the six refusals (F2), and the reconsideration criteria.
- [ ] 0.2 Read the sibling reviews — `privacy-restriction.md`, `security-architecture-self-review.md`,
      `technical-self-review.md`, `product-decision.md`, `dependency-license-acceptance.md`. The
      supersession must not contradict any of them.
- [ ] 0.3 Confirm no client-evidence code, field, or schema exists anywhere in the repository.

## Task 1: Post the decision surface

- [ ] 1.1 Post the three outcomes (above), the F1 test (does the proposed purpose touch a prohibited
      use?), and the F5 format.
- [ ] 1.2 State F3: this record does not discharge #119.
- [ ] 1.3 State F6: NO-GO is a clean, cheap outcome that closes fourteen issues.
- [ ] 1.4 Carry the AI-triage disclaimer. Move `needs-triage` → `ready-for-human`.

## Task 2: When the owner answers — record only

- [ ] 2.1 Write the record in `final-project-owner-outcome.md`'s shape (F5), as a **new** document; do not
      edit the 2026-07-31 outcome.
- [ ] 2.2 It must contain: one bounded purpose; the decision it supports; why server evidence and
      lower-data alternatives are insufficient; data subjects; foreseeable misuse; the **minimum necessary
      data** (F4); an explicit GO / NO-GO / REVISE; and the narrow supersession clause.
- [ ] 2.3 Review the language against F2 — nothing reopens the detection decision.
- [ ] 2.4 On NO-GO: close #118–#131 with the reasoning, and write the `.out-of-scope/` entry.

## Task 3: Close

- [ ] 3.1 Close #117 naming the record path and the outcome.
- [ ] 3.2 Tick #117 in #132's Wave 5 checklist.
- [ ] 3.3 On GO: comment on #118 and #119. **Do not promote #120–#131** — each has its own gate.

---

## Validation matrix

| Acceptance criterion (#117) | Where satisfied |
| --- | --- |
| One bounded purpose and the decision it supports | record, Task 2.2 |
| Why current server evidence and lower-data alternatives are insufficient | record |
| Data subjects and foreseeable misuse identified | record |
| Owner records explicit GO / NO-GO / REVISE, not a recommendation | Task 2, and the retyping correction |
| Supersedes the detection-domain criteria **for this purpose only** | Task 2.2 supersession clause |
| Does not reopen the 2026-07-31 no-adoption decision | Task 2.3 |
| Records future work only; implementation NOT AUTHORIZED | record's authorizations section |

## Risks and open questions

- **A purpose that quietly includes risk scoring** (F1) collapses the supersession and reopens a settled
  decision.
- **Producing an analysis instead of a decision** is the exact defect the 2026-08-10 correction fixed.
- **Omitting the minimum-data analysis** (F4) leaves #123 unbounded.
- **Open question for the owner:** is there a concrete decision that client evidence would inform, today?
  #117's first criterion asks for "the decision it supports". If no such decision exists, the honest
  outcome is NO-GO, and that is worth surfacing before a purpose is constructed to fit.

## What this does not authorize

Selecting client fields or wire formats, implementing browser or mobile collection, treating speculative
usefulness as an approved purpose, or discharging the privacy review.

## What this plan did not verify

Whether a materially distinct purpose exists at all. That is the question, and only the owner can answer
it.
