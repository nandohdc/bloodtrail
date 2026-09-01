## 1. Ratify the decision records

- [ ] 1.1 Extend `packages/security-audit-sdk-core/adr/004-authority-context.md` with option C and the explicit forge-resistance, module-copy, same-copy cross-instance, cross-copy fail-closed, #79 diagnostic-ownership, single-copy-Core, dependency-allowance, global-singleton-rejection, and revisit invariants; verify the SDK ADR inventory remains exactly ADR-SDK-001 through ADR-SDK-011 and no ADR-SDK-012 exists.
- [ ] 1.2 Add `docs/adr/0009-sdk-core-authority-scope.md` as the repository decision record; verify it preserves the A/B/C table, F3's 35 exported constructors, F4's binding-depends-on-and-re-exports-Core reasoning without `context.ts` duplication, explicit global-singleton rejection, and the exact revisit condition.
- [ ] 1.3 Verify ADR-SDK-004, root ADR 0009, this delta, and the canonical SDK capability use identical authority terms and preserve the frozen contract, current runtime behavior, and #79 issue body.

## 2. Bind future Core-extraction obligations to #86

- [ ] 2.1 In #86's authorized Core-split implementation plan, implement and verify a consumer-graph fixture where deliberately duplicated Core fails closed with bounded deduplication remediation and the otherwise identical non-duplicate null control passes; verify the Node binding depends on and re-exports Core without duplicating `context.ts`.
- [ ] 2.2 In #86's authorized Core-split implementation, update `check-dependencies.mjs` and `check-coherence.mjs`'s `lock-runtime-dependencies` rule together; verify only an exact allowlisted first-party Core runtime dependency passes and disposable third-party runtime-dependency mutations fail in both controls.
- [ ] 2.3 Preserve #79 exactly without an issue-body rewrite; when #79 is separately implemented, verify its distinct bounded duplicate-Core diagnostic agrees with #86's fixture wording, still rejects foreign authority, and names deduplication as remediation.
- [ ] 2.4 If any supported consumer graph cannot resolve Core to exactly one module instance, stop the #86 work and reopen the authority-scope decision between A-with-a-mechanism and B; verify no local global, registry-sharing, or auto-hoisting workaround is introduced.

## 3. Proposal materialization verification and canonical fold

- [ ] 3.1 Before staging documentation materialization, run `openspec validate ratify-sdk-core-authority-scope --strict`, perform the full 15-dimension assessment and cross-artifact semantic review, run `git diff --check`, and verify the changed-path allowlist excludes runtime source, generated artifacts, contract source, manifests, dependencies, production integrations, and #79's issue body.
- [ ] 3.2 After the documentation materialization is authorized and merged, fold the delta into `openspec/specs/security-audit-sdk-core/spec.md` while this change is active; verify the added requirement and all six scenarios occur exactly once, no delta header reaches the canonical spec, and a second semantic application is a no-op.
- [ ] 3.3 Before each proposal, materialization, and fold commit, use an explicit staged allowlist, verify staged blobs match the verified candidate, and keep implementation, #79 diagnostic, and generated/contract paths absent.

## 4. Governance, review, merge, and archive

- [ ] 4.1 Obtain a technical review and the project owner's explicit exact-commit decision only after the final normative technical commit; verify the record states that technical/AI review is not independent assurance or owner approval and retains every production and real-user exclusion.
- [ ] 4.2 Merge only after the exact reviewed commit, required formal owner approval, and required CI are satisfied through the repository merge process; verify the identity-preserving merge contains the reviewed technical and signed-record commits.
- [ ] 4.3 Archive only after the approved merge and canonical fold, using a separate byte-preserving relocation commit; verify the archive does not repeat the fold and that proposal, assessment, design, delta, and metadata retain the required historical evidence.
