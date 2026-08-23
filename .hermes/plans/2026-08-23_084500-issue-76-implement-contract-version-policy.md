# Issue #76 — Implement the Approved sdk-core Contract-Version Policy — Plan

> **For Hermes:** Blocked on #75, which is an unanswered owner decision. **The shape of this issue depends
> entirely on that answer**, and the two shapes are not comparable: under EXACT_ONE this issue closes as
> already-implemented after a re-verification pass and writes no code; under EXPLICIT_SET it becomes the
> largest open piece of Wave 2, touching the generator, `src/generated/`, runtime validation and four
> gates. Do not start writing code under either assumption. Task 0 is a gate, and it is the whole
> discipline here.

**Goal:** Types, runtime, metadata and documentation all agree on the version policy selected in #75, with
positive fixtures passing and unknown versions failing deterministically before readiness.

**Status at this baseline:** BLOCKED ON #75 (owner decision, unanswered since 2026-08-16).

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #76, OPEN, labels `security-audit-sdk` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependency | #75 — **open, `ready-for-human`, unanswered** |
| Native GitHub blockers | `blocked_by` is `0` — nothing mechanically prevents a premature start |
| Enforcement layer 1 — metadata | `compatibility.json`: `contractVersion`, `supportedContractVersions`, `unsupportedContractVersions`, `contractVersionRange` |
| Enforcement layer 2 — generated | `src/generated/contract.generated.ts` — `export const CONTRACT_VERSION = "1.0.0"`, asserted by `check-coherence.mjs:183` |
| Enforcement layer 3 — runtime | `src/config.ts` — construction-time validation; unsupported values rejected before readiness |
| Enforcement layer 4 — built | `check-coherence.mjs:167` — `dist/index.js` `CONTRACT_VERSION` matches metadata |
| Immutability gate | `check-contract-immutability.mjs` — throws unless `contractVersion` and `normativeTechnicalTarget` match pinned literals |
| Coherence pin | `check-coherence.mjs:136` — `supportedContractVersions` must be exactly `["1.0.0"]` |
| Generated-types mode | `generatedTypes.compatibility: "exact-contract-projection"` |
| Type tests | `npm run test:types` — compile-only, positive **and negative** assertions, `tests/types/tsconfig.json` |
| Lifecycle mode | `archived`; new `src/` files need an entry in `ownership.reviewedNewSdkSourcePaths` |

---

## Proven findings

### F1 — Under EXACT_ONE this issue is already satisfied, four times over

Every one of #76's acceptance criteria maps to an existing, gated behaviour:

| #76 criterion | Already enforced by |
| --- | --- |
| Types accept exactly the approved set | `exact-contract-projection` + `check:generated` byte-for-byte |
| Runtime accepts approved, rejects unsupported | `src/config.ts` construction validation; `unsupportedContractVersions: ["0.9.0","2.0.0"]` |
| Metadata/docs match behaviour | `check-coherence.mjs` rules `compat-contract`, `provenance-version`, `docs-contract` |
| Positive fixtures pass, unknown versions fail deterministically | `test:types` positive/negative pairs + runtime construction tests |

So under EXACT_ONE the work is a **re-verification and evidence pass**, not an implementation: run each
gate, record each result against the ratified policy, and close with that evidence.

### F2 — Under EXPLICIT_SET the change starts in the generator, not the SDK

`src/generated/` is generated from `contracts/security-audit/source/contract.source.json` by
`scripts/generate-contract.mjs`, and `check:generated` compares byte-for-byte. **The fix is always in the
generator, never in its output.** Supporting two versions means the generator must emit either two type
sets or a union projection — a design decision that #75 does not make and #76 would have to.

If EXPLICIT_SET is selected, **stop and write a fresh plan**; this one is not adequate to it.

### F3 — Three pinned constants move under EXPLICIT_SET and none move under EXACT_ONE

`check-coherence.mjs:136` requires `supportedContractVersions` to be exactly one element. `check-
contract-immutability.mjs` pins `contractVersion` as a literal. `compatibility.json.contractVersionRange`
has `min === max`. Widening the set moves all three in one change — and `test:coherence` will reject a
partial move, which is the desired behaviour and also the thing that makes EXPLICIT_SET a single large
change rather than a sequence of small ones.

### F4 — There is a second contract version already named, and it is not a real one

`unsupportedContractVersions: ["0.9.0", "2.0.0"]` are **negative fixtures**, not versions that exist. Only
`1.0.0` exists, and the contract is frozen. Under EXPLICIT_SET there would be no second real version to
support — the set would be `["1.0.0"]` with machinery for a future member. Say that plainly: EXPLICIT_SET
today buys capability, not coverage.

### F5 — The collector half of the policy cannot be implemented here

PLAN-053 and PLAN-065 want the collector to validate an explicit set during migration. No collector
exists and building one is unauthorized. #76's scope is producer-side only; the collector half is #107.

---

## Task 0: The gate — do not skip

- [ ] 0.1 **Read #75's resolution.** If #75 is open, **stop.** Post a comment on #76 recording that it
      remains blocked, and work something else.
- [ ] 0.2 If EXACT_ONE: continue to Task 1.
- [ ] 0.3 If EXPLICIT_SET: **stop**, re-scope #76, and write a new plan covering the generator design.
      This plan's Task 1–3 do not apply.

## Task 1 (EXACT_ONE): Re-verify every layer against the ratified policy

- [ ] 1.1 `npm run check:generated --prefix packages/security-audit-sdk-core` — **before** `validate`.
- [ ] 1.2 `npm run test:compatibility` — record the range assertion output.
- [ ] 1.3 `npm run test:contract-immutability` — record that it binds `1.0.0` and the normative target.
- [ ] 1.4 `npm run test:coherence` — record `compat-contract`, `generated-version`, `runtime-contract`,
      `provenance-version`, `docs-contract`.
- [ ] 1.5 `npm run test:types` — record that the negative assertions reject a non-`1.0.0` literal.
- [ ] 1.6 Construct an SDK with an unsupported `contractVersion` in a disposable copy; record that it
      throws `SecurityAuditSdkError` at construction, **not** an `AuditResult` failure — configuration is
      the single exception to the results-not-exceptions rule.

## Task 2 (EXACT_ONE): Fill the only real gap — documentation

- [ ] 2.1 Confirm `API.md` / `MIGRATION.md` / `compatibility.json` state the policy in words, not only in
      pins. If they only state the *value* `1.0.0` and not the *policy* EXACT_ONE, that is the gap.
- [ ] 2.2 If a doc edit is needed, it rides in #75's ratification change (which already extends
      ADR-SDK-009), not in a separate cycle.

## Task 3 (EXACT_ONE): Close with evidence

- [ ] 3.1 Closing comment: a four-row table mapping each acceptance criterion to the gate that proves it,
      with the command output.
- [ ] 3.2 State explicitly that the collector half is #107 and is unauthorized (F5).
- [ ] 3.3 `gh issue close 76 --reason completed`; tick it in #132's Wave 2 checklist.
- [ ] 3.4 Comment on #83, #86, #95, #107, #125 — all declare #76 as a dependency — that it is resolved.

---

## Validation matrix (EXACT_ONE path)

| Acceptance criterion (#76) | Gate | Evidence |
| --- | --- | --- |
| Types accept exactly the approved set | `test:types`, `check:generated` | compile-only positive + negative |
| Runtime accepts approved, rejects unsupported | construction test | throws at construction |
| Metadata/docs match behaviour | `test:coherence` | five named rules |
| Positive fixtures pass, unknown versions fail deterministically | `test:types` + Task 1.6 | recorded output |

## Risks and open questions

- **Starting before #75 answers** is the dominant risk and nothing prevents it (`blocked_by` is `0`).
- **Closing #76 as already-implemented can look like avoidance.** It is not, if the closing comment carries
  the four-row evidence table. Without it, it is exactly that.
- **Open question inherited from #75:** whether a future contract minor forces an SDK major while the
  package is at `0.x`. If #75's ADR leaves it open, #76 inherits the ambiguity and should say so rather
  than resolving it unilaterally.

## What this does not authorize

Creating a contract version, unfreezing the contract, implementing collector policy, publishing, or
freezing any API.

## What this plan did not verify

Anything on the EXPLICIT_SET path, deliberately. That path needs its own plan and its own measurements.
