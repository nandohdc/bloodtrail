# Issue #129 — Decide the Mode B Device-Trust Model — Decision Packet

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #128 and #119. This is the largest *new*
> commitment in the entire backlog: platform attestation brings verifier ownership, key lifecycle,
> nonce handling, a supported-platform matrix and a permanent dependency on vendor infrastructure. **NO-GO
> is an explicitly named outcome** in #129's own first acceptance criterion, and given everything upstream
> it deserves to be presented as the leading option, not the fallback. The prior owner decision already
> concluded that browser-controlled signals "do not establish identity, humanity, or truthful browser
> state" — attestation moves that boundary a little, and the decision must be precise about how little.

**Goal:** A recorded decision naming each supported attestation mechanism and platform, or explicitly
selecting NO-GO, with verifier ownership, nonce and replay handling, key lifecycle, fallback behaviour,
privacy impact and trust output all deterministic.

**Status at this baseline:** BLOCKED ON OWNER, behind #128 and #119.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #129, OPEN, labels `enhancement` `question` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #128, #119 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| PLAN-002 | keep **Mode A client claims separate from Mode B attested/device-trust claims** |
| PLAN-058 | defer Mode B producer-class / effective-trust-ceiling work behind a separate device-trust decision |
| Prior owner decision | 2026-07-31 — browser-controlled signals can be fabricated, suppressed, replayed or modified and do **not** establish identity, humanity, or truthful browser state |
| Existing trust registry | `registries.trust_levels`; `provenance.trust_level` pinned to `downstream_enrichment` by the generated schema (S-1) |
| Zero-dependency policy | the SDK has zero runtime dependencies; an attestation verifier would be the first vendor coupling in the product |
| Downstream | #130, #131 both declare #129 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Mode B is a different trust model, not a stronger Mode A, and PLAN-002 insists on the separation

"Keep Mode A client claims separate from Mode B attested/device-trust claims." So Mode B is not "Mode A
with better evidence" — it introduces a claim class with a different provenance and a different ceiling,
and the two must remain distinguishable end to end. A decision that quietly merges them breaks PLAN-002.

### F2 — Attestation proves a platform-defined statement and nothing about the claim's content

Even a valid, fresh, correctly-verified attestation says something like "this app binary, on this device,
in this OS state". It says nothing about whether the claim the app then sends is **true**. #129's own
assurance limitation states it. So the trust *output* of a successful attestation is bounded, and the
decision must name that bound explicitly rather than leaving "elevated" undefined.

### F3 — The S-1 pin means "elevated trust" may not be representable at all today

`provenance.trust_level` is pinned by the generated schema to `downstream_enrichment`. If Mode B's output
is to carry a higher trust level, the contract must gain one — a contract change with the whole
PLAN-022 apparatus (#95's gate list applies: immutability literals, protected prefix, regeneration,
version increment).

**That is a large, unscoped consequence** and it is not mentioned in #129. Surface it: choosing GO implies
a frozen-contract edit.

### F4 — Four failure states must all fail closed, and fallback is where they leak

Unavailable, invalid, stale, replayed. #129's third criterion: none may receive elevated trust. The leak is
**fallback**: an implementation that falls back to Mode A on attestation failure is correct only if the
fallback carries Mode A's trust, not the attempted Mode B trust. State the fallback's trust explicitly.

### F5 — Vendor coupling is permanent and contradicts a standing property

The SDK has **zero runtime dependencies** and three gates enforce it. An attestation verifier couples the
product to a platform vendor's service, key rotation schedule and availability. That is a structural change
to the product's character, not just a feature. It belongs in the decision as a cost.

### F6 — Privacy impact is not neutral

Device attestation produces device-scoped identifiers. The 2026-07-31 decision already flagged that
browser-derived identifiers may increase privacy and correlation risks. #129 declares #119 as a dependency
for exactly this reason, and a GO would likely require #119 to be **redone** for the new data class.

### F7 — NO-GO is cheap, clean and closes two issues

#130 and #131 both declare #129. A NO-GO closes #130 outright and reduces #131 to a Core-binding question
that no longer needs attestation. Given F3's contract consequence and F5's vendor coupling, NO-GO is a
defensible default rather than a failure.

---

## The decision, as the owner should see it

| | **NO-GO** (leading option) | **GO — named mechanisms** |
| --- | --- | --- |
| Contract change | none | likely required, to represent elevated trust (F3) |
| Runtime dependencies | stays zero | first vendor coupling (F5) |
| Privacy review | unchanged | #119 likely redone for device identifiers (F6) |
| Supported platforms | n/a | must be enumerated; expansion is a new decision each time |
| What is gained | nothing | a platform-defined statement about app/device state — **not** claim truth (F2) |
| Issues closed | #130 closed; #131 simplified | #130 and #131 both proceed, each with its own gates |

---

## Task 0: The gate

- [ ] 0.1 **Confirm #128 recorded GO and #119 approved.** If #128 is NO-GO, close #129 with that reasoning.
- [ ] 0.2 Confirm the S-1 trust pin still holds and record F3's consequence concretely.
- [ ] 0.3 Read the 2026-07-31 outcome's concerns paragraph — it is the prior art for what browser and
      device signals cannot establish.

## Task 1: Post the decision surface

- [ ] 1.1 Present NO-GO as the leading option with F7's reasoning.
- [ ] 1.2 Present the GO path with F3's contract consequence and F5's vendor coupling stated as costs.
- [ ] 1.3 State F2 precisely: attestation proves a platform statement, not claim truth.
- [ ] 1.4 Carry the AI-triage disclaimer. Move `needs-triage` → `ready-for-human`.

## Task 2: When the owner answers — record only

- [ ] 2.1 Record in the `final-project-owner-outcome.md` shape: each supported mechanism and platform, or
      an explicit NO-GO.
- [ ] 2.2 If GO: verifier ownership, nonce and replay handling, key lifecycle, fallback behaviour **and its
      trust** (F4), privacy impact, and the exact bounded trust output (F2).
- [ ] 2.3 If GO: record the contract consequence (F3) as a named prerequisite, not a footnote.
- [ ] 2.4 Record the assurance limitation: valid attestation proves only the platform-defined statement —
      not truthful evidence, not user identity, not uncompromised application logic.
- [ ] 2.5 If NO-GO: close #130; re-scope #131 to drop its #129 dependency.

## Task 3: Close

- [ ] 3.1 Close #129 naming the record; tick it in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#129) | Where satisfied |
| --- | --- |
| Names each supported mechanism/platform or explicitly selects NO-GO | record, Task 2.1 |
| Verifier, nonce, replay, key lifecycle, fallback, privacy, trust semantics deterministic | Task 2.2 |
| Unavailable, invalid, stale, replayed attestations cannot receive elevated trust | Task 2.2, F4 |
| Assurance limitations distinguish device/app attestation from user intent and claim truth | Task 2.4 |
| NOT AUTHORIZED pending separate owner/privacy approvals | throughout |

## Risks and open questions

- **Merging Mode A and Mode B** (F1) violates PLAN-002 and makes the trust story unreadable.
- **Undefined "elevated trust"** (F2) — the bound must be a value, not an adjective.
- **Fallback carrying the attempted trust** (F4) is the leak.
- **The unscoped contract consequence** (F3) — a GO implies editing a frozen contract.
- **Open question for the owner:** does this project have a use for a platform-defined device statement at
  all? If the purpose recorded in #117 is audit correlation, attestation adds device provenance to a
  correlation identifier — which may be more privacy cost than correlation benefit. Ask it directly.

## What this does not authorize

Implementing platform attestation, treating unavailable or failed attestation as verified, or expanding
supported platforms implicitly.

## What this plan did not verify

Whether any candidate attestation mechanism could produce a value representable in the current contract
(F3). Measure before choosing GO.
