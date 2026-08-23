# Issue #115 — Implement the Approved Collector Storage Adapter — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #114 — which is itself an unanswered owner
> decision. This is the deepest unauthorized point in Wave 4: **persistence** is unauthorized, `storage`
> is a forbidden filename and export term, and #115's own last acceptance criterion says implementation is
> NOT AUTHORIZED until the storage decision **and all named approvals** — including privacy and legal —
> are complete. There is nothing to build and nothing to design. What this plan does is state the gate
> precisely and record the two things that will otherwise be discovered late.

**Goal:** The approved storage abstraction and its selected adapter, enforcing retention, deletion,
tenancy, encryption integration and acknowledgment ordering, with no false acknowledgment on write failure
or partial outage.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #114 (owner) plus named privacy and
legal approvals.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #115, OPEN, labels `enhancement` `openspec-change-needed` `area:server` `needs-triage`; `P3_DEFERRED` |
| Declared dependency | #114 — unanswered owner decision |
| Native GitHub blockers | `blocked_by` is `0` |
| Authorization | persistence is unauthorized; `storage` is a forbidden filename and export term |
| Additional gate | "all named approvals" — privacy and legal, per #114's required work |
| Acknowledgment rule | to be fixed by #114; recommended there as **acknowledge only after durability** |
| Prohibited by name | cryptographic audit-log chaining, hash chains, tamper-evident linking |
| Downstream | #116 (pilot) declares #115 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Two gates, not one, and the second is not a code gate

#115 is blocked on #114's *decision* **and** on the privacy/legal approvals that decision names. An
approved architecture with unapproved privacy review is still blocked. Treat them as separate rows in the
gate, because a partial "yes" is the most likely form the unblocking will take.

### F2 — The dedupe store arrives first and nobody has decided whether it counts

#108 introduces a small store — an identity record plus a content digest for conflict detection — before
#114 answers anything. If #114 governs it, #108 is blocked on #114 too, and the roadmap's ordering is
wrong. If #114 does not govern it, then a store exists outside the storage decision. **Neither is
recorded.** This is flagged in #114's plan as an open question and it belongs on #115's radar because #115
inherits whatever #108 built.

### F3 — "No false acknowledgment" is the security property and it is testable without a product

Write failure or partial outage must not produce an acknowledgment. That is checkable against the
abstraction with a fault-injecting fake, before any real backend exists. So the *test suite* for #115 can
be written against #114's scenarios (its F6) well before the adapter is authorized — and writing it early
would validate that #114's scenarios are implementable, which is the cheapest possible review of that
decision.

**This is the one genuinely useful thing available in advance**, and it should be offered to the owner as
part of #114's answer rather than started unilaterally.

### F4 — Tenant isolation is a negative test, and negative tests are the ones that get skipped

"Tenant-isolation and retention/deletion negative tests pass" — the arm is: tenant A's query must not
return tenant B's record, under a selector A controls. That is the adapter's most important test and it
proves a property no positive test can.

### F5 — Failure logs are a leak path

"Secrets and raw evidence are absent from failure logs." A storage adapter's error path is where the
record's content most naturally ends up in a log line. The SDK's discipline — code, category, bounded path
— must extend to the adapter, and the arm must inspect actual log output, not the code.

### F6 — Retention and deletion are behaviours, not configuration

An adapter that accepts a retention setting and never enforces it passes every write/read test. The arm
must advance time and assert the record is **gone**, and assert that a deletion request removes it in a way
a subsequent read cannot recover.

---

## Task 0: The gate — three rows

- [ ] 0.1 **#114's decision is recorded.** If not, stop.
- [ ] 0.2 **Every named privacy and legal approval is affirmative.** If not, stop (F1).
- [ ] 0.3 **An explicit authorization for persistence implementation exists.** Persistence is
      unauthorized by default; a decision is not an authorization.

## Task 1: What is available today

- [ ] 1.1 Post on #115 the F2 finding: #108's dedupe store arrives before #114 and its governance is
      undecided. Cross-reference #114 and #108.
- [ ] 1.2 Offer, in #114's brief, that #115's fault-injection suite could be written against #114's
      scenarios as a cheap review of their implementability (F3) — **as an offer, not as work started**.
- [ ] 1.3 Carry the AI-triage disclaimer. Keep `needs-triage`.

## Task 2: When authorized — propose

- [ ] 2.1 Dedicated OpenSpec change, in its own package, with vocabulary respecting the forbidden terms.
- [ ] 2.2 Full assessment — `persistence`, `security_sensitive_behavior`, `integration` all fire.
- [ ] 2.3 The design implements **only** what #114 approved. Any gap is a question for #114, not a
      decision here.

## Task 3: RED — seven arms, all against fault-injecting fakes first

| Arm | Fixture | Expected |
| --- | --- | --- |
| L1 | canonical valid record stored and retrieved | round-trips through the abstraction |
| L2 | write failure injected | **no acknowledgment** (F3) |
| L3 | partial outage injected | approved outcome; **no acknowledgment** (F3) |
| L4 | tenant B's selector against tenant A's record | **no result** (F4) |
| L5 | retention window advanced past expiry | record **gone** (F6) |
| L6 | deletion request | record unrecoverable by a subsequent read (F6) |
| L7 | failure logs inspected on L2 and L3 | **no secrets, no raw evidence** (F5) |
| N0 | **null control** — normal write/read | succeeds; no diagnostics |

## Task 4: GREEN, verify, close

- [ ] 4.1 Implement the approved abstraction and the selected adapter.
- [ ] 4.2 Re-run all eight arms against the real adapter in an isolated environment.
- [ ] 4.3 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 4.4 Closing comment: the eight arms, the configuration surface, and the statement that adapter tests
      cannot prove production durability, key management, backups, or legal compliance.
- [ ] 4.5 Tick #115 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#115) | Arm |
| --- | --- |
| Canonical record stored and retrieved through the approved abstraction | L1 |
| Write failure or partial outage produces the approved outcome without false acknowledgment | L2, L3 |
| Tenant-isolation and retention/deletion negative tests pass | L4, L5, L6 |
| Secrets and raw evidence absent from failure logs | L7 |
| NOT AUTHORIZED until the decision and all approvals are complete | Task 0 |

## Risks and open questions

- **Starting on a decision without an authorization** (Task 0.3) — the two are distinct and the issue
  names both.
- **Retention as configuration rather than behaviour** (F6) passes every naive test.
- **Tenant isolation** (F4) is the negative test most likely to be cut.
- **Open question:** does #115 inherit #108's dedupe store, replace it, or coexist with it? Three
  different implementations, and nothing decides between them.

## What this does not authorize

Implementing alternative backends not selected by governance, production deployment, real-data migration,
changing approved retention or acknowledgment semantics, or any cryptographic chaining.

## What this plan did not verify

Anything about a specific backend, because none is selected — deliberately.
