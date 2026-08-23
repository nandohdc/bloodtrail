## Purpose

Defines deterministic evidence for whether a qualifying repository change reuses, extends, or introduces a Bloodtrail contract rather than making that decision implicitly.

## ADDED Requirements

### Requirement: Contract Reuse Assessment trigger is computed from changed paths

The Contract Reuse Assessment (CRA) checker SHALL require a CRA when the evaluated change range modifies a path under `contracts/`, `packages/security-audit-sdk-core/src/generated/`, `openspec/specs/security-audit-event-contract/`, or that change's `openspec/changes/<change-id>/specs/security-audit-event-contract/` delta. The checker SHALL determine applicability from the changed path set and SHALL NOT treat labels, prose, author intent, or record presence as evidence that the trigger does or does not apply.

#### Scenario: Contract source change requires a CRA
- **WHEN** an evaluated change range modifies a path under `contracts/`
- **THEN** the checker requires a CRA for that change

#### Scenario: Generated SDK projection change requires a CRA
- **WHEN** an evaluated change range modifies a path under `packages/security-audit-sdk-core/src/generated/`
- **THEN** the checker requires a CRA for that change

#### Scenario: Security-audit contract specification delta requires a CRA
- **WHEN** an evaluated change range modifies the evaluated change's delta under `specs/security-audit-event-contract/`
- **THEN** the checker requires a CRA for that change

#### Scenario: Unaffected change produces a distinguishable skip
- **WHEN** an evaluated change range modifies none of the CRA trigger paths
- **THEN** the checker reports an approved skip distinct from a CRA-validated pass

### Requirement: CRA record is distinct, author-written, and non-authorizing

A required CRA SHALL be stored as `contract-reuse.json` in the evaluated change root. It SHALL be author-written and mechanically validated. A CRA SHALL NOT be represented by that change's design-pattern-governance `assessment.json`, and it SHALL NOT constitute signed review, project-owner approval, implementation authorization, production authorization, or an exemption from normal OpenSpec governance.

#### Scenario: Required change carries a distinct CRA record
- **WHEN** a CRA-triggered change supplies its reuse evidence
- **THEN** the evidence is stored as `contract-reuse.json` in that change root rather than as `assessment.json`

#### Scenario: CRA evidence does not authorize implementation
- **WHEN** a CRA record is structurally valid
- **THEN** normal review, owner-governance, and authorization requirements remain independently required

### Requirement: CRA disposition is closed and explicit

A CRA SHALL declare exactly one disposition: `reuse`, `extend`, or `new_contract`. A `reuse` or `extend` disposition SHALL identify the applicable contract mechanism references and compatibility treatment. A `new_contract` disposition SHALL explain why existing contract mechanisms are insufficient and identify the intended separately versioned contract boundary. `not_applicable` SHALL NOT be a disposition.

#### Scenario: Reuse records an existing mechanism
- **WHEN** a change selects the `reuse` disposition
- **THEN** its CRA identifies the existing contract mechanism references it reuses

#### Scenario: Extension records compatibility treatment
- **WHEN** a change selects the `extend` disposition
- **THEN** its CRA identifies the extended mechanism and the proposed compatibility treatment

#### Scenario: New contract records the separation rationale
- **WHEN** a change selects the `new_contract` disposition
- **THEN** its CRA explains why existing mechanisms are insufficient and identifies the separate versioned boundary

#### Scenario: Non-applicability cannot be selected as a disposition
- **WHEN** a CRA declares `not_applicable` as its disposition
- **THEN** validation rejects the record with a stable field diagnostic

### Requirement: Exemptions are project-owner-bound exceptions

A qualifying change may omit a normal CRA only when it carries an explicit written, change-bound exemption granted by the project owner. The exemption SHALL identify its scope and rationale. An exemption SHALL be validated as an exception and SHALL NOT be interpreted as a successful reuse disposition or as authorization for unrelated changes.

#### Scenario: Project-owner exemption is recognized for its bound change
- **WHEN** a qualifying change carries a complete exemption granted by the project owner and bound to that change
- **THEN** the checker reports the defined exemption outcome for that change only

#### Scenario: Unauthorized exemption fails closed
- **WHEN** a qualifying change carries an exemption that is not granted by the project owner
- **THEN** the checker rejects the change with a stable unauthorized-exemption diagnostic

### Requirement: Mechanism references resolve against the declared contract version

For a disposition requiring a mechanism reference, the checker SHALL resolve each reference against `contracts/security-audit/source/contract.source.json` at the version declared by the CRA. An unresolved reference or unsupported contract version SHALL fail closed. Diagnostics may name a bounded field, safe reference path, or version, but SHALL NOT echo unbounded rationale or other caller-supplied content.

#### Scenario: Existing registry reference resolves
- **WHEN** a CRA for the current security-audit contract references `registries.trust_levels`
- **THEN** the checker accepts that mechanism reference

#### Scenario: Misspelled registry reference is rejected
- **WHEN** a CRA references `registries.trust_levelz`
- **THEN** the checker rejects the record with a stable unresolved-mechanism diagnostic naming that reference

#### Scenario: Unsupported declared contract version fails closed
- **WHEN** a CRA declares a contract version that the checker cannot resolve
- **THEN** the checker rejects the record rather than resolving references against an arbitrary on-disk version

### Requirement: CRA enforcement proves applicability and failure modes

Before CRA enforcement is relied upon, it SHALL prove a valid required record, a non-applicable approved skip, a missing required record, a malformed or structurally invalid record, an unresolved mechanism reference, an unauthorized exemption, and an unmodified null control. Each proof SHALL assert its expected stable diagnostic or its distinguishable successful outcome; exit status alone SHALL NOT satisfy the proof.

#### Scenario: Valid required record passes
- **WHEN** a CRA-triggered fixture change carries a valid record with resolved references
- **THEN** enforcement reports a CRA-validated pass

#### Scenario: Missing required record fails
- **WHEN** a CRA-triggered fixture change carries no CRA record or valid owner exemption
- **THEN** enforcement rejects it with the stable missing-record diagnostic

#### Scenario: Null control establishes harness validity
- **WHEN** the unmodified fixture repository is evaluated before a mutation arm
- **THEN** it passes without emitting a CRA failure diagnostic

### Requirement: CRA implementation phases remain separate and ordered

The CRA capability SHALL preserve distinct ordered phases for record-schema implementation, checker implementation, CI integration, review and project-owner governance, and archive. No later implementation phase may be represented as complete while an earlier required phase remains incomplete.

#### Scenario: CI phase cannot precede checker phase
- **WHEN** the record schema or checker phase remains incomplete
- **THEN** the CI integration phase remains incomplete

#### Scenario: Archive follows review and owner governance
- **WHEN** review or project-owner governance remains incomplete
- **THEN** the CRA change is not archive-ready
