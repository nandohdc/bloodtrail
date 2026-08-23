# Issue #95 — Add Material-Input Provenance for Derived Contract Fields — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #94 (semantics) and #76 (version policy, via
> #75). This is the issue that **edits the frozen contract**, and the contract is the product. Three gates
> will fight you and all three are supposed to: `check-contract-immutability.mjs` throws unless the pinned
> literals match, `check:generated` compares generated output byte-for-byte, and `test:changed-paths`
> rejects any write under `contracts/security-audit/` outright. The issue's own acceptance criteria
> already name two of them — a correction applied after an adversarial audit — so the path through is
> documented; it is just narrow. **Never hand-edit generated output. The fix is always in the generator.**

**Goal:** The approved `derived_from` provenance exists in the sole authored contract source, every
generated artifact is regenerated through the canonical generator and drift-free, and compatibility
fixtures cover valid, missing, malformed, duplicate, unknown and ordered input lists.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #94 and #76.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #95, OPEN, labels `enhancement` `openspec-change-needed` `area:core` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #94, #76 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| **Sole authored source** | `contracts/security-audit/source/contract.source.json` — **not** any YAML, and there is no `v1/` directory (corrected on the issue after an adversarial audit) |
| Generated from it | `catalog/`, `registries/`, `policies/`, `docs/`, `adr/`, `schema/` in `contracts/security-audit/`, plus `src/generated/` in the SDK |
| Generators | `contracts/security-audit/scripts/generate-artifacts.mjs`; `packages/security-audit-sdk-core/scripts/generate-contract.mjs` |
| Gate 1 | `check-contract-immutability.mjs` — **throws** unless `contractVersion` and `normativeTechnicalTarget` match pinned literals |
| Gate 2 | `check:generated` — byte-for-byte |
| Gate 3 | `test:changed-paths` — `contracts/security-audit/` is a `protectedPrefix` in `verification-lifecycle.json`; writes are **rejected outright** |
| Gate 4 | `check-coherence.mjs` — `provenance-version`, `provenance-target`, `compat-contract`, `generated-version`, `runtime-contract` |
| Provenance file | `packages/security-audit-sdk-core/contract-provenance.json` |
| Determinism rule | generators sort by **code point**, deliberately not `localeCompare` |
| Current contract | `1.0.0`, frozen; 24 events; bounds 65536 B / depth 8 / 256 B strings / 32-element arrays |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The protected prefix is not advisory; it blocks the write

`verification-lifecycle.json.contract.protectedPrefixes` contains `contracts/security-audit/`, and
`check-changed-paths.mjs` **rejects** writes to it. So this change cannot begin without updating that
metadata in the same change — which #95's own last acceptance criterion already demands, in the alternative
form "or the change records why `test:changed-paths` need not be modified".

`verification-lifecycle.json` is `governance_record_only`. Touching it together with a normative path makes
the commit **not** governance-record-only, per the policy's own `record_file_granularity` note. Budget for
the stricter class.

### F2 — The immutability gate throws rather than failing, and that is a different failure mode

`check-contract-immutability.mjs` **throws** unless the pinned literals match. A thrown gate produces a
stack trace, not a diagnostic — so a version bump without updating the literals looks like a broken script
rather than a policy rejection. Update `contract-provenance.json` and the checker's literals in the same
commit as the source edit, or the first CI run will be misread.

### F3 — A contract change forces a version increment, and #75 decides what that costs

Adding `derived_from` is additive, so `1.1.0` under normal semver. Under EXACT_ONE that makes it an SDK
**major** (generated type incompatibility). Under EXPLICIT_SET it may be an SDK minor. **This is why #95
declares #76.** The version treatment is an acceptance criterion, and its answer is not local.

### F4 — Regeneration touches two pipelines, not one

`contracts/security-audit/` regenerates its own catalog, registries, policies, docs, ADRs and schema; the
SDK regenerates `src/generated/contract.generated.ts` and `schema-validator.generated.cjs`. Both must be
run and both must be drift-free. Run `check:generated` **before** `validate` in the SDK, because `validate`
runs `generate` first and would mask committed drift.

### F5 — The fixture matrix is six-way and each one is a schema-level assertion

Valid, missing, malformed, duplicate, unknown, ordered. Under #94's recommended semantics: duplicates
**reject**, unknown references **reject**, ordering is canonical by code point. Each of the six is a
generated-validator assertion, testable without any SDK runtime.

### F6 — The contract ADRs are generated and must not be hand-written

`contracts/security-audit/adr/adr-001.md` … `adr-008.md` are produced by `generate-artifacts.mjs` from
`contract.source.json`'s `adrs` array. Recording a decision means adding to that array, not writing a file.
**A hand-written contract ADR is drift and `check:generated` will catch it** — which is the system working,
but it wastes a cycle.

### F7 — Bounds apply to the new structure

Strings 256 B, arrays 32 elements, depth 8, event 65536 B. A `derived_from` array is bounded at 32
entries and each reference at 256 B. Fixtures must include a bounds-violation arm, and the expected
behaviour is **reject, not truncate** — the same rule PLAN-049 states for the client envelope.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #94's semantics are recorded and #76 is resolved.** If either is open, stop.
- [ ] 0.2 Confirm the authored source path (F1's first row) is still
      `contracts/security-audit/source/contract.source.json` and no `v1/` YAML has appeared.
- [ ] 0.3 Read `verification-lifecycle.json`'s protected prefixes and plan the update (F1).
- [ ] 0.4 Read `check-contract-immutability.mjs`'s literals and `contract-provenance.json` (F2).

## Task 1: Propose

- [ ] 1.1 OpenSpec change `add-material-input-provenance`.
- [ ] 1.2 **Full assessment.** `canonical_capability_requirement` and `public_api` fire; a contract change
      is by definition the widest kind here.
- [ ] 1.3 The design records: the structure, the version increment and its SDK consequence (F3), the
      protected-prefix update (F1), the immutability-literal update (F2), and the six-way fixture matrix.
- [ ] 1.4 A **Contract Reuse Assessment** may be required by then (#98–#101). Check; this is the first
      real caller of that gate.

## Task 2: Edit the source, regenerate, never the other way round

- [ ] 2.1 Add the approved provenance structure to `contract.source.json` **only**.
- [ ] 2.2 Add the decision to the source's `adrs` array; do not write a contract ADR file (F6).
- [ ] 2.3 Bump `contractVersion` in the source per #75's policy.
- [ ] 2.4 Regenerate both pipelines (F4).
- [ ] 2.5 Update `contract-provenance.json`, `check-contract-immutability.mjs`'s literals,
      `compatibility.json`'s version fields, and `verification-lifecycle.json`'s protected prefix — **all
      in the same change**.

## Task 3: Fixtures

- [ ] 3.1 Canonical valid `derived_from` — passes generated validation.
- [ ] 3.2 Missing required provenance on a derived field — rejects.
- [ ] 3.3 Malformed structure — rejects.
- [ ] 3.4 Duplicate input reference — rejects (F5).
- [ ] 3.5 Unknown input reference — rejects.
- [ ] 3.6 Correctly ordered vs mis-ordered list — the canonical order is accepted; state whether
      mis-ordering rejects or is normalized (#94 decides; do not decide here).
- [ ] 3.7 Bounds violation — 33 entries, or a 257-byte reference — **rejects, does not truncate** (F7).
- [ ] 3.8 **Null control** — the unmodified contract still validates and all existing fixtures pass.

## Task 4: Verify, commit, PR

- [ ] 4.1 `npm run validate --prefix contracts/security-audit`
- [ ] 4.2 `npm run check:generated --prefix packages/security-audit-sdk-core` **before** `validate` (F4)
- [ ] 4.3 `npm run validate --prefix packages/security-audit-sdk-core`; `test:matrix` on both Node majors
- [ ] 4.4 `openspec validate --strict`; index empty; governance verified after the commit (#191)
- [ ] 4.5 Report readiness. **Do not merge.**

## Task 5: Hand off

- [ ] 5.1 Comment on #96 (enforcement) and #125 (client evidence, which declares the same gates).
- [ ] 5.2 Close #95; tick it in #132's Wave 3 checklist.

---

## Validation matrix

| Acceptance criterion (#95) | Arm |
| --- | --- |
| Authored contract represents the provenance without hand-editing generated artifacts | Task 2.1, 2.4 |
| Generated TS and validators match and pass drift checks | Task 4.2 |
| Canonical valid fixture passes | 3.1 |
| Malformed/invalid fixtures deterministically fail | 3.2–3.5, 3.7 |
| Compatibility/version metadata matches the approved policy | Task 2.5 |
| `contract-provenance.json` and immutability literals updated in the same change | Task 2.5 |
| Protected prefix updated, or the change records why not | Task 0.3 + 2.5 |

## Risks and open questions

- **Hand-editing a generated artifact** is the classic failure and `check:generated` catches it — after
  the cycle is wasted.
- **The immutability gate throwing (F2)** will be misread as a broken script on the first run.
- **This change unfreezes a frozen contract.** The freeze is the product's central claim. The change must
  say, in its proposal, what "frozen" means afterwards and what re-establishes it.
- **Open question:** does `derived_from` belong on every derived field, or only on server-derived ones?
  PLAN-043 says "derived-server fields". #94 must settle it; #95 must not.

## What this does not authorize

Inventing semantics that differ from #94's decision, implementing runtime trust-floor enforcement, or
adding browser evidence fields.

## What this plan did not verify

Whether the SDK's generated types tolerate an optional additive field without a breaking type change.
Measure it before choosing the version increment.
