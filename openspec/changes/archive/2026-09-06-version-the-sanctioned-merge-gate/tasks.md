## 1. Versioned Merge Gate Decision Module

- [x] 1.1 Implement `.github/scripts/merge-gate.mjs` with pure gate functions for pull-request state, required-context presence and passing, review verdict bound to the exact head, and merge method
- [x] 1.2 Assert required-context presence against `.required_status_checks.contexts` from branch protection, refusing when protection is unreadable or reports no contexts
- [x] 1.3 Return `--merge` as the single merge method for every pull request, recording the archive reason separately without letting it select the method

## 2. Versioned Operator Entry Point

- [x] 2.1 Implement `.github/scripts/merge-pr.sh` collecting pull-request metadata, changed paths, required contexts, reported checks, and reviewer runs, failing closed on any unreadable source
- [x] 2.2 Delegate the merge decision to `merge-gate.mjs` and merge only on a clean gate report, using `--merge --delete-branch --match-head-commit`

## 3. Executable Gate Arms Behind a Required Check

- [x] 3.1 Implement `.github/scripts/merge-gate.test.mjs` covering each gate arm with a defective input and its null control, including the PR #245 missing-context shape and the non-archive squash shape
- [x] 3.2 Replace the hand-named test file in `ci.yml`'s `design-pattern-governance` job with `node --test .github/scripts/*.test.mjs`, recovering the never-run `npm-audit-retry.test.mjs`

## 4. Documentation and Verification

- [x] 4.1 Correct CONTRIBUTING.md's account of branch protection and document the sanctioned merge path
- [x] 4.2 Run `node --test .github/scripts/*.test.mjs` and confirm every arm and null control passes
- [x] 4.3 Run `.github/scripts/merge-pr.sh --dry-run` against a live open pull request and confirm the gate report matches its observed check state
- [x] 4.4 Verify governance with `check-design-pattern-governance.mjs --phase assessment` and `run-governance-dual-check.mjs`
