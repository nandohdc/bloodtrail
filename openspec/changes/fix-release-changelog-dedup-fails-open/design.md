## Context

See `proposal.md` for the defects. The cleaner has these shapes today:

- **Parser.** `ENTRY_REGEX` is anchored at the commit link, `([<sha>](<url>))\s*$`, and
  `parseSectionEntries` silently skips any bullet it does not match. The cleaning mode, the check mode
  and the description cleanup all share that parser.
- **Resolver.** `createGitResolver` runs `git log` and `git rev-list`. On any failure it returns "not
  a merge, nothing merged".
- **Description cleanup.** `cleanPullRequestBody` runs `gh pr view` and `gh pr edit`, catches every
  error, and prints a warning.
- **Only caller.** The release job in `release-please.yml` runs `release-please-action`, checks out
  `release-please--branches--main` with full history, and runs
  `clean-release-changelog.mjs --pr <n>`. Its shell stops at the first failing command, so the next
  lines, which commit and push `CHANGELOG.md`, run only after that command exits 0. The job
  authenticates with the `RELEASE_PLEASE_TOKEN` PAT as `GH_TOKEN`.
- **Where the release notes come from.** Release Please writes the same notes into the new
  changelog section and into the release PR description, and builds the GitHub Release notes from
  the description. Two releases show this:
  - the `v0.20.0` notes carry the 6 bullets of PR #519's description, while its changelog section
    has 3;
  - the `v0.19.0` notes carry PR #509's description as it was rewritten out of band.
- **Which workflows see what.** The required contexts are pinned at ten by `ci-topology`.
  - `ci.yml` runs on `pull_request` with its default event types, so a description edit never
    triggers it. Two active changes own `ci.yml`.
  - `conventional-commits.yml` runs on `opened`, `edited`, `reopened`, `synchronize` and
    `ready_for_review`, holds `contents: read` and `pull-requests: read`, checks out shallow, and
    no active change owns it.
  - Description edits authored with the PAT trigger workflows. Edits authored with `GITHUB_TOKEN`
    would not.

## Goals / Non-Goals

**Goals:**

- Every bullet that links a commit is either recognised or fatal. Nothing is skipped silently.
- One enforcement point sees both the changelog section and the live PR description.
- No new binary, action, secret or permission, and no change to `release-please.yml`.

**Non-Goals:**

- Preventing duplicates at merge time. The merge-commit policy stays.
- Rewriting published data: sections before `0.18.0`, the `v0.20.0` GitHub Release notes, and
  `0.21.0` if #537 is merged first.
- How Release Please renders a `Refs` footer, which it words as "closes".
- The #582 Breaking-heading question, and commit classification generally.
- Deciding what happens to #537.

## Decisions

### D1. Locate the commit link, then classify what follows it

An entry has four parts:

- the bullet prefix;
- the subject;
- the commit link ` ([<hex>](<url>/commit/<hex>))`;
- an optional reference suffix: `, closes` followed by one or more `[<ref>](<url>)`, separated by a
  space or by `, `.

A bullet is **linked** when it contains a commit link. A linked bullet with anything other than the
suffix grammar after its link is unrecognised and fatal. Unlinked bullets, such as Breaking-change
notes, stay out of scope exactly as today.

The subject used for grouping excludes the suffix. The cleaner still drops whole lines and never
rewrites a line it keeps, so a retained entry keeps its suffix byte for byte.

Patterns stay linear: no nested quantifiers over overlapping character classes (Sonar S5852).

Alternatives considered:

- **Widen the pattern to accept any trailing text.** Rejected: it would "recognise" arbitrary text
  and hide the next unknown shape. That is the failure being fixed.
- **Parse the Markdown with a library.** Rejected: the entry is a one-line template, and a library
  would be a new dependency.

### D2. A resolution failure is fatal

The resolver stops swallowing `git` failures. A failed lookup throws an error that names the SHA,
and the CLI turns it into exit 1 with the entry named.

In both callers the history is complete, so a failure means something is actually wrong: a shallow
clone, a rewritten history, or a mistyped SHA. Reading a missing merge commit as a regular commit is
the fail-open path.

### D3. Update the description over REST with the built-in `fetch`

The cleaner updates the description in four steps:

1. `GET {GITHUB_API_URL}/repos/{GITHUB_REPOSITORY}/pulls/{n}`, with a bearer token from `GH_TOKEN`,
   `Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28`.
2. Clean the body with the same logic as the changelog section.
3. If the body changed, `PATCH` it with `{ "body": … }`.
4. Verify the `PATCH` response body against the cleaned text, ignoring line-ending normalization.

Each of these exits non-zero:

- a missing `GH_TOKEN` or `GITHUB_REPOSITORY`;
- a non-2xx response;
- a network error;
- a verification mismatch.

Diagnostics name the method, the API path and the HTTP status only. They never include the token,
request headers or response headers.

`fetch` is injectable, the same way `execGit` already is, so every outcome is tested without the
network. `release-please.yml` stays unchanged:

- the step already passes `GH_TOKEN`;
- the runner sets `GITHUB_REPOSITORY` and `GITHUB_API_URL`;
- a non-zero exit already stops the step before it commits or pushes.

When the description cannot be cleaned, the uncleaned section therefore stays on the branch, and
the required check (D4) fails on it.

Alternatives considered:

- **Install `gh` in the job**, with `apt` or a setup action. Rejected: it adds a binary or a
  third-party action to a job that holds a write-scoped PAT, all for two HTTP calls. The runner
  image also lives in another repository.
- **`actions/github-script`.** Rejected: a third-party action would hold the PAT, and the logic
  would move into YAML, where the repository script tests cannot reach it.

### D4. The required check is a step in the `conventional-commits` job

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0     # the release changelog check resolves merge commits and reads the base version
# …existing setup-node and conventional-commit steps…
- name: Release changelog lists each change once
  env:
    BASE_SHA: ${{ github.event.pull_request.base.sha }}
  run: node .github/scripts/clean-release-changelog.mjs --check --release-base "$BASE_SHA" --event-description
```

- **`--release-base <ref>`** compares `version.txt` at `<ref>` with the working tree.
  - If they are equal, the step prints that the range contains no release and exits 0. It reads
    neither `CHANGELOG.md` nor the event.
  - If they differ, the target is the section for the new version. A missing section is exit 1.
- **`--event-description`** reads `pull_request.body` as data from the file at `GITHUB_EVENT_PATH`.
  The description is never interpolated into a shell. It is checked with the same logic as the
  section, and a missing event file or body on a release range is exit 1.

This job is the right host for four reasons:

- it is one of the ten required contexts;
- it already runs on `edited`, so every description edit re-runs the check, whether the edit comes
  from Release Please or from the cleaner (both use the PAT);
- it already holds `pull-requests: read`;
- no active change owns its workflow file.

On a release pull request the runs happen in this order:

1. Release Please pushes. This is a `synchronize` event, and the check fails on the duplicates.
2. The cleaner patches the description. This is an `edited` event, and the check still fails,
   because the cleaned section is not pushed yet.
3. The cleaner pushes the cleaned section. This is a `synchronize` event on a new head, and the check
   passes.

Status is read per head commit, so the passing run is the one that counts. If any step fails, the
head keeps its failing run.

Alternatives considered:

- **A step in `ci.yml`'s `design-pattern-governance` job.** Rejected: `ci.yml` never runs on
  `edited`, so it would read a stale description or none. Its file is also owned by two active
  changes whose signed records bind governance objects.
- **A new job.** Rejected: a new context is not required unless branch protection changes, and
  `ci-topology` pins the required set at exactly ten.

### D5. `version.txt` decides what gets checked

The check keys on a change to `version.txt`, not on the release branch name. That covers the
manual-fallback release path and needs no branch-name constant. Published sections are never read,
whether they predate the cleaner or are a `0.21.0` published before this change lands.

## Risks / Trade-offs

- **Release Please emits a shape the grammar does not know.** Mitigation: the release job and the
  required check both fail and name the entry, and the grammar is extended in a governed change.
  This is the intended trade: a loud failure instead of silent duplicates.
- **The check fails on a release PR between Release Please's push and the cleaner's push.**
  Mitigation: this is transient and expected. It blocks merging only until the cleaned section
  lands, which is what failing closed means.
- **The GitHub API is down or changes.** Mitigation: the release job fails, and the recovery is the
  existing `gh workflow run release-please.yml --ref main` from `RELEASING.md`.
- **A full-history checkout slows `conventional-commits`.** Mitigation: the repository pack is about
  6 MiB (1,158 commits on 2026-09-28), and non-release pull requests exit before reading any
  history.
- **A fork puts crafted text in its description.** Mitigation: the description is read from the
  event file as data, is never passed to a shell, and is examined only on a range that changes
  `version.txt`.
- **#537 is merged with its 7 duplicates before this lands.** Mitigation: the section stays as
  published, and D5 keeps it out of the check.

## Migration Plan

1. Merge the proposal pull request, which contains planning artifacts only.
2. The owner merges or closes #537. Until then, the implementation cannot land, because the
   capability forbids a release-config edit while a release PR is open.
3. Merge the implementation pull request. The next push to `main` runs the release job with the new
   cleaner, and every later release PR is checked by `conventional-commits`.
4. Fold the delta, then archive the change, each in its own pull request.

Rollback: revert the implementation merge commit. The old cleaner and workflow return, and no
published data changes in either direction.
