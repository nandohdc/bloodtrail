## 1. RED-first record — the nine-arm matrix, before any change

- [x] 1.1 Reproduce and record the result of every authority-scope arm before any implementation change, in a disposable clone wherever an arm needs one, and record each arm's exact result in the change's evidence. Arms: `same` (accepted), `foreign` (accepted — settled under the adopted module-copy scope, F7), `forged` (rejected), `cloned` (rejected), `copy` (rejected with `AUTHORITY_ESCALATION` before the sink), `nested` (isolation preserved), `concurrent` (no leakage), `cleanup` (no retention), `null` (full `validate` passes).
- [x] 1.2 Record the `foreign` arm as settled acceptance — two SDK instances in one module copy accept each other's brands — and verify its null control can be made red by a cross-copy fixture mutation, so the settled arm is never a green arm that could not have been red.
- [x] 1.3 Verify the `forged` and `cloned` arms already fail. If either passes today, that is a live forgeability vulnerability that outranks this issue — stop and report it before any formalization work.
- [x] 1.4 Record the enumeration inputs from `src/context.ts` before any edit: exactly 35 exported brand constructors (`export function` declarations) and exactly 19 `AuditBrandKind` union members, with both lists captured in the RED record.
- [x] 1.5 Record the `null` arm: the unmutated package passes both full `validate` chains, so every later arm result is comparable against an unmutated baseline.

## 2. GREEN — comments-only formalization and regression guards

- [x] 2.1 Name the chosen module-copy invariant in `src/context.ts` comments only: the registry is a module-private identity-keyed `WeakMap`, only the exported brand constructors in this file can insert entries, and the scope is a chosen invariant per ADR-SDK-004's scope selection and root ADR 0010 — preserving the existing `structuredClone`/symbol reasoning. Verify no runtime code, no registry relocation, no public API change, and no diagnostic-path addition.
- [x] 2.2 Add the nine-arm authority-scope matrix to the SDK verification suite with per-arm null controls; prove each arm is mutation-sensitive by showing a fixture mutation that violates the arm's guarded invariant fails that arm.
- [x] 2.3 Add the insertion-surface enumeration control asserting both counts — 35 exported brand constructors and 19 `AuditBrandKind` members — derived from `src/context.ts` itself, with the two counts asserted independently and named separately in every diagnostic.
- [x] 2.4 Add the genuine two-copy fixture for the `copy` arm in a disposable clone via `tests/verification/disposable-git.mjs`: two independently installed copies, a distinct-resolved-copy assertion, and verification that the rejection carries the bounded `AUTHORITY_ESCALATION` shape.
- [x] 2.5 Re-run all nine arms; every arm's result must match the RED record — under option C no arm changes.
- [x] 2.6 Run `npm run test:types --prefix packages/security-audit-sdk-core`; the branded types' negative assertions must still reject casts and the public export surface must be byte-identical in shape.

## 3. Verification

- [x] 3.1 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before `validate`; run both full `validate` chains (`packages/security-audit-sdk-core` and `contracts/security-audit`); run `npm run test:matrix --prefix packages/security-audit-sdk-core` on Node 24 and Node 26.
- [x] 3.2 Keep the index empty before verification; run governance verification only after the commit exists (#191); record the expected `signed-review-stale` diagnostics under R15 and never weaken a gate to make them pass.
- [x] 3.3 If a new `src/` file is created, add its exact path to `ownership.reviewedNewSdkSourcePaths` in the same change or `test:changed-paths` rejects it; a comments-only formalization must create none — stop and re-check scope if one appears.
- [x] 3.4 Report readiness. Do not merge.

## 4. Compatibility classification

- [x] 4.1 Update `compatibility.json` with the authority-scope classification against `semverClassification`: no public API change, no runtime behavior change, and no new SDK error code; record the bounded module-copy scope decision, the settled same-copy cross-instance acceptance, and the future obligations owned by #79 (distinct duplicate-Core diagnostic) and #86 (single-copy Core proof and dependency-gate rescoping) without authorizing either.
- [x] 4.2 Verify `npm run test:compatibility --prefix packages/security-audit-sdk-core` passes with the classification in place and the bounded `AUTHORITY_ESCALATION` shape preserved (code, category, bounded path only — never caller data).

## 5. Handoff

- [x] 5.1 Verify issue #79 stands as written — no issue-body rewrite; its distinct duplicate-Core diagnostic ownership is unchanged by this change.
- [ ] 5.2 Comment on issues #83 and #86 that their dependency is resolved: module-copy scope is now a chosen, regression-guarded invariant, and the single-copy Core proof remains #86's obligation.
- [ ] 5.3 Close issue #78 and tick it in issue #132's Wave 2 checklist.

## 6. Governance, review, merge, archive

- [ ] 6.1 Obtain a technical review and the project owner's exact-commit decision only after the final technical commit; verify the record states that AI review is not independent assurance or owner approval and retains every production and real-user exclusion.
- [ ] 6.2 Fold the capability delta into `openspec/specs/security-audit-sdk-core/spec.md` in a separate commit and PR while this change is active; verify each requirement and scenario occurs exactly once, no delta header reaches the canonical spec, and a second semantic application is a no-op.
- [ ] 6.3 Merge only through the repository gate process with the exact reviewed commit and all nine required CI checks green — including the resolution of issue #256 for the `sdk` job — and verify the identity-preserving merge contains the reviewed commits.
- [ ] 6.4 Archive after merge in a separate byte-preserving relocation commit that does not repeat the fold.
