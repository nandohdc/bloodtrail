## Why

The design-pattern governance checker treats an explicit full-SHA `--base` equal to resolved `HEAD` as a successful empty range, but returns before it records any range summary. A consumer cannot distinguish that valid, inspected-zero-range result from a perimeter check that never established a baseline or ran. The reproduced #191 defect therefore weakens auditability without changing the intended success verdict.

## What Changes

- Preserve the successful verdict for a semantically empty governance range while recording the resolved baseline and zero inspected commits and paths.
- Add a deterministic regression test that distinguishes the empty-range result from the untracked-probe null control without expanding perimeter scope.
- Retain the existing behavior for non-empty ranges, fail-closed diagnostics, activation state, and checker phases.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `software-design-pattern-governance`: Require a successful empty governance-range check to report an explicit zero-range summary and resolved baseline.

## Impact

The change is limited to the dependency-free governance checker, its perimeter regression tests, the active OpenSpec governance artifacts, and the existing governance specification. It adds no runtime SDK surface, transport, exporter, storage, telemetry, browser instrumentation, or production integration.
