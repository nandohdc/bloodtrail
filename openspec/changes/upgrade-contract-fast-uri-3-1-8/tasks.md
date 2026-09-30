## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks, design-pattern assessment and contract reuse record for
  `upgrade-contract-fast-uri-3-1-8`. Verify `openspec validate upgrade-contract-fast-uri-3-1-8 --strict`,
  `node openspec/scripts/generate-assessment.mjs --change upgrade-contract-fast-uri-3-1-8 --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` pass.

## 2. Refresh the vulnerable transitive dependency

- [ ] 2.1 Run `npm audit fix --package-lock-only` in `contracts/security-audit`. Verify the diff changes only
  the `node_modules/fast-uri` version, registry URL and integrity, to 3.1.8, that `package.json` is unchanged,
  and that the lockfile is byte-identical to Dependabot's #676.

## 3. Verify

- [ ] 3.1 In `contracts/security-audit`, run `npm ci`, `npm run check:generated`, `npm run validate`, and
  `npm audit` at `high` and at `low`. Verify each passes and no generated artifact changes.
- [ ] 3.2 Run sdk-core's `test:changed-paths` and `test:contract-immutability`, the final design-pattern
  governance phase, both dual-check arms, the contract reuse check for every active change, the merge-stage
  normative precedence check and `git diff --check`. Verify each passes.

## 4. Archive

- [ ] 4.1 After the owner merges the implementation, archive `upgrade-contract-fast-uri-3-1-8` in a separate
  pull request.
