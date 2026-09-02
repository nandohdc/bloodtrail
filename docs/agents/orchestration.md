# Autonomous Engineering Workflow

## Source of truth

Hermes Kanban is the source of truth for work state.

OpenSpec is the source of truth for requested behavior and implementation
requirements.

GitHub is the source of truth for branches, PRs, reviews, CI, and merges.

## Standard workflow

For changes affecting application behavior, API behavior, persistence,
business logic, public interfaces, security behavior, or user-visible
functionality:

1. Create an OpenSpec proposal.
2. Review the proposal.
3. Merge the approved proposal.
4. Implement the OpenSpec change.
5. Run required tests and validation.
6. Open a PR.
7. Request independent review.
8. Address review findings.
9. Merge only when approval and required CI are green.
10. Archive the OpenSpec change.
11. Merge the OpenSpec archive.
12. Mark the root Hermes issue complete.

Documentation-only and purely mechanical maintenance changes may skip
OpenSpec when no behavior, contract, architecture, or requirements change.

## Pull-request rule

Prefer small independently reviewable and independently mergeable PRs.

Do not create arbitrary one-commit-per-task PRs when the work is tightly
coupled.

Do not create giant PRs when the work can safely be separated.

## Merge rule

Never merge while a required CI check is pending, failing, cancelled,
or otherwise incomplete.

Administrative merge permissions may only be used when every required
CI check has succeeded and all required review conditions have been
satisfied.

Admin permissions must never be used to bypass failed or incomplete CI.

Implementers never merge their own PRs.
Reviewers never merge PRs.
Only the integrator may perform merges.

The integrator merges only through the gate script:

    ~/.hermes/scripts/hermes-merge-pr.sh --pr <number> --review-task <task_id>

Never call `gh pr merge` directly.

The script is the merge policy. GitHub enforces only the required status
checks: `main` has no `required_pull_request_reviews` block and the repository
has no CODEOWNERS file, so `reviewDecision` is empty on every PR and nothing on
the GitHub side will catch a premature merge.

For the same reason the binding review verdict comes from the Kanban task, not
from a GitHub approval. Every PR is authored by the account the agents run as,
and GitHub refuses self-approval, so a GitHub approval is unobtainable by
design here. Do not "fix" the gate script by relaxing it to accept an empty
`reviewDecision`.

**A completed run is not an approval.** A reviewer that requests changes
completes its run too, so run completion cannot tell the two apart. The verdict
is carried in the reviewer run's metadata:

    .metadata.technical_review     "approved" | "changes_requested"
    .metadata.reviewed_commit      the exact SHA the verdict is bound to
    .metadata.blocking_findings[]  {path, finding}

The gate requires `technical_review == "approved"` on a run whose
`reviewed_commit` equals the PR head, and refuses when that metadata is absent.
Binding to the head also expires a stale verdict: a review of an earlier head
does not survive a force-push.

This paragraph previously called the completed run itself the binding verdict,
and the gate script implemented that literally. On 2026-08-30 the script
reported "All gates passed" for PR #225 at `0b7e051` while the reviewer had
recorded `changes_requested` on that exact head, with all nine required checks
green. Do not restate the rule in terms of run completion.

A review task claimed as an ordinary running task cannot be transitioned with
`kanban_request_changes` — it is refused as "not claimed from the review
column" — and the verdict then survives only in the run metadata and a comment,
never in task status. That is a further reason the gate reads metadata rather
than task status.

## Repository preflight

These are mechanical properties of this repository. A change that ignores them
fails CI regardless of how good it is. Read this section before running any
verification or opening any PR.

### Workspaces

There is no root `package.json`. Every npm command names its workspace:

    npm run validate --prefix packages/security-audit-sdk-core
    npm run validate --prefix contracts/security-audit

Use Node 24 or 26 for the SDK; the contract and research workspaces require
`>=26.5.0`. Install per workspace with `npm ci --prefix <workspace>`.

### Check for generated drift before validating

`validate` runs `generate` as its first step, which rewrites `src/generated/`
and so masks drift that is already committed. Run the drift check standalone
first, exactly as CI does:

    npm run check:generated --prefix packages/security-audit-sdk-core
    npm run validate       --prefix packages/security-audit-sdk-core

### Verify before staging, never after

`test:git`, the last step of `validate`, requires an empty Git index. Run the
full validation with the working tree dirty and nothing staged; stage and
commit only once it passes. `git add` followed by `validate` fails every time.

The same gate rejects any trailing whitespace, any CR byte, and any missing
final newline in every file changed since the baseline — Markdown, JSON and
YAML included. A stray trailing space fails CI.

### Generated output is never hand-edited

`packages/security-audit-sdk-core/src/generated/` is a projection of
`contracts/security-audit/`. The fix is always in the generator
(`scripts/generate-contract.mjs`), never in its output. `check:generated`
compares byte-for-byte, and generation must stay deterministic and
locale-independent.

### New files under src/

`test:changed-paths` rejects a new, uncommitted file under
`packages/security-audit-sdk-core/src/` unless its exact path is listed in
`ownership.reviewedNewSdkSourcePaths` in
`packages/security-audit-sdk-core/verification-lifecycle.json`.

### New OpenSpec changes

`test:coherence` pins package identity, version, engines, catalog counts and
task counts for the change named in `verification-lifecycle.json`. A change
that moves any of those must update `verification-lifecycle.json`, and
`compatibility.json` where the toolchain moves, within the same change.

### Path classification

Every path a change touches is classified by
`openspec/governance/design-pattern-policy.json`. Longest match wins, and a
path matching no pattern is unclassified and fails closed against the required
`design-pattern-governance` check.

| Class | Covers | Cost |
|---|---|---|
| `documentation_only` | `docs/`, `README.md`, `SECURITY.md`, `RELEASING.md`, `.hermes/plans/`, `version.txt` | cheap |
| `governed_implementation` | `packages/`, `contracts/`, `research/`, `openspec/specs/`, `openspec/changes/` | normal |
| `governance_record_only` | `verification-lifecycle.json`, `openspec/governance/records/` | normal |
| `governance_core` | `AGENTS.md`, `CLAUDE.md`, `.hermes.md`, `CONTRIBUTING.md`, `.github/workflows/`, `.github/scripts/`, `openspec/scripts/`, `openspec/governance/`, `.claude/skills/`, `.hermes/skills/`, `.gitignore`, `sonar-project.properties` | full assessment |
| unclassified | anything else, including a root `scripts/` directory | fails closed |

`governance_core_path` is a full assessment trigger. Touching any of those
paths — even for a one-line documentation edit — requires a full OpenSpec
assessment with all fifteen dimension justifications. Never touch them
incidentally alongside another change.

Operator tooling that is not part of the product belongs outside the
repository, in `~/.hermes/scripts/`, not in a root `scripts/` directory.

### Commits and branches

Conventional Commits, validated on the PR title *and every commit subject* in
the PR. Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, `security`, `style`, `test`.

Use separate commits for proposal, implementation and archive. Never mix them.
Stage an explicit allowlist; leave unrelated untracked files alone.

Rebase onto `origin/main`. Never `git merge main` into a PR branch — a
`Merge branch 'main' into ...` subject has no exemption from the
conventional-commits check and blocks the PR.

Branch only from a fresh `main` after the previous stage's PR has merged. The
gate script merges with `--delete-branch`, so a branch created from an
unmerged parent has its PR closed outright rather than retargeted.

### Required checks

Nine checks are required on `main`:

    ci / lint    ci / test    ci / audit    sdk    contract
    sonar        conventional-commits       codescene delta
    design-pattern-governance

`main` also requires branches to be up to date before merging, so every merge
to `main` puts the remaining open PRs out of date; they must be rebased, and
their checks rerun, before they can merge in turn.

Count the checks you see against those nine. `gh pr checks --required` lists
only contexts that have **reported**, so a check that never started is absent
from its output rather than pending in it, and "nothing is failing" can settle
on an incomplete set. `sonar` is the one this bites, because it declares
`needs: [ci, sdk, contract, coverage]` and never gets created at all when an
upstream job is cancelled or evicted. PR #245 read as eight contexts, all
passing, zero failing, while `sonar` had not run.

Read the required contexts from branch protection and require each one to be
present as well as passing:

    gh api repos/nandohdc/bloodtrail/branches/main/protection \
      --jq '.required_status_checks.contexts[]'

`hermes-merge-pr.sh` does this at its CI gate and fails closed when a context
is missing, so the sanctioned merge path is safe; the trap is reporting a PR
green from `--required` alone before you get there.

A red `sonar` is more often the self-hosted server than the code. The job
already retries once after a 30s wait, and its "Explain quality gate failure"
step prints the failing conditions.

### When a stage fails

Rerun a failed infrastructure job at most once, with `gh run rerun --failed`.
If it fails again, or if a review cycle has returned the same task twice
without converging, stop and escalate with
`kanban_block(kind="needs_input", ...)`. Do not keep retrying, and never
weaken a gate, a test, or the merge script to make a stage pass.
