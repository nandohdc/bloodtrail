# Issue #125 — Extend the Audit Contract for Bounded Client Evidence — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #123 and #76. This is the **second** issue that
> edits the frozen contract (the first is #95), and it carries the same corrected acceptance criteria: the
> sole authored source is `contracts/security-audit/source/contract.source.json` — there is no `v1/`
> directory and no authored YAML — and both `check-contract-immutability.mjs`'s pinned literals and
> `verification-lifecycle.json`'s `contracts/security-audit/` protected prefix must be handled in the same
> governed change. The distinctive constraint here is different from #95's: **client claims must never
> overwrite server-owned canonical fields**, and that is a structural property the schema should enforce
> rather than a rule the mapper remembers.

**Goal:** The approved bounded envelope linkage, correlation, provenance and trust metadata in the authored
contract; existing server-only fixtures still valid; a valid bounded client fixture passing; and client
overwrite, oversized evidence and unknown envelope versions all failing deterministically.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #123 and #76 (→ #75).

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #125, OPEN, labels `enhancement` `openspec-change-needed` `area:core` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #123, #76 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Correction (2026-08-10) | `INVALID_VERIFICATION` — the body named a non-existent `v1/security-audit.yaml`; corrected to the JSON source, and two gate criteria added |
| **Sole authored source** | `contracts/security-audit/source/contract.source.json` |
| Generated from it | `catalog/`, `registries/`, `policies/`, `schema/`, `docs/`, `adr/`, plus the SDK's `src/generated/` |
| Gate 1 | `check-contract-immutability.mjs` — **throws** unless `contractVersion` and `normativeTechnicalTarget` match pinned literals |
| Gate 2 | `check:generated` — byte-for-byte |
| Gate 3 | `test:changed-paths` — `contracts/security-audit/` is a protected prefix; writes **rejected outright** |
| Existing authority machinery | `authority_matrix.claimed_identity` already covers `source.client_reported.*` (PLAN-042, ALREADY_SATISFIED) |
| Existing trust pin | `provenance.trust_level` pinned by the generated schema to `downstream_enrichment` (S-1 outcome) |
| PLAN-024 | bounded transform output / `key_id` **cannot prove** an HMAC or keyed transform actually occurred |
| PLAN-062 | Mode A client origin is unverified and relayed by an authenticated producer |
| Bounds | event 65536 B, depth 8, strings 256 B, arrays 32 elements |
| Downstream | #126 declares #125 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The contract may already have the mechanism, and checking costs nothing

`authority_matrix.claimed_identity` already covers `source.client_reported.*`, recorded as ALREADY_SATISFIED
under PLAN-042. If #122 selected the "claim on an existing field" option, and if the envelope stays
independent per #123, then the contract extension needed here may be **a reference to an envelope, not a
set of client fields** — a single bounded linkage rather than a claim surface.

**That is the smallest possible version of this issue** and it should be evaluated before designing
anything larger. It also preserves PLAN-086's independence: the contract points at an envelope; it does not
absorb one.

### F2 — Overwrite protection should be structural, not procedural

"Client overwrite of server-owned risk/trust fields ... deterministically fail." The strongest form is a
schema in which client-supplied values simply **cannot appear** in server-owned fields — a separate
sub-object with its own field set, rather than shared field names distinguished by provenance. The S-1
precedent is exactly this technique: pinning `provenance.trust_level` in the generated schema made
escalation structurally impossible rather than validated-against.

### F3 — PLAN-024's non-claim must appear in the contract's own documentation

"Bounded transform output / `key_id` cannot prove an HMAC or keyed transform actually occurred." This is a
statement about what the contract's integrity fields do **not** mean, and #125's required work asks for it
explicitly. Put it in the contract's docs and its `integrity_claims`, where the existing eight claims
already carry `can_establish` / `cannot_establish` pairs — that structure exists for exactly this.

### F4 — Backward compatibility of existing fixtures is the acceptance criterion that catches over-reach

"Existing valid server-only fixtures remain valid under the approved compatibility policy." An additive
optional field satisfies it; a required field or a renamed field does not. Run the existing fixture set
unchanged as the first arm, before any new fixture.

### F5 — Bounds must be enforced at the linkage, not delegated

Even though the envelope has its own bounds (#123), the contract's reference to it must itself be bounded —
one envelope, bounded size, bounded count — or an attacker embeds many envelopes inside one event. #125's
"oversized evidence" criterion is about the *event*, not the envelope.

### F6 — Same three gates as #95, same throw-not-fail surprise

`check-contract-immutability.mjs` throws rather than failing cleanly; the protected prefix rejects the write
outright; `check:generated` byte-compares. Handle all three in the same change, and expect the first CI run
to look like a broken script if the literals were not updated.

### F7 — This is the second contract change, and the two must not collide

#95 (`derived_from`) and #125 both bump the contract version. If both land, the second inherits the first's
version. Sequence them explicitly; two changes each assuming they move `1.0.0` → `1.1.0` will conflict on
every pinned literal.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #123's envelope is final and #76's version policy is resolved.** If either is open,
      stop.
- [ ] 0.2 Confirm #121's authorization covers contract extension.
- [ ] 0.3 **Evaluate F1's minimal option first** — a bounded envelope reference rather than a client field
      surface.
- [ ] 0.4 Check whether #95 has landed and what contract version is current (F7).

## Task 1: Propose

- [ ] 1.1 Task group inside #120's change, or its own change if #120's is archived by then.
- [ ] 1.2 **Full assessment.** A Contract Reuse Assessment (#98–#101) may also be required — this is a
      textbook CRA case: extend an existing contract, with reuse of `claimed_identity` as the alternative.
- [ ] 1.3 The design states: the minimal option's evaluation (F1), the structural overwrite protection
      (F2), the PLAN-024 non-claim (F3), the linkage bounds (F5), and the version sequencing (F7).

## Task 2: Edit the source, regenerate, never the reverse

- [ ] 2.1 Edit `contract.source.json` only.
- [ ] 2.2 Bump the version per #76's policy.
- [ ] 2.3 Regenerate both pipelines.
- [ ] 2.4 Update `contract-provenance.json`, `check-contract-immutability.mjs`'s literals,
      `compatibility.json`, and `verification-lifecycle.json`'s protected prefix — **same change** (F6).

## Task 3: Fixtures — eight arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| Q1 | **existing server-only fixtures, unchanged** | all still valid (F4) |
| Q2 | valid bounded client evidence | passes |
| Q3 | client value in a server-owned risk field | **structurally impossible** or rejected (F2) |
| Q4 | client value in a server-owned trust field | same |
| Q5 | oversized embedded evidence / many envelopes | rejected (F5) |
| Q6 | unknown envelope version | rejected |
| Q7 | generated artifacts | drift-free |
| N0 | **null control** — unmodified contract | everything passes as before |

## Task 4: Verify, commit, PR, close

- [ ] 4.1 `npm run validate --prefix contracts/security-audit`; `check:generated` before the SDK's
      `validate`; both chains; `test:matrix` on both Node majors.
- [ ] 4.2 Index empty; governance verified after the commit (#191).
- [ ] 4.3 Closing comment: the eight arms, and the statement that contract representation cannot prove
      client authenticity, device integrity, or completeness.
- [ ] 4.4 Comment on #126, which declares #125.
- [ ] 4.5 Tick #125 in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#125) | Arm |
| --- | --- |
| Only the approved bounded client extension in the authored contract | Task 2.1, design review |
| Existing server-only fixtures remain valid | Q1 |
| Valid bounded client fixture passes | Q2 |
| Overwrite, oversized evidence, unknown version fail | Q3, Q4, Q5, Q6 |
| Generated artifacts drift-free; governance-gated | Q7, Task 4.1 |
| Provenance and immutability literals updated in the same change | Task 2.4 |
| Protected prefix updated, or the change records why not | Task 2.4 |

## Risks and open questions

- **Absorbing the envelope into the audit contract** contradicts PLAN-086 and couples two version lines.
- **Procedural overwrite protection** (F2) is one refactor away from being forgotten.
- **Colliding with #95's version bump** (F7).
- **Open question:** should client evidence be a *field* on the event or a *sibling record* referenced by
  id? A sibling keeps the event's bounds untouched and the envelope independent; a field is simpler to
  query. This is arguably the whole design and #125's body does not settle it.

## What this does not authorize

Embedding unbounded raw browser payloads, letting client claims overwrite server-owned canonical fields, or
implementing backend validation or SDK mapping.

## What this plan did not verify

Whether F1's minimal option is sufficient — that depends on #117's purpose and #122's correlation decision,
neither of which exists.
