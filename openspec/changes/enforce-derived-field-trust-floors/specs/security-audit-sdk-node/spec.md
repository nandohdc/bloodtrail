## MODIFIED Requirements

### Requirement: The Node candidate remains aligned with the governed Core projection

When the Core candidate advances for a governed contract move, the private unpublished Node candidate
SHALL advance to the same candidate version in the same governed change — `0.2.0` for `1.1.0`, and
`0.3.0` for `2.0.0`. Its package manifest, package lock, and compatibility manifest SHALL agree on that
candidate identity, and its first-party Core dependency and tests SHALL use the Core package's exact
contract projection. This alignment SHALL NOT add, remove, or rename a Node public export, transport
behavior, or delivery guarantee.

#### Scenario: Node uses the matching Core projection
- **WHEN** the Node candidate is built and validated
- **THEN** it resolves the Core candidate of the same version and its conformance tests construct
  through that Core candidate's exact contract binding

#### Scenario: Node candidate metadata drifts
- **WHEN** the Node package manifest, lockfile, or compatibility manifest disagrees about the
  candidate version
- **THEN** Node package validation fails before package contents are accepted

#### Scenario: Alignment changes the frozen Node surface
- **WHEN** the version-alignment work adds, removes, or renames a Node export
- **THEN** the frozen-export verification rejects the candidate
