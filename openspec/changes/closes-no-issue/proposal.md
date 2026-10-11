# Proposal

## Why

Issue #744, adopted under the owner's spec #747, identifies a release PR that can close unrelated tracker issues: Release Please converts deliberately non-closing `Refs #N` footers into `closes [#N](…)`, which GitHub executes when the PR merges into the default branch. Precedent #642 made these suffixes recognisable but preserved them unchanged; the ratified suffix-preservation clause must now change alongside the cleaner.

Commit `de94202` carries `Refs #649`, yet release PR #672 at `899a9d8` / `6b18395` contains `closes [#649](…)` in its description (line 88) and changelog. GitHub registered #672 in #649's `closedByPullRequestsReferences`. This instance is inert because #649 is already closed, but an open epic such as #700 would be closed without its work being complete. The notes also wrongly attribute issue closure to a reference-only commit.

## What Changes

- Neutralize Release Please's `closes [#N]` form to `refs [#N]` in retained release entries and release PR descriptions, preserving links and every other suffix byte.
- Recognise both `closes` and `refs` suffixes for subject-based merge-twin de-duplication.
- Fail check mode on any remaining closing keyword in the original selected section or description, naming the offending entry or line. Cleaning must persist keyword-only changes even when no duplicate is dropped.
- Preserve distinct non-merge commits with identical subjects, intermediate commits, non-commit entries, and unselected historical sections. Existing malformed-entry, commit-resolution and REST failure behavior remains fail-closed.
- Deliver proposal and implementation as separate commits. Fold #751 and archive #754 are later, separate tickets and PRs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-versioning-tag-model`: modify “Release changelog de-duplication fails closed and is enforced on every release” to keep suffixes unchanged except that a closing keyword becomes a non-closing reference; add “A release pull request closes no issue”. Keep every existing scenario name and leave the separate distinct-non-merge preservation requirement untouched.

## Impact

- Implementation: `.github/scripts/clean-release-changelog.mjs` and `.github/scripts/clean-release-changelog.test.mjs` only; no new dependency, credential, permission, or API surface is required.
- Planning: the seven files in `openspec/changes/closes-no-issue/`, including a generated full assessment. `.github/scripts/` is `governance_core`, and a normative capability requirement changes, so both full-assessment triggers apply.
- Untouched: Release Please's `release-please-config.json`, `.release-please-manifest.json`, and `.github/workflows/release-please.yml`; all other workflows, `CHANGELOG.md`, canonical specs, package versions, contract and instruction files.
- #747 settles the release-config boundary as those three Release Please files, not the post-processing cleaner (#471 / #642 precedent). Do not inherit #642's superseded implementation-wait rule. v0.22.0 ships as generated; this fix must land before the next release PR merges.
- No push, PR creation, release merge, issue mutation, fold, or archive is performed in this run. Live regeneration and GitHub's closure-link observation remain owner/mainline integration checks, not claims proven locally.
