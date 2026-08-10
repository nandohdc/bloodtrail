## 1. Lifecycle gate

- [ ] 1.1 Confirm `remediate-security-audit-sdk-adversarial-review` is archived and its tasks 12.4 through 12.10 are complete, so that editing `tests/verification/` no longer moves bytes inside a candidate bound to a pending independent review. Do not begin group 2 until this is recorded.
- [ ] 1.2 Record the exact commit this change is applied against, and confirm the SDK package tree is unchanged from the archived remediation candidate.

## 2. Baseline evidence

- [ ] 2.1 Capture the current failure: with a tracked root `CLAUDE.md` present, run `npm run test:verification --prefix packages/security-audit-sdk-core` and record that the control "an ignored local CLAUDE.md is excluded by standard Git semantics" fails with the `local-instruction-unrelated` assertion.
- [ ] 2.2 Capture the current pass: with no tracked `CLAUDE.md`, run the same command and record the control passing. Together 2.1 and 2.2 establish that the tracked file is the sole cause.
- [ ] 2.3 Record that `npm run test:changed-paths --prefix packages/security-audit-sdk-core` passes in both states, confirming the policy already permits what the control rejects.

## 3. Control correction

- [ ] 3.1 Add a local helper that extracts the classification-count object from the changed-path checker's summary line and returns the count for a named bucket, returning zero when the key is absent and failing loudly when the summary line cannot be parsed.
- [ ] 3.2 Rewrite the ignored-file control to capture the `local-instruction-unrelated` count before creating the ignored file, then assert the count is unchanged after, per design decision D1.
- [ ] 3.3 Add a control asserting that a *tracked* local instruction file is reported under the `local-instruction-unrelated` classification and that changed-path verification still passes.
- [ ] 3.4 Confirm no change was made to `scripts/check-changed-paths.mjs`, its `CLAUDE.md` rule, the bucket name, or the summary-line format.

## 4. Negative proof

- [ ] 4.1 Add a mutation in which the local instruction file is tracked rather than ignored, and prove the corrected delta assertion fails deterministically.
- [ ] 4.2 Add a mutation removing the `CLAUDE.md` classification rule, and prove the tracked-case control from 3.3 fails — so the suite cannot be satisfied by deleting the classification.
- [ ] 4.3 Verify both mutations fail for the stated reason and not incidentally, by checking the assertion message identifies the unexpected or missing record.
- [ ] 4.4 Confirm each mutation is applied to a disposable clone and that the live package tree is untouched afterwards.

## 5. Verification

- [ ] 5.1 Run `npm run test:verification --prefix packages/security-audit-sdk-core` and confirm the suite passes with no tracked `CLAUDE.md` present.
- [ ] 5.2 Add a tracked root `CLAUDE.md`, re-run the suite, and confirm it now also passes — the outcome this change exists to produce.
- [ ] 5.3 Run the full `npm run validate --prefix packages/security-audit-sdk-core` chain in both states and confirm all 16 gates pass, including `test:changed-paths`, `test:coherence`, and `test:git`.
- [ ] 5.4 Run `openspec validate --all --strict` and confirm it passes.
- [ ] 5.5 Confirm no SDK source file, generated artifact, contract artifact, or public API changed.

## 6. Governance

- [ ] 6.1 Record that this change does not add `CLAUDE.md` to the repository and grants no authorization to do so; adoption remains a separate decision.
- [ ] 6.2 Obtain independent technical review of the exact implementation commit, covering the corrected control and both mutations. Test success is not review.
- [ ] 6.3 Obtain and record the project owner's explicit exact-commit decision.
- [ ] 6.4 Archive this change with its capability delta in a dedicated archive commit, and re-run strict OpenSpec validation afterwards.
