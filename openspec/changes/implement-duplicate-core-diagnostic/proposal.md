## Why

A value branded by one installed `@bloodtrail/security-audit-sdk-core` copy and supplied to another copy is today rejected with `AUTHORITY_ESCALATION` — the attack wording — at every brand-miss site (`src/context.ts:372` and `:424`, `src/validation/semantic.ts:218`/`:221`/`:229`). Two independently installed copies are a dependency-tree fault, not an authority attack, and issue #79 (owner-confirmed: body STANDS as written) asks for a distinct bounded diagnostic for that fault without weakening brands. #78 deliberately froze the generic wording and named #79 as the change that replaces it; the canonical spec's deferral sentences ("owned by separately governed issue #79 … remains pending", "#79 remains responsible") now settle here.

The owner's 2026-08-23 addition governs the wording: after the #86 split, Core carries the invariant that it **resolves to exactly one module instance in any supported consumer graph**, so a duplicate Core is a violated invariant — the message must say so and name deduplication as the remediation, worded together with #86's duplicate-Core fixture. This change defines that single coordinated wording; #86 reuses it.

## What Changes

- Amend the canonical cross-copy requirement: a value branded by another installed copy SHALL fail closed with `DUPLICATE_AUTHORITY` instead of `AUTHORITY_ESCALATION` before sink handoff — for **both** the sibling two-copy condition and the genuine nested-duplicate condition.
- Add a diagnostic-only sibling probe in a new internal module `src/duplicate-copy-probe.ts` (not exported from the package index): each resolved copy registers a boolean predicate in an append-only array under `Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1")` on `globalThis`. On a brand miss the local copy asks **only** sibling predicates (self skipped by registration-object identity), each call try/catch-wrapped and coerced to boolean; any true → `DUPLICATE_AUTHORITY`, else `AUTHORITY_ESCALATION`. The probe never shares registry membership, brands, or values, and never accepts foreign authority — the value is rejected either way; only the operator-facing wording changes.
- Route all five brand-miss rejection sites (`src/context.ts:372`, `:424`; `src/validation/semantic.ts:218`, `:221`, `:229`) through one shared decision helper that picks the code.
- The thrown `SecurityAuditSdkError` for `DUPLICATE_AUTHORITY` carries the static message naming the single-copy invariant and the deduplication remediation (verbatim #86 wording; full text in the delta spec). `toJSON()` stays `{code, category, path}`; no error class gains new fields.
- Forged, cast, and cloned values keep `AUTHORITY_ESCALATION` — unchanged. The escalation/duplicate contrast is exactly issue #79's acceptance criteria 1 and 2.
- Scope gate: `platform-coupling-policy.mjs` gains a dedicated role for exactly `src/duplicate-copy-probe.ts` whose host globals allow **only** `globalThis`; the policy's `globalThis` ban stays total everywhere else, and role resolution plus inventory reporting are extended without broadening the authored role.
- `compatibility.json` gains a new `patch[]` entry classifying a safe diagnostic bound tightening (implementation stage); no version bump (0.1.0); #78's existing entry stays untouched (historical).
- ADR-SDK-004 gains a dated amendment paragraph (implementation stage): decision unchanged, cross-copy wording now `DUPLICATE_AUTHORITY`, escalation retained for forged values, the #86 pointer stays #86's.
- **No contract change and no regeneration**: `DUPLICATE_AUTHORITY` is already a reserved member of the frozen contract's `validation_error_codes` (`src/generated/contract.generated.ts:458`) and is referenced nowhere in `src/` outside that generated list. No new SDK error code; no public API change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Amend the cross-copy rejection requirement (genuine sibling and nested duplicate copies now reject with `DUPLICATE_AUTHORITY`; forged values keep `AUTHORITY_ESCALATION`), settle the #79 deferral sentences in the authority-brand scope requirement (diagnostic landed; still no global registry; still fail closed), and add the requirement pinning the bounded, diagnostic-only probe channel and the invariant-and-remediation message.

## Impact

Full-assessment, material modification of the `security-audit-sdk-core` capability, triggered by `security_sensitive_behavior` and `public_api` (the observable thrown-error wording is public surface). The proposal stage is specification and planning only; the apply phase touches `src/context.ts`, new `src/duplicate-copy-probe.ts`, `src/validation/semantic.ts`, the two scope-gate scripts, `tests/verification/`, `compatibility.json`, `verification-lifecycle.json` (the new `src/` path listing and coherence metadata), and ADR-SDK-004 — never the contract and never `src/generated/`.

This sits on the permitted side of the issue's out-of-scope line ("no global brand sharing"): the probe shares **booleans only**, and it is explicitly **not** the `approach-global-registry-singleton` alternative the #78 assessment and ADR-SDK-004 invariant 7 rejected (shared membership, mutable by any process code, accepting cross-copy values). No registry entry, brand, value, or authority ever crosses copies, and the foreign value is rejected either way.

Assurance limitation, written down rather than solved: any in-process code can register a fake sibling predicate that always answers "yes", downgrading the operator-facing wording of a genuine escalation to the duplicate diagnostic. The harm is bounded — the value is still rejected and no authority is granted — and the rejection is never weakened to compensate. Sibling and nested duplication share one code because nothing observable at the rejection site distinguishes npm-installed duplication from an attacker loading a second copy; the security decision never changes, only the wording. The diagnostic cannot prove why duplication exists; #86 owns making duplication impossible (single-copy Core proof and dependency-gate rescoping) and is not absorbed here.

Nothing in this change authorizes a global registry, auto-hoisting, tree mutation, stack leakage, or any production transport, exporter, collector, storage, SIEM integration, analytics, detection, browser telemetry, or audit-log chaining.
