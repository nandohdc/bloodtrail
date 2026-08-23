## 1. Planning and baseline evidence

- [ ] 1.1 Re-read the proposal, design, canonical SDK scope requirement, and #201 triage note; verify `skip_specs: true` remains justified because no canonical requirement requires source-content regex scanning.
- [ ] 1.2 Capture the unmodified `npm run test:scope --prefix packages/security-audit-sdk-core` pass line and coupling inventory, then search the repository for exact consumers of its file-count text; verify the coupling inventory is the baseline for the null control.
- [ ] 1.3 Verify the active design-pattern assessment against the proposal baseline and record the applicable security-sensitive behavior rationale without asserting owner approval.

## 2. Regression-first replacement evidence

- [ ] 2.1 Add disposable-copy positive controls for authored `fetch`, `node:fs/promises`, `redis`, `window`, `console`, and dynamic `node:child_process`; run them against the unmodified checker and verify the AST platform-coupling diagnostic class, artifact, and detail already appear for every arm.
- [ ] 2.2 Add comment and string-literal negative controls naming retired tokens; run them against the unmodified checker and verify the raw source matcher rejects them, establishing the intended precision correction.
- [ ] 2.3 Add a generated `transport.generated.cjs` filename control; run it against the unmodified checker and verify it passes because the legacy `.ts` filter and generated skip hide it.
- [ ] 2.4 Rename and tighten the existing `fetch()` scope mutation to require the surviving `[platform-coupling:` diagnostic prefix; run it against the unmodified checker and verify that assertion fails for the expected legacy-diagnostic reason.
- [ ] 2.5 Keep an unmutated disposable-copy null control and verify it passes with the baseline coupling inventory before interpreting any mutation result.

## 3. Bounded scope-gate implementation

- [ ] 3.1 Delete `forbiddenSource`, its source-content loop, the text-based specifier scan, the `.ts` filter, and the generated-source skip; retain the forbidden-filename, manifest, export, and AST platform-coupling controls, then verify `npm run test:scope --prefix packages/security-audit-sdk-core` passes.
- [ ] 3.2 Re-run every positive, negative, generated-filename, and null control; verify positives fail through the retained AST or filename diagnostic, both precision controls pass, and the null control retains the baseline coupling inventory.
- [ ] 3.3 Verify the scope pass-line count reflects the complete source-tree inventory without changing the authored/generated coupling inventory or any consumer that asserts only stable text.
- [ ] 3.4 Remove the dead `command()` helper from `tests/verification/mutations.test.mjs` as the explicitly documented #169 rider; verify no caller remains and the full verification suite passes.

## 4. Read-only technical verification

- [ ] 4.1 Run `npm run test:verification --prefix packages/security-audit-sdk-core` and `npm run test:matrix --prefix packages/security-audit-sdk-core` on each supported Node major; verify every retirement, negative, null, compatibility, and scope arm passes.
- [ ] 4.2 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before `npm run validate --prefix packages/security-audit-sdk-core`, then run `npm run validate --prefix contracts/security-audit`; verify generated artifacts, frozen contract, package scope, and authorization-boundary checks remain clean.
- [ ] 4.3 Run `openspec validate retire-superseded-scope-regexes --strict`, `git diff --check`, and an empty-index inspection; verify the candidate changes only the declared checker, tests, #169 rider, and OpenSpec artifacts.
- [ ] 4.4 Run CodeScene delta with warning failure when a token is available; otherwise record the unavailable local credential separately and require the exact PR's mandatory CodeScene CI result before merge.

## 5. Governed delivery and lifecycle completion

- [ ] 5.1 Commit the proposal and implementation as separate commits with explicit path allowlists after their respective read-only verification; verify the implementation candidate is frozen before exact-commit review.
- [ ] 5.2 Open a focused #201 PR that documents every replacement control, the false-positive precision correction, generated-filename widening, host-object-member residual, and #169 rider; verify the live PR head, changed paths, and all mandatory checks are green before any merge action.
- [ ] 5.3 Obtain and record any required exact-commit owner/reviewer decisions without treating AI review, PR state, or CI success as approval; verify review records bind the exact reviewed content.
- [ ] 5.4 After identity-preserving merge, fold or archive only if the active change still has a canonical delta to fold; otherwise archive the `skip_specs` change with byte-preserving relocation and strict OpenSpec validation.
- [ ] 5.5 Close #201 only after its archive and all required evidence are complete; post the seven positive arms, two precision controls, null control, filename widening, renamed test rationale, #169 landing reference, and the residual that host-object member access remains undetected by construction.
