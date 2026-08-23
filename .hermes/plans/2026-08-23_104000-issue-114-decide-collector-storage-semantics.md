# Issue #114 — Decide Collector Storage Retention and Failure Semantics — Decision Packet

> **For Hermes:** Owner decision, `ready-for-human`, brief posted 2026-08-16, `P3_DEFERRED`, NOT
> AUTHORIZED. **Do not implement storage** — `storage` is a forbidden filename and export term and
> persistence is unauthorized. The single most important thing in this issue is a prohibition that was
> added after an adversarial audit found it *cited but unenforced*: **cryptographic audit-log chaining is
> not to be designed** without separate explicit authorization, and any future integrity scheme must be
> computed over a **retention-stable projection** so field-level expiry cannot invalidate a retained
> record. Both are acceptance criteria now. Do not let a storage discussion drift into hash chains.

**Goal:** A governed decision recording the storage abstraction, durability target, encryption and key
ownership, retention and deletion authority, tenancy, indexing, acknowledgment-versus-persistence timing,
failure behaviour, privacy/legal prerequisites, and migration/recovery boundaries.

**Status at this baseline:** BLOCKED ON OWNER, and deferred behind #108.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #114, OPEN, labels `enhancement` `question` `openspec-change-needed` `area:server` `ready-for-human`; `P3_DEFERRED` |
| Declared dependency | #108 — blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Brief posted | 2026-08-16, unanswered |
| Adversarial correction | 2026-08-10 — PLAN-057 was cited but unenforced; two acceptance criteria added |
| **Prohibited by name** | cryptographic audit-log chaining, hash chains, tamper-evident log linking — unauthorized, per CLAUDE.md and source plan §D.9 / §J |
| Retention-stable projection | required for any future integrity scheme, so field-level expiry cannot invalidate a retained record |
| Forbidden terms | `storage`, `outbox`, `queue` — filenames and exports |
| Contract rows touching durability | `security_significant.durability` "durable or protected bounded queue in later implementation"; `transaction_critical.durability` "product not selected" |
| Downstream | #115 (adapter), #116 (pilot) |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The chaining prohibition is the reason this issue was corrected, and it will be tested

The 2026-08-10 audit found PLAN-057 cited in traceability while `Required work` invited deciding
"encryption/key ownership" with nothing preventing a chaining design. Two acceptance criteria were added.
**A decision document that discusses tamper-evidence, Merkle structures or hash-linked records violates
its own acceptance criteria** — even to reject them, phrase it as "not designed, unauthorized", not as a
design comparison.

### F2 — The retention-stable projection requirement is subtle and is the interesting technical content

If an integrity value is computed over a whole record and a field later expires under retention policy, the
integrity value no longer verifies — so retention and integrity fight. Computing over a **projection that
survives retention** resolves it. This is worth stating precisely in the decision because it constrains any
future scheme without designing one.

### F3 — The acknowledgment-versus-persistence question is the one with immediate consequences

"When may the collector acknowledge relative to persistence?" Acknowledging before persistence turns
at-least-once into at-most-once silently. Acknowledging after makes the producer's timeout budget depend
on storage latency. This is the decision that changes #107's and #108's observable behaviour, and it is
the one an owner can answer without choosing a product.

**Recommend: acknowledge only after the record is durable**, consistent with `security_significant`'s
"at-least-once after required producer boundary accepts", and record the latency consequence.

### F4 — The decision must not choose infrastructure, and #114 says so

"Choosing infrastructure by implementation convenience" is out of scope. So the decision names an
**abstraction** and its required properties — durability target, isolation, deletion — and leaves the
product to #115 under a later authorization. `transaction_critical.durability` already says "product not
selected"; keep it that way.

### F5 — Tenancy and deletion authority are governance questions, not engineering ones

"Data owner, retention/deletion authority, key owner" are the three named roles. None is discoverable from
the code. These are the parts only the owner can answer, and they are why this issue is `ready-for-human`.

### F6 — Two failure scenarios must have deterministic outcomes, and they must be written as scenarios

One write failure, one partial outage. Written as a scenario each, in the OpenSpec sense — WHEN/THEN — so
#115 has something to implement and #109-style evidence has something to check.

### F7 — Nothing here is startable, and the brief is a week old

Same posture as #75, #77, #80: the decision surface is documented, the answer is missing. Escalate in
tracker syncs rather than re-posting.

---

## The decision surface, as the owner should see it

Ten questions. Three are governance-only (F5), one is technical with immediate consequences (F3), the rest
shape the abstraction:

1. Storage abstraction and required properties — **not a product** (F4).
2. Durability target.
3. Encryption and **key ownership** — governance.
4. Retention, deletion, and **deletion authority** — governance.
5. Tenancy and isolation — governance.
6. Indexing requirements.
7. **Acknowledgment relative to persistence** — recommend after durability (F3).
8. Write-failure outcome — deterministic (F6).
9. Partial-outage outcome — deterministic (F6).
10. Migration and recovery boundaries.

Plus two mandatory statements: chaining is **not designed and remains unauthorized** (F1); any future
integrity scheme is computed over a **retention-stable projection** (F2).

---

## Task 0: Re-verify and refresh the brief

- [ ] 0.1 Confirm no storage decision record exists anywhere in the repository or on GitHub.
- [ ] 0.2 Confirm the two corrected acceptance criteria are still in the issue body (F1).
- [ ] 0.3 Post a refreshed brief: the ten questions, the F3 recommendation, and the two mandatory
      statements. Carry the AI-triage disclaimer. Keep `ready-for-human`.

## Task 1: When the owner answers — record only

- [ ] 1.1 A governed artefact: a root ADR or an OpenSpec change's design. **No code.**
- [ ] 1.2 Record all ten answers plus the two mandatory statements.
- [ ] 1.3 Write the two failure scenarios in WHEN/THEN form (F6).
- [ ] 1.4 Record the privacy and legal review prerequisites and who must sign them.
- [ ] 1.5 Record explicitly that implementation remains NOT AUTHORIZED until those approvals are
      affirmative.
- [ ] 1.6 Review the document against F1 — no chaining design, not even a rejected one.

## Task 2: Hand off

- [ ] 2.1 Comment on #115 with the decision. **Do not promote it** — it remains unauthorized.
- [ ] 2.2 Comment on #107 and #108 if the acknowledgment answer (F3) changes their observable behaviour.
- [ ] 2.3 Close #114; tick it in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#114) | Where satisfied |
| --- | --- |
| Governed decision records storage, privacy, durability, acknowledgment, failure semantics | Task 1.2 |
| Data owner, retention/deletion authority, key owner identified | questions 3–5 |
| One write-failure and one partial-outage scenario with deterministic outcomes | Task 1.3 |
| Migration and recovery boundaries explicit | question 10 |
| Chaining explicitly not designed and unauthorized | Task 1.2, mandatory statement |
| Future integrity scheme over a retention-stable projection | Task 1.2, mandatory statement |
| Implementation NOT AUTHORIZED until approvals affirmative | Task 1.5 |

## Risks and open questions

- **Drifting into a chaining design** (F1) violates the issue's own criteria and the authorization
  boundary — including a "considered and rejected" section.
- **Choosing a product** (F4) turns a decision into a procurement.
- **Acknowledgment timing (F3)** silently changes the delivery guarantee if answered carelessly.
- **Open question for the owner:** does storing an audit event's content digest for deduplication (#108's
  conflict detection) already constitute storage under this decision? It is a small, real store that #108
  introduces before #114 answers. Recommend: yes, and #114 should cover it explicitly.

## What this does not authorize

Implementing a storage backend, choosing infrastructure, claiming production durability, or designing
cryptographic audit-log chaining, hash chains, or tamper-evident log linking.

## What this plan did not verify

Whether #108's dedupe store (the open question) is already in scope. It arrives first chronologically and
nobody has decided whether it is governed by this decision.
