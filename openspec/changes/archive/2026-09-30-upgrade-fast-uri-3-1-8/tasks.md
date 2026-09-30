## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and design-pattern assessment for `upgrade-fast-uri-3-1-8`.
  Verify `openspec validate upgrade-fast-uri-3-1-8 --strict`,
  `node openspec/scripts/generate-assessment.mjs --change upgrade-fast-uri-3-1-8 --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` pass.

## 2. Refresh the vulnerable transitive dependency

- [x] 2.1 Run `npm audit fix --package-lock-only` in `packages/security-audit-sdk-core`. Verify the diff
  changes only the `node_modules/fast-uri` version, registry URL and integrity, to 3.1.8, and that
  `package.json` is unchanged.

## 3. Verify

- [x] 3.1 In `packages/security-audit-sdk-core`, run `npm ci`, `npm run check:generated`, the complete
  `npm run validate` chain and `npm audit --audit-level=low`. Verify each passes and the audit reports
  zero vulnerabilities.
- [x] 3.2 Run the final design-pattern governance phase, both dual-check arms, the contract reuse check
  for every active change, the merge-stage normative precedence check and `git diff --check`. Verify each
  passes.

## 4. Archive

- [x] 4.1 After the owner merges the implementation, archive `upgrade-fast-uri-3-1-8` in a separate pull
  request.
