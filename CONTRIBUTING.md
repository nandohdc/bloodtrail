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
- `openspec-sync-specs` — fold deltas into canonical `specs/` (first PR, while change remains active)
- `openspec-archive-change` — archive the change into `archive/` (second PR, carrying no canonical writes)
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

## Design-pattern governance applies to everyone

[`docs/design-pattern-governance.md`](docs/design-pattern-governance.md) is the full policy. It
applies identically to humans, Hermes, Claude Code, other agents, direct commits, pull requests, and
scripts — there is no actor for whom a different rule holds. `AGENTS.md`, `CLAUDE.md`, `.hermes.md`,
and generated agent instruction surfaces are **not** policy sources; the canonical capability, the
policy configuration, the checker, and the required `design-pattern-governance` CI check are.

What it asks of a change touching a governed implementation path:

- **Name the OpenSpec change that owns the modified capability.** An unrelated change does not
  satisfy the association, and code without one is rejected.
- **Compare candidate approaches, don't pick a pattern from a list.** A full assessment compares
  direct implementation with at least one materially plausible alternative. Naming a catalog pattern
  is never required — `direct_implementation` is a first-class decision. Every rejection must cite
  architectural forces; "best practice", popularity, and speculative future use are not reasons, and
  enumerating patterns that do not match your forces fails rather than passes.
- **If you do select a catalog pattern, you bind it.** Record the pattern ID, catalog version, every
  required invariant, and the test evidence for each. See
  [`openspec/governance/design-pattern-catalog.md`](openspec/governance/design-pattern-catalog.md) —
  24 entries, and deliberately not exhaustive.
- **Assess before you implement.** The assessment commit must be an ancestor of the earliest commit
  that touches a governed implementation path. Assessment and implementation in one commit fails, and
  amending an assessment afterwards does not backdate it.
- **Classification reads behaviour, not labels.** Implementation hidden in tests, build files,
  scripts, or configuration is still implementation. A public API change called internal-only, or
  concurrency called performance-only, is classified by what it does. Path classes are minimum
  floors, never ceilings, and an unclassified path fails closed.

Changes to governance itself — the checker, policy, schemas, catalog, invariant registry, the
actor-neutral documents, or the CI workflow — additionally run **both** the trusted baseline checker
and the candidate checker, recorded separately. A candidate checker is never the sole judge of
whether it weakened itself.

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final
node openspec/scripts/run-governance-dual-check.mjs        # governance-core changes
```

Hermes and other agents run these as a convenience. Running one is not a substitute for the required
CI check, and bypassing one does not bypass governance.

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

The binding is *resolved*, not just well formed. A record declares the candidate commit's root tree
and one entry per reviewed path:

```json
"reviewedContent": {
  "kind": "tree",
  "candidateRoot": "<git rev-parse <candidate>^{tree}>",
  "entries": [{ "path": "…", "object": "<git rev-parse <candidate>:…>" }]
}
```

Git resolves `candidateRoot:path` and the gate compares it to `object`, so naming one path while
supplying another path's tree is rejected. Each object must also be carried at its path by history
reachable from `HEAD` — that half is mandatory and is what survives the squash merge, because the
candidate root tree itself does not: the signing commit sits on top of the candidate, so only the
signing commit's tree lands on `main`.

**A reviewed path may not contain the record.** `verification-lifecycle.json` carries the records, so
binding a path that contains it means signing changes the reviewed content. Bind subtrees the signing
commit does not touch — `packages/security-audit-sdk-core/scripts` rather than
`packages/security-audit-sdk-core`. The gate rejects the self-referential form up front instead of
letting it pass on the branch and fail on `main`.

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
covers that case: when the attested source revision is unreachable, `test:changed-paths` compares the
archive against recorded blob objects instead. That does not re-derive the original move, and on its
own it would not detect an archived file rewritten *together with* its recorded object — the archive
and the attestation are both mutable working-tree content, so agreeing with each other proves
nothing.

`test:archive-attestations` is what makes that pair honest. It compares both the archive and the
recorded inventory against `anchorCommit`, the commit history shows introduced the archive, derived by
walking history for that path rather than read from the manifest. It checks every declared
attestation, not one named change. Its bounded claim: **a history-derived anchor does not withstand
rewriting the history it derives from** — that is bounded by `main` being protected against
force-push, and by a rewrite invalidating every recorded commit identifier at or after the anchor.

**The attestation is the safety net, not a reason to squash** — a merge commit keeps the stronger
re-derivation available.

### Changes with specification deltas: the two-PR sequence

When an OpenSpec change carries specification deltas under `specs/<capability>/spec.md`, folding those deltas into canonical specifications and archiving the change **cannot share a single pull request**. They must land across two separate PRs:

1. **Fold PR** — apply the deltas from `openspec/changes/<id>/specs/` into canonical `openspec/specs/<capability>/spec.md` while the change directory remains active. Merge this PR to `main`.
2. **Archive PR** — relocate the change directory from `openspec/changes/<id>/` into `openspec/changes/archive/<date>-<id>/`. This PR carries **no canonical writes**.

#### Why two commits in one PR fails

The design-pattern governance check evaluates the union of all paths changed across the entire pull request range. In `openspec/scripts/design-pattern-governance/perimeter.mjs`, `ownedPathsFor` deliberately narrows a relocated change strictly to its archive directories once an archive path appears in the change:

```javascript
if (archivedDirs) return paths; // covers only openspec/changes/<id>/ + archive/
paths.push(...(assessment?.owned_paths ?? []));
paths.push(...capabilities.map((c) => `openspec/specs/${c}/`));
```

The moment the archive relocation appears anywhere in the PR range, the change ceases to own the canonical specification. If the canonical spec write is bundled into the same PR—even as an earlier commit—it has no active owning change in the range and fails closed with `[openspec-association-unrelated]`. This rule is intentional: it prevents a finished change from being reused to wave through further unassessed capability work.

#### Declaring canonical capability paths in `assessment.json`

During the change's active phase, `assessment.json` must declare the **canonical** capability path (`openspec/specs/<capability>/spec.md`) in `owned_paths`, not merely the delta path (`openspec/changes/<id>/specs/<capability>/spec.md`). Declaring only the delta path will fail `checkOpenSpecAssociation` when folding into `openspec/specs/`.

#### Post-fold idempotence check

Before opening the archive PR, verify that the fold PR is fully synchronized with canonical specifications. Re-running `openspec archive <change>` against the updated `main` branch should print:

```
Specs already in sync; no files changed
```

and leave the canonical specification blob hash unchanged. Once verified, relocate the change directory and open the archive PR.
