## Why

PR #888 updates the contract development toolchain's transitive fast-uri dependency from 3.1.8
to 3.1.9, but has no owning OpenSpec change. Its Sonar job also runs without credentials on a
Dependabot event, failing with `URI with undefined scheme` before analysis begins.

## What Changes

- Own the existing three-field contract lockfile refresh under a dedicated assessment.
- Gate the entire Sonar job so fork and Dependabot PRs visibly skip private analysis.
- Test the actual workflow condition against trusted, fork, bot-authored and bot-triggered events.
- Keep static checks, mutation checks, scan retries and trusted quality-gate failures enforced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This restores the existing `ci-topology` requirement "Untrusted PRs get static and mutation
checks, no restricted secrets, and visible skips" without changing its semantics. The lockfile
refresh changes development tooling only. No spec delta is needed.

## Impact

Owned implementation paths are `contracts/security-audit/package-lock.json`,
`.github/workflows/ci.yml` and `.github/scripts/sonar-trust-boundary.test.mjs`.
The frozen contract source, generated artifacts, direct dependency declarations, required-context
names and merge-gate treatment of skips remain unchanged. No package publication, production
deployment, processing or integration is authorized.
