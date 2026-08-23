# Issue #104 — Implement Bounded Delivery Retry Semantics — Plan

> **For Hermes:** Blocked on #103, which is blocked on #102, #87, and an authorization that has no issue
> (see #103's plan, F2). Same boundary applies: retry logic belongs to the delivery package, not to
> `security-audit-sdk-core`. The one thing worth fixing in advance is a vocabulary trap: the contract row
> says *"same event id on retry"*, and #103 introduces an **attempt** id. Retry preserves event identity
> and increments attempt identity. Conflating them produces a system that either dedupes nothing or
> dedupes everything.

**Goal:** Retries are deterministic under a fixed clock and randomness source, bounded by a configured
maximum, applied only to outcomes #102 classifies retryable, and terminate in an observable exhaustion
result.

**Status at this baseline:** DEFERRED — UNAUTHORIZED CAPABILITY. Blocked on #103.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #104, OPEN, labels `enhancement` `security-audit-sdk` `area:server` `needs-triage` |
| Declared dependency | #103 — blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Contract row | `security_significant.retry` — **"bounded retry with jitter and retry exhaustion alert"** |
| `best_effort.retry` | "none or bounded retry" |
| `transaction_critical.retry` | "persistent retry after commit" |
| `policy_critical.retry` | "policy-defined" |
| Identity rule | `security_significant.idempotency` — "same event id on retry; consumers dedupe" |
| Deterministic sources available | `AuditClock` and `AuditIdentifierProvider` in `src/providers.ts` — the existing SPI seed |
| Authorization | transports and their machinery are unauthorized; needs its own change and authorization |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The contract already fixes the policy shape; only the numbers are open

"Bounded retry with jitter and retry exhaustion alert" fixes three things: a bound exists, jitter exists,
and exhaustion is **alerted**, not merely returned. What is open is the maximum attempt count, the backoff
curve, and the jitter distribution. Those are configuration, and the decision belongs in #102's
conformance contract or in this change's design — not invented at the call site.

### F2 — Determinism requires injectable clock and randomness, and half of that already exists

`src/providers.ts` defines `AuditClock`. There is no randomness provider. #104's third acceptance criterion
("deterministic under a fixed clock/random source") therefore needs an SPI addition — which belongs to
#86's `PlatformProvider`, not to this change. **Check whether #86 included randomness; if it did not, this
issue needs it and should say so rather than adding a private one.**

### F3 — Jitter and determinism are in tension and the resolution is standard

Jitter must be random in production and fixed in tests. The provider gives both. The **test** asserts the
delay for a given seed; the **production** path asserts only the bound. Do not test the exact production
delay; test that it lies within `[base, base × factor]`.

### F4 — "Only retryable outcomes are retried" is a differential, not an assertion

#104's fourth criterion names the mutation: change a retryable outcome to permanent and the next attempt
must not happen. That needs a null control — the same fixture left retryable must attempt again. Two arms.

### F5 — Exhaustion must not look like success, and the contract says so twice

`security_significant.backpressure` is "alert before silent loss" and `retry` ends in an "exhaustion
alert". So the exhausted result carries an observable signal, not just a return value. #104's fifth
criterion asks for "observable counters". Counters must be bounded and must not carry payload — the SDK's
error and metric discipline.

### F6 — Retry preserves event identity, and that is what makes collector dedupe work

`idempotency: "same event id on retry; consumers dedupe"`. #108 (collector dedupe) depends on it. A retry
that mints a new event id silently defeats deduplication and turns at-least-once into
at-least-once-with-duplicates-forever. **Assert event-id stability across attempts explicitly.**

### F7 — Timing overflow is a named risk

#104's security note: attacker-controlled failures must not create unbounded attempts **or timing
overflow**. Exponential backoff with a large attempt count overflows or produces absurd delays. Cap the
computed delay, and test the cap at the maximum attempt count.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #103 is complete and delivery implementation is authorized.** If not, stop.
- [ ] 0.2 Confirm #102's contract fixes the attempt maximum, backoff curve and jitter distribution (F1).
      If it does not, that is a gap in #102 — raise it there, do not decide it here.
- [ ] 0.3 Confirm whether Core's `PlatformProvider` includes a randomness capability (F2).

## Task 1: Propose

- [ ] 1.1 Dedicated OpenSpec change.
- [ ] 1.2 Full assessment — `concurrency` and `lifecycle_or_state` fire.
- [ ] 1.3 The design fixes: maximum attempts, backoff formula, jitter distribution, the delay cap (F7),
      and the exhaustion signal's shape.

## Task 2: RED — seven arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| B1 | retryable outcome, attempts below the maximum | next attempt scheduled |
| B2 | **retryable mutated to permanent** | no next attempt (F4) |
| N1 | **null control** — B2's fixture left retryable | next attempt scheduled |
| B3 | attempts reach the configured maximum | `exhausted` + observable alert (F5) |
| B4 | fixed clock + fixed randomness | delay is exactly the expected value |
| B5 | production randomness | delay within `[base, base × factor]` (F3) |
| B6 | maximum attempt count | computed delay does not overflow and respects the cap (F7) |
| B7 | event id across all attempts | **identical** (F6) |

- [ ] 2.1 Confirm each arm's behaviour before implementation.
- [ ] 2.2 N1 must pass; if it fails, the harness is broken.

## Task 3: GREEN

- [ ] 3.1 Implement retry as a pure scheduler over `(outcome, attemptNumber, clock, random)` returning a
      decision. Pure means unit-testable with no transport.
- [ ] 3.2 Wire it to #103's result classes; retry **only** what #102 classifies retryable.
- [ ] 3.3 Preserve event identity; increment attempt identity (F6).
- [ ] 3.4 Emit the exhaustion alert with bounded counters (F5).
- [ ] 3.5 Re-run all eight arms.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 4.2 Closing comment: the eight arms, the configured bounds, and the statement that retry success
      proves handoff acknowledgment only — **not downstream storage**.
- [ ] 4.3 Tick #104 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#104) | Arm |
| --- | --- |
| Only retryable outcomes are retried | B2 + N1 |
| Attempts never exceed the configured maximum | B3, B6 |
| Delay deterministic under fixed clock/randomness, within bounds | B4, B5 |
| Mutating retryable → permanent prevents the next attempt | B2 |
| Exhaustion produces the terminal result and observable counters | B3 |

## Risks and open questions

- **Minting a new event id per attempt (F6)** silently breaks #108. Assert identity, do not assume it.
- **Adding a private randomness source** instead of extending the platform SPI (F2) creates a second
  source of truth and defeats Core neutrality.
- **Testing the exact production delay** makes the suite flaky. Test the bound (F3).
- **Open question:** does retry survive process restart? "Bounded retry" says nothing about durability, and
  `security_significant.durability` says "durable or protected bounded queue in later implementation".
  In-memory retry is the honest scope here; durability is #114/#115 and is unauthorized. State it.

## What this does not authorize

Queue capacity (#105), shutdown (#106), retrying validation failures or any non-retryable outcome, claiming
delivery after exhaustion, or any durable substrate.

## What this plan did not verify

Whether #102 fixes the retry numbers. If it does not, this change acquires a decision it should not own.
