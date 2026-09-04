## MODIFIED Requirements

### Requirement: Contract Reuse Assessment trigger is computed from changed paths for one selected change

Each Contract Reuse Assessment (CRA) evaluation SHALL identify exactly one selected active OpenSpec change and inspect its material merge-base change range. The CRA checker SHALL require a CRA when that range modifies a path under `contracts/`, `packages/security-audit-sdk-core/src/generated/`, `openspec/specs/security-audit-event-contract/`, or that selected change's `openspec/changes/<change-id>/specs/security-audit-event-contract/` delta that is owned by the evaluated change. The checker SHALL determine applicability from the changed path set and SHALL NOT treat labels, prose, unstructured author intent, or record presence as evidence that the trigger does or does not apply. It SHALL associate each triggering path by reusing the existing `collectOpenSpecChanges` association over active changes and their `assessment.json` `owned_paths`: exactly one collected owned-path set must match the path. When an evaluated change owns none of the range's trigger paths and each trigger path in the range is uniquely owned by another active change, the evaluation SHALL report an approved skip. Zero or multiple matches fail closed; CI SHALL enumerate relevant change roots rather than treating a repository-wide scan as one CRA evaluation.

#### Scenario: Contract source change requires a CRA
- **WHEN** an evaluated change range modifies a path under `contracts/` owned by the evaluated change
- **THEN** the checker requires a CRA for that change

#### Scenario: Generated SDK projection change requires a CRA
- **WHEN** an evaluated change range modifies a path under `packages/security-audit-sdk-core/src/generated/` owned by the evaluated change
- **THEN** the checker requires a CRA for that change

#### Scenario: Security-audit contract specification delta requires a CRA
- **WHEN** an evaluated change range modifies the evaluated change's delta under `specs/security-audit-event-contract/`
- **THEN** the checker requires a CRA for that change

#### Scenario: Unaffected change produces a distinguishable skip
- **WHEN** an evaluated change range modifies none of the CRA trigger paths owned by the evaluated change and all triggering paths in the range are uniquely owned by other active changes
- **THEN** the checker reports an approved skip distinct from a CRA-validated pass

#### Scenario: Unattributable trigger path fails closed
- **WHEN** a material range modifies a CRA trigger path that cannot be uniquely associated with an active OpenSpec change
- **THEN** the checker rejects the evaluation with a stable attribution diagnostic rather than discovering a record heuristically
