# Issue #108 — Implement Collector Idempotency and Deduplication — Plan

> **For Hermes:** Blocked on #107, and behind the same unauthorized-collector gate. The contract already
> fixes the identity: `security_significant.idempotency` reads *"same event id on retry; consumers
> dedupe"*, and `transaction_critical` reads *"dedupe by event id **and** transaction id"*. So the
> idempotency key is not a design choice for `security_significant` — it is the authenticated producer plus
> `event.id`, exactly as PLAN-054 states. The design freedom is in **retention** and **conflict**, not in
> identity. And note what #108 explicitly forbids: using payload content as an undocumented identity key.

**Goal:** A first valid submission records its identity and processes normally; an identical duplicate
within the retention window returns the duplicate outcome without reprocessing; conflicting reuse of one
identity fails closed; concurrent identical submissions cannot both process.

**Status at this baseline:** DEFERRED — UNAUTHORIZED CAPABILITY. Blocked on #107.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #108, OPEN, labels `enhancement` `openspec-change-needed` `area:server` `needs-triage` |
| Declared dependency | #107 — blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Identity rule | PLAN-054 — authenticated producer **plus** stable `event.id` |
| Contract rows | `security_significant.idempotency`: "same event id on retry; consumers dedupe"; `transaction_critical.idempotency`: "dedupe by event id **and** transaction id"; `policy_critical`: "same event id on retry with policy-specific reconciliation" |
| Retry identity guarantee | #104 must preserve `event.id` across attempts — the property this issue depends on |
| Exactly-once | **never claimed** anywhere in the contract; `transaction_critical.durability` says "product not selected" |
| Storage | **unauthorized**; `storage` is a forbidden filename and export term |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The key is fixed by the contract; only retention and conflict are open

For `security_significant`: authenticated producer + `event.id`. For `transaction_critical`: also
`transaction_id`. Do not design a key. Design the **store's** behaviour: how long an identity is
remembered, what happens on expiry, and what "conflicting reuse" means.

### F2 — This issue depends on a property #104 must provide, and nothing links them

Deduplication by `event.id` works only if a retry reuses the id. That is #104's job, and #104's plan flags
it as an arm to assert explicitly. If #104 mints a new id per attempt, #108 dedupes nothing and the failure
is silent — duplicates simply stop being duplicates. **Assert the linkage in #108's own suite**: a fixture
that submits the *same* event twice the way a retry would.

### F3 — Deduplication must come after validation, and that ordering is testable

#108's required work: duplicate checks occur **only after required ingress validation**. Otherwise an
attacker can probe which event ids exist by submitting invalid bodies with guessed ids. Instrument the
ordering the way #107's E2 arm does.

### F4 — "Conflicting reuse" needs a definition before it can fail closed

Same identity, different content. Detecting it requires remembering something about the content — a digest,
not the content itself. That is a real design decision with a privacy dimension: a digest of an audit event
is a fingerprint of it. Decide what is stored, and record it, because #114 (storage semantics) will
otherwise inherit an undocumented store.

**Recommend a bounded digest of the canonical serialization**, never the payload, and say so in the design.

### F5 — The store is not authorized, which bounds this issue to an abstraction

`storage` is a forbidden term and #114/#115 own persistence. So #108 implements deduplication **against an
abstraction** with one non-production in-memory implementation. #108's own verification says "against the
deduplication abstraction" — that wording is deliberate.

### F6 — Concurrency is the arm that catches the real bug

Two identical submissions arriving simultaneously must not both reach downstream processing. A
check-then-insert without atomicity admits both. In-memory this is a same-tick guarantee; against any real
store it is a conditional write. **The abstraction's contract must require atomic check-and-insert**, or
every future implementation is free to be wrong.

### F7 — Expiry is where "not exactly-once" becomes visible

After the retention window, a duplicate is processed again. That is correct and it is exactly why the
system does not claim exactly-once. State it in the closing comment rather than letting a reader assume
the window is a guarantee.

---

## Task 0: The gate

- [ ] 0.1 **Confirm collector implementation is authorized and #107 is complete.** If not, stop.
- [ ] 0.2 Confirm #104 preserves `event.id` across retries (F2). If it does not, raise it there first.
- [ ] 0.3 Confirm #102 fixes the duplicate outcome's shape.

## Task 1: Propose

- [ ] 1.1 Dedicated OpenSpec change.
- [ ] 1.2 Full assessment — `concurrency`, `persistence` (via the abstraction), `security_sensitive_behavior`.
- [ ] 1.3 The design fixes: the key (from the contract), the retention window, the conflict definition
      (F4), the atomic check-and-insert requirement (F6), and that the store is an abstraction (F5).

## Task 2: RED — seven arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| F1a | first valid submission | recorded; normal processing |
| F2a | identical duplicate within the window | duplicate outcome; **no reprocessing** |
| F3a | same identity, different content | conflict; **fail closed** (F4) |
| F4a | two identical submissions concurrently | exactly one reaches downstream (F6) |
| F5a | duplicate after the retention window expires | processed again (F7) |
| F6a | invalid body with a known event id | rejected by validation **before** any dedupe lookup (F3) |
| F7a | retry-shaped resubmission (same id, same content) | duplicate outcome (F2) |
| N0 | **null control** — two *different* events | both processed |

## Task 3: GREEN

- [ ] 3.1 Key from the contract, per class (F1).
- [ ] 3.2 Dedupe after validation (F3).
- [ ] 3.3 Bounded content digest for conflict detection; never the payload (F4).
- [ ] 3.4 Abstraction with an atomic check-and-insert contract; one in-memory implementation (F5, F6).
- [ ] 3.5 Re-run all eight arms.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 4.2 Closing comment: the eight arms, the retention window, and — explicitly — that this is **scoped
      deduplication, not an exactly-once guarantee** (F7).
- [ ] 4.3 Tick #108 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#108) | Arm |
| --- | --- |
| First valid submission records identity and processes normally | F1a |
| Identical duplicate within the window returns the duplicate outcome | F2a, F7a |
| Conflicting reuse fails deterministically | F3a |
| Concurrent identical submissions cannot both process downstream | F4a |
| Expiry matches the approved retention semantics | F5a |

## Risks and open questions

- **#104 minting new event ids (F2)** makes this issue a no-op, silently.
- **Non-atomic check-and-insert (F6)** passes every sequential test.
- **Storing a content digest (F4)** has a privacy dimension that #114 will inherit — document it now.
- **Open question:** what is the retention window? #108 says "the approved duplicate record lifetime" but
  nothing approves one. It is really a storage-semantics question (#114) arriving early. Recommend a
  configurable window with a stated default and an explicit note that #114 may override it.

## What this does not authorize

Durable evidence storage, global exactly-once claims, or using payload content as an undocumented identity
key.

## What this plan did not verify

Whether #102 specifies the duplicate outcome as distinct from a successful accept. If it does not, a
duplicate could be indistinguishable from a first submission to the producer — which would defeat the
point.
