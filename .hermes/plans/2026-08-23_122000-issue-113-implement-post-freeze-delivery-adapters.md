# Issue #113 — Implement Post-Freeze Delivery Adapters — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #110, #111 and #102. This issue is unusual: its
> **first acceptance criterion is that every implemented adapter is named in an approved governed
> inventory**, and no such inventory exists. So the issue is not merely blocked on its dependencies — it is
> blocked on an artefact that nobody has been asked to create. That is the finding worth recording. Also
> note `adapter` and `exporter` are forbidden filename and export terms in `check-scope.mjs`, so even the
> vocabulary needs care.

**Goal:** Additional delivery adapters, each named in an approved inventory, each conforming to #102's
contract, each with adapter-specific failure evidence, and none leaking runtime dependencies into Core.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED, and blocked on a **non-existent governed
inventory**.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #113, OPEN, labels `enhancement` `security-audit-sdk` `openspec-change-needed` `area:server` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #110, #111, #102 — all blocked or open |
| Native GitHub blockers | `blocked_by` is `0` |
| **Missing prerequisite** | "an approved governed inventory" of adapters — **does not exist and has no issue** |
| Forbidden terms | `adapter`, `exporter`, `transport`, `collector` — filenames and exports |
| Authorization | delivery adapters are unauthorized; each needs its own change and authorization |
| Conformance instrument | #102's suite, reused — #113 must not define new semantics |
| Core neutrality gate | #88's per-package coupling policy |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The governed inventory does not exist, and that is a roadmap hole

#113's first criterion presupposes an artefact. No issue creates it, nothing in `openspec/` resembles it,
and PLAN-079 (its only traceability) says "after API freeze, implement remaining classes, additional
adapters, and a separately authorized non-production pilot" — the *authorization* is named for the pilot
(#116), not for the adapters.

**Record this on #113 and on #132.** Either an inventory issue should be filed, or #113's first criterion
should be rewritten to say the inventory is created as part of this change and approved by the owner.

### F2 — Without an inventory, this issue has no scope at all

"Implement only adapters explicitly authorized by a later governed inventory" plus "no unspecified
adapters" means the implementable set today is **empty**. That is not a defect in the issue; it is the
issue working as intended. Do not invent a candidate list to make it startable.

### F3 — The reusable conformance suite is what makes an adapter cheap, and it must exist first

Every adapter passes #102's suite. If #102's suite is not reusable across transports — if its scenarios
are entangled with HTTP — then each adapter costs a full test suite. **That is a design constraint on
#102**, and it is worth stating there while #102 is still being written: the suite must be transport-
agnostic and driven by a mapping table.

### F4 — "When an adapter cannot provide a guarantee, it must not claim it"

#113's out-of-scope line and its assurance limitation both say it. The mechanism: each adapter declares
which delivery classes it can serve, and routing an event to an adapter that cannot serve its class must
fail — the same substitution check #112's F4 describes, applied per adapter rather than per class.

### F5 — Runtime dependencies must stay out of Core, and #88 is the instrument

#113's fourth criterion. Not re-implemented here; referenced.

### F6 — Each adapter is its own trust boundary and its own authorization

"Each adapter introduces its own untrusted peer/input boundary and must document fail-open/fail-closed
behavior." Practically: one OpenSpec change per adapter, not one change for all of them. Say that in the
inventory when it is written.

---

## Task 0: The action available today

- [ ] 0.1 Post on #113 the F1 finding: the governed adapter inventory does not exist and has no issue.
      Ask the owner whether to file one or to fold inventory creation into #113.
- [ ] 0.2 Post the F3 constraint on **#102** while it is still being authored: the conformance suite must
      be transport-agnostic, or every future adapter pays for a bespoke suite.
- [ ] 0.3 Carry the AI-triage disclaimer. Keep `needs-triage`.

## Task 1: The gate

- [ ] 1.1 **Confirm #110 and #111 have landed** and #102 is folded.
- [ ] 1.2 **Confirm a governed adapter inventory exists and is approved.** If not, stop.
- [ ] 1.3 Confirm the specific adapter to be implemented is named in it. If none is named, there is
      nothing to implement (F2).

## Task 2: Per adapter — propose

- [ ] 2.1 **One OpenSpec change per adapter** (F6), not one for all.
- [ ] 2.2 Full assessment — `integration` and `security_sensitive_behavior` fire for every adapter.
- [ ] 2.3 The design is a mapping table: adapter-native outcome → #102 result class, plus a declaration of
      which delivery classes this adapter can serve (F4).

## Task 3: Per adapter — implement and prove

| Arm | Fixture | Expected |
| --- | --- | --- |
| K1 | conformance suite, all scenarios | passes for the declared classes |
| K2 | adapter-specific malformed response | maps to `protocol_error` or the approved class |
| K3 | adapter-specific timeout | maps to `retryable` |
| K4 | adapter-specific failure mode (its own) | maps to a declared class, deterministically |
| K5 | route an event whose class this adapter cannot serve | **fails** (F4) |
| K6 | Core neutrality | adding this adapter's runtime dependency to Core fails, via #88 (F5) |
| N0 | **null control** | happy path passes; no diagnostics |

- [ ] 3.1 All seven arms per adapter.
- [ ] 3.2 Document the adapter's assurance and operational limits — #113 requires it explicitly.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 4.2 Closing comment: the inventory entry, the seven arms, and the adapter's stated limits.
- [ ] 4.3 Close #113 only when every inventoried adapter is done, or record which remain.
- [ ] 4.4 Tick #113 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#113) | Arm |
| --- | --- |
| Every implemented adapter is named in an approved inventory | Task 1.3 |
| Each adapter passes the common conformance suite | K1 |
| Adapter-specific malformed/timeout/failure mutation fails or maps to the approved result | K2, K3, K4 |
| Adapter runtime dependencies stay outside Core | K6, via #88 |
| Implementation NOT AUTHORIZED until freezes and adapter authorization exist | Task 1 |

## Risks and open questions

- **The missing inventory (F1)** makes this issue unstartable in a way its body does not admit.
- **A transport-entangled conformance suite (F3)** turns every adapter into a bespoke project. The time to
  prevent that is while #102 is being written, not here.
- **Claiming a guarantee an adapter cannot provide (F4)** is the substantive security risk.
- **Open question for the owner:** is the intent that adapters are ever added at all, or was PLAN-079
  recording a possibility? If the answer is "no adapters are planned", #113 should be closed as
  `wontfix` with the reasoning recorded, rather than carried indefinitely.

## What this does not authorize

Changing common delivery semantics to fit an adapter, implementing unspecified adapters, or claiming
equivalent guarantees where an adapter cannot provide them.

## What this plan did not verify

Anything about a specific adapter, because none is named anywhere.
