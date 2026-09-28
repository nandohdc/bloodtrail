## Why

#471 added a release changelog cleaner, and the first large release since then shows that it fails
open (#642). `release-versioning-tag-model` requires that "the generated release section and release
PR description SHALL NOT duplicate entries for the same change", and that "a check mode SHALL assert
that the release changelog contains no duplicate entries". Release PR #537 (`v0.21.0`) violates both
requirements while every gate stays green:

- **Entries with an issue-reference suffix are invisible.**
  - Release Please renders a commit with a `Refs #N` footer (this repository's own referencing
    convention) with a trailing `, closes [#N](…)`.
  - The cleaner's entry pattern requires the line to end at the commit link, so it skips that
    bullet, and the merge-commit entry that duplicates it survives.
  - `v0.21.0` keeps 7 such duplicates.
- **Check mode shares the blind spot, and nothing runs it.** It reports the `v0.21.0` section
  clean, and no workflow or required check invokes it.
- **The PR-description cleanup has never run in CI.**
  - It shells out to `gh`, which the release job's runner does not have. The error is caught and
    printed as a warning, and the step succeeds.
  - Release Please builds the GitHub Release notes from that description. The published `v0.20.0`
    notes therefore list every change twice, while `CHANGELOG.md` lists each change once.
- **An unresolvable commit reads as a regular commit.** The resolver swallows a `git` failure and
  reports "not a merge". In a history that lacks the commit, the merge twin survives and check mode
  passes.

The requirement is already ratified, so the fix restores conformance rather than changing intent. It
also moves enforcement from a warning-only workflow step to a required check, so the next unknown
shape fails instead of shipping.

## Authorization

- The owner approves this change through two acts on the pull request that proposes it:
  1. an approval comment naming this change and the exact head commit SHA;
  2. the owner's own merge of that commit.

  `CONTRIBUTING.md` says merged state alone is never approval, so the comment is required. No agent
  merges that pull request or arms auto-merge on it.
- The capability says "No release-config edit SHALL land while a release-please PR is open". This
  change alters how release pull requests are cleaned and checked, so its implementation is treated
  as a release-config edit and lands only once the open release PR #537 has been merged or closed.
  That choice is the owner's, and this change makes neither. The proposal itself adds planning
  artifacts only.
- It authorizes none of the following:
  - a release, a tag, or any merge or edit of #537;
  - an edit to a published changelog section or GitHub Release;
  - a new secret, permission or third-party action;
  - a change to the merge-commit policy.

## What Changes

- **Every entry shape Release Please emits is recognised.**
  - An entry is recognised whether or not it ends with an issue-reference suffix: `, closes`
    followed by one or more linked references.
  - Its subject for de-duplication excludes the suffix, and a retained entry keeps its suffix
    unchanged.
- **Both modes fail closed.**
  - A bullet that links a commit but matches no recognised shape, or whose commit cannot be
    resolved, stops the run with a non-zero exit code that names the bullet.
  - Bullets without a commit link, such as Breaking-change notes, stay out of scope as today.
- **The release PR description is updated without `gh`.**
  - The cleaner reads and writes the description through the GitHub REST API with Node's built-in
    `fetch`, using the token the release job already passes.
  - Any failure exits non-zero before the workflow commits or pushes the de-duplicated changelog.
- **Check mode runs as part of a required check.**
  - `conventional-commits` is a required context that already re-runs whenever a pull request's
    description is edited. It gains a step that runs check mode when a pull request changes
    `version.txt`.
  - That step checks the changelog section for the new version and the pull request's description.
    It fails when that section is missing or when either one contains a duplicate.
  - A pull request that leaves `version.txt` unchanged checks nothing. Published sections,
    including those before `0.18.0` that predate the cleaner, therefore cannot fail unrelated work.
  - The job's checkout gains the full history the check needs to resolve merge commits.
- **Preserved:**
  - distinct non-merge commits that share a subject;
  - every intermediate commit of a multi-commit pull request;
  - the merge-commit policy;
  - every published changelog section.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-versioning-tag-model`: one added requirement, "Release changelog de-duplication fails
  closed and is enforced on every release". It requires that:
  - entries are recognised with or without an issue-reference suffix;
  - both modes fail closed on an entry they cannot recognise or resolve;
  - the release workflow fails when it cannot update the release pull request description;
  - a required status check runs check mode against a release's new section and its pull request
    description.

  "The generated release changelog lists each merged change once" is left unchanged. It already
  states the outcome, and this change adds the enforcement it lacked.

## Impact

- **`.github/scripts/clean-release-changelog.mjs`** and its test file.
- **`.github/workflows/conventional-commits.yml`**: one new step and a full-history checkout. The job
  id, and so the required context name, is unchanged.
- **At the fold:** `openspec/specs/release-versioning-tag-model/spec.md`.
- **Untouched:**
  - `.github/workflows/release-please.yml` and `release-please-config.json`, because the release
    step's command and token do not change;
  - `.github/workflows/ci.yml`;
  - every package, the contract, `CHANGELOG.md`, and every published GitHub Release.
- **Governance:** every touched path is `governance_core`, so the change carries a full assessment.
- **Tracking:** Refs #642. The issue closes after the archive lands.
