## Why

The CRA CI integration needs a never-merged live workflow witness showing that a change-local security-audit contract delta is attributed to its selected change and accepted when it carries a valid Contract Reuse Assessment.

## What Changes

- Add a disposable change-local security-audit-event-contract delta solely to exercise the CRA trigger in CI.
- Add a valid `contract-reuse.json` that reuses `registries.trust_levels`.
- Keep this carrier isolated from canonical contract sources, generated projections, runtime code, production surfaces, and publication surfaces.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `security-audit-event-contract`: Adds a throwaway witness requirement that exists only on the never-merged witness branch.

## Impact

Only `openspec/changes/cra-ci-witness/` is affected. This fixture creates no production, deployment, collection, processing, framework, delivery, storage, publication, or contract-source authorization.
