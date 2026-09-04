## Why

Coverage currently cannot fail. It is permissive at three independent layers: Codecov statuses are marked `informational: true`, workspace `test:coverage` scripts set no minimum line or branch thresholds, and the CI `coverage` job is not a required status check in branch protection. Consequently, coverage regressions can occur without turning any gate red. This change enforces deterministic local thresholds and requires the `coverage` context in branch protection, closing #271.

## What Changes

- Add deterministic line and branch coverage thresholds to `packages/security-audit-sdk-core/package.json` (`test:coverage`: `--test-coverage-lines=95 --test-coverage-branches=65`).
- Add deterministic line and branch coverage thresholds to `research/browser-telemetry/package.json` (`test:coverage`: `--test-coverage-lines=90 --test-coverage-branches=65`).
- Promote the `coverage` CI job to a required branch-protection status check, updating the pinned context list and moving the documented required check count from nine to ten.
- Update `codecov.yml` comments to clarify that Codecov status checks remain informational for PR diff telemetry while deterministic enforcement is held by local test execution and the required `coverage` CI job.
- Update repository documentation (`CLAUDE.md`, `docs/adr/0011-ci-topology.md`, and `openspec/specs/ci-topology/spec.md`) to reflect ten required contexts and fail-closed coverage enforcement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-topology`: Updates the required context set from nine to ten (adding `coverage`) and requires deterministic local coverage threshold enforcement that fails closed.

## Impact

- `packages/security-audit-sdk-core/package.json`: `test:coverage` script enforces line and branch thresholds.
- `research/browser-telemetry/package.json`: `test:coverage` script enforces line and branch thresholds.
- `codecov.yml`: Permissive-tuning commentary replaced with permanent architecture documentation.
- `CLAUDE.md` & `docs/adr/0011-ci-topology.md`: Context count updated from nine to ten.
- GitHub branch protection settings: `coverage` added to required status checks.
