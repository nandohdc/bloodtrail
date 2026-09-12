## Why

In issue #306, two inefficiencies in the self-hosted runner shape cost roughly half the pipeline's wall clock:
1. `actions/setup-node` spends 7-15s per job downloading Node on an image that can pre-cache it.
2. The 2-CPU cgroup serializes the test-runner suite because Node defaults concurrency to `Math.max(os.availableParallelism() - 1, 1) = 1`.

Under doks-platform#320, the runner image pre-populates declared Node versions (26.5.0 and 24.2.0) in `/opt/hostedtoolcache` with `RUNNER_TOOL_CACHE=/opt/hostedtoolcache`, and the scale set overlay is tuned to 4 CPUs / 6Gi memory with `maxRunners: 2` (committing 8 CPUs within host VM capacity).

To record and mechanically prove acceptance criteria on the runner:
- Issue #306 requires observing `os.availableParallelism()` directly on the runner rather than inferring from Helm values.
- We must verify that `setup-node` finds Node in cache without downloading.
- We must record verification suite duration and pipeline makespan before and after.
- In addition, `packages/client-evidence-browser` lacks a `.gitignore`, leaving `dist/` and `dist-tests/` untracked after product test runs; adding `.gitignore` ensures clean workspace state across development loops.

## What Changes

- Add a mechanical `Runner shape diagnostics` step in `.github/workflows/ci.yml` within the `sdk` job to report `os.hostname()`, `os.cpus().length`, `os.availableParallelism()`, and `RUNNER_TOOL_CACHE`.
- Add `packages/client-evidence-browser/.gitignore` to ignore build artifacts (`dist/`, `dist-tests/`, `coverage/`, `*.tgz`).
- Verify that `actions/setup-node` reports `Found in cache` across jobs on the updated runner.
- Record and baseline runner performance and concurrency against the #306 baseline (349s makespan / 206s verification).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change adds diagnostic reporting and workspace ignore hygiene without altering canonical package requirements or public contracts. The change declares `skip_specs: true`.

## Impact

- `.github/workflows/ci.yml`: Adds runner shape diagnostics step to the `sdk` job.
- `packages/client-evidence-browser/.gitignore`: Adds standard build artifact ignore patterns.
- No public APIs, dependencies, or contract schemas are modified.
