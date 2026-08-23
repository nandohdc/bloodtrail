# Issue #112 — Implement the Remaining Governed Delivery Classes — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #109, #110 and #111. This issue was **rescoped
> after an adversarial audit** — it originally read "remaining event classes", which was unexecutable
> because the 24-event catalog is frozen and all 24 already have SDK methods. It now means the three
> remaining *delivery* classes. Read that correction before anything else; the old framing is still how
> people will describe it. The hardest constraint is not technical: `transaction_critical.durability`
> names a **"transactional outbox"**, and `outbox`, `queue` and `storage` are forbidden filename and export
> terms in `check-scope.mjs`. This issue implements class **semantics and conformance evidence only** —
> the durability substrate needs its own change and its own authorization.

**Goal:** `best_effort`, `transaction_critical` and `policy_critical` each pass #102's conformance suite
against their own `delivery_class_contracts` row, with one deterministic negative fixture per class.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #109, #110, #111.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #112, OPEN, labels `enhancement` `security-audit-sdk` `openspec-change-needed` `area:server` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #109, #110, #111 — all blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Rescope record | correction comment 2026-08-10 — delivery classes, not event classes |
| Frozen catalog | 24 events, 24 named SDK methods (`catalogEventCount` / `namedEventApiCount`) |
| `best_effort` row | at-most-once with bounded loss reporting; direct attempt or bounded memory buffer; duplicates tolerated; none or bounded retry; **drop with bounded counter and health signal**; no unbounded delay; loss estimate on outage; `fail_open` |
| `transaction_critical` row | audit durability **atomic with successful business commit**; "transactional outbox or equivalent behavior, **product not selected**"; dedupe by event id **and** transaction id; persistent retry after commit; **commit gate before durability point**; durable handoff required; `fail_closed` before business commit if durability unreachable |
| `policy_critical` row | policy owner must approve exact fail-open / fail-closed / deferred-completion **before production**; durability at least security-significant; policy-defined retry/backpressure/shutdown; **`blocked_pending_qualified_review`** |
| Forbidden terms | `outbox`, `queue`, `storage`, `transport`, `collector`, `adapter`, `exporter` — filenames and exports |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Two of the three classes are implementable as semantics; one is deliberately not

`best_effort` is fully specified by its row and needs no substrate. `policy_critical` is specified as
**blocked** — its `business_failure_posture` is literally `blocked_pending_qualified_review`, so the
correct implementation is a control that **fails when no policy-owner record exists**. That is #112's
fourth acceptance criterion, and it is unusual and elegant: the implementation of `policy_critical` is a
gate, not a behaviour.

`transaction_critical` is the problem child (F2).

### F2 — `transaction_critical` cannot be fully implemented without a forbidden substrate

Its durability requires "transactional outbox or equivalent behavior", and every word for that substrate
is a forbidden term. #112's own out-of-scope line resolves it: implement the **commit gate** and the
**dedupe-by-two-keys**, and prove that an audit record is not durable ahead of the business commit — all of
which are semantics — while the durability mechanism itself waits for its own authorized change.

The testable core is: *a fixture proves an audit record is not durable ahead of the business commit gate.*
That is checkable against an abstraction, exactly as #108 checks deduplication against an abstraction.

### F3 — `best_effort` must be provably weaker, and that assertion is unusual

#112's second criterion: `best_effort` explicitly does **not** claim the `security_significant`
guarantees, and its loss counter is bounded and observable. So the test asserts an *absence* of a
guarantee. The honest form: run `security_significant`'s at-least-once arm against `best_effort` and
assert it does **not** hold — a negative conformance test.

### F4 — Class substitution is the security risk and it is stated in the issue

"Weaker classes must never be silently substituted for stronger ones. `best_effort` … must not be
reachable for events whose catalog entry declares a higher minimum delivery class." That is a mechanical
check against the frozen catalog: each of the 24 events declares a delivery class; routing an event to a
weaker class than its catalog entry must fail. **That check is arguably the most valuable thing in this
issue** and it is easy to omit because it is not one of the three classes.

### F5 — Nothing in the contract may move

#112's sixth criterion: no contract artifact, catalog entry, or frozen API surface is modified. The
evidence is `check:generated` plus the coherence pins (`catalogEventCount: 24`, `namedEventApiCount: 24`,
delivery classes, extension namespaces). Run them and record them; a drift here would mean the
implementation redefined a class rather than conforming to it.

### F6 — `policy_critical` needs a record format that does not exist

"A recorded policy-owner decision naming the exact fail-open / fail-closed / deferred-completion
behaviour." No such record type exists in the repository. The governance record schemas
(`openspec/governance/schemas/`) are the natural precedent for shape. That is a design decision this issue
must make and #102 may not have covered.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #109's evidence, #110's and #111's freezes are complete.** If any is open, stop —
      #112's seventh criterion says implementation is NOT AUTHORIZED until both freezes are done.
- [ ] 0.2 Confirm #102's conformance suite is reusable per class (its scenarios must be class-scoped).
- [ ] 0.3 Re-read the three `delivery_class_contracts` rows verbatim and paste them into the design.

## Task 1: Propose

- [ ] 1.1 Dedicated OpenSpec change.
- [ ] 1.2 Full assessment.
- [ ] 1.3 The design states: the substrate exclusion (F2), the negative conformance approach for
      `best_effort` (F3), the catalog-minimum check (F4), and the `policy_critical` record format (F6).

## Task 2: RED — arms per class, plus the substitution check

| Arm | Class | Fixture | Expected |
| --- | --- | --- | --- |
| J1 | `best_effort` | drop under overload | bounded counter + health signal, **not** an alert-before-loss |
| J2 | `best_effort` | at-least-once arm from `security_significant` | **does not hold** (F3) |
| J3 | `transaction_critical` | dedupe by event id **and** transaction id | duplicate by one key alone is not a duplicate |
| J4 | `transaction_critical` | audit durability attempted before the commit gate | **fails** (F2) |
| J5 | `policy_critical` | no policy-owner record present | **fails deterministically** (F1) |
| J6 | `policy_critical` | valid policy-owner record present | conforms to the recorded behaviour |
| J7 | **substitution** | event whose catalog entry declares `security_significant`, routed `best_effort` | **fails** (F4) |
| N0 | **null control** | `security_significant` unchanged | passes exactly as #109 recorded |

## Task 3: GREEN

- [ ] 3.1 Implement each class against its own row, reusing #102's suite (F1).
- [ ] 3.2 Implement the commit gate and two-key dedupe; leave the substrate abstract (F2).
- [ ] 3.3 Implement `policy_critical` as a record-presence gate (F1, F6).
- [ ] 3.4 Implement the catalog-minimum substitution check (F4).
- [ ] 3.5 Re-run all eight arms.

## Task 4: Prove nothing moved

- [ ] 4.1 `check:generated` — no contract drift (F5).
- [ ] 4.2 `test:coherence` — catalog counts, delivery classes, extension namespaces unchanged.
- [ ] 4.3 The frozen Core and Node surfaces unchanged — #110's and #111's checks pass.

## Task 5: Verify, commit, PR, close

- [ ] 5.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 5.2 Closing comment: the eight arms, and the statement that conformance proves the implemented
      semantics for the exercised class and transport only — **not durability of an unselected substrate**.
- [ ] 5.3 Tick #112 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#112) | Arm |
| --- | --- |
| Each class passes the conformance suite for its own row | J1, J3, J6, across all six dimensions |
| `best_effort` does not claim the stronger guarantees; loss counter bounded and observable | J1, J2 |
| `transaction_critical` dedupes by two keys; not durable ahead of the commit gate | J3, J4 |
| `policy_critical` blocked without a recorded decision | J5, J6 |
| One deterministic negative fixture per class | J2, J4, J5 |
| No contract, catalog or frozen surface modified | Task 4 |

## Risks and open questions

- **Implementing the substrate** (F2) is the boundary violation this issue is most likely to commit, and
  it would need its own authorization.
- **Omitting the substitution check** (F4) leaves the actual security property unguarded.
- **A `policy_critical` record format invented ad hoc** (F6) will not compose with the existing governance
  schemas.
- **Open question:** where does the catalog's per-event minimum delivery class live, and is it currently
  enforced anywhere? If the SDK already routes by catalog entry, J7 may already pass — measure before
  building.

## What this does not authorize

Adding, renaming or removing audit event classes; modifying `delivery_class_contracts` or any contract
artifact; implementing a transactional outbox, queue or storage engine; or beginning before both freezes.

## What this plan did not verify

Whether the catalog declares a per-event minimum delivery class at all (the open question). That single
fact decides whether F4's check is small or substantial.
