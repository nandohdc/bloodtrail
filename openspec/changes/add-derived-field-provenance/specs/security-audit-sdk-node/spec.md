## ADDED Requirements

### Requirement: The Node candidate remains aligned with the governed Core projection

When the Core candidate advances to `0.2.0` for contract `1.1.0`, the private unpublished Node
candidate SHALL advance from `0.1.0` to `0.2.0` in the same governed change. Its package manifest,
package lock, and compatibility manifest SHALL agree on that candidate identity, and its first-party
Core dependency and tests SHALL use the Core package's exact `1.1.0` projection. This alignment
SHALL not add, remove, or rename a Node public export, transport behavior, or delivery guarantee.

#### Scenario: Node uses the matching Core projection
- **WHEN** the `0.2.0` Node candidate is built and validated
- **THEN** it resolves the `0.2.0` Core candidate and its conformance tests construct through the
  Core `1.1.0` contract binding

#### Scenario: Node candidate metadata drifts
- **WHEN** the Node package manifest, lockfile, or compatibility manifest disagrees about candidate
  version `0.2.0`
- **THEN** Node package validation fails before package contents are accepted

#### Scenario: Alignment changes the frozen Node surface
- **WHEN** the version-alignment work adds, removes, or renames a Node export
- **THEN** the frozen-export verification rejects the candidate
