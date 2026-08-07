## Why

Bloodtrail uploads coverage for two distinct workspaces, but Codecov currently exposes them only through upload-time flags. Path-based Codecov components will make workspace coverage visible in pull-request comments and component statuses without changing how reports are produced or uploaded.

## What Changes

- Define stable Codecov components for the SDK core and browser-telemetry research workspaces using repository-relative path filters.
- Add component details to the Codecov pull-request comment layout.
- Publish informational project and patch statuses for each component so the new signals do not become unreviewed merge gates.
- Retain the existing flags, badges, and per-flag history.

## Capabilities

### New Capabilities

None. This is repository tooling configuration and does not change product behavior; the change opts out of specification deltas.

### Modified Capabilities

None.

## Impact

- Affects `codecov.yml` and Codecov-generated pull-request reporting.
- Does not change coverage generation, CI upload inputs, product APIs, runtime behavior, dependencies, or the authorization boundary.
