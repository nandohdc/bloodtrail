## 1. Assessment

- [x] 1.1 Author the proposal, delta, design and assessment before implementation; verify strict validation, assessment generation and assessment-phase governance.

## 2. Runner and CI

- [x] 2.1 Implement discovery and execution with vertical TDD at the runner command seam; verify multiple active suites, archive exclusion, no-harness not-applicable, missing/empty/unreadable suites, symbolic links and a failing fixture with its passing null control.
- [x] 2.2 Wire the runner into the existing required governance context; verify the real active harness suite runs on Node 26.5.0 without a probe approval and the workflow retains its context names.

## 3. Verification

- [ ] 3.1 Run repository-script tests, strict change validation, full product/governance validation, baseline/candidate governance, contract reuse, generated/path checks, whitespace and CodeScene; record exact results on the final head.
- [ ] 3.2 Complete AGY and two-axis code reviews, verify unchanged HEAD/tree after review, and require all declared CI contexts plus DeepScan before the merge.
- [ ] 3.3 Fold the delta into canonical ci-topology in a separate reviewed PR and verify synchronization.

## Workflow follow-up

- Archive in a separate PR after the fold merges; verify no canonical writes are bundled with archival.
- Close #877 only after acceptance and its governed lifecycle are complete. Continue #838 under its own exact-head S1.
