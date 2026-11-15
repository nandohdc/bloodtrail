## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and design-pattern assessment for
  `add-sonar-analysis-toggle`. Verify `openspec validate add-sonar-analysis-toggle --strict`,
  `node openspec/scripts/generate-assessment.mjs --change add-sonar-analysis-toggle --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` pass.

## 2. Implement the switch

- [x] 2.1 Extend `.github/scripts/sonar-trust-boundary.test.mjs` with a `vars` context and the
  disabled, default and other-value cases. Observe the disabled cases fail against the unchanged
  workflow.
- [x] 2.2 Prefix the `sonar` job's `if:` with `vars.SONAR_ANALYSIS != 'disabled' &&` and wrap the
  existing trust expression in parentheses, unchanged. Verify every trust-boundary test passes and
  that replacing the switch predicate with `true` makes a disabled event run.

## 3. Verify

- [x] 3.1 Run `node --test .github/scripts/*.test.mjs`, `openspec validate --strict` for the
  change and `git diff --check`. Verify each passes.
- [x] 3.2 Commit the candidate, then run the final design-pattern governance phase against the
  recorded baseline and the repository governance-gate chain. Verify each passes.

## 4. Archive

- [ ] 4.1 After the owner merges the implementation, archive `add-sonar-analysis-toggle` in a
  separate pull request.
