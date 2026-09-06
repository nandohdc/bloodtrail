## Why

A single transport-level `ECONNRESET` between the self-hosted runner and GitHub's artifact endpoints reds the required `coverage` context even though all three coverage suites and every threshold passed: `actions/upload-artifact@v7` has no retry, and because `sonar` declares `needs: [coverage]`, the required `sonar` context is then never created (#345). Eighteen minutes later the same fault struck the artifact *download* side in the `sonar` job on the same run, so the defect covers both directions of the artifact hop. One dropped connection currently costs two of the ten required contexts and a full pipeline re-run.

## What Changes

- Add a bounded, in-house retry (one retry after a short delay, matching the existing SonarQube-scan retry precedent in the same workflow) to the `actions/upload-artifact@v7` step in the `coverage` job, using the `continue-on-error` plus outcome-gated retry-step pattern.
- Add the same bounded retry to the `actions/download-artifact@v8` step in the `sonar` job.
- Preserve the fail-closed null control: `if-no-files-found: error` remains set on every upload attempt, so a genuine "no coverage produced" outcome fails both attempts and reds the context; only a transport failure that clears on retry goes green.
- Set `overwrite: true` on both upload attempts so a first attempt that failed after partially creating the run-scoped artifact container cannot poison the retry with an "artifact already exists" conflict. The `coverage` artifact name has no other legitimate producer in the run.

No new dependencies, no new scripts, no runtime code, no public API, no generated contract artifacts, and no branch-protection policy requirements are altered. No spec-level behavior changes: CI job internals only.

## Capabilities

### New Capabilities

None. This hardens artifact transport within two existing CI jobs without modifying product or gate behavior; the change opts out of specification deltas (`skip_specs: true`).

### Modified Capabilities

None. The assessment declares `software-design-pattern-governance` solely so the governance perimeter associates these governance-core workflow edits with their owning change.

## Impact

- `.github/workflows/ci.yml` (`coverage` job upload step, `sonar` job download step)
- `openspec/changes/retry-artifact-transport-in-ci/`

No runtime code, public API, generated contract artifacts, dependency versions, or branch-protection policy requirements are altered.
