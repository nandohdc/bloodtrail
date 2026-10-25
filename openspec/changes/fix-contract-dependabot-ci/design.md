## Context

The original PR changes only fast-uri's version, registry URL and integrity in the contract
workspace's lockfile. `upgrade-fast-uri-3-1-9` explicitly excluded that workspace, so it cannot
serve as ownership evidence. The existing toolchain exception permits this lockfile to change
without modifying frozen contract content; it does not exempt it from OpenSpec ownership.

The failed Actions run identifies its secret source as Dependabot and supplies empty Sonar token
and host values. The repository has these names in Actions secrets but no Dependabot secrets.
GitHub restricts secrets for Dependabot and fork events. ADR 0011 and the canonical ci-topology
capability already permit private analysis to visibly skip for these PRs.

## Decision

Create this assessment in a separate commit before replaying the original dependency patch.
Rebase the replacement branch on current main; preserve the original lockfile patch exactly.
This establishes assessment-before-implementation in the submitted history, without claiming
that the bot's historical unassessed commit had prior approval.

Use a job-level Sonar condition: non-PR events run normally; PRs run only when the actor and
author are not Dependabot and the head repository matches the current repository. Check both
actor and author so a maintainer update or rerun does not turn a bot PR into trusted analysis.
A job-level skip preserves GitHub's SKIPPED conclusion. Returning success from an empty scan
step would misrepresent verification. The existing merge gate continues to distinguish skips.

The workflow test evaluates the actual condition across event fixtures, with controls for a
removed condition and each missing trust predicate. It also checks that static and mutation
jobs remain ungated. No scanner installation or network call is needed for this feedback loop.

## Alternatives

- Copy Actions secrets into Dependabot secrets or use pull_request_target: rejected because
  canonical policy withholds restricted secrets from untrusted PRs. No privilege change is needed.
- Skip Sonar whenever secrets are empty: rejected because it would mask missing credentials on
  trusted PRs and main. Trusted configuration or quality failures must still fail.
- Claim the unrelated SDK assessment owns this patch: rejected because its scope expressly
  excludes the contract workspace and it has no Sonar trust-boundary assessment.

## Verification and Risks

Run the workflow regression red before editing CI and green afterwards. Install contract
dependencies, check generation before validation, run its complete validation and audit, and
confirm the lockfile patch equals Dependabot's. Run repository script tests and full governance
checks, including trusted baseline and candidate separately after committing a nonempty range.
Run the complete repository governance-gate chain before pushing.

Sonar is intentionally unperformed for untrusted PRs; a skipped check is not an analysis pass or
merge approval. Required checks and independent owner review retain their existing authority.
Trusted events still execute the scanner and retain its existing retry and quality-gate behavior.
