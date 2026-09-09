## 1. Governed planning and assessment

- [x] 1.1 Generate the full design-pattern assessment for this contract, compatibility, and gate-binding change; assess every security dimension and declare the security-sensitive classification before any governed implementation commit.
- [x] 1.2 Validate the complete active OpenSpec packet with `openspec validate add-derived-field-provenance --strict`; verify its three capability deltas match the approved `1.1.0` / `0.2.0` scope.
- [x] 1.3 Record the required Contract Reuse Assessment as an `extend` of the existing security-audit contract and validate it against the proposal baseline.
- [x] 1.4 Commit the assessed proposal packet and merge its dedicated PR with an exact green head; verify it changes only the active OpenSpec directory before beginning governed implementation.
- [x] 1.5 Correct Contract Reuse Assessment mechanism resolution to read the exact reviewed baseline source, and add transition and non-authoritative-baseline regression controls before changing the canonical contract.

## 2. Canonical contract and provenance validation

- [x] 2.1 Update only `contracts/security-audit/source/contract.source.json` with the `1.1.0` metadata, bounded optional `risk.model.provenance.derived_from` field, closed provenance error vocabulary, and generated-documentation inputs; verify no generated contract artifact is hand-edited.
- [x] 2.2 Extend the canonical generation and validation boundary to reject duplicate, non-canonical, unresolvable, absent, empty, non-derived, and cyclic provenance declarations without normalization or unbounded diagnostic echo; verify focused contract tests exercise every stable outcome with null controls.
- [x] 2.3 Add canonical valid, absent, malformed, duplicate, unknown, absent-input, unordered, and cyclic provenance fixtures; run contract generation and verify the generated schema, catalog, registries, policies, docs, and examples are current.

## 3. Exact SDK and gate transition

- [x] 3.1 Regenerate the Core TypeScript and validator projections from the `1.1.0` contract, then verify `npm run check:generated --prefix packages/security-audit-sdk-core` passes without generated-source edits.
- [x] 3.2 Move the Core and Node private candidate manifests, lockfiles, and compatibility metadata from `0.1.0` to `0.2.0`; bind Core to exact contract `1.1.0` and verify `1.0.0` fails before readiness. Add a Node compatibility check to `validate` that rejects package, lockfile, compatibility, or installed first-party Core identity drift while Node's frozen export surface remains unchanged.
- [ ] 3.3 Rebind `contract-provenance.json`, `check-contract-immutability.mjs`, changed-path lifecycle metadata, and their negative verification control to this named governed candidate; verify the new binding accepts only this exact candidate content inventory and continues to reject unrelated or byte-different protected-contract writes.

## 4. Verification and delivery

- [ ] 4.1 Run `npm run validate --prefix contracts/security-audit`, Core generated/compatibility checks and `npm run validate --prefix packages/security-audit-sdk-core`, and `npm run validate --prefix packages/security-audit-sdk-node`; record each exact result.
- [ ] 4.2 Run `npx --yes @fission-ai/openspec@latest validate --all --strict`, `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment`, `node openspec/scripts/check-design-pattern-governance.mjs --phase final`, `node openspec/scripts/run-governance-dual-check.mjs`, and `git diff --check`; verify no governance or whitespace failure remains.
- [ ] 4.3 Commit the assessed implementation with a Conventional Commit, push the branch, and open the implementation PR using every section of the repository template; verify its head is rebased on `origin/main` and the PR cites #95 without prematurely closing it.

## 5. Canonicalization and lifecycle closure

- [ ] 5.1 After the implementation PR merges with an exact green head, fold the three approved OpenSpec deltas into their canonical capability specifications in a dedicated PR; verify strict validation and a second fold is a no-op.
- [ ] 5.2 After the fold merges with an exact green head, archive the active change by byte-preserving relocation in a dedicated PR; verify archive attestation, strict validation, and that #95 can close only after the archive lands.
