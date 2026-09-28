# Tasks

This change fixes #642. The proposal and implementation are delivered as separate commits / pull requests. The fold and archive are handled in subsequent lifecycle steps.

## 1. Governed Planning and Proposal Delivery

- [x] 1.1 Author the OpenSpec proposal, delta specification, technical design, and task list for `fix-release-changelog-dedup-fails-open`. Verify `npx --yes @fission-ai/openspec@latest validate fix-release-changelog-dedup-fails-open --strict` passes.
- [x] 1.2 Author and generate the design-pattern governance assessment (`assessment.source.json` and `assessment.json`); verify `node openspec/scripts/generate-assessment.mjs --change fix-release-changelog-dedup-fails-open --check` passes and `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` succeeds.
- [x] 1.3 Commit proposal packet and verify `git diff --check` passes cleanly before submitting proposal PR.

## 2. Cleaner Entry Grammar and Resolver Hardening

- [ ] 2.1 Update `ENTRY_REGEX` and `parseSectionEntries` in `.github/scripts/clean-release-changelog.mjs` to recognise bullet entries ending with issue-reference suffixes (e.g. `, closes [#N](...)`) and strip the suffix when extracting subjects for de-duplication while retaining suffixes byte-for-byte in kept entries. Verify with focused unit tests in `.github/scripts/clean-release-changelog.test.mjs`.
- [ ] 2.2 Update entry parsing to fail closed: assert that any bullet entry containing a commit link that does not match the recognised grammar exits non-zero and names the malformed entry. Verify with failing-fixture unit test in `.github/scripts/clean-release-changelog.test.mjs`.
- [ ] 2.3 Harden `createGitResolver` in `.github/scripts/clean-release-changelog.mjs` so that `git` resolution failures throw rather than defaulting to non-merge commits. Verify with unresolvable SHA fixture unit test in `.github/scripts/clean-release-changelog.test.mjs`.

## 3. PR Description REST API Client

- [ ] 3.1 Replace external `gh` CLI invocations in `cleanPullRequestBody` with direct REST calls using Node's built-in `fetch` (`GET` and `PATCH` `/repos/{repo}/pulls/{n}` with `X-GitHub-Api-Version: 2022-11-28`). Verify unit tests with mocked injectable `fetch` cover success, no-op when already clean, and body verification after update.
- [ ] 3.2 Ensure description cleanup fails closed with sanitized diagnostics (excluding tokens/headers) on missing environment variables (`GH_TOKEN`, `GITHUB_REPOSITORY`), non-2xx responses, network errors, or response mismatch. Verify unit tests cover each error path.

## 4. Check Mode Flags and Event Description Verification

- [ ] 4.1 Implement `--release-base <ref>` in `clean-release-changelog.mjs` comparing `version.txt` at `<ref>` with working tree `version.txt`: exit 0 immediately if unchanged, or target the new version section and fail if missing or containing duplicates. Verify with unit tests exercising both matching and bumped version scenarios.
- [ ] 4.2 Implement `--event-description` in `clean-release-changelog.mjs` reading `pull_request.body` from `GITHUB_EVENT_PATH` and checking it for duplicates with the same parsing logic. Verify with unit tests exercising clean and duplicated event payloads.

## 5. Workflow Integration into Required Status Checks

- [ ] 5.1 Update `.github/workflows/conventional-commits.yml` to checkout with `fetch-depth: 0` and add a step executing `node .github/scripts/clean-release-changelog.mjs --check --release-base "$BASE_SHA" --event-description` on pull requests changing `version.txt`. Verify workflow syntax and validate against workflow tests.

## 6. Verification and Governance Finalization

- [ ] 6.1 Run all script tests via `node --test .github/scripts/*.test.mjs` and execute `node .github/scripts/clean-release-changelog.mjs --check` against test fixtures and existing clean sections.
- [ ] 6.2 Execute full product test loop across all workspaces (`make runtime-gates`) and verify zero regressions.
- [ ] 6.3 Run `node openspec/scripts/check-design-pattern-governance.mjs --phase final` and verify design-pattern governance passes.

## 7. Lifecycle Completion: Spec Fold and Archive

- [ ] 7.1 Fold `release-versioning-tag-model` delta into canonical specification `openspec/specs/release-versioning-tag-model/spec.md`. Verify `openspec validate --all --strict` passes.
- [ ] 7.2 Archive change `fix-release-changelog-dedup-fails-open` under `openspec/changes/archive/`. Verify archive structure and close issue #642.
