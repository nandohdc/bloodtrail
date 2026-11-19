# Spec Delta

## MODIFIED Requirements

### Requirement: Target set is exactly seven declared packages

The ratified topology decision SHALL be amended to a target set of exactly seven packages: `contracts/security-audit`, `packages/client-evidence-browser`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, `packages/security-audit-collector-server`, and `research/browser-telemetry`. The collector's admission to the target set SHALL be bound to the recorded #343 owner authorization: a dedicated package governed by its own OpenSpec change, bounded to synthetic non-production development and CI use with a non-production authentication interface, with production deployment, production collection, and real-user data processing remaining unauthorized for that package. The browser evidence package's admission SHALL be bound to the #117 decision and the #124 implementation, and grants no production, publication, deployment, or real-user collection. The collector server's admission SHALL be bound to the owner authorization of 2026-11-18 recorded by `add-collector-live-poc-deployment`, and SHALL grant only the local PoC and live PoC scope that change names. The React Native (#131) evidence package SHALL NOT be a member of the target set while no such package exists in the repository.

#### Scenario: Four-package target is named
- **WHEN** the pre-amendment decision record is read
- **THEN** it named the original four-package target set of `contracts/security-audit`, `packages/security-audit-sdk-core`, the Node binding, and `research/browser-telemetry`, and the amendments recorded since are what admit the collector, the browser evidence package, and the collector server

#### Scenario: Five-package target is named
- **WHEN** the decision record before the browser evidence package and the collector server were admitted is read
- **THEN** it named the five-package target set of `contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, and `research/browser-telemetry`

#### Scenario: Seven-package target is named
- **WHEN** the amended decision record names the target set
- **THEN** it lists exactly `contracts/security-audit`, `packages/client-evidence-browser`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, `packages/security-audit-collector-server`, and `research/browser-telemetry`

#### Scenario: Collector admission is authorization-bound
- **WHEN** the collector's target-set membership is inspected
- **THEN** it is bound to the #343 authorization scope and grants no production deployment, production collection, or real-user data processing authority

#### Scenario: Browser evidence package admission is decision-bound
- **WHEN** the browser evidence package's target-set membership is inspected
- **THEN** it is bound to the #117 decision and the #124 implementation and grants no production, publication, deployment, or real-user collection authority

#### Scenario: Collector server admission is authorization-bound
- **WHEN** the collector server's target-set membership is inspected
- **THEN** it is bound to the 2026-11-18 owner authorization and grants nothing beyond the local PoC and live PoC scope that authorization names

#### Scenario: Contingent packages are excluded while #117 is undecided
- **WHEN** #117 had no recorded decision
- **THEN** the browser (#124) and React Native (#131) packages were not members of the ratified target set, and the React Native package remains outside it while no such package exists in the repository

## RENAMED Requirements

- FROM: `### Requirement: Target set is exactly five declared packages`
- TO: `### Requirement: Target set is exactly seven declared packages`
