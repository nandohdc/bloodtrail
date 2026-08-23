# Issue #128 — Evaluate a Server-Issued Client-Claim Proof of Concept — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #127 and #118. This is Wave 5's evidence gate —
> the analogue of #109 in Wave 4 — and it is the last issue before the Mode B branch opens. Two disciplines
> carry over from #109 and matter more here because the inputs are adversarial: **do not change
> implementation during evaluation**, and **every arm gets a null control**. The distinctive constraint:
> the PoC runs on **approved synthetic or non-sensitive data only** and in an **isolated non-production
> harness** — the 2026-07-31 owner decision authorizes no real-user collection, and #128 does not change
> that.

**Goal:** The minimum approved Mode A flow exercised in isolation, measured against #118's criteria, with
replay, claim substitution, correlation collision and server-field fabrication attempted and recorded, and
a GO / NO-GO / REVISE recommendation stating what Mode A can and cannot prove.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #127 and #118.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #128, OPEN, labels `enhancement` `question` `openspec-change-needed` `area:server` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #127, #118 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Mode A definition | the **server** issues or derives the authoritative evidence; client input remains a bounded claim |
| PLAN-061 | client evidence cannot prove a real browser existed, or that the backend did not fabricate it |
| PLAN-063 | keyed-transform truthfulness and client non-fabrication are producer-conformance requirements |
| PLAN-085 | rejection is bounded producer-side counters, never audit evidence; absence has no security meaning |
| Prior owner decision | 2026-07-31 — real-user collection authorization: **none** |
| Data boundary | approved synthetic / non-sensitive only |
| Downstream | #129 declares #128 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Mode A's definition already answers most of the adversarial arms

If the **server** issues the authoritative evidence and the client supplies a bounded claim, then replay,
substitution and collision are all attacks against a *claim*, not against evidence. The claim's trust is
already the lowest available (#123's enum), so a successful substitution changes a low-trust claim into
another low-trust claim — which is not a security failure, it is the model working.

**The interesting failures are elsewhere:** a successful attack that *raises* trust, that overwrites a
server field, or that causes the server to fabricate evidence it did not observe. Design the arms around
those.

### F2 — "The backend did not fabricate it" is unprovable and must be stated, not tested

PLAN-061 says client evidence cannot prove a real browser existed **or that the backend did not fabricate
it**. The second half is a statement about the system's own trustworthiness that no test inside the system
can establish. The recommendation must say it plainly rather than implying the PoC covers it.

### F3 — The PoC must measure #118's criteria, and if #118's baseline was unmeasurable the PoC cannot conclude

#128's second criterion: "results cover every approved success and stop criterion". #118's plan flags that
the baseline — what server-side evidence achieves for the same purpose today — may be unmeasurable. If it
is, #128 can produce measurements but not a comparison, and therefore not a GO. **Check #118's baseline
before building the harness.**

### F4 — The harness is isolated and must be structurally unable to reach real data

Same discipline as #116's F5: assert it in the plan, make it true in the environment. An isolated harness
that *could* reach production data is one configuration mistake from doing so.

### F5 — Four attacks, and each needs its expected outcome fixed in advance

| Attack | What it tries | Expected under Mode A |
| --- | --- | --- |
| Replay | resubmit a captured claim | rejected if the nonce was server-issued (#123's F6); otherwise **undetectable** — report it |
| Claim substitution | swap one client's claim into another's request | correlation fails, or the claim maps at low trust; **must not raise trust** |
| Correlation collision | force two subjects onto one correlation value | deterministic outcome per #127's F4 (fail closed) |
| Server-field fabrication | make the server record a field it did not observe | **must fail** — #127's S6/S7 arms at system scale |

Fixing the expected outcome in advance is what makes a surprise a finding rather than a debate.

### F6 — A GO here opens the Mode B branch, which is a much larger commitment

#129 (Mode B device trust) declares #128. Mode B introduces platform attestation, verifier ownership, key
lifecycle and a supported-platform matrix. **A GO on Mode A is not a GO on Mode B** — #129 is its own
decision — but it is the door. Say so in the recommendation.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #127 is complete and #118's criteria exist**, including a measurable baseline (F3).
      If the baseline is unmeasurable, report that and stop — a PoC that cannot conclude is wasted work.
- [ ] 0.2 Confirm #121's authorization covers a non-production PoC with synthetic data.
- [ ] 0.3 Freeze the exact commits of every participating component, per #109's F1 discipline.

## Task 1: Build the isolated harness

- [ ] 1.1 Structurally unable to reach real user data (F4).
- [ ] 1.2 Approved synthetic data only; the data set is part of the evidence.
- [ ] 1.3 One switch per arm in F5's table, plus the happy path, plus a **null control**.

## Task 2: Measure

- [ ] 2.1 Run every #118 success metric and every stop criterion (F3).
- [ ] 2.2 Run the four attacks with their pre-fixed expected outcomes (F5).
- [ ] 2.3 Run the null control. **If it fails, the harness is broken** — fix the harness, not the system.
- [ ] 2.4 **Do not change implementation.** A mismatch is a finding (#128 inherits #109's rule).
- [ ] 2.5 Re-run three times; any non-deterministic arm is a failed arm, not a flake.

## Task 3: Recommend

- [ ] 3.1 Record GO / NO-GO / REVISE with the measurements.
- [ ] 3.2 State what Mode A **can** prove: the claim's structural validity, its correlation under defined
      rules, and its preserved low trust.
- [ ] 3.3 State what it **cannot** prove: that a real browser existed; that the backend did not fabricate
      the evidence (F2); that any claim is true.
- [ ] 3.4 State that a GO opens #129 as a *decision*, not as an authorization (F6).
- [ ] 3.5 No publication, no deployment.

## Task 4: Close

- [ ] 4.1 Close #128 with the evidence path; tick it in #132's Wave 5 checklist.
- [ ] 4.2 Comment on #129 with the outcome.

---

## Validation matrix

| Acceptance criterion (#128) | Where satisfied |
| --- | --- |
| Uses only approved synthetic/non-sensitive data and exact governed fields | Task 1.1, 1.2 |
| Results cover every approved success and stop criterion | Task 2.1 |
| Replay, substitution, collision and fabrication have deterministic recorded outcomes | Task 2.2, F5 |
| Recommendation states what Mode A can and cannot prove | Task 3.2, 3.3 |
| Records future work only; NOT AUTHORIZED | throughout |

## Risks and open questions

- **An unmeasurable baseline** (F3) makes the PoC unable to conclude, and that is discovered late unless
  checked first.
- **Fixing during evaluation** (Task 2.4) invalidates the frozen commits.
- **A harness that could reach real data** (F4).
- **Reading a Mode A GO as a Mode B GO** (F6).
- **Open question:** who evaluates? #109's plan flags the same problem — "independently verify" with no
  mechanism. If the implementer evaluates their own work, say so in the evidence rather than implying
  independence.

## What this does not authorize

Production deployment, treating the client claim as authoritative, implementing Mode B device trust, or
any real-user collection.

## What this plan did not verify

Whether #118's baseline is measurable — the single fact that decides whether this PoC can produce a
conclusion.
