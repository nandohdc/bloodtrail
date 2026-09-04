## Context

See proposal.md for motivation. Current measured coverage:
- `packages/security-audit-sdk-core`: 97.79% line coverage, 68.84% branch coverage (Ajv-generated validator has ~42% branch coverage, pulling aggregate branch down).
- `research/browser-telemetry`: 93.16% line coverage, 72.50% branch coverage.

Node's built-in test runner (`node --test --experimental-test-coverage`) natively supports `--test-coverage-lines=<threshold>` and `--test-coverage-branches=<threshold>`, exiting with non-zero status when measured coverage does not meet thresholds.

## Goals / Non-Goals

**Goals:**
- Enforce local reproducibility by establishing line and branch thresholds in `test:coverage` scripts for both code-bearing packages.
- Protect `main` by promoting the CI `coverage` job to a required branch-protection status check.
- Keep third-party service outages (Codecov) off the critical path for PR merges by enforcing thresholds directly in the local runner and GitHub Actions job.
- Update repository documentation to reflect ten required status checks.

**Non-Goals:**
- Altering what tests assert or writing new tests to artificially inflate coverage.
- Modifying any of the other nine existing branch protection checks.
- Removing Codecov reporting: Codecov remains active for PR diff visualization and component breakdown.

## Decisions

### 1. Enforce locally with native Node test coverage thresholds
Node 24 and Node 26 support `--test-coverage-lines` and `--test-coverage-branches`. Adding these flags to `test:coverage` ensures that any coverage regression fails immediately on a developer's machine as well as in CI.
- SDK Core thresholds: `--test-coverage-lines=95 --test-coverage-branches=65`
- Browser Telemetry thresholds: `--test-coverage-lines=90 --test-coverage-branches=65`
These ratchets sit safely below current measured baselines (97.8% / 68.8% for SDK, 93.2% / 72.5% for research), preventing coverage collapse while avoiding sensitivity to minor compiler branch artifact variance.

### 2. Promote `coverage` to required branch-protection context
GitHub branch protection currently requires nine contexts. The `coverage` job in `.github/workflows/ci.yml` executes both package `test:coverage` scripts and reports status as `coverage`. Adding `coverage` to GitHub branch protection ensures that any regression blocking `test:coverage` prevents merging into `main`.

### 3. Maintain Codecov as informational telemetry
Codecov statuses (`codecov/patch`, `codecov/project`, component statuses) remain `informational: true` to isolate Bloodtrail PR merges from third-party vendor outages (analogous to past SonarCloud HTTP 530 incidents). The outdated comment in `codecov.yml` is updated to explain this explicit architectural choice.

## Risks / Trade-offs

- [Risk: Generated Ajv validator branch coverage drags down overall SDK branch percentage] -> Mitigation: SDK branch threshold set at 65%, which accommodates the generated validator (~42%) while tightly constraining authored TypeScript modules (which exceed 85%).
- [Risk: Adding a required context increases branch protection friction] -> Mitigation: The `coverage` job finishes in ~1m20s, well before the critical-path `sdk` job (~4m40s), so adding it as a required check incurs zero critical-path latency.
