## 1. Contract Reuse Assessment schema — #99

- [ ] 1.1 Define `openspec/governance/schemas/contract-reuse.schema.json` in the repository's closed-schema dialect with the record identity, declared contract/version, disposition, mechanism references, rationale, compatibility, trust-boundary, transformation-ownership, alternatives, author evidence, assurance-limitation, and exemption fields; verify the schema is version `1.0`, declares only supported versions, and documents its non-authorizing assurance boundary.
- [ ] 1.2 Encode the closed `reuse` / `extend` / `new_contract` disposition vocabulary and the project-owner-bound exemption shape; verify fixtures reject `not_applicable`, an unknown disposition, missing required fields, and an exemption without the required owner binding.
- [ ] 1.3 Add canonical and negative CRA record fixtures adjacent to the schema; verify a canonical `registries.trust_levels` record passes while omitted required evidence and unknown controlled values fail with named field diagnostics.
- [ ] 1.4 Add schema validation tests that assert fixture diagnostics rather than only process exit status; verify the test suite passes from a clean repository state.

## 2. Contract Reuse Assessment checker — #100

- [ ] 2.1 Implement a dependency-free CRA checker that computes applicability from the merge-base change range using only the D2 trigger prefixes; verify a `contracts/` mutation, a generated-SDK mutation, and a security-audit contract delta each require a CRA while an unrelated change prints the distinguishable approved-skip outcome.
- [ ] 2.2 Implement record loading, structural validation, declared-version handling, and bounded `[diagnostic-id] path: message` diagnostics; verify absent, malformed, and structurally invalid records fail closed with distinct stable diagnostics and without echoing rationale values.
- [ ] 2.3 Resolve mechanism references against the declared canonical contract source; verify `registries.trust_levels` passes and the `registries.trust_levelz` mutation fails with the unresolved-mechanism diagnostic naming that safe reference.
- [ ] 2.4 Enforce the project-owner-bound exemption rule; verify a complete bound exemption produces its defined exception outcome and an unauthorized or unbound exemption fails with the unauthorized-exemption diagnostic.
- [ ] 2.5 Add disposable-repository fixture tests for valid-required, approved-skip, missing-record, malformed-record, invalid-field, unresolved-reference, unauthorized-exemption, and null-control cases; verify every failing arm asserts its diagnostic and the null control passes before interpreting any mutation result.
- [ ] 2.6 Run the trusted baseline and candidate governance checks for the governance-core checker and test changes; verify both verdicts are recorded and a deliberately weakened candidate cannot waive the trusted baseline result.

## 3. CI integration — #101

- [ ] 3.1 Add the documented CRA checker command to the existing `design-pattern-governance` CI job without a workflow `paths:` filter or secrets; verify the checkout provides the merge-base history the checker needs.
- [ ] 3.2 Verify CI with a valid CRA-triggered fixture change; confirm the job log shows the checker ran and reports a CRA-validated pass.
- [ ] 3.3 Verify CI with a missing CRA on a trigger path; confirm the job fails with the stable missing-record diagnostic in its log.
- [ ] 3.4 Verify CI with an unaffected change; confirm the job passes while its log shows the distinguishable approved-skip outcome rather than a false CRA-validated pass.
- [ ] 3.5 Record whether the CRA execution remains inside the existing required governance status or creates a new status; verify any separate required-status configuration is completed by the project owner before calling that status an enforcement gate.

## 4. Verification and governance

- [ ] 4.1 Run `node --test openspec/tests/design-pattern-governance/*.test.mjs`, `npm run validate --prefix contracts/security-audit`, and `npm run check:generated --prefix packages/security-audit-sdk-core` before the full SDK validation chain; verify the index is empty before the read-only candidate verification pass.
- [ ] 4.2 Run `openspec validate --strict contract-reuse-assessment` and a semantic verification of every CRA requirement, scenario, task, diagnostic, trigger prefix, and artifact boundary; verify the implementation has not modified the frozen contract, generated projections, unrelated design-pattern-governance artifacts, or production-scope surfaces.
- [ ] 4.3 Prepare an exact-commit technical review packet and obtain an explicit review/owner decision bound to the reviewed content object; verify that author-written CRA records are not represented as review, approval, or assurance.
- [ ] 4.4 Complete the lifecycle-status sweep and live PR/CI verification; verify the exact reviewed commit remains the PR head, all required CI checks have passed, and no required check is bypassed or failing before merge readiness is reported.

## 5. Canonicalization and archive

- [ ] 5.1 After an approved identity-preserving merge, fold this change's `contract-reuse-assessment` delta into `openspec/specs/contract-reuse-assessment/spec.md` in a dedicated commit and verify a second semantic application would be a no-op.
- [ ] 5.2 Archive the active change in a separate archive-relocation commit with byte identity for proposal, design, delta spec, and metadata; verify strict OpenSpec validation, archive attestations, explicit staged scope, and historical review bindings.
- [ ] 5.3 Close #99, #100, and #101 only after their respective task groups and live CI evidence are complete; close #98 only after the proposal artifacts are merged, comment the downstream issue links, and update #132's Wave 3 checklist with the recorded lifecycle state.
