# Issue #106 — Implement Deadline-Bounded Delivery Shutdown — Plan

> **For Hermes:** Blocked on #104 and #105, and behind the same unauthorized-capability gate as the rest
> of Wave 4's implementation issues. The important prior art is not in the issue: **the SDK already has a
> shutdown contract, written down in full**, at `compatibility.json.shutdownTimerOwnership` — `unref`,
> idempotent clear in a structured `finally` after either race outcome, logical timeout preserved while
> the process is active, no idle-process retention, no signal handlers, no intervals. Delivery shutdown
> must extend that, not invent a second protocol. And `src/sink.ts` already tracks in-flight promises so
> `shutdown()` can drain under a timeout — the drain mechanism exists.

**Goal:** Shutdown stops admitting work, drains or cancels according to the deadline and retry rules,
returns exact accepted/completed/abandoned accounting, and is idempotent.

**Status at this baseline:** DEFERRED — UNAUTHORIZED CAPABILITY. Blocked on #104, #105.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #106, OPEN, labels `enhancement` `security-audit-sdk` `area:server` `needs-triage` |
| Declared dependencies | #104, #105 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| **Existing shutdown contract** | `compatibility.json.shutdownTimerOwnership` — `unref`; idempotent clear in a structured `finally`; logical timeout preserved while active; **no** idle retention, **no** signal handlers, **no** intervals |
| Existing drain | `src/sink.ts` — in-flight promises tracked; `shutdown()` drains under a timeout |
| SDK lifecycle states | `ready` / `shutting_down` / `shut_down`; anything but `ready` fails immediately |
| Config | `shutdownTimeoutMs` already exists |
| Contract row | `security_significant.shutdown` — "bounded flush or durable handoff" |
| `best_effort.shutdown` | "no unbounded delay" |
| `transaction_critical.shutdown` | "durable handoff required" |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The admission boundary already exists at the SDK level and must be mirrored, not duplicated

The SDK's lifecycle guard rejects everything but `ready`. Delivery shutdown needs the same boundary one
layer down: once shutdown starts, `enqueue` returns the rejection deterministically. **Reuse the state
names** (`ready` / `shutting_down` / `shut_down`) so the two layers read the same way in a log.

### F2 — "No signal handlers, no intervals" is a contract, and a delivery shutdown will want to break it

A delivery implementation that helpfully wires `SIGTERM` looks correct and violates
`shutdownTimerOwnership` and #106's own out-of-scope line ("process signal wiring for every deployment
platform"). The host application owns signals; the delivery layer exposes `shutdown()`.

### F3 — The accounting is three numbers and they must sum

`accepted`, `completed`, `abandoned`. `completed + abandoned === accepted` must hold at return, and that
is a testable invariant rather than a description. It is also the assertion that catches the classic bug:
a drain that resolves early and reports work as completed that was actually cancelled.

### F4 — "Never report abandoned evidence as delivered" is the security requirement

#106's security note. The failure mode is silent: a shutdown that times out and returns `completed`
counts. Assert the invariant in F3 **and** assert that an abandoned item never appears in a delivered
count, on a fixture where the deadline definitely expires.

### F5 — Fake time is mandatory and the SDK's own timer discipline shows how

Every arm uses a controlled clock and controlled in-flight promises. Real timers make the deadline arms
flaky and slow. The existing `AuditClock` SPI is the injection point.

### F6 — Idempotency has two halves and both need arms

`shutdown()` called twice must return the same accounting and must not double-count. And a shutdown called
*during* a shutdown must not start a second drain. Two arms, not one.

### F7 — Concurrent enqueue at the admission boundary is a race, exactly like #105's C4

An enqueue racing the shutdown transition must be either fully admitted or fully rejected, never
half-accounted. Same discipline as #105: no `await` between the state check and the accounting update.

---

## Task 0: The gate, and the contract to read first

- [ ] 0.1 **Confirm delivery implementation is authorized; confirm #104 and #105 are complete.** If not,
      stop.
- [ ] 0.2 **Read `compatibility.json.shutdownTimerOwnership` verbatim** and paste it into the design.
      Delivery shutdown extends it (F2).
- [ ] 0.3 Read `src/sink.ts`'s in-flight tracking and drain (F1).
- [ ] 0.4 Confirm #102 fixes the shutdown deadline semantics for `security_significant`.

## Task 1: Propose

- [ ] 1.1 Dedicated OpenSpec change.
- [ ] 1.2 Full assessment — `lifecycle_or_state` and `concurrency` fire.
- [ ] 1.3 The design states the accounting invariant (F3) as a requirement, not a note.

## Task 2: RED — eight arms, all on fake time

| Arm | Fixture | Expected |
| --- | --- | --- |
| D1 | empty queue | completes immediately; `accepted = completed = abandoned = 0` |
| D2 | queue drains before the deadline | all `completed`; `abandoned = 0` |
| D3 | deadline expires with work outstanding | remaining `abandoned`; **never** counted as delivered (F4) |
| D4 | `shutdown()` called twice | identical accounting; no double-count (F6) |
| D5 | `shutdown()` called during shutdown | no second drain (F6) |
| D6 | enqueue after shutdown starts | deterministic rejection |
| D7 | enqueue racing the transition | fully admitted or fully rejected, accounting sums (F7) |
| D8 | accounting invariant on every arm | `completed + abandoned === accepted` (F3) |
| N0 | **null control** — normal operation, no shutdown | no accounting emitted |

## Task 3: GREEN

- [ ] 3.1 Mirror the SDK's lifecycle states (F1).
- [ ] 3.2 Drain under the deadline using the injected clock (F5).
- [ ] 3.3 Cancel or mark remaining work exactly as #102 specifies; never as delivered (F4).
- [ ] 3.4 Idempotent, in both senses (F6).
- [ ] 3.5 **No signal handlers, no intervals** (F2).
- [ ] 3.6 Re-run all nine arms.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 4.2 A child-process test asserting the process **exits** after shutdown, with no retained handle —
      the only honest test for "does not retain exit".
- [ ] 4.3 Closing comment: the nine arms, the accounting invariant, and the statement that local
      completion cannot prove downstream durable storage.
- [ ] 4.4 Tick #106 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#106) | Arm |
| --- | --- |
| New submissions after shutdown starts receive the deterministic rejection | D6 |
| Empty or fully drained queue completes before the deadline | D1, D2 |
| Deadline expiry cancels/marks remaining work and returns accurate counts | D3, D8 |
| Repeated shutdown calls are idempotent | D4, D5 |
| Concurrent enqueue cannot be accepted after the boundary | D7 |

## Risks and open questions

- **Reporting abandoned work as delivered (F4)** is the security failure and it is silent.
- **Wiring signals (F2)** is the helpful-looking contract violation.
- **Real timers** make D3 flaky; use fake time (F5).
- **Open question:** what happens to work that is *retrying* when shutdown starts? "Drain or cancel
  according to the deadline **and retry rules**" is ambiguous — does an in-flight retry get its next
  attempt inside the deadline, or is the retry budget cut? #102 or this change's design must fix it;
  leaving it open produces two implementations that disagree.

## What this does not authorize

Process signal wiring, guaranteeing remote persistence after cancellation, extending deadlines
indefinitely, or any durable substrate.

## What this plan did not verify

Whether #102 fixes the retry-during-shutdown question (the open question above).
