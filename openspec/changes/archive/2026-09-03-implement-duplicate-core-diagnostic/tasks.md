## 1. Proposal

- [x] 1.1 Land the proposal PR for issue #79 against `origin/main`: the complete packet (`proposal.md`, `assessment.json`, `design.md`, the delta spec, `tasks.md`), `openspec validate implement-duplicate-core-diagnostic --strict` passing, all nine required CI contexts green, conventional commit `docs(openspec): propose issue-79 duplicate-core diagnostic`. Do not merge.

## 2. RED record and implementation

- [x] 2.1 Record the pre-change baseline (RED) at the change's baseline commit before any edit: the copy arm rejects with `AUTHORITY_ESCALATION`, the duplicate arm rejects with category `"authority"` (code not asserted — wording is #79's), and the forged/cloned arms reject with `AUTHORITY_ESCALATION`.
- [x] 2.2 Add `src/duplicate-copy-probe.ts` (internal, not exported from the package index): each resolved copy registers a boolean predicate in an append-only array under `Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1")` on `globalThis`; a brand-miss ask queries only sibling predicates (self skipped by registration-object identity), each call try/catch-wrapped and coerced to boolean; any true => `DUPLICATE_AUTHORITY`, else `AUTHORITY_ESCALATION`. Share no registry membership, brands, values, or authority.
- [x] 2.3 Route all five brand-miss/authority rejection sites through one shared decision helper: `src/context.ts:372` and `:424`, `src/validation/semantic.ts:218`, `:221`, `:229`. Rejection shape (code/category/path, throw versus `AuditResult`) unchanged at every site.
- [x] 2.4 Add the static `DUPLICATE_AUTHORITY` message constant — "Core resolves to exactly one module instance in any supported consumer graph. A duplicate installed copy branded this value: deduplicate the @bloodtrail/security-audit-sdk-core dependency so a single copy resolves before continuing." — the single coordinated wording #86's duplicate-Core fixture reuses; `toJSON()` stays `{code, category, path}`; no error class gains fields.
- [x] 2.5 Scope gate: add a dedicated policy role for exactly `src/duplicate-copy-probe.ts` whose host globals allow only `globalThis`; extend role resolution (`roleForArtifact`) and inventory reporting in `scripts/check-scope.mjs`; keep the `globalThis` ban total everywhere else.
- [x] 2.6 Fixture edits in `tests/verification/`: the copy arm and the duplicate arm assert code `DUPLICATE_AUTHORITY` (keeping the distinct-copy and nested-copies-distinct assertions and the same-copy accepted controls); forged/cloned arms keep `AUTHORITY_ESCALATION`; assert the bounded shape for the duplicate diagnostic (no caller data, serialized under 512 bytes); add a probe-channel control showing a throwing or lying foreign predicate never crashes the site and never grants acceptance.
- [x] 2.7 List `packages/security-audit-sdk-core/src/duplicate-copy-probe.ts` in `ownership.reviewedNewSdkSourcePaths` (`verification-lifecycle.json`) in the same change so `test:changed-paths` passes.
- [x] 2.8 Re-run the authority-scope matrix: copy and duplicate arms now `DUPLICATE_AUTHORITY` (the only arms whose result may change); forged/cloned/same/foreign/nested/concurrent/cleanup arms unchanged against the RED record.

## 3. Compatibility and ADR

- [x] 3.1 Add the new `patch[]` entry to `compatibility.json` classifying a safe diagnostic bound tightening; no version bump (0.1.0); leave #78's existing entry untouched.
- [x] 3.2 Add the dated amendment paragraph to `packages/security-audit-sdk-core/adr/004-authority-context.md`: decision unchanged; cross-copy wording now `DUPLICATE_AUTHORITY`; escalation retained for forged values; the #86 pointer stays #86's.

## 4. Verification

- [x] 4.1 Run `npm run test:scope --prefix packages/security-audit-sdk-core`; the new probe role passes and the `globalThis` ban holds everywhere else.
- [x] 4.2 Run `npm run test:compatibility --prefix packages/security-audit-sdk-core`; the new classification passes.
- [x] 4.3 Run the full SDK `validate` chain and `npm run validate --prefix contracts/security-audit`; `check:generated` proves no regeneration or `src/generated/` drift; run `test:matrix` on Node 24 and Node 26.
- [x] 4.4 Demonstrate the assurance limitation rather than solve it: a lying sibling predicate yields `DUPLICATE_AUTHORITY` wording but the value is still rejected; the forged arm keeps `AUTHORITY_ESCALATION`.
- [x] 4.5 Keep the index empty before verification; record the expected `signed-review-stale` diagnostics under R15 without weakening a gate; report readiness — do not merge.

## 5. Fold, governance, archive

- [x] 5.1 Fold the delta into `openspec/specs/security-audit-sdk-core/spec.md` in a separate commit and PR while this change is active; verify each requirement and scenario occurs exactly once, no delta header reaches the canonical spec, and a second semantic application is a no-op.
- [ ] 5.2 Obtain a technical review and the project owner's exact-commit decision after the final technical commit; merge identity-preservingly with all nine required CI contexts green.
- [x] 5.3 Archive after merge in a separate byte-preserving relocation commit that does not repeat the fold.
