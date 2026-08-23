# Issue #127 — Map Approved Client Claims Without Fabricating Server Evidence — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #126. This is the issue where attacker-
> controlled values cross into a server-owned record, and its governing obligations are unusually explicit
> about what **cannot** be guaranteed: PLAN-061 (client evidence cannot prove a real browser existed, or
> that the backend did not fabricate it) and PLAN-063 (keyed-transform truthfulness and client
> non-fabrication are **producer-conformance requirements, not mechanical guarantees**). Read those twice.
> A mapper that appears to guarantee either is misrepresenting the system.

**Goal:** Validated client claims mapped into the approved audit representation with provenance and trust
preserved, server-owned canonical fields never overwritten, ambiguity failing deterministically, and any
derived server field produced only through approved transforms and trust-floor rules.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #126.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #127, OPEN, labels `enhancement` `security-audit-sdk` `openspec-change-needed` `area:server` `needs-triage`; `P3_DEFERRED` |
| Declared dependency | #126 — blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| PLAN-003 | **reuse** existing trust, privacy-transform, integrity-claim, bounds and delivery mechanisms rather than duplicating them |
| PLAN-024 | bounded transform output / `key_id` cannot prove an HMAC or keyed transform occurred |
| PLAN-061 | client evidence cannot prove a real browser existed, or that the backend did not fabricate it |
| PLAN-063 | keyed-transform truthfulness and client non-fabrication are **producer-conformance requirements** |
| Existing trust machinery | `registries.trust_levels`; `authority_matrix.claimed_identity` covers `source.client_reported.*` |
| Existing transform machinery | `privacy_transformations`; transform SPI in `src/config.ts`; applied in `src/events.ts`; output re-validated |
| Existing trust pin | `provenance.trust_level` pinned to `downstream_enrichment` by the generated schema |
| Related deferred work | #94/#95/#96 — material-input provenance and trust floors |
| Downstream | #128 declares #127 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — PLAN-003 makes this a reuse exercise, and a Contract Reuse Assessment may be mandatory

"Reuse existing trust, privacy-transform, integrity-claim, bounds and delivery mechanisms instead of
duplicating them." Every mechanism this issue needs already exists: trust levels, the claimed-identity
authority row, privacy transformations, integrity claims with `can_establish`/`cannot_establish` pairs.

If #98–#101 landed, this is a **textbook CRA case** — and the CRA's misspelling arm (`registries.trust_levelz`)
was almost certainly written with this issue in mind. Check whether a CRA is required before designing.

### F2 — Trust promotion is the failure mode and it has three tempting routes

1. **Correlation matched, therefore trusted.** A correlation match links claims under defined rules; it
   proves nothing about origin. #122's decision says the value is not a credential.
2. **HMAC present, therefore trusted.** PLAN-024: a bounded transform output or `key_id` cannot prove the
   keyed transform actually occurred.
3. **Relaying producer authenticated, therefore trusted.** #107's own out-of-scope line: authenticated
   clients are not trustworthy evidence sources.

All three are explicitly excluded. **List them in the design as rejected routes**, so a reviewer can check
the implementation against a named list rather than reasoning from scratch.

### F3 — The trust-floor connection is real and its dependency is not declared

If a server field is derived partly from a client claim, its maximum trust is bounded by that claim's
trust — which is exactly #96's trust-floor function, and #94's semantics. #127's required work says
"derive any server fields only through approved transforms and derivation/trust-floor rules", but #127
declares **no dependency on #94/#95/#96**.

**That is a missing edge.** Either #127 derives no server fields (and should say so), or it depends on the
derived-field chain. Resolve it before implementation; report it on both issues.

### F4 — "Conflicting claims" needs a defined resolution or it becomes an accident

Two client claims that disagree, or a client claim disagreeing with a server observation. #127's third
criterion asks for "the approved deterministic outcome". The safe default is **fail closed** — reject the
mapping rather than pick a winner — because any picking rule is a rule an attacker can exploit by
supplying the losing value deliberately.

### F5 — The fabrication mutation is the acceptance evidence

#127's fourth criterion: a mutation that labels a client value as server-derived or higher-trust fails
deterministically. Under the S-1 pin (`provenance.trust_level` fixed by the generated schema) that may
already be structurally impossible — verify it, and if so, record that the arm passes because of the
schema rather than because of mapper logic. That is a stronger result and it should be stated as such.

### F6 — Absence of a correlation match is not evidence of anything

Same shape as PLAN-085's "absence has no security meaning". A missing or ambiguous correlation produces a
deterministic outcome (F4: fail closed), not a suspicion score.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #126 is complete** and #121's authorization covers mapping. If not, stop.
- [ ] 0.2 **Resolve F3**: does #127 derive server fields? If yes, it depends on #94/#95/#96 and that edge
      must be added to both issue bodies.
- [ ] 0.3 Check whether a Contract Reuse Assessment is required (F1).
- [ ] 0.4 Verify the S-1 trust pin still holds (F5).

## Task 1: Propose

- [ ] 1.1 Task group inside #120's change.
- [ ] 1.2 Full assessment — `security_sensitive_behavior` fires.
- [ ] 1.3 The design lists F2's three rejected promotion routes by name.
- [ ] 1.4 The design fixes the conflict resolution as **fail closed** (F4), or records the owner's
      alternative.

## Task 2: RED then GREEN — eight arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| S1 | canonical validated envelope mapped | every claim retains client provenance and trust |
| S2 | client value targeting a server-owned canonical risk field | **not overwritten** |
| S3 | correlation missing | deterministic outcome; **no suspicion signal** (F6) |
| S4 | correlation ambiguous (multiple matches) | deterministic outcome, fail closed (F4) |
| S5 | two client claims conflicting | fail closed (F4) |
| S6 | mutation labelling a client value **server-derived** | **fails** (F5) |
| S7 | mutation labelling a client value **higher-trust** | fails — ideally structurally (F5) |
| S8 | correlation match present | trust **unchanged** — a match is not a promotion (F2) |
| N0 | **null control** — S1 repeated | maps cleanly; no diagnostics |

## Task 3: Verify, commit, PR, close

- [ ] 3.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 3.2 Closing comment: the nine arms, the three rejected promotion routes, and the statement that
      correct mapping **does not prove** a correlated client claim is true or came from the intended
      device.
- [ ] 3.3 Comment on #128, which declares #127.
- [ ] 3.4 Tick #127 in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#127) | Arm |
| --- | --- |
| Every mapped claim retains approved client provenance and trust | S1, S8 |
| Canonical server-owned risk fields not overwritten by client values | S2 |
| Missing/ambiguous correlation and conflicting claims produce the approved deterministic outcome | S3, S4, S5 |
| A mutation labelling a client value server-derived or higher-trust fails | S6, S7 |
| NOT AUTHORIZED until all prerequisites complete | Task 0 |

## Risks and open questions

- **Trust promotion by correlation, HMAC, or producer authentication** (F2) — three named, all excluded.
- **The undeclared trust-floor dependency** (F3) is a real gap in the issue graph.
- **A conflict-resolution rule that picks a winner** (F4) is exploitable by supplying the loser.
- **Open question:** does mapping produce a *new* audit event, or annotate an existing one? #127 says "map
  validated client claims into the approved audit representation", which is ambiguous. Producing a new
  event makes client input an event source — a much larger claim than annotating a server-originated
  event. Settle it in the design; it changes the whole trust story.
