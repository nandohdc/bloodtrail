## Why

The SDK currently enforces support for one exact contract version, but the canonical SDK capability does not make that future-facing cardinality normative and the migration guide still instructs future maintainers to reconsider whether one package may support multiple contract versions. The owner selected `EXACT_ONE` on 2026-08-23, so the repository must ratify that choice coherently before dependent issue #76 can close.

## What Changes

- Add a normative SDK requirement that each SDK package version supports exactly one canonical contract version across its compatibility manifest, generated public types, generated validator projection, construction-time version check, and event-validation semantics.
- Define exact-version instance binding as a construction invariant with fail-closed rejection of unsupported versions; the SDK does not negotiate, coerce, downgrade, fall back, or best-effort interpret contract versions.
- Record the relation as many-to-one: several SDK package versions may support the same contract version, while one SDK package version may not support several contract versions.
- Record that a separately authorized collector MAY support an explicitly enumerated finite set of contract versions for migration, without broadening producer package support or authorizing collector implementation.
- Align the SDK glossary, ADR-SDK-009, migration guidance, and a root decision ADR with the normative policy and its SemVer consequences.
- Classify replacement of the sole supported contract baseline as SDK compatibility-major even when the canonical contract change is additive and contract-minor; while the private unpublished package remains `0.x`, any separately authorized release would express that classification through the project's `0.x` policy.
- Preserve the frozen contract, runtime behavior, generated output, package version, publication boundary, and production-integration exclusions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Make exact-one package support, construction-time exact-version instance binding, and the separately authorized collector migration asymmetry normative.

## Impact

The change is a Full-assessment, Material capability modification. Proposal, assessment, delta specification, design, tasks, and SDK documentation under `openspec/changes/` and `packages/` are governed implementation; the root ADR and execution plan are documentation-only. No runtime source, generated artifact, contract source, package manifest or version, dependency, collector, transport, publication path, or production authorization changes are permitted.
