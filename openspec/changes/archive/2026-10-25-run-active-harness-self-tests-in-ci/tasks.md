## 1. Assessment

- [x] 1.1 Author the proposal, delta, design and assessment before implementation; verify strict validation, assessment generation and assessment-phase governance.

## 2. Runner and CI

- [x] 2.1 Implement discovery and execution with vertical TDD at the runner command seam; verify multiple active suites, archive exclusion, no-harness not-applicable, missing/empty/unreadable suites, symbolic links and a failing fixture with its passing null control.
- [x] 2.2 Wire the runner into the existing required governance context; verify the real active harness suite runs on Node 26.5.0 without a probe approval and the workflow retains its context names.

## 3. Verification

- [x] 3.1 Run repository-script tests, strict change validation, full product/governance validation, baseline/candidate governance, contract reuse, generated/path checks, whitespace and CodeScene; record exact results on the final head. Evidence: on final head `08c614bcfa0eda3451cb24c721a0e625efdee36f`, the required `design-pattern-governance`, SDK, contract, research and coverage jobs passed; CodeScene and DeepScan also passed. Local nine-test Node 26.5.0 verification is recorded in PR #885; the final-head CI results were independently rechecked during the fold.
- [ ] 3.2 Complete AGY and two-axis code reviews, verify unchanged HEAD/tree after review, and require all declared CI contexts plus DeepScan before the merge. Evidence: on head `08c614bcfa0eda3451cb24c721a0e625efdee36f` in PR #885, all ten required contexts plus DeepScan, CodeScene and Codecov passed; AGY high-effort sandboxed plan-mode review accepted the final head with unchanged tree/HEAD (`/tmp/bloodtrail-877-agy-review-final.log`). The two-axis review originally covered `5505e4a`; the final refactor received its two-axis review only after merge. This historical sequencing requirement remains unfulfilled; the post-merge review is recorded in the fold PR and is not retroactive approval. The owner merged PR #885 as `f12fbd80619aaaacfa43d48b88b0b40dc3f1eb0c`.
- [x] 3.3 Fold the delta into canonical ci-topology in a separate reviewed PR and verify synchronization. Evidence: the two ADDED requirements are appended unchanged to `openspec/specs/ci-topology/spec.md` in this dedicated fold PR, while the change is active (ADR 0001).
- [x] 3.4 Archive the change in a separate PR, after the fold lands. Evidence: relocated to openspec/changes/archive/2026-10-25-run-active-harness-self-tests-in-ci in this dedicated archive PR, after fold PR #886 merged as b1baaba1a12260f890538a8e1e8da54a7fe5092a.

## Workflow follow-up

- Archive in a separate PR after the fold merges; verify no canonical writes are bundled with archival.
- Close #877 only after acceptance and its governed lifecycle are complete. Continue #838 under its own exact-head S1.
