## 1. Public type-projection regression

- [x] 1.1 Add a `@ts-expect-error` public `roleAssigned` call that omits `event.outcome_reason`; run `npm run test:types --prefix packages/security-audit-sdk-core` and verify it fails first because the directive is unused.
- [x] 1.2 Keep an adjacent valid `roleAssigned` call with the canonical `event.outcome_reason` shape; after the repair, run `test:types` and verify the valid call remains accepted while unrelated named-input controls remain valid.

## 2. Generator-owned correction

- [x] 2.1 Add the narrow `reason` branch to `RequiredContextProperty` in `scripts/generate-contract.mjs`, regenerate with `npm run generate --prefix packages/security-audit-sdk-core`, then verify `test:types` and `check:generated` pass.
- [x] 2.2 Inspect the generated projection and changed-path scope: only the generator, its derived `src/generated/contract.generated.ts`, the type regression, and this change packet may carry the correction; no handwritten generated edit, contract-source change, runtime semantic change, package metadata, dependency, or delivery surface is permitted.

## 3. Technical verification and frozen candidate evidence

- [x] 3.1 Run `npm run test:runtime --prefix packages/security-audit-sdk-core`, `npm run test:types --prefix packages/security-audit-sdk-core`, `npm run test:contract-immutability --prefix packages/security-audit-sdk-core`, `npm run check:generated --prefix packages/security-audit-sdk-core`, `npm run validate --prefix contracts/security-audit`, `openspec validate fix-generated-required-context-reason --strict`, `openspec validate --all --strict`, and implementation-phase design-pattern governance; verify the existing runtime reason diagnostic, frozen contract, and scope boundary remain unchanged.
- [x] 3.2 Reconstruct the exact unstaged candidate in an isolated disposable clone, run `npm run validate --prefix packages/security-audit-sdk-core`, and record the full 19-gate result, exact candidate tree/hash, generated-projection scope, and empty-index proof without modifying the verified candidate afterward.

## 4. Governed delivery and lifecycle completion

- [x] 4.1 Commit the proposal artifact allowlist separately after strict OpenSpec and assessment validation; verify its parent, staged paths, and working-tree/index blob equality.
- [ ] 4.2 Commit the verified technical allowlist separately; bind any subsequent human review and governance record to that exact final technical commit, without treating AI review, CI, issue state, or this task list as approval.
- [ ] 4.3 Open a focused #217 PR, verify its live head/path set and required checks, then obtain the required exact-commit owner/reviewer decision before any identity-preserving merge.
- [ ] 4.4 After merge, confirm the technical and decision commits are reachable from `main`; archive the `skip_specs` change with byte-preserving relocation only when every implementation/governance task is genuinely complete, and close #217 only after archive evidence is recorded.
