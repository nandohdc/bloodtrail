## 1. Correct the Codecov invocation

- [x] 1.1 Replace `report-type` with `report_type`, add
  `disable_search: true` to the test-results upload, and verify the coverage
  invocation and all other test-results inputs remain unchanged in the focused
  workflow diff.

## 2. Verify governance and workflow configuration

- [x] 2.1 Run strict validation for `fix-codecov-test-results-upload`, strict
  validation for all OpenSpec content, and `git diff --check`; verify every
  command passes.
- [x] 2.2 Run the trusted-baseline and candidate design-pattern governance
  checks separately for this governance-core workflow edit; verify both accept
  the association, assessment ordering, owned path, and security-sensitive
  classification.

## 3. Deliver and observe

- [x] 3.1 Commit the assessment before the workflow implementation, push the
  focused branch, and open a pull request using every section of the repository
  template; verify the remote branch and PR head match the local branch head.
- [x] 3.2 In the first Actions run containing the correction, verify the
  test-results step has no unexpected-input warning, reports
  `CC_REPORT_TYPE: test_results`, invokes Codecov with
  `--report-type test_results`, and considers only the two declared JUnit XML
  files. Verified in run `33650343593`, job `100315849998`: the step emitted no
  unexpected-input warning, selected exactly two `test_results` files, selected
  no LCOV file, and queued the upload successfully.
