## 1. Assessment

- [ ] 1.1 Validate and commit the full security-sensitive assessment before implementation.

## 2. Reproduce and fix

- [ ] 2.1 Add the workflow event regression and observe the Dependabot/fork cases fail.
- [ ] 2.2 Replay the original contract lockfile patch and guard the Sonar job; run the regression.

## 3. Verify

- [ ] 3.1 Install contract dependencies, check generated drift, validate and audit the workspace.
- [ ] 3.2 Run repository script tests, OpenSpec validation and the repository governance-gate chain.
- [ ] 3.3 Commit the candidate, then run final governance and trusted/candidate dual checks against
  the recorded mainline baseline; record exact scope and results before pushing PR #888.

## 4. Lifecycle

- [ ] 4.1 After owner review and merge, fold or archive in a separate change as applicable.
