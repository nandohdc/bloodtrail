## Context

See `proposal.md` for motivation. The CI workflow currently sequences `sonar` behind `[ci, sdk, contract, coverage]`. Analysis of recent CI runs demonstrates that `coverage` finishes in ~3m40s–4m, while `sdk` runs for ~7m–8m. Sonar takes ~1m20s. Sequenced behind `sdk`, Sonar pushes total critical-path time to ~9m20s. Decoupling Sonar to run after `coverage` enables concurrent execution with `sdk`, reducing the critical path to the duration of `sdk` alone.

Additionally, GitHub issue #286 records a live repository outage where npm's advisory endpoint (`registry.npmjs.org/-/npm/v1/security/advisories/bulk`) experienced timeouts. Because `npm audit` has a 5-minute timeout and zero retries in CI, three required checks (`ci / audit`, `sdk`, `contract`) failed simultaneously, taking down `sonar` behind them and halting merges repo-wide.

## Goals / Non-Goals

**Goals:**
- Remove 80–100 seconds from the normal critical path by running Sonar concurrently with `sdk` and `contract`.
- Prevent external npm audit transport outages from causing 5-minute merge-blocking CI failures.
- Enforce strict null-control behavior: genuine security advisories at or above the target level must exit 1 immediately without retrying.
- Provide clear, test-covered error classification for transport errors versus security findings.

**Non-Goals:**
- Lower audit levels (`--audit-level=low` in SDK and `--audit-level=high` in Contract remain strictly enforced).
- Add `--no-audit` or `continue-on-error` to audit steps.
- Eliminate or restructure the standalone `coverage` job at this time (tracked as a separate future effort dependent on #271).
- Modify external workflows in `nandohdc/gh-pipelines` (in-repo `sdk` and `contract` jobs are addressed first).

## Decisions

### 1. Change Sonar to depend strictly on `[coverage]`

`sonar` needs only the generated LCOV coverage report and source tree. Because `coverage` runs `npm run test:coverage` (which invokes `npm run build` and `tsc -p tsconfig.test.json` in the SDK and tests in research), broken product code will fail the `coverage` job and prevent `sonar` from running. In the event of a contract validation failure, Sonar may run concurrently on the PR, but the overall PR remains blocked by the required `contract` check.

### 2. Dedicated Node script for npm audit retry (`.github/scripts/npm-audit-retry.mjs`)

Create a script `.github/scripts/npm-audit-retry.mjs` that:
- Forwards arguments (such as `--audit-level`) to `npm audit`.
- Adds `--fetch-timeout=30000` (30s) and `--fetch-retries=0` to prevent 5-minute hangs per attempt.
- Inspects stderr/stdout and process exit status.
- Retries at most twice (3 attempts total) with backoff **only** if the failure matches known transport failure patterns (`audit endpoint returned an error`, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`, `500`, `502`, `503`, `504`, `fetch failed`).
- Exits immediately with the original exit code and logs if the failure is due to found vulnerabilities or unrecognized errors.

### 3. Comprehensive unit tests and null-control verification

Create `.github/scripts/npm-audit-retry.test.mjs` using `node:test` to verify:
- Clean pass (exit 0) without retry.
- Simulated transport failure on attempt 1 followed by success on attempt 2 retries and passes.
- Simulated advisory finding (exit 1 with vulnerability output) terminates immediately on attempt 1 without retry.
- Repeated transport failure exhausts retry attempts and exits with failure.

## Risks / Trade-offs

- **[Trade-off] Sonar server capacity on contract failures:** If a PR breaks `contract` but not `sdk`, Sonar will run and consume SonarQube worker capacity before the PR fails. Given that contract failures are rare relative to successful PR iterations, the 80–100s critical path speedup on every successful PR outweighs this occasional worker consumption.
- **[Risk] npm audit output format changes:** If npm changes its transport error wording, an outage might be treated as a vulnerability finding (failing immediately) rather than retrying. This fails closed (the gate remains strict) rather than failing open.

## Migration Plan

Merge the workflow and script updates. CI runs will immediately reflect parallel Sonar execution and resilient audit checks. Rollback is a standard Git revert.
