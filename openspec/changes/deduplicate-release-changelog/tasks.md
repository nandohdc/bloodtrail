## 1. Governed planning and proposal delivery

- [x] 1.1 Generate and validate the design-pattern assessment for this governance-core change; verify `governance_core_path` and `canonical_capability_requirement` triggers are matched, owned-path inventory is closed, and all 15 security dimensions are justified. — Generated assessment with assessment-phase governance passed. All 15 security dimensions justified.
- [x] 1.2 Author the `release-versioning-tag-model` delta as an `ADDED` requirement with scenarios for duplicate merge commit removal, multi-commit PR preservation, non-merge duplicate preservation, and check mode detection. — Added requirement `The generated release changelog lists each merged change once` with four distinct scenarios.
- [x] 1.3 Run `npx --yes @fission-ai/openspec@latest validate deduplicate-release-changelog --strict`, assessment-phase design-pattern governance, and `git diff --check`; commit proposal packet with Conventional Commit. — OpenSpec validation passed (15/15), assessment phase governance passed, git diff clean. Committed as `0050da9`.
- [x] 1.4 Push and merge dedicated proposal PR only after all CI checks pass on its exact head; verify `origin/main` carries proposal before implementation. — PR #508 passed all 16 CI checks and merged via `--admin --merge` as `bbd43f9`.

## 2. Cleaner implementation and unit tests

- [x] 2.1 Implement `.github/scripts/clean-release-changelog.mjs` parsing changelog entries and inspecting git commit topology to drop duplicate merge commits while preserving branch commits. — Implemented with `createGitResolver`, `parseSectionEntries`, `identifyDuplicateEntries`, `cleanSection`, and `cleanChangelog`.
- [x] 2.2 Add support for `--check` mode in `clean-release-changelog.mjs` exiting non-zero when duplicates are found. — Implemented `--check` mode in `main` and exported `checkChangelog`.
- [x] 2.3 Add unit test suite `.github/scripts/clean-release-changelog.test.mjs` using `node:test` covering all acceptance criteria with synthetic fixtures. — Added 11 unit tests covering merge commit removal, multi-commit PR retention, identical-subject non-merge preservation, breaking change preservation, snippet cleaning, and `--check` mode.
- [x] 2.4 Verify unit tests pass with `node --test .github/scripts/clean-release-changelog.test.mjs`. — All 11 tests pass with 0 failures.

## 3. Workflow integration and changelog deduplication

- [x] 3.1 Update `.github/workflows/release-please.yml` to run the deduplication step when release PRs are created or updated. — Added checkout, setup-node, and deduplication steps for release PR branch and PR description.
- [x] 3.2 Run `clean-release-changelog.mjs` on `CHANGELOG.md` to remove the 17 duplicate entries in `[0.18.0]`. — Ran on `CHANGELOG.md --section 0.18.0`, dropping 30 duplicate merge commit entries and retaining all 50 unique branch commits.
- [x] 3.3 Verify `--check` mode passes on the cleaned `CHANGELOG.md`. — Verified with `node .github/scripts/clean-release-changelog.mjs --check --section 0.18.0` (exited 0, no duplicates found).

## 4. Verification and implementation delivery

- [ ] 4.1 Run full product test loop, all script tests (`node --test .github/scripts/*.test.mjs`), `make runtime-gates`, and `git diff --check`.
- [ ] 4.2 Push implementation branch, open PR with complete PULL_REQUEST_TEMPLATE.md, verify all CI checks pass.
- [ ] 4.3 Merge implementation PR via `--admin --merge` after all CI checks pass.

## 5. Lifecycle completion: fold, archive, and issue closure

- [ ] 5.1 Fold `release-versioning-tag-model` delta into canonical spec `openspec/specs/release-versioning-tag-model/spec.md`.
- [ ] 5.2 Archive change to `openspec/changes/archive/2026-09-12-deduplicate-release-changelog/`.
- [ ] 5.3 Close Issue #471 with comprehensive verification comment.
