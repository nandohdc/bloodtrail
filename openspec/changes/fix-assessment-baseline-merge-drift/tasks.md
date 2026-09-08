## 1. Assessment and RED regression

- [x] 1.1 Create the full governance assessment for the generator, tests, active collector source, and this change; record the stable baseline and all security dimensions before implementation.
- [x] 1.2 Add a focused RED fixture proving a generated assessment passes before a descendant merge commit but fails afterward under the current HEAD fallback.

## 2. Stable generation

- [x] 2.1 Require an authored proposal baseline during generation and emit a bounded diagnostic when it is absent.
- [x] 2.2 Migrate the active collector assessment source to its recorded pre-merge baseline and regenerate its artifact without hand-editing generated JSON.
- [x] 2.3 Make the merge-boundary fixture green and retain the existing drift-detection arm.

## 3. Verification and delivery

- [ ] 3.1 Run focused governance tests, strict OpenSpec validation, baseline/candidate governance checks, and `git diff --check`.
- [ ] 3.2 Commit, open a PR with the full governance posture, and merge only after exact-head CI is green.
