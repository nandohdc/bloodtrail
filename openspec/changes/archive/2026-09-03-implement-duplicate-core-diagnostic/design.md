## Context

See `proposal.md` for motivation and the delta specification for the normative behavior. Repository evidence, verified read-only on 2026-09-03 against `origin/main` `8224850258514b64ef52ce22f29aa69701ceda51`: `DUPLICATE_AUTHORITY` is already a reserved member of the frozen contract's `validation_error_codes` (`src/generated/contract.generated.ts:458`) and is referenced nowhere in `src/` outside that generated list. `brandRegistry` is a module-level identity-keyed `WeakMap` at `src/context.ts:50`; `isBranded()` is a lookup in that map, so a value branded by a different installed copy and a forged value are both simply absent — indistinguishable at the rejection sites. The brand-miss rejection sites are `src/context.ts:372` (a `failure("AUTHORITY_ESCALATION", "authority", ...)`) and `:424` (a thrown `SecurityAuditSdkError`), and the three authority-rejection sites in `src/validation/semantic.ts` are `:218`, `:221`, and `:229`. The #78 fixture `tests/verification/authority-scope.test.mjs` already builds a genuine nested duplicate install (`runDuplicateArm`, line 171; header comment "wording is #79's, not asserted"), asserts only category `authority` (line 176), and its `runCopyArm` (line 161) asserts `crossCopyRejected === "AUTHORITY_ESCALATION"` (line 166) — the two assertions this change tightens to the specific code, plus the forged/cloned arms that must stay `AUTHORITY_ESCALATION`. The scope gate lives in `scripts/platform-coupling-policy.mjs` (roles `authored` and `generated` at lines 99-135; `roleForArtifact` at line 661) exercised by `scripts/check-scope.mjs` (inventory formatting at lines 51-64); `globalThis` is deliberately absent from the language-global list and is reported as undeclared wherever it appears (policy comment, lines 10-15).

The canonical audit contract is frozen and unaffected; no regeneration is required or permitted. The SDK remains an isolated technical candidate; this change authorizes no production integration.

## Goals / Non-Goals

**Goals:**

- Give a genuine duplicate installed copy a distinct, bounded, operator-facing diagnostic (`DUPLICATE_AUTHORITY`) at every brand-miss rejection site, without changing the rejection itself.
- Keep forged, cast, and cloned values on `AUTHORITY_ESCALATION` — the contrast between the two codes is the point of issue #79.
- Keep the probe channel diagnostic-only: booleans across a well-known `Symbol.for` key, never registry membership, brands, values, or authority.
- Word the message around the single-copy invariant verbatim from #86 and name deduplication as the remediation, so #79 and #86's duplicate-Core fixture describe the same fault in the same words.
- Leave the frozen contract, generated artifacts, package surface, and error shape untouched; add no new SDK error code and no public API.

**Non-Goals:**

- No global brand sharing, no registry singleton: the #78 assessment and ADR-SDK-004 invariant 7 explicitly rejected `approach-global-registry-singleton`, and this change does not resurrect it in probe clothing.
- No making duplication impossible: #86 owns the single-copy Core proof and the dependency-gate rescoping; #79 only diagnoses.
- No strengthening the probe against in-process impersonation: a hostile sibling predicate can always answer "yes" (Assurance Limitations).
- No contract amendment, no `src/generated/` edit, no regeneration, no version bump, no package release.
- No production transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, or audit-log chaining.

## Decisions

### D1 — `DUPLICATE_AUTHORITY` is reused from the frozen contract; no contract change

The diagnostic reuses `DUPLICATE_AUTHORITY`, already reserved in the frozen contract's `validation_error_codes` and currently unused by any runtime site. Category stays `"authority"`; `toJSON()` stays `{code, category, path}`; no error class gains fields.

The rejected alternative is a contract amendment adding or renaming an error code. The contract is frozen and a change to `contracts/` would trip `test:changed-paths` and make `contract`/`sdk` mutually unsatisfiable (the exact trap PR #259 resolved); the reservation already exists for precisely this fault, so an amendment would add governance risk for zero behavioral gain.

### D2 — The cross-copy channel is a diagnostic-only sibling probe, not a shared registry

Each resolved copy registers a boolean predicate in an append-only array under `Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1")` on `globalThis`, in a new internal module `src/duplicate-copy-probe.ts` that is **not** exported from the package index. On a brand miss the local copy asks only sibling predicates — self skipped by registration-object identity — each call try/catch-wrapped and coerced to boolean; any true → `DUPLICATE_AUTHORITY`, else `AUTHORITY_ESCALATION`. Registration happens once per resolved module copy; the array is append-only so no copy can unregister another.

This sits deliberately on the permitted side of the issue's out-of-scope line ("No … global brand sharing"). What crosses copies is a boolean ("is this object in my registry?"), never membership: a sibling's "yes" changes the operator-facing wording only, and the value is still rejected by the local copy's own registry logic. It is **not** `approach-global-registry-singleton`, the alternative the #78 assessment and ADR-SDK-004 invariant 7 rejected: that design shared membership so copy B could *accept* copy A's brands, mutable by any process code and reachable from anywhere. The probe shares nothing accept-shaped and cannot be reached to grant authority.

The rejected alternative is exactly that singleton: sharing membership across copies would violate the issue's "Detection cannot accept foreign authority" constraint and reverse the fail-closed decision recorded in ADR-SDK-004.

### D3 — One shared decision helper across all five rejection sites

The five sites that currently emit `AUTHORITY_ESCALATION` with category `"authority"` — `src/context.ts:372` and `:424`, `src/validation/semantic.ts:218`, `:221`, `:229` — all route through one shared decision helper: on a brand miss, consult the probe and select `DUPLICATE_AUTHORITY` when any sibling recognizes the value, else `AUTHORITY_ESCALATION`; the rejection itself (code shape, path, throw versus `AuditResult` failure) is unchanged at every site.

The rejected alternative is per-site probe logic. Five divergent copies of the same decision invite wording drift between sites — precisely the coordination defect this change exists to prevent — and would make the copy arm's expected code differ between paths.

### D4 — The message is one static constant naming the invariant and the remediation

The thrown `SecurityAuditSdkError` for `DUPLICATE_AUTHORITY` carries the static message constant:

> Core resolves to exactly one module instance in any supported consumer graph. A duplicate installed copy branded this value: deduplicate the @bloodtrail/security-audit-sdk-core dependency so a single copy resolves before continuing.

The invariant sentence is the owner's verbatim #86 wording; this change defines the single coordinated text and #86's duplicate-Core fixture reuses it. `toJSON()` remains `{code, category, path}`; `SafeAuditError` gains no fields.

The rejected alternative is adding structured fields (e.g. a duplicate marker) to the safe error surface. That would change public API and broaden the serialized surface beyond the bounded shape the #78 compatibility record preserved, for information the prose message already conveys.

### D5 — The scope gate admits `globalThis` for exactly the probe module

`scripts/platform-coupling-policy.mjs` gains a dedicated role whose prefix is exactly `src/duplicate-copy-probe.ts`, with `globalThis` as its only host global (`Symbol` is already a declared language global). `roleForArtifact` resolves the new prefix, and `scripts/check-scope.mjs` inventory reporting accounts for the third role. The `authored` role is not broadened, and `globalThis` remains a reported undeclared global for every other artifact.

The rejected alternative is adding `globalThis` to the authored role. That would weaken the platform-coupling gate for all of `src/` — the gate whose comment (policy lines 10-15) explains that `globalThis` defeats static classification — to admit a single module.

### D6 — Sibling and nested duplication share one code, with the impersonation limitation stated

Sibling two-copy and nested-duplicate conditions both emit `DUPLICATE_AUTHORITY`. The honest reason: at the rejection site nothing observable distinguishes "npm installed two copies" from "an attacker loaded a second copy to launder authority" — both are a value present in a different copy's registry. Splitting them would manufacture a distinction the system cannot make. The security decision never changes: the value is rejected either way; only the wording does.

The assurance limitation is written down, not solved: a hostile in-process sibling predicate can always answer "yes", downgrading the operator-facing wording of a genuine escalation to the duplicate diagnostic. Harm is bounded — no authority is granted, the rejection is unchanged, and the rejection is never weakened to compensate. This matches the issue's own "The diagnostic cannot prove why duplication exists."

### D7 — Compatibility and ADR record the wording change without touching #78's history

`compatibility.json` gains a new `patch[]` entry classifying this as a **safe diagnostic bound tightening**: no public API change, no new SDK error code, reuse of a reserved contract code, behavior change limited to the operator-facing code/message of an already-rejecting path. No version bump; the package stays at private unpublished `0.1.0`. #78's existing entry stays byte-untouched (historical record). ADR-SDK-004 gains a dated amendment paragraph (2026-09-03): the decision is unchanged, cross-copy wording is now `DUPLICATE_AUTHORITY`, escalation is retained for forged values, and the #86 pointer remains #86's.

The rejected alternative is editing #78's `patch[]` entry in place. It is a historical classification of a different change and must remain as landed; folding #79 into it would rewrite history and break the "one classification per change" reading that `test:compatibility` and future readers rely on.

## Migration Plan

1. Land the proposal, full assessment, delta, design, and all-unchecked tasks as a proposal-only commit and PR against `origin/main`; do not merge.
2. After the required exact-commit review/authorization, execute the apply phase: RED record of the current copy/duplicate/forged arm results, the probe module, the shared decision helper, the message constant, the scope-gate role, the fixture tightening (copy and duplicate arms assert `DUPLICATE_AUTHORITY`; forged/cloned keep `AUTHORITY_ESCALATION`; bounded-shape assertion on the duplicate diagnostic; a probe-channel control showing a throwing/lying foreign predicate cannot crash or grant acceptance), the `reviewedNewSdkSourcePaths` listing, and the compatibility/ADR amendments — each verified against the checked tasks before they are ticked.
3. Fold the capability delta into `openspec/specs/security-audit-sdk-core/spec.md` in a separate active-change canonical-fold commit, proving a second semantic application is a no-op.
4. After identity-preserving merge and all required approval evidence, archive in a separate byte-preserving relocation commit.

Rollback before implementation is removal of the unmerged proposal. After the delta is folded, reverting the diagnostic requires a new governed change rather than an edit to this record.

## Risks / Trade-offs

- [The probe cannot distinguish npm duplication from an attacker's second copy] → Accepted by design (D6): one code for both; the security decision never changes; recorded as an assurance limitation, not solved.
- [A hostile sibling predicate lies and softens a real escalation's wording] → Bounded harm: the value is still rejected; the rejection is never weakened to compensate; recorded in the delta and proposal.
- [The probe accidentally becomes registry sharing] → The channel is boolean-only and append-only; the scope gate admits `globalThis` for exactly the probe module; the delta's probe-channel scenario pins "never shares membership, brands, values, or authority".
- [A second active OpenSpec change makes design-pattern-governance fail closed] → This change is proposed only after #78's archive landed; the perimeter checker sees one active change's `owned_paths` at a time.
- [The fixture's copy arm still asserts `AUTHORITY_ESCALATION`] → The implementation tightens `runCopyArm` and `runDuplicateArm` to `DUPLICATE_AUTHORITY` in the same change; the forged/cloned arms keep the escalation and are the regression control for acceptance criteria 1 and 2.
- [A reader mistakes the wording change for a contract change] → The proposal and assessment state the contract is frozen, the code is already reserved, and nothing is regenerated; `check:generated` must stay green.
- [Prose is mistaken for implementation approval] → Implementation, review, merge, and archive tasks stay unchecked until their exact-commit gates fire.

## Open Questions

None. The owner-selected option C, the owner's message-wording constraint (verbatim #86 invariant sentence), the frozen contract's existing `DUPLICATE_AUTHORITY` reservation, and the #79/#86 ownership boundaries are all settled. The helper's exact signature, probe-registration mechanics, and test file placement within `tests/verification/` are left to the implementer under the constraints above.
