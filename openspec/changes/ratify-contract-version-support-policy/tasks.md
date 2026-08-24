## 1. Authored policy documentation

- [ ] 1.1 Sharpen `packages/security-audit-sdk-core/CONTEXT.md` so exact-one package support is explicitly many-to-one and exact-version instance binding is explicitly a construction invariant; verify both definitions match the delta requirement without implementation mechanics.
- [ ] 1.2 Extend `packages/security-audit-sdk-core/adr/009-package-contract-compatibility.md` with the complete exact-one support surface, construction binding, support-baseline SemVer consequence, `0.x` treatment, collector `MAY` asymmetry, no-authorization boundary, and conjunctive revisit condition; verify no twelfth SDK ADR or ADR-count change exists.
- [ ] 1.3 Add `docs/adr/0007-contract-version-support-policy.md` recording `EXACT_ONE` versus `EXPLICIT_SET`, the many-to-one cardinality, selected-policy consequences, rejected-alternative rationale, no-authorization boundaries, and the second-version-plus-authorized-collector revisit condition; verify root ADR numbering remains unique.
- [ ] 1.4 Replace the decision-reopening instruction in `packages/security-audit-sdk-core/MIGRATION.md` with an exact-one adaptation procedure that preserves separate contract-minor and SDK compatibility-major classifications without authorizing a release or version bump; verify no migration step permits multi-version producer support.

## 2. Documentation candidate verification and commit

- [ ] 2.1 Verify cross-artifact semantics across the delta, glossary, ADR-SDK-009, root ADR 0007, and migration guide, including complete-surface cardinality, construction-time failure, SemVer axes, `0.x` treatment, collector nonauthorization, and the conjunctive revisit condition.
- [ ] 2.2 Run strict validation for `ratify-contract-version-support-policy`, both repository validation chains, `git diff --check`, and explicit protected-path assertions; verify runtime source, generated output, contract source, package metadata/version, dependencies, and collector/transport/publication surfaces are unchanged.

## 3. Canonical capability fold

- [ ] 3.1 After the documentation implementation lands, fold the delta's added requirement into `openspec/specs/security-audit-sdk-core/spec.md` while the change remains active; verify the canonical requirement and all seven scenarios occur exactly once without a delta operation header.
- [ ] 3.2 Prove a second semantic application of the delta is a no-op, run strict OpenSpec and both repository validation chains read-only, and commit the canonical fold separately with an explicit allowlist that excludes the active change relocation.
- [ ] 3.3 After the canonical fold is the final normative technical commit, obtain one signed governance record containing both technical review and the project-owner decision; verify it binds the exact technical commit and a content object covering every reviewed normative path, states its assurance boundary, and is not represented as independent assurance merely because AI review also ran.
- [ ] 3.4 After the signed record commit, have the project owner merge the exact technical and signed-record commit identities into the protected mainline without squash, rebase, amendment, or force-push; verify the merge commit or fast-forward contains both exact identities and no later normative commit has made the signed record stale.

## 4. Dependent issue reconciliation

- [ ] 4.1 Re-verify issue #76 against the ratified canonical policy and existing exact-one implementation, then close it as already implemented only when each acceptance criterion has exact repository and commit evidence.
- [ ] 4.2 Close issue #75 only after the glossary, both ADRs, migration guidance, and canonical requirement have landed; name `EXACT_ONE`, the exact commit identities, ADR paths, and canonical requirement in the closing evidence.
- [ ] 4.3 Update issue #132's Wave 2 checklist and notify issues #76, #102, #107, and #122 of the settled policy; read back every changed GitHub target and verify AI-generated comments carry the required disclaimer.

## 5. Archive relocation

- [ ] 5.1 From the identity-preserving mainline merge, relocate the active change into its dated archive in a separate direct-following commit without repeating the canonical fold; verify proposal, assessment, design, delta spec, and metadata retain byte identity and `openspec/specs/**` is absent from the archive diff.
- [ ] 5.2 Run strict all-change validation, archive-attestation and repository gates, staged relocation scope checks, and post-commit governance verification; verify the active path is absent, the archive path exists, and archive readiness is reported separately from technical and merge readiness.
