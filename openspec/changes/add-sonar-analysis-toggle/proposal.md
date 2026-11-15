## Why

The owner is moving SonarQube from the self-hosted server to SonarQube Cloud (#963), and the
server is unavailable while that happens. `sonar` was removed from `main`'s required status checks
on 2026-11-14, so it no longer blocks merging. The job still runs on every trusted pull request and
`main` push, though, and fails red against a server that is down. A red check that everyone has
been told to ignore teaches reviewers to ignore red.

## What Changes

- Add a repository-variable switch to the `sonar` job's job-level `if:`. Setting
  `SONAR_ANALYSIS` to `disabled` skips the job, and GitHub renders that as a skip. An unset
  variable, or any other value, runs the job as today.
- Keep the three existing trust predicates (Dependabot actor, Dependabot author, same-repository
  head) byte-identical, so fork and Dependabot PRs still skip regardless of the variable.
- Extend `.github/scripts/sonar-trust-boundary.test.mjs` to evaluate the condition with a `vars`
  context: `disabled` skips trusted events, the default runs them, and removing the switch
  predicate makes a disabled event run.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The `ci-topology` requirement "Untrusted PRs get static and mutation checks, no restricted
secrets, and visible skips" permits token-gated analysis to skip for untrusted PRs, and it requires
every skip to render as a skip, never as a pass-shaped green. A job-level skip satisfies that, and
it is not pass-shaped while `sonar` is absent from the required set. Nothing in the requirement
forbids a skip for other reasons, so no spec delta is needed.

## Impact

- Owned implementation paths: `.github/workflows/ci.yml` (the `sonar` job header only) and
  `.github/scripts/sonar-trust-boundary.test.mjs`.
- Every other job, the scan steps, the retry, the quality gate, the merge gate and the required
  context names are unchanged.
- The switch has no effect until the owner sets the variable. Setting and later deleting it are
  repository settings actions taken under #963, not part of this change's diff.
- While analysis is skipped, nothing catches functions with `readonly` parameters, which the
  CodeScene CLI skips. That gap closes when the variable is deleted.
- No package publication, production deployment, processing or integration is authorized.
