# Proposal — version-the-sanctioned-merge-gate

Bring the sanctioned merge path into the repository and put its decision behind a required check.

## Why

`~/.hermes/scripts/hermes-merge-pr.sh` calls itself "the only sanctioned merge path for bloodtrail",
yet it lives outside the repository, has no tests, and is covered by no required check. Two defects
sat in it undetected (#246):

- **A required context that never started was invisible.** The gate counted `gh pr checks --required`,
  which lists only contexts that have *reported*. A context that never started is absent from that
  list rather than pending in it, so "nothing is failing" settled on an incomplete set. Observed live
  on PR #245: eight contexts reported, all passing, zero not-passing, while `sonar` had never run —
  `sonar` declares `needs: [ci, sdk, contract, coverage]`, so an evicted upstream job keeps it from
  ever being created. The script would have merged an ungated pull request.
- **Non-archive pull requests were squashed.** The merge method was chosen by whether a changed path
  started with `openspec/changes/archive/`. A squash replays the branch as one commit parented on the
  target tip, orphaning the commit a governance record named, and `check-governance-history.mjs` then
  fails `governance-commit-not-ancestor`. Fold pull requests are exactly that case: the CRA fold
  commit `60411db` is bound as `reviewedCommit` in `verification-lifecycle.json` and is an ancestor
  of `main` only because PR #238 landed as a merge commit.

Both are fixed in the out-of-tree copy. This change closes the structural gap that let them ship: the
logic was untestable because it was unversioned, and it was unversioned because root `scripts/` is an
unclassified path in `design-pattern-policy.json` and unclassified paths fail closed.

The same gap has a second, independent instance already in the repository. `.github/scripts/npm-audit-retry.test.mjs`
was written, is passing, and is run by **no check at all** — `ci.yml` names `check-package-discovery.test.mjs`
by hand rather than globbing the directory, so a test file added beside it is silently never executed.
A hand-maintained list of test files is the same defect class as a hand-counted list of required
contexts: it fails by omission, and omission looks like success.

## What Changes

- **Version the decision, separately from the I/O.** Add `.github/scripts/merge-gate.mjs`: pure
  functions over plain JSON evidence — pull-request state, required contexts versus reported checks,
  the review verdict bound to the exact head, and the merge method — plus a CLI that reads an
  evidence object and exits non-zero when any arm refuses. It reaches no network and shells out to
  nothing, which is what makes it testable.
- **Version the operator entry point.** Add `.github/scripts/merge-pr.sh`, which collects the
  evidence from `gh` and `hermes`, delegates the judgment to `merge-gate.mjs`, and merges only on a
  clean gate report. Every evidence source fails closed: an unreadable source is indistinguishable
  from an empty one to the gate, and empty evidence must never be why a merge is allowed.
- **Put the arms behind a required check.** Add `.github/scripts/merge-gate.test.mjs`, asserting each
  arm against both a defective input and its null control, and replace the hand-named test file in
  `ci.yml`'s `design-pattern-governance` job with `node --test .github/scripts/*.test.mjs` so every
  test beside a repository script runs — recovering `npm-audit-retry.test.mjs` in the same edit.
- **Correct CONTRIBUTING.md's account of the merge gate.** Its opening states PRs land "with one
  approving review from a CODEOWNER" and that `@nandohdc` "cannot self-approve". Neither holds:
  `required_pull_request_reviews` is `null` and the repository has no CODEOWNERS file, so GitHub
  supplies no approval gate and `reviewDecision` is empty on every pull request. Stating it wrongly
  makes the gate's own review arm look redundant when it is in fact the only review gate there is.

No new path class is added to `design-pattern-policy.json`. `.github/scripts/` is already classified
`governance_core`, which is the correct class for a gate that decides what may enter `main`, and
placing the script there needs no policy edit at all.

## Capabilities

- `change-governance`: the sanctioned merge path is versioned in the repository, its gate decisions
  are pure and executable, and each arm is proven to refuse a defective input and to allow its null
  control behind a required check.

## Impact

- Affected code:
  - `.github/scripts/merge-gate.mjs` (new)
  - `.github/scripts/merge-gate.test.mjs` (new)
  - `.github/scripts/merge-pr.sh` (new)
  - `.github/workflows/ci.yml`
  - `CONTRIBUTING.md`
- No branch-protection change: the arms run inside the existing required `design-pattern-governance`
  context, so no new context is pinned and no open pull request acquires a check it cannot satisfy.
- Zero third-party dependencies; the gate module imports only `node:fs` and `node:url`.
- Out of scope: the reviewer profile's own vocabulary, the Kanban schema, and any change to what
  branch protection requires.
