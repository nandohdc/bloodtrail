# Issue #119 — Complete Privacy and Threat-Model Review for Client Evidence — Plan

> **For Hermes:** `severity:high`, `P3_DEFERRED`, NOT AUTHORIZED, blocked on #117 and #118. This review is
> **mandatory** twice over: #117's own assurance limitation says the purpose record does not discharge it,
> and the 2026-07-31 owner decision names "qualified privacy/legal review" as a condition before any
> real-user experiment, shadow collection, pilot, analytics, or enforcement. The word that matters is
> **qualified**. This is the one issue in the backlog an agent cannot complete: it requires named reviewers
> with standing, and #119's own out-of-scope line says a technical threat model is not legal advice.

**Goal:** A recorded review identifying data subjects, controller/processor roles, data categories,
purpose, retention and deletion obligations; a threat model covering attacker-controlled browser and mobile
inputs and malicious host pages; explicit prohibited data and minimization controls; and an outcome of
APPROVE FOR PROPOSAL / REJECT / REVISE with named reviewers.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED, and **not agent-completable**.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #119, OPEN, labels `enhancement` `question` `severity:high` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #117, #118 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Prior mandate | 2026-07-31 outcome — "qualified privacy/legal review is mandatory before real-user experiments, shadow collection, pilots, analytics, enforcement, or other real-user browser telemetry" |
| Existing privacy artefact | `research/browser-telemetry/reviews/privacy-restriction.md` — approved, authorizes **no** production or real-user collection |
| Existing threat artefact | `research/browser-telemetry/reviews/security-architecture-self-review.md` — **self**-review, explicitly non-independent |
| Prohibited-data machinery | `packages/security-audit-sdk-core/src/validation/prohibited.ts` — an existing scan, producer-side |
| Contract prohibited data | `contracts/security-audit/source/contract.source.json` → `prohibited_data` |
| Assurance limitation on all existing reviews | "documented governance for a personal open-source project; not independent assurance, formal certification, legal advice, or organizational approval" |
| Downstream | #120, #129 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Every existing review in this repository is explicitly non-independent, and #119 asks for something different

The 2026-07-31 outcome and its siblings all carry the same limitation: documented governance for a personal
open-source project, **not** independent assurance, certification, legal advice, or organizational
approval. #119 requires a **qualified** review with named reviewers. Either the owner accepts the same
non-independent posture and says so explicitly, or an external reviewer is engaged.

**That is a decision, not a task**, and it should be surfaced before the review is drafted.

### F2 — A large part of the review is already written and should be reused, not redone

`privacy-restriction.md` and `security-architecture-self-review.md` cover the browser-telemetry domain:
fabrication, suppression, replay, modification, fingerprinting and correlation risk, and the fact that
browser signals establish neither identity, humanity, nor truthful browser state. #119's purpose differs,
but the **threat inventory is the same threats**. Start from those documents; note what changes when the
purpose is audit correlation rather than detection.

### F3 — The contract already has prohibited-data machinery, and the review should bind to it

`prohibited_data` exists in the contract and `src/validation/prohibited.ts` enforces it. #119's third
criterion — "prohibited data and mandatory minimization controls are explicit" — is best satisfied by
naming the **existing** prohibited-data set plus any additions the client domain requires. That makes the
review's output mechanically enforceable by #126 rather than a prose list.

### F4 — "Malicious host page" is a threat class that does not exist server-side

The audit SDK's threat model assumes an untrusted *caller* but a trusted *process*. A browser SDK runs
inside a page that may be hostile: it can shadow globals, intercept the SDK's own calls, and observe its
data. #119's second criterion names it explicitly, and it is the class most likely to be under-modelled
because it has no server analogue.

### F5 — The review gates two branches, not one

#120 (the governed proposal) and #129 (Mode B device trust) both declare #119. So a REVISE outcome stalls
both the Mode A and Mode B branches. Say so in the review's routing.

### F6 — This issue cannot be closed by an agent

An agent can assemble the packet, inventory the data categories, draft the threat model from F2's base, and
prepare the decision form. It cannot **be** the qualified reviewer, and recording an agent-drafted review
as a qualified one would be a governance failure of exactly the kind this repository's gates exist to
prevent.

---

## Task 0: The gate and the prior question

- [ ] 0.1 **Confirm #117 recorded GO and #118 is complete.** If not, stop.
- [ ] 0.2 Post the F1 question to the owner: does "qualified" mean an external reviewer, or does the
      project accept the same non-independent posture as its existing reviews, recorded explicitly?
      **This must be answered before the review is drafted.**

## Task 1: Assemble the packet (agent-completable)

- [ ] 1.1 Inventory the proposed data categories **at the minimum level needed for review** — #119's own
      instruction; do not build a fuller inventory than the review requires.
- [ ] 1.2 Draft the threat model from `security-architecture-self-review.md`'s inventory (F2), adding the
      malicious-host-page class (F4) and re-scoping each threat to the audit-correlation purpose.
- [ ] 1.3 Name the existing `prohibited_data` set and propose client-domain additions (F3).
- [ ] 1.4 Draft the assessment sections: consent and notice, purpose limitation, minimization, retention,
      regional transfer, data-subject rights, child and sensitive data.
- [ ] 1.5 Prepare the decision form: APPROVE FOR PROPOSAL / REJECT / REVISE, with reviewer name, role and
      date fields, in `final-project-owner-outcome.md`'s shape.

## Task 2: Hand to the reviewer (not agent-completable)

- [ ] 2.1 The named reviewer records the outcome. **The agent does not.**
- [ ] 2.2 The record carries its own assurance limitation, honestly stated (F1).

## Task 3: Route the outcome

- [ ] 3.1 APPROVE FOR PROPOSAL → comment on #120 and #129 (F5); neither is thereby authorized.
- [ ] 3.2 REJECT → close #120–#131 with the reasoning; write the `.out-of-scope/` entry.
- [ ] 3.3 REVISE → return to #117 or #118 with the specific gap.
- [ ] 3.4 Close #119; tick it in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#119) | Where satisfied |
| --- | --- |
| Data subjects, controller/processor roles, categories, purpose, retention, deletion identified | Task 1.1, 1.4 |
| Threat model identifies attacker-controlled browser/mobile inputs and malicious host-page risks | Task 1.2, F4 |
| Prohibited data and mandatory minimization controls explicit | Task 1.3, bound to `prohibited_data` |
| Result is APPROVE FOR PROPOSAL / REJECT / REVISE with named reviewers | Task 2.1 |
| Records future work only; NOT AUTHORIZED | throughout |

## Risks and open questions

- **An agent recording a "qualified" review** (F6) would be the most consequential governance failure
  available in this backlog.
- **Under-modelling the malicious host page** (F4) because it has no server analogue.
- **A prose prohibited-data list** (F3) that #126 cannot enforce.
- **Open question for the owner:** #119 is `severity:high` and gates two branches. If engaging a qualified
  external reviewer is not realistic for this project, that is a strong signal for NO-GO at #117 — and it
  is better learned before #118's metrics are written than after.

## What this does not authorize

Implementing collection or persistence, approving production use, or treating a technical threat model as
legal advice.

## What this plan did not verify

Whether "qualified" is achievable here (F1). That question determines whether Wave 5 has a viable path at
all.
