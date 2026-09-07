## MODIFIED Requirements

### Requirement: Target set is exactly five declared packages

The ratified topology decision SHALL be amended to a target set of exactly five packages: `contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, and `research/browser-telemetry`. The collector's admission to the target set SHALL be bound to the recorded #343 owner authorization: a dedicated package governed by its own OpenSpec change, bounded to synthetic non-production development and CI use with a non-production authentication interface, with production deployment, production collection, and real-user data processing remaining unauthorized. The browser (#124) and React Native (#131) evidence packages SHALL NOT be members of the target set while #117 is undecided.

#### Scenario: Four-package target is named
- **WHEN** the pre-amendment decision record is read
- **THEN** it named the original four-package target set of `contracts/security-audit`, `packages/security-audit-sdk-core`, the Node binding, and `research/browser-telemetry`, and the amendment recorded by this change is what admits the collector

#### Scenario: Five-package target is named
- **WHEN** the amended decision record names the target set
- **THEN** it lists exactly `contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, and `research/browser-telemetry`

#### Scenario: Collector admission is authorization-bound
- **WHEN** the collector's target-set membership is inspected
- **THEN** it is bound to the #343 authorization scope and grants no production deployment, production collection, or real-user data processing authority

#### Scenario: Contingent packages are excluded while #117 is undecided
- **WHEN** #117 has no recorded decision
- **THEN** the browser (#124) and React Native (#131) packages are not members of the ratified target set

## RENAMED Requirements

- FROM: `### Requirement: Target set is exactly four declared packages`
- TO: `### Requirement: Target set is exactly five declared packages`
