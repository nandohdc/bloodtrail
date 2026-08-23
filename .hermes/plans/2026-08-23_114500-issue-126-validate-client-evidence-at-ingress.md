# Issue #126 — Validate Client Evidence at Backend Ingress — Plan

> **For Hermes:** `severity:high`, `P3_DEFERRED`, NOT AUTHORIZED, blocked on #125 and #107 — and #107 is
> itself behind the unauthorized-collector gate. This is where fully attacker-controlled data first meets
> the server, so it is the highest-consequence implementation issue in Wave 5. Its governing obligation,
> PLAN-074, is the one this repository enforces hardest: **every enforcement gate must demonstrate a
> passing fixture and a deterministic failing mutation.** PLAN-085 adds an unusual and important rule:
> client-evidence rejection is recorded as **bounded producer-side counters, never as audit evidence**, and
> **absence has no security meaning**.

**Goal:** Envelope version, structure, bounds, correlation, allowed claims, provenance and replay inputs all
validated before mapping; client claims preserved at their approved trust level; server-field fabrication
prevented; rejection counters emitted by stable class without payloads.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #125 and #107.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #126, OPEN, labels `enhancement` `severity:high` `openspec-change-needed` `area:device`/`area:server` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #125, #107 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| PLAN-050 | validate at ingress and **preserve unverified-client provenance** |
| PLAN-074 | passing fixture + deterministic failing mutation, for every gate |
| **PLAN-085** | rejection is **bounded producer-side counters, never audit evidence**; **absence has no security meaning** |
| Existing prohibited-data scan | `src/validation/prohibited.ts` — producer-side precedent |
| Existing validation pipeline | normalize → prohibited scan → generated-Ajv structural → semantic → post-transformation rescan |
| Envelope validation | #123's generated validator |
| Error discipline | code, category, bounded path; never caller data |
| Downstream | #127 declares #126 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — PLAN-085's rule is the one that will be broken by accident, and it is counter-intuitive

A rejected client envelope is **not** an audit event. Emitting a "client evidence rejected" audit event
would let an attacker write to the audit log by sending malformed data — a log-injection primitive. So
rejection produces a **counter**, in the producer's own metrics, and nothing else.

The second half is subtler: **absence has no security meaning.** A request without client evidence must not
be treated as suspicious, because an attacker simply omits it. Any downstream logic that scores absence
turns a bounded claim into a signal it cannot support.

Both halves belong in the spec text and in the closing comment.

### F2 — The validation order is the security property and it must be instrumented

Version → structure → bounds → correlation → allowed claims → provenance → replay → **then** mapping.
Each stage fails closed. The ordering assertion must be measured (instrument the mapper and prove it was
never reached), not inferred from reading the code — the same discipline #107's authentication-before-parse
arm needs.

### F3 — Reuse #123's generated validator; do not write a second one

The envelope has a generated validator. Ingress runs **that artifact**, so client and server cannot
disagree about validity. A hand-written ingress check is how the two sides drift, and drift here means
accepting something the envelope's own schema rejects.

### F4 — "Preserve unverified-client provenance" is easiest if the schema makes escalation impossible

#123's F4 recommends a trust enum with no high value. If that landed, #126's "preserve at approved trust"
is satisfied structurally: there is no representable higher value. Verify it did; if it did not, this
issue must enforce procedurally, which is weaker.

### F5 — Server-field fabrication is the mutation that matters most

#126's third criterion: a client attempt to assert or overwrite server-owned risk or trust fields fails
deterministically. If #125 made that structurally impossible (its F2), this arm proves the structure holds
end to end. If #125 did not, this is the last line of defence.

### F6 — Replay validation needs a server-issued nonce or it is theatre

#123's F6 flags the same thing: a client-generated nonce proves nothing. Ingress can only detect replay if
the nonce was server-issued, or if it maintains seen-nonce state — which is a store, and stores are
governed by #114. **Check which mechanism #123 specified**; if neither, replay validation cannot be
implemented and that must be reported rather than faked.

### F7 — Counters must be bounded and must not become a side channel

Counters labelled by tenant, by correlation id, or by claim value leak exactly what the payload would.
Label by **stable rejection class only**. #126's fourth criterion.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #125 landed, #107 is complete, and #121's authorization covers backend ingress.** If
      any is open, stop.
- [ ] 0.2 Confirm #123's trust enum forbids escalation (F4) and which replay mechanism it specified (F6).
- [ ] 0.3 Read #119's prohibited-data list — it defines "forbidden claim".

## Task 1: Propose

- [ ] 1.1 Task group inside #120's change.
- [ ] 1.2 Full assessment — `security_sensitive_behavior` and `integration` fire; `severity:high`.
- [ ] 1.3 The design states PLAN-085's two rules as requirements (F1), the validation order (F2), and the
      replay mechanism's dependency (F6).

## Task 2: RED then GREEN — ten arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| R1 | canonical approved envelope | **accepted for mapping** |
| R2 | unknown envelope version | rejected, fail closed |
| R3 | malformed provenance | rejected |
| R4 | oversized claim | rejected |
| R5 | prohibited field present | rejected |
| R6 | replay-input mutation | rejected (F6) |
| R7 | client value asserting a server-owned risk field | rejected (F5) |
| R8 | client value asserting a server-owned trust field | rejected |
| R9 | rejection counters inspected | **class label only**, no payload, no identifier (F7) |
| R10 | **rejection emits an audit event?** | **it must not** (F1) |
| R11 | request with **no** client evidence | processed normally; **no security meaning** (F1) |
| N0 | **null control** — R1 repeated | accepted; no rejection counter incremented |

- [ ] 2.1 R10 and R11 are the PLAN-085 arms and are the ones most likely to be omitted.
- [ ] 2.2 R1's ordering: instrument the mapper and prove R2–R8 never reach it (F2).

## Task 3: Verify, commit, PR, close

- [ ] 3.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 3.2 Closing comment: the twelve arms, and the statement that ingress validation proves **structural
      policy compliance**, not genuine client execution or truthful claims.
- [ ] 3.3 Comment on #127, which declares #126.
- [ ] 3.4 Tick #126 in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#126) | Arm |
| --- | --- |
| Canonical approved envelope accepted for mapping | R1 |
| Unknown version, malformed provenance, oversized claim, prohibited field, replay mutation fail | R2–R6 |
| Client attempt to assert or overwrite server-owned fields fails | R7, R8 |
| Rejection counters distinguish stable classes without raw payloads or identifiers | R9 |
| NOT AUTHORIZED until governed client and backend prerequisites complete | Task 0 |

## Risks and open questions

- **Emitting an audit event on rejection** (F1, R10) hands an attacker a write primitive into the audit log.
- **Treating absence as suspicious** (F1, R11) is a signal the data cannot support.
- **Unenforceable replay validation** (F6) that looks implemented.
- **A second, hand-written validator** (F3) that drifts from the envelope's schema.
- **Open question:** where do the producer-side counters live, and who reads them? PLAN-085 says
  producer-side, but the ingress is server-side — so "producer" here means the relaying producer, not the
  browser. Confirm that reading before implementing, because the alternative reading puts counters in the
  browser where nobody can see them.

## What this does not authorize

Mapping accepted claims into canonical server fields (#127), proving client authenticity, or storing or
deploying client evidence.

## What this plan did not verify

Which replay mechanism #123 specified (F6) — without a server-issued nonce or a seen-nonce store, R6 cannot
be implemented.
