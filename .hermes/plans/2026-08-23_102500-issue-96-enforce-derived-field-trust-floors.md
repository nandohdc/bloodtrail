# Issue #96 — Enforce Approved Trust Floors for Derived Fields — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #95 (which is blocked on #94 and #76). This is
> the enforcement half of the derived-field work and it lands in the SDK's semantic kernel, not the
> contract. Read #94's F1 before starting: the S-1 outcome pinned `provenance.trust_level` to
> `downstream_enrichment` in the generated schema, so **the naive escalation is already impossible** and
> this control guards a narrower thing — a derived *value* whose assurance exceeds its inputs while its
> declared trust stays honest. If the change is written against the wrong threat, it will be a large
> amount of code guarding nothing.

**Goal:** Every authorized derivation path invokes one trust-floor implementation; a derivation at or below
the computed maximum passes; lowering any material input's trust makes an unchanged excessive output claim
fail; omitting a required input or referencing an unknown one fails.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #95.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #96, OPEN, labels `enhancement` `security-audit-sdk` `openspec-change-needed` `area:core` `needs-triage`; `P3_DEFERRED` |
| Declared dependency | #95 — blocked on #94, #76 |
| Native GitHub blockers | `blocked_by` is `0` |
| Semantic kernel | `packages/security-audit-sdk-core/src/validation/semantic.ts` — tenant-scope policy, causality, authority rules |
| Validation pipeline | normalize → prohibited-data scan → generated-Ajv structural → **semantic** → post-transformation rescan |
| Transform hooks | registered in `src/config.ts`, applied in `src/events.ts`, output re-validated |
| Post-transformation rescan | already exists — the natural place a derived value's trust would be re-checked |
| S-1 outcome | `provenance.trust_level` pinned to `downstream_enrichment` by the generated schema |
| Error discipline | `AuditResult<T>`; never throws across the boundary; errors bounded to code, category, path |
| New `src/` file rule | fails `test:changed-paths` unless pre-declared in `ownership.reviewedNewSdkSourcePaths` |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The enforcement point already exists and is named

The validation pipeline's **post-transformation rescan** re-validates after field-transformation hooks run.
That is precisely "the authorized derivation boundary" #96 asks to be covered — a transform hook is how a
derived value gets produced. Enforcement belongs there, in `src/validation/semantic.ts`, and it needs no
new pipeline stage.

**"All authorized derivation paths invoke the same approved trust-floor implementation"** is therefore
achievable by construction: there is one rescan, so there is one call site.

### F2 — There is exactly one derivation mechanism today, and that bounds the change

Field-transformation hooks are the only way a caller-supplied value becomes a different value inside the
SDK. If a second derivation mechanism is introduced later, #96's invariant breaks silently — so the change
should add a **test that asserts the call-site count**, not merely that the function is called.

### F3 — The floor needs data that #95 supplies and #94 defines

`derived_from` references (from #95), the trust ordering (from #94), and each transformation's authority
ceiling (from #94, if it exists at all — #94's Task 0.3 measures whether transformations carry authority
today; probably they do not). Without all three, this control cannot be written. That is the real
dependency, and it is stronger than "depends on #95".

### F4 — Incomparable trust levels must fail closed, and that will be discovered here if not decided in #94

`min` over a partial order is undefined for incomparable elements. If #94 did not decide it, #96 will hit
it on the first fixture pair that is incomparable. Push it back to #94 rather than deciding it in code.

### F5 — The mutation that matters is "lower one input, leave the claim"

#96's own verification step names it: lower a material input's trust while leaving the output claim
unchanged, and the emission must fail. That is a **differential**, and it needs a null control — the same
fixture with the input unchanged must pass. Two arms, not one.

### F6 — The assurance limitation is severe and must be repeated everywhere

"The gate proves consistency with declared material inputs; it cannot prove an omitted undeclared input
was not actually used." That is a producer-conformance obligation, not a mechanical guarantee — the same
class as PLAN-063's keyed-transform truthfulness. Put it in the ADR, the spec requirement, the API docs
and the closing comment. A control that is believed to prove more than it does is worse than none.

### F7 — Errors stay bounded

A trust-floor rejection must name the field path and a code — never the input values or the computed
trust of caller data. The SDK's error discipline is code, category, bounded path.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #95 has landed** and `derived_from` exists in the contract. If not, stop.
- [ ] 0.2 **Confirm #94 decided the trust ordering, the incomparability rule and transformation
      authority.** If any is open, push back rather than deciding in code (F3, F4).
- [ ] 0.3 Read `src/validation/semantic.ts` and the post-transformation rescan; confirm F1 still holds.
- [ ] 0.4 Count the derivation call sites (F2). If more than one exists by then, the invariant needs a
      different shape.

## Task 1: Propose

- [ ] 1.1 OpenSpec change `enforce-derived-field-trust-floors`.
- [ ] 1.2 Full assessment — `security_sensitive_behavior` fires unambiguously.
- [ ] 1.3 The design's first line is the threat, stated per #94's F1: not asserted escalation (already
      structurally impossible), but a derived value whose assurance exceeds its material inputs.
- [ ] 1.4 Spec delta on `security-audit-sdk-core`, one requirement with scenarios per #96 criterion.

## Task 2: RED — six arms, before any code

| Arm | Fixture | Expected |
| --- | --- | --- |
| A1 | derivation at exactly the computed maximum | pass |
| A2 | derivation below the maximum | pass |
| A3 | **one material input lowered, claim unchanged** | fail (F5) |
| A4 | required material input omitted | fail |
| A5 | unknown input referenced | fail |
| A6 | two incomparable input trust levels | fail closed (F4) |
| N0 | **null control** — A3's fixture with the input unchanged | pass |

- [ ] 2.1 Confirm A3–A6 currently pass (wrongly) and A1, A2, N0 pass.
- [ ] 2.2 If N0 fails, the harness is broken — fix it before reading any other arm.

## Task 3: GREEN

- [ ] 3.1 Implement the floor as a pure function over `(inputTrusts, transformationAuthority, ordering)`.
      Pure means unit-testable without an SDK instance; test it both ways.
- [ ] 3.2 Call it from the post-transformation rescan — one call site (F1).
- [ ] 3.3 Add the call-site-count assertion (F2).
- [ ] 3.4 Bounded diagnostics only (F7).
- [ ] 3.5 Re-run all seven arms.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 `check:generated` before `validate`; both chains; `test:matrix` on both Node majors.
- [ ] 4.2 Index empty; governance verified after the commit (#191).
- [ ] 4.3 If a new `src/` file is added, pre-declare its exact path in
      `ownership.reviewedNewSdkSourcePaths` in the same change.
- [ ] 4.4 Update `compatibility.json` — a new rejection is a behavioural tightening; classify it.
- [ ] 4.5 Closing comment: the seven arms **and** F6's limitation, verbatim.
- [ ] 4.6 Tick #96 in #132's Wave 3 checklist.

---

## Validation matrix

| Acceptance criterion (#96) | Arm |
| --- | --- |
| All authorized derivation paths invoke the same implementation | Task 3.3, call-site assertion |
| Valid derivation at or below the maximum passes | A1, A2 |
| Lowering a material input makes an excessive claim fail | A3 + N0 |
| Omitted or unknown input fails | A4, A5 |
| SDK/contract tests and strict OpenSpec validation pass | Task 4.1, 4.2 |

## Risks and open questions

- **Guarding the wrong threat** (F1 of #94) is the dominant risk and it is invisible until review.
- **Incomparable trust levels** will surface here if #94 skipped them (F4).
- **The limitation (F6) is easy to under-state.** A gate believed to prove input honesty is a liability.
- **Open question:** should a trust-floor violation be an `AuditResult` failure or a construction throw?
  The SDK's rule is results-not-exceptions with configuration as the sole exception — so a *runtime*
  derivation violation is a result. But a transform hook **configured** to exceed its ceiling is a
  configuration error and could throw at construction. Decide in the design; both are defensible and the
  second is stronger.

## What this does not authorize

Changing #94's materiality semantics, proving the underlying transformation correct, or enabling browser
or React Native evidence.

## What this plan did not verify

Whether transformations carry an authority ceiling today (#94's Task 0.3). If they do not, introducing one
is a contract addition and #95's scope grows to cover it.
