## Context

Release Please automatically generates release PRs and updates `CHANGELOG.md` upon pushes to `main`. When Bloodtrail pull requests are merged, GitHub creates merge commits with subjects like `Merge pull request #<num> from <branch>` and commit bodies repeating the PR title.

Because Release Please's commit parser splits messages on Conventional Commit headers, it parses both the merge commit body and the individual commits of the merged branch, producing two changelog entries for every merged pull request (#471). In `v0.18.0`, this produced 17 duplicate entry pairs across `CHANGELOG.md`.

GitHub Repository API forbids configuring `merge_commit_message: "BLANK"` with `merge_commit_title: "PR_TITLE"` (HTTP 422 `invalid_merge_commit_setting_combo`). Release Please upstream maintainers closed Issue #2476, declining to deduplicate merge commits and recommending squash-only workflows instead. Bloodtrail's ratified release and governance rules mandate merge commits (`gh pr merge --admin --merge`) to preserve commit history, provenance, and auditability.

## Goals / Non-Goals

**Goals.**
- Deterministically deduplicate release changelog entries produced by Release Please.
- Retain the genuine branch commit and drop the redundant merge commit entry when subjects match.
- Preserve all intermediate commits in multi-commit pull requests.
- Preserve genuine duplicate commits with identical subjects when neither is a merge commit.
- Provide a `--check` mode to verify changelog cleanliness in CI.
- Integrate deduplication into `.github/workflows/release-please.yml` so release PR branches and bodies are cleaned automatically.
- Clean the historical `[0.18.0]` duplicate entries from `CHANGELOG.md`.

**Non-Goals.**
- Abandoning merge commits in favor of squash merges.
- Altering Release Please's upstream release algorithm or manifest format.
- Modifying runtime code or package publishing behavior.

## Decisions

### D1 — Implement post-processing script using git commit graph inspection

The cleaner parses changelog entries and extracts their commit SHAs. For each entry:
- It checks git commit topology using `git rev-parse --verify ${sha}^2` or `git cat-file -p ${sha}` to determine parent count.
- A commit with multiple parents (`parentCount > 1`) whose subject starts with `Merge ` is identified as a merge commit.
- If a merge commit duplicates the subject of a branch commit within the same release section, the merge commit entry is dropped and the branch commit entry is retained.
- If a merge commit has no corresponding branch commit in the section (e.g. direct merge or squashed commit), the merge commit entry is preserved.
- If two entries have the same subject but neither is a merge commit, both are preserved.
- Multi-commit PRs have distinct subjects for each commit, so all intermediate commits are preserved.

### D2 — Support `--check` mode and Injectable Git Executor for Testability

`.github/scripts/clean-release-changelog.mjs` supports:
- `--file <path>` (defaults to `CHANGELOG.md`) to clean the file in-place.
- `--check` mode which scans the changelog, reports any duplicate entries found, and exits with code 1 if duplicates exist without modifying the file.
- Injectable git runner / commit resolver functions so unit tests in `clean-release-changelog.test.mjs` can run deterministically against synthetic commit topologies without executing child processes or touching git state.

### D3 — Integrate into `.github/workflows/release-please.yml`

In `.github/workflows/release-please.yml`, after the `googleapis/release-please-action@v5` step executes:
- If a release PR exists or was updated (`steps.release.outputs.pr` is present):
  - Check out the release PR branch `release-please--branches--main`.
  - Run `node .github/scripts/clean-release-changelog.mjs`.
  - If `CHANGELOG.md` is modified, commit with `chore: deduplicate release changelog` and push to `release-please--branches--main`.
  - Update the PR body using the cleaned release notes via `gh pr edit`.

### D4 — Clean `[0.18.0]` historical entries in `CHANGELOG.md`

`CHANGELOG.md` contains 17 duplicate entry pairs under `## [0.18.0]`. The cleaner will be run on `CHANGELOG.md` to remove these 17 duplicate merge-commit entries, establishing a clean baseline for future releases and `--check` assertions.

## Risks / Trade-offs

- **Merge commit identification requires git history**: The cleaner uses git commands to inspect commit topology. In CI, checkout must provide adequate fetch depth (`fetch-depth: 0` or sufficient history). CI jobs running governance gates already fetch with `fetch-depth: 0`.
- **Workflow push permissions**: Pushing the cleaned changelog to `release-please--branches--main` requires repository write permissions, which `.github/workflows/release-please.yml` already possesses via `secrets.RELEASE_PLEASE_TOKEN`.
- **Governance core path**: Modifying `.github/scripts/` and `.github/workflows/` touches `governance_core` paths, requiring full design-pattern assessment and 15-dimension security justification.
