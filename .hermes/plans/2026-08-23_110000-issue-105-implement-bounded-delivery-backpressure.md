# Issue #105 — Implement Bounded Delivery Backpressure — Plan

> **For Hermes:** Blocked on #102 and #87, plus the unauthorized-capability gate that covers all of
> Wave 4's implementation issues. One repository-specific asset is directly relevant and easy to miss:
> **`packages/security-audit-sdk-core/src/bounded-fifo.ts` already exists** — it is the single entry in
> `ownership.reviewedNewSdkSourcePaths`, meaning it was reviewed and admitted as new SDK source. A bounded
> FIFO is exactly the primitive this issue needs. Read it before designing a queue, and note that the word
> `queue` is a **forbidden filename and export term** in `check-scope.mjs`, which is why the existing file
> is called `bounded-fifo`.

**Goal:** Queue depth cannot exceed the configured capacity; an enqueue at capacity returns the approved
overload result deterministically; capacity recovers without counter drift; concurrent enqueues cannot
over-admit; rejection and saturation are observable without payload leakage.

**Status at this baseline:** DEFERRED — UNAUTHORIZED CAPABILITY. Blocked on #102, #87.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #105, OPEN, labels `enhancement` `security-audit-sdk` `area:server` `needs-triage` |
| Declared dependencies | #102 (startable), #87 (blocked) |
| Native GitHub blockers | `blocked_by` is `0` |
| **Existing primitive** | `packages/security-audit-sdk-core/src/bounded-fifo.ts` — the sole entry in `ownership.reviewedNewSdkSourcePaths` |
| Forbidden term | `queue` — a `check-scope.mjs` forbidden filename **and** forbidden export substring |
| Contract row | `security_significant.backpressure` — **"alert before silent loss"** |
| `best_effort.backpressure` | "drop with bounded counter and health signal" |
| `transaction_critical.backpressure` | "commit gate before durability point; backlog alert after commit" |
| `policy_critical.backpressure` | "policy-defined operator escalation" |
| Existing in-flight tracking | `src/sink.ts` — in-flight promises tracked so `shutdown()` can drain under a timeout |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The primitive exists and was already reviewed

`src/bounded-fifo.ts` is in `reviewedNewSdkSourcePaths`, which is the repository's record that a new SDK
source file was consciously admitted. Whatever it does, it is the starting point — and its **name** is the
evidence that the authorization boundary shapes vocabulary here: `queue` is forbidden, `bounded-fifo` is
not. Reuse the name discipline.

Read the file first. If it already provides capacity accounting and a full/rejection signal, this issue is
substantially smaller than it looks.

### F2 — The four classes want four different overload behaviours, and only one is in scope

`security_significant` alerts before silent loss; `best_effort` drops with a bounded counter;
`transaction_critical` gates the commit; `policy_critical` escalates per policy. #102 specifies
`security_significant` first, so **this issue implements alert-before-loss and nothing else**. #112
implements the others, and is deferred behind two API freezes.

Implementing all four now would be scope expansion into an explicitly deferred issue.

### F3 — "Cannot over-admit under concurrency" is the criterion that needs real concurrency

A capacity check followed by an insert is a check-then-act race unless the two are atomic. In single
-threaded JavaScript they are atomic **only if no `await` sits between them**. That is a code-review
invariant, and the test that catches its violation must launch many concurrent enqueues and assert the
admitted count equals the capacity exactly — not "at most".

### F4 — Counter drift is the subtle failure and it needs a long-running arm

Enqueue/dequeue cycles that leak a count are invisible at small N. Run a few thousand cycles and assert
depth returns to zero and capacity is fully available. This is the arm most likely to be skipped and the
one most likely to catch a real defect.

### F5 — Observability must not leak evidence content

#105's fifth criterion. Metrics are counts and class labels; never the rejected event's fields. The SDK's
existing discipline — bounded diagnostics, code/category/path only — applies to metrics too.

### F6 — Backpressure sits above the sink, not inside it

`src/sink.ts` is a bare `emit`/`flush?`/`shutdown?` interface with in-flight tracking. Capacity accounting
belongs to the delivery implementation behind a sink, not to the interface. Changing the sink interface
would change the SDK's public surface, which is a much larger change than this issue.

---

## Task 0: The gate, and the file to read first

- [ ] 0.1 **Confirm delivery implementation is authorized and #102 is complete.** If not, stop.
- [ ] 0.2 **Read `src/bounded-fifo.ts` in full** and record what it already provides: capacity, rejection
      signal, depth accounting, concurrency safety (F1).
- [ ] 0.3 Confirm #102 fixes the overload result's shape for `security_significant`. If not, raise it
      there.

## Task 1: Propose

- [ ] 1.1 Dedicated OpenSpec change.
- [ ] 1.2 Full assessment — `concurrency` fires unambiguously; `lifecycle_or_state` likely.
- [ ] 1.3 The design states: capacity semantics, the overload result, the metric set, and **explicitly**
      that only `security_significant`'s behaviour is implemented (F2).
- [ ] 1.4 Respect the naming discipline — no file or export containing `queue` (F1).

## Task 2: RED — seven arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| C1 | enqueue at capacity − 1 | admitted; depth = capacity − 1 |
| C2 | enqueue at capacity | **overload result**, deterministic |
| C3 | dequeue then enqueue | admitted; capacity recovered |
| C4 | N concurrent enqueues, N > capacity | admitted count **exactly** equals capacity (F3) |
| C5 | few thousand enqueue/dequeue cycles | depth returns to 0, no drift (F4) |
| C6 | rejection metric emitted | count and class only, **no payload** (F5) |
| N0 | **null control** — normal operation below capacity | no rejection, no saturation signal |

- [ ] 2.1 Confirm each arm before implementation. C4 and C5 are the load-bearing ones.

## Task 3: GREEN

- [ ] 3.1 Build on `bounded-fifo` rather than a new structure (F1).
- [ ] 3.2 No `await` between the capacity check and the insert (F3).
- [ ] 3.3 Emit depth, rejection and saturation metrics, bounded (F5).
- [ ] 3.4 Implement `security_significant`'s alert-before-loss only (F2).
- [ ] 3.5 Re-run all seven arms.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 4.2 If a new `src/` file appears, pre-declare its exact path in `reviewedNewSdkSourcePaths`.
- [ ] 4.3 Closing comment: the seven arms, and the statement that backpressure protects **this** process
      boundary and cannot make upstream callers respect overload signals.
- [ ] 4.4 Tick #105 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#105) | Arm |
| --- | --- |
| Depth cannot exceed capacity | C1, C2, C4 |
| Enqueue at capacity returns the approved overload result | C2 |
| Capacity recovers without counter drift | C3, C5 |
| Concurrent enqueues cannot over-admit | C4, asserting exact equality |
| Rejection and saturation metrics without raw content | C6 |

## Risks and open questions

- **Check-then-act across an `await`** (F3) is the defect this issue exists to prevent, and it is
  invisible in a single-enqueue test.
- **Implementing all four classes' overload behaviour** drifts into #112, which is deferred behind two API
  freezes.
- **Counter drift (F4)** needs a long arm that a reviewer may cut for speed.
- **Open question:** is the overload result synchronous or asynchronous? #105's required work says "the
  approved synchronous/asynchronous overload outcome", leaving it to #102. A synchronous rejection is far
  easier to reason about and to test; if #102 has not fixed it, push it back there.

## What this does not authorize

Transport retries (#104), shutdown draining (#106), auto-scaling, silently dropping accepted work, or
implementing any delivery class other than `security_significant`.

## What this plan did not verify

What `src/bounded-fifo.ts` currently provides (Task 0.2). That single read could halve or double this
issue's size.
