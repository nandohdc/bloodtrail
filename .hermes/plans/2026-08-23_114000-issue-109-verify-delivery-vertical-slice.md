# Issue #109 — Verify the End-to-End Delivery Vertical Slice — Plan

> **For Hermes:** Blocked on #106 and #108 — the last two implementation issues in the delivery chain. This
> is the **evidence gate** that #110 and #111 (the two API freezes) consume, and #112, #113 and #116 sit
> behind those. So #109 is the hinge of the second half of the roadmap. Its own out-of-scope line is the
> discipline that makes it worth anything: **do not change implementation during verification.** If a
> failure injection produces the wrong result, that is a finding, not a bug to fix in the same pass. Freeze
> the commits first, then measure.

**Goal:** One producer-to-collector slice exercised against #102's conformance contract, with every
required failure injection producing its specified deterministic result, published as an evidence matrix
with residual limitations.

**Status at this baseline:** DEFERRED — blocked on #106, #108, and the whole unauthorized delivery chain.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #109, OPEN, labels `security-audit-sdk` `verification` `openspec-change-needed` `area:server` `needs-triage` |
| Declared dependencies | #106, #108 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Consumers of this evidence | #110, #111 (freezes) → #112, #113, #116 |
| Class under test | `security_significant` — PLAN-051: the only class exercising every claimed property |
| Governing plan obligations | PLAN-051, PLAN-064, PLAN-066 |
| Repository precedent for exact-commit evidence | the archived remediation packet, and `verification-lifecycle.json`'s `technicalCommit` / `governanceCommit` / `synchronizationCommit` / `mergeCommit` fields |
| Exactly-once | never claimed; `transaction_critical.durability` says "product not selected" |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — "Freeze the exact commits" has an established shape in this repository

`verification-lifecycle.json` records `technicalCommit`, `governanceCommit`, `synchronizationCommit` and
`mergeCommit` per change, and the archived remediation packet binds review to exact hashes. Reuse that
shape: the evidence names the exact commit of every participating package, plus the exact command lines.
**A review bound to a branch name is not bound to anything.**

### F2 — This is the repository's own recurring lesson, applied at scale

Two independent findings here: `cs delta` exited 0 for its entire life because a flag was missing, and a
probe's exit 1 was a harness artefact rather than detection. Both were caught by a **null control**. A
vertical-slice harness has many moving parts and correspondingly many ways to produce a green that means
nothing. Every injection arm needs its non-injected twin.

### F3 — The happy path is one arm out of nine, and the eight failures are the deliverable

#109 names seven injections: timeout, retry, overload, shutdown, invalid authentication, unsupported
version, duplicate. Plus the happy path, plus the null control. Each maps to a #102 result class:

| Injection | Expected class | Owner |
| --- | --- | --- |
| happy path | `acknowledged` | #103 |
| timeout | `retryable` → eventually `acknowledged` or `exhausted` | #103, #104 |
| retry exhaustion | `exhausted` + alert | #104 |
| overload | `rejected_overload`, never silent | #105 |
| shutdown at deadline | `abandoned`, never counted delivered | #106 |
| invalid authentication | rejected before acceptance | #107 |
| unsupported version | rejected, distinct from schema rejection | #107 |
| duplicate | duplicate outcome, no reprocessing | #108 |
| **null control** | happy path with no injection | `acknowledged`, no diagnostics |

### F4 — "No test claims exactly-once or durable storage without proof" is an assertion about the *evidence*, not the code

#109's fourth acceptance criterion is unusual: it constrains what the evidence document may say. Enforce it
by reviewing the matrix's language, and by stating positively what the slice does prove — handoff
acknowledgment for the tested topology, against fakes.

### F5 — Fakes are the topology, and that is a limitation to state, not to hide

The harness uses deterministic fakes for the network peer and an in-memory dedupe store. So the slice
proves the *implementation's* conformance, not any deployed system's behaviour. #109's own assurance
limitation says exactly this. It must appear in the matrix, not only in the issue.

### F6 — Independence is claimed and needs a mechanism

"Independently verify" — but the same agent that implemented #103–#108 would be verifying its own work. The
repository's precedent for this is #60 ("Obtain independent technical review of the merged remediation
candidate"), which was a separate issue with a separate actor. **The delivery chain has no equivalent.**
Raise it: either #109 is run by a different actor, or the word "independently" should come out of the
issue.

### F7 — Freezing the API is explicitly not this issue

#110 and #111 do that. #109 produces evidence; it does not freeze. Keeping them separate is what makes the
freeze reviewable.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #103–#108 are all complete and the delivery chain was authorized.** If any is open,
      stop.
- [ ] 0.2 Confirm #102's conformance contract is folded into the canonical spec — it is the scoring rubric.
- [ ] 0.3 Freeze: record the exact commit of every participating package and the exact package versions
      (F1). Nothing may move after this point.

## Task 1: The action available today

- [ ] 1.1 Post on #109 the F6 finding: "independently verify" has no mechanism in this chain, unlike #60
      in the remediation lifecycle. Ask whether a separate reviewer issue should be filed.
- [ ] 1.2 Carry the AI-triage disclaimer. Keep `needs-triage`.

## Task 2: Build the harness

- [ ] 2.1 Deterministic fakes: network peer, clock, randomness, dedupe store.
- [ ] 2.2 One injection switch per arm in F3's table, plus the null control.
- [ ] 2.3 The harness must be re-runnable from a clean clone with one command, and that command goes in
      the evidence.

## Task 3: Run the matrix

- [ ] 3.1 Run all nine arms (F3). Record the observed result class for each, verbatim.
- [ ] 3.2 **Do not fix anything.** A mismatch is a finding; record it and stop the arm (#109's own
      out-of-scope line).
- [ ] 3.3 Re-run the whole matrix three times. Any non-deterministic arm is a failure of the arm, not a
      flake to retry.

## Task 4: Publish the evidence

- [ ] 4.1 An evidence document naming: exact commits, exact versions, exact commands, the nine-row matrix
      with PASS/FAIL, and the residual limitations.
- [ ] 4.2 Review the document's language against F4 — no exactly-once or durability claim survives.
- [ ] 4.3 State F5's limitation explicitly: fakes, one topology, no deployed system.
- [ ] 4.4 The document lives in the OpenSpec change's evidence, not in a plan file.

## Task 5: Hand off

- [ ] 5.1 Comment on #110 and #111 with the evidence path and the exact commits they must bind to.
- [ ] 5.2 Comment on #112, #113, #116 that their upstream evidence exists but the freezes are still open.
- [ ] 5.3 Close #109; tick it in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#109) | Where satisfied |
| --- | --- |
| Exact reviewed commits and commands recorded | Task 0.3, 4.1 |
| Canonical happy path reaches the approved collector outcome | F3 row 1 |
| Each required failure injection produces the specified result | F3 rows 2–8 |
| No claim of exactly-once or durable storage without proof | Task 4.2 |
| Evidence matrix covers every conformance scenario with PASS/FAIL | Task 4.1 |

## Risks and open questions

- **Fixing during verification** invalidates the whole pass; the frozen commits stop matching the evidence.
- **A harness artefact producing a false green** (F2) — every arm needs its null twin.
- **Self-verification** (F6) weakens the word "independently" to nothing.
- **Open question:** does "every delivery conformance scenario" mean every scenario in #102's spec, or only
  those reachable by the `security_significant` slice? #102 will specify scenarios for all four classes;
  three of them have no implementation. Recommend: score only `security_significant`'s scenarios and record
  the other three as **not exercised**, rather than as PASS.

## What this does not authorize

Changing implementation, freezing any API, or authorizing production deployment.

## What this plan did not verify

Whether #102's scenario set is scoped per class. If it is not, the matrix's row count is undefined.
