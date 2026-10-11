# Tasks

## 1. Proposal and Governance Assessment

- [x] 1.1 Proposal and Governance Assessment: author the planning artifacts and `assessment.source.json` for `work-item-key`, generate `assessment.json`, and verify strict change validation, generated drift and phase assessment. Run external proposal-structure assertions, existing `.github/scripts` tests, package discovery and core typecheck before the proposal-only commit; keep results outside the repository.

## 2. Implementation and Test

- [x] 2.1 Implementation: update `.github/scripts/check-conventional-commits.mjs` with the single shared work-item predicate and subject-identifying failure message. Verify both title and commit call sites use the same rule and preserve conventional syntax and GitHub fetching.
- [x] 2.2 Test: add `.github/scripts/check-conventional-commits.test.mjs` with positive, negative, existing-syntax and planted-defect control cases. Run the focused CLI tests; require the three rejected work-item cases to pass only under the externally created disabled-predicate mutant, cleaned up in `finally`.

## 3. Verification and Commit

- [x] 3.1 Verification: run `node --test .github/scripts/*.test.mjs`, core typecheck and full governance validations against `f2827060538da5f05b18da7095086af9c98638e7`: strict change validation, generated assessment drift, final design-pattern governance, trusted/candidate dual checks, both active contract-reuse checks, merge-stage normative precedence, `make runtime-gates` and range whitespace. Retain each output and exit code externally and certify the final clean implementation commit.
- [x] 3.2 Commit: tick tasks 2.1, 2.2, 3.1 and 3.2, verify the candidate bytes, then commit only the script, new test file and `tasks.md` as `fix(governance): reject work-item IDs in commit subjects (#743)`. Verify the exact two-commit range, proposal ancestry, restricted eight-path scope and empty index; do not amend the proposal assessment.

## 4. Archive

- [x] 4.1 Archive: after implementation lands, archive `work-item-key` in separate PR #752 and verify the archived result. This remains unchecked throughout the proposal-and-implementation run.
