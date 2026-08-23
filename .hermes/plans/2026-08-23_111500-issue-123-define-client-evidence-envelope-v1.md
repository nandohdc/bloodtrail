# Issue #123 — Define ClientEvidenceEnvelope v1 — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #122. This is the artefact **both** Wave 5
> branches share — #124 (browser) treats it as the sole contract surface, #131 (React Native) uses it
> alongside Core semantics — so its independence is load-bearing: PLAN-086 requires the envelope to be
> **independent of the audit event, Core and delivery contract boundaries**. Two rules that come straight
> from the plan and must not be softened: the envelope is **closed** and **versioned**, and on a bounds
> violation it **rejects rather than truncates**. Truncation is how attacker-controlled input silently
> becomes valid input.

**Goal:** A versioned, closed envelope schema with an explicit v1 discriminator, bounded collections and
strings, approved low-assurance provenance on every claim, generated through the canonical workflows, with
positive and negative fixtures.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #122 → #121 → #120 → #119 → #118 → #117.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #123, OPEN, labels `enhancement` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependency | #122 — blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| PLAN-049 | separate, **closed**, versioned envelope **below event bounds**; **reject rather than truncate** |
| PLAN-061 | client evidence cannot prove a real browser existed, or that the backend did not fabricate it |
| PLAN-062 | Mode A client origin is **unverified and relayed by an authenticated producer** |
| PLAN-086 | envelope independent of the audit event / Core / delivery contract boundaries |
| Audit event bounds | event 65536 B, depth 8, strings 256 B, arrays 32 elements — the envelope must be **below** these |
| Existing closed-schema dialect | `openspec/governance/schemas/*.schema.json` — `closed: true`, `version`, `supported_versions`, `fields`, `rules` |
| Existing trust registry | `registries.trust_levels`; `authority_matrix.claimed_identity` covers `source.client_reported.*` |
| Contract generation | `contracts/security-audit/source/contract.source.json` → generators; `check:generated` byte-compares |
| Downstream | #124, #125, #131 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — "Independent of the audit event contract" decides where the envelope lives

PLAN-086 is explicit, and #124's 2026-08-10 correction reinforced it by removing the Core dependency. So
the envelope is **not** a section of `contract.source.json` — it is its own authored source with its own
generation, its own version line, and its own immutability story.

That is a significant structural consequence and it should be stated first in the design: putting the
envelope inside the audit contract would couple the two version lines and contradict the plan obligation
this issue cites.

### F2 — "Below event bounds" is a numeric requirement, not a posture

The audit event allows 65536 B, depth 8, 256 B strings, 32-element arrays. The envelope must be **below**
those. Pick concrete numbers and justify each: a client envelope carrying a handful of claims has no
business approaching a 64 KB event. Smaller bounds are the primary defence against an attacker-controlled
payload, and they are free.

### F3 — Reject-not-truncate is a schema behaviour and needs its own arm

Truncation turns an over-bounds payload into a valid one, discarding exactly the part an attacker would
want discarded. The fixture: a 33-element array and an over-length string, each **rejected** with a
diagnostic naming the bound — not silently shortened.

### F4 — Every claim is low-assurance by construction, and the schema should make it impossible to say otherwise

PLAN-062: Mode A client origin is unverified and relayed by an authenticated producer. So the provenance
field's value set should not *contain* a high-trust option. A schema whose trust enum admits only
client-reported values makes escalation structurally impossible — the same technique the S-1 withdrawal
used server-side, where `provenance.trust_level` is pinned by the generated schema.

**Reuse that technique.** It is the strongest available control and it costs one enum.

### F5 — Unknown-version behaviour must fail closed, and the governance schemas already show the shape

`schema_compatibility.unknown_newer` is `"unknown-new-version"` and `unsupported_older` is
`"unsupported-old-version"`. An envelope with an unknown version discriminator must be rejected, not
best-effort parsed. #123's fourth criterion names it.

### F6 — Replay inputs are named but not specified, and that is a decision this issue must take

"nonce/replay inputs" appears in #123's required work. A nonce that the client generates is not a replay
defence — the server must have issued it, or must be able to detect reuse. That connects to #122's
generation-authority decision (server-issued recommended) and to #126's ingress validation. **Specify the
nonce's issuance authority here**, or #126 inherits an unenforceable field.

### F7 — Extension rules need a closed answer

The audit contract has four extension namespaces. The envelope should either have **none** — simplest, and
consistent with "bounded" — or exactly one with the same registration discipline. Recommend none for v1;
an unbounded extension surface on attacker-controlled input is a poor trade for flexibility nobody has
asked for.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #122 selected the correlation semantic** and #121's authorization covers envelope work.
      If not, stop.
- [ ] 0.2 Read #117's minimum-necessary-data statement — it caps the claim set.
- [ ] 0.3 Read #119's prohibited data and minimization controls — they cap it further.

## Task 1: Propose

- [ ] 1.1 Dedicated task group inside #120's change (not a new change).
- [ ] 1.2 The design states F1 first: the envelope is its own authored source, independent of the audit
      contract.
- [ ] 1.3 Fix concrete bounds, below event bounds, with a justification per number (F2).
- [ ] 1.4 Fix the trust enum so escalation is structurally impossible (F4).
- [ ] 1.5 Specify the nonce's issuance authority (F6).
- [ ] 1.6 Extensions: none in v1 (F7), stated as a decision.

## Task 2: RED then GREEN — eight fixtures

| Arm | Fixture | Expected |
| --- | --- | --- |
| M1 | canonical valid envelope | passes generated validation |
| M2 | unknown version discriminator | **rejected**, fail closed (F5) |
| M3 | 33-element collection | **rejected**, not truncated (F3) |
| M4 | over-length string | **rejected**, not truncated (F3) |
| M5 | malformed provenance | rejected |
| M6 | forbidden claim (from #119's list) | rejected |
| M7 | claim asserting a trust level above client-reported | **structurally impossible** — the enum has no such value (F4) |
| M8 | missing nonce or a nonce the server did not issue | rejected (F6) |
| N0 | **null control** — M1 repeated | passes; no diagnostics |

## Task 3: Generate and verify

- [ ] 3.1 Generate all artifacts through the canonical workflow. **Never hand-edit generated output.**
- [ ] 3.2 `check:generated`-equivalent drift check for the envelope's own pipeline.
- [ ] 3.3 Both `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 3.4 Confirm the audit contract's `contractVersion` and `normativeTechnicalTarget` are **unchanged** —
      the envelope's independence means the audit contract does not move (F1).

## Task 4: Hand off

- [ ] 4.1 Comment on #124, #125 and #131 with the envelope's version and path.
- [ ] 4.2 Close #123; tick it in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#123) | Arm |
| --- | --- |
| Explicit v1 discriminator; bounded collections and strings | schema + M3, M4 |
| Every claim carries or inherits the approved provenance/trust representation | F4's enum + M7 |
| Canonical envelope passes generated validation | M1 |
| Unknown version, oversized collection, malformed provenance, forbidden claim fail | M2, M3, M5, M6 |
| Generated artifacts drift-free; NOT AUTHORIZED until prerequisites complete | Task 3.1, 3.2 |

## Risks and open questions

- **Placing the envelope inside the audit contract** (F1) couples two version lines and contradicts
  PLAN-086.
- **Truncation instead of rejection** (F3) silently sanitizes attacker input.
- **A trust enum that admits a high value** (F4) leaves escalation possible in the schema.
- **A client-generated nonce** (F6) is not a replay defence.
- **Open question:** does the envelope need its own immutability gate, mirroring
  `check-contract-immutability.mjs`? Independence implies yes, eventually. Recommend deciding it here and
  deferring implementation, rather than discovering it when v2 is proposed.

## What this does not authorize

Implementing browser collection or backend acceptance, adding claims beyond the approved inventory, or
claiming client authenticity.

## What this plan did not verify

#117's minimum-data statement and #119's prohibited-data list, because neither exists — and together they
determine the entire claim set.
