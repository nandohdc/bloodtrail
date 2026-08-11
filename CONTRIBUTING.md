# Contributing

`main` is protected — land every change via PR, with one approving review from a CODEOWNER.
`@nandohdc` is the sole CODEOWNER and cannot self-approve, so in practice PRs land with
`gh pr merge --admin`. An admin merge substitutes for the approval only; it never substitutes for
the required checks, which must have passed.

Before pushing, run the same gates CI runs:

```bash
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
```

There is **no root `package.json`** — every workspace is standalone, so every npm invocation needs
`--prefix` or must run from inside the package directory. Node is pinned to `>=24 <25 || >=26 <27`.

## Changes go through OpenSpec first

This repository is spec-driven. A change starts as a proposal under `openspec/changes/`, not as a
diff. Use the `openspec-*` skills rather than editing change directories by hand:

- `openspec-propose` / `openspec-new-change` — start a change (proposal, specs delta, design, tasks)
- `openspec-continue-change` / `openspec-update-change` / `openspec-apply-change` — work it
- `openspec-verify-change` — check it before commit
- `openspec-archive-change` / `openspec-sync-specs` — land it and fold deltas into `specs/`
- `openspec-explore` / `openspec-onboard` — orient in the repo

Specs under `openspec/specs/<capability>/spec.md` describe what the system must do. A change's
`specs/` entries are **deltas**, not replacements.

## Non-negotiable rules

**The authorization boundary is enforced, not advisory.** The SDK is an isolated technical
candidate. Transports, exporters, collectors, queues, outboxes, storage, SIEM integration,
framework instrumentation, analytics, detection, browser telemetry, and cryptographic chaining are
all out of scope, and `test:scope` will fail if one appears. Each requires its own OpenSpec change
and explicit authorization — never add one incidentally alongside another change. See
[`README.md`](README.md#authorization-boundary).

**Never hand-edit generated output.** `packages/security-audit-sdk-core/src/generated/` is derived
from the contract, and `contracts/security-audit/{catalog,registries,policies,docs,adr}/` are
derived from `contracts/security-audit/source/contract.source.json`. Change the source and
regenerate. `check:generated` catches divergence; the fix is always in the generator, never in the
output.

**The contract is frozen.** `contracts/security-audit/` is a protected prefix — `test:changed-paths`
rejects writes to it. A genuine semantic change needs a separately governed contract version.

**Staged, evidence-backed commits.** Run read-only semantic verification *before* committing; do
not regenerate, reformat, or rerun tests on a candidate that has already been verified. Use
separate commits for proposal, implementation, and archive — do not mix them. Stage an explicit
allowlist only, leaving unrelated untracked files untouched.

**AI review is not approval.** Never treat an AI review, a PR assignment, or an informal message as
human or organizational approval. AI-produced analysis may inform a governance record but is never
review, approval, or assurance — and neither are passing gates, checked tasks, issue state,
pull-request state, or merged state.

## How much governance a change needs

**Governance weight scales with what the change can actually affect.** While every workspace a
change touches is unpublished, undeployed, and processing no real-user data, that change needs one
signed governance record, the passing gates, and archive validation — and nothing else. No separate
review, owner-decision, restriction-restatement, or revalidation task group. Full attestation,
including independent technical assurance by someone other than the project owner, is required
before publication or deployment authorization is granted, and is not required merely to land or
archive a change.

That lightweight path is conditioned on a **mechanically established** state, never a claimed one.
`test:scope`, `test:package`, `test:dependencies`, and `test:publication-path` are what establish it.
A change cannot assert its way onto the lightweight path.

**Cite gates; do not restate them.** A governance record must not narrate in prose any claim about
repository state that a gate already enforces — cite the gate instead. If a change depends on a
repository-state claim that no gate checks, **add the gate**. That is what
`test:publication-path` is: the "no publication path exists" claim used to be hand-verified once per
change, and is now enforced on every run.

**Bind the record to a content object.** A governance record names the reviewed tree or subtree
identifier, and may additionally name a commit; a commit hash alone is not an accepted binding. A
commit cannot record its own hash, and a squash merge orphans the commit a record named — that is
exactly how the adversarial remediation ended up bound to `a7ac3177`, which is not an ancestor of
`main`. A tree identifier survives squash, rebase, and cherry-pick. Bindings are declared as
structured data in
[`verification-lifecycle.json`](packages/security-audit-sdk-core/verification-lifecycle.json) under
`governanceRecords`, and `test:governance-history` verifies them: declared merge commits must have
their declared parent count, bound commits must remain ancestors of `HEAD`, and governed commits
must still resolve.

**Supersede in version control, not in-document.** When a governance record is revised, the new
revision *replaces* the old content; Git keeps the prior revision. Do not accumulate superseded
revisions inside the document — that convention is how one packet reached ~1,500 lines and came to
contain revisions describing revisions. A short dated correction note is allowed in the one case
where a prior statement was factually wrong and a reader could otherwise carry the error forward.

**A task must change the repository or produce evidence.** Write tasks that add a gate, change code,
or run something whose output is recorded — not tasks that assert a state, restate an exclusion, or
re-describe what a previous task already did.

## Commit subjects

Conventional Commits, enforced by `.github/workflows/conventional-commits.yml` on the PR title and
on **every** commit subject in the PR:

```
type(scope)!: description
```

Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
`security`, `style`, `test`. Include the issue number where one exists, e.g.
`feat(sdk): reserve terminal success per operation (#42)`.

These types drive both the release and the changelog — see [`RELEASING.md`](RELEASING.md).

## Whitespace is a CI gate, not a style preference

`test:git` runs `git diff --check` and then, for every file changed since the verification
baseline, rejects a missing final newline, any CR byte, and any trailing whitespace. This applies
to *new* files too, including Markdown, YAML, and JSON. A stray trailing space fails the `sdk` job.

`test:git` also requires an **empty Git index** — verification runs before staging, not after.

---

The two rules below are about branch mechanics rather than code, so neither is caught by review.
Both are carried over from `risk-analyzer`, where they were learned the hard way.

## Stacked PRs: retarget before you merge the base

When PR B is based on PR A's branch, **retarget B onto the new base before squash-merging or
deleting A's branch** — not after.

Squash-merging A rewrites its commits into a single new commit on `main`. B's branch still points
at A's original, now-orphaned commits, so B's diff reopens every change A already landed.

Worse, B does not survive the base branch going away: squash-merging A and deleting its branch
**closes** PR B outright rather than auto-retargeting it. Recovering means restoring A's branch on
the remote, reopening B, retargeting, and only then rebasing.

Do it in this order instead:

```bash
gh pr edit <B> --base main                     # 1. retarget while A's branch still exists
git rebase --onto main <A-branch> <B-branch>   # 2. replay only B's own commits
git push --force-with-lease                    # 3. then A is safe to merge and delete
```

Verify with `gh pr diff <B>` before merging A: B's diff should contain only B's changes.

## Branch synchronization: rebase, don't merge

Use `git rebase main` to bring a feature branch up to date. **Do not `git merge main` into a PR
branch.**

The conventional-commits check inspects *every* commit subject in the PR, not just the PR title,
and has no merge-commit exemption — a `Merge branch 'main' into …` subject fails the
`conventional-commits` job and blocks the PR.

```bash
git fetch origin && git rebase origin/main
git push --force-with-lease
```

**The exception is a branch under concurrent automation.** If an agent is pushing to the same
branch, rebasing rewrites history underneath it and its next push either fails or resurrects stale
commits. For those branches, fetch before pushing and merge rather than rebase, accepting that the
merge commit must then be squashed or reworded before the PR can pass. Prefer to pause the
automation and rebase once it is idle.

## Archive PRs: prefer a merge commit

Merge a PR that archives an OpenSpec change with a merge commit rather than a squash, where the
required checks allow it.

Archive-movement validation compares the archive against the active change it replaced. When the
pre-archive commit is still reachable it re-derives that comparison from history, which proves the
archive is an exact move. A squash replays the branch as one commit whose parent is the target
branch tip, so the pre-archive state disappears and re-derivation is no longer possible — PR #146
broke `main` this way.

The movement attestation in
[`verification-lifecycle.json`](packages/security-audit-sdk-core/verification-lifecycle.json)
covers that case: when the attested source revision is unreachable, verification compares the
archive against recorded blob objects instead. That detects any change to the archive after the
attestation, but it does not re-derive the original move. **The attestation is the safety net, not
a reason to squash** — a merge commit keeps the stronger check available.
