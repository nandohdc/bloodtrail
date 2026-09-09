## 1. Proposal, assessment, and RED baseline

- [x] 1.1 Create the design-pattern assessment (source + generated) for the exact owned-path allowlist (`packages/security-audit-collector/`, this change's own directory, `openspec/specs/security-audit-collector/spec.md`); record the rejected fingerprint/hash alternative and verify all 15 security dimensions are justified.
- [x] 1.2 RED evidence: #391's own reproduction against the unmodified implementation observed `attempt 1: collector decision = rejected COLLECTOR_DUPLICATE_CONFLICT` for a body differing only in `correlation.retry_attempt`; the new D9 test in `ingress.test.ts` asserts the corrected (GREEN) outcome directly, since the fix was authored alongside the regression test rather than as two separate commits.

## 2. Canonical deduplication key

- [x] 2.1 Add `deduplicationKeyOf` (and a small deterministic, key-sorted `canonicalStringify`) to `packages/security-audit-collector/src/ingress.ts`, deriving the key from the already-parsed, schema-validated body with `correlation.retry_attempt` omitted; verify it is a pure function with no new import beyond existing relative modules.
- [x] 2.2 Wire `CollectorIngress#submit` to pass the canonical key (not the raw `submission.body`) into `#deduplicate` / `DeduplicationLedger.decide`; verify `DeduplicationLedger` itself is untouched and its existing unit tests still pass unmodified.
- [x] 2.3 Turn the RED test from 1.2 GREEN (retry-only-attempt-advance now returns `duplicate`), and add a second assertion tightening the existing "different producer field" conflict test to confirm it is unaffected (null control); run `npm run test:runtime --prefix packages/security-audit-collector`.

## 3. GREEN verification and governance

- [x] 3.1 Run `npm run validate --prefix packages/security-audit-collector` (build, typecheck, runtime tests, scope, dependencies, package-contents) fully green — 45/45 tests pass.
- [x] 3.2 Run `npx --yes @fission-ai/openspec@latest validate --all --strict`, the assessment design-pattern-governance phase, and `git diff --check` with an empty index; resolve any scope or classification failure before staging.
- [x] 3.3 Stage only the collector source/tests and this change's declared OpenSpec artifacts; commit with Conventional Commits (`fix(collector): ...`, referencing #391).

## 4. Delivery, fold, archive, and closure

- [x] 4.1 Open the proposal PR (this change's planning artifacts only); merge only when every required branch-protection context is green on the exact head. — PR #392, merged `8da0490`.
- [x] 4.2 Open the implementation PR (section 2 + 3 changes); merge only when every required branch-protection context is green on the exact head. — PR #394, merged `ee595a8`.
- [x] 4.3 Fold the `security-audit-collector` delta into its canonical spec in a dedicated fold PR, proving the requirement blocks match byte-for-byte and a second application is a no-op; merge only after its exact-head CI is green.
- [x] 4.4 Archive the completed change with byte-preserving relocation and `archive-evidence.md`; verify strict OpenSpec validation and the repository's governance-gate chain, then merge as a merge commit (not squash).
- [ ] 4.5 Close #391 with the regression-test and null-control evidence, and note in #109's tracking that this blocker is resolved.
