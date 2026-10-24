## Why

Active change harness self-tests run locally but no required CI context executes them (#877). A shared harness regression can therefore survive green CI and consume a bounded Stage 2 run before it is discovered.

## What Changes

- Run every active change harness self-test suite in the existing `design-pattern-governance` job.
- Fail on missing, unreadable or empty suites and propagate test failures; exclude archives and report no active harnesses as explicitly not applicable.
- Add fixture tests proving discovery and the failing-test path without executing an approved Stage 2 probe.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-topology`: required CI covers active change harness self-tests as repository tooling, separately from declared packages.

## Impact

Changes are limited to the CI workflow, its dependency-free runner and tests, and this governed change. Required context names and package APIs stay unchanged. The owner confirmed these requirements and delegated #877's review, all-green merge and lifecycle closure in the 2026-10-24 Codex session implementing #838. The proposal precedes implementation; canonical fold and archive are separate later PRs.
