# contract-reuse-assessment Specification

## Purpose

Defines deterministic evidence for whether a qualifying repository change reuses, extends, or introduces a Bloodtrail contract rather than making that decision implicitly.

## Requirements

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

### Requirement: CRA record is distinct, author-written, and non-authorizing

A required CRA SHALL be stored as `contract-reuse.json` in the evaluated change root. It SHALL be author-written and mechanically validated. Each CRA record SHALL identify exactly one `contract: "security-audit@1.0.0"`, declare `schema_version: "1.0"`, and contain `mode` with exactly one mutually exclusive value: `assessment` or `exemption`. The closed schema SHALL use named `assessment` and `exemption` record shapes selected by `mode`; mode-incompatible fields are rejected rather than inferred. A CRA SHALL NOT be represented by that change's design-pattern-governance `assessment.json`, and it SHALL NOT constitute signed review, project-owner approval, implementation authorization, production authorization, or an exemption from normal OpenSpec governance.

#### Scenario: Required change carries a distinct CRA record
- **WHEN** a CRA-triggered change supplies its reuse evidence
- **THEN** the evidence is stored as `contract-reuse.json` in that change root rather than as `assessment.json`

#### Scenario: CRA evidence does not authorize implementation
- **WHEN** a CRA record is structurally valid
- **THEN** normal review, owner-governance, and authorization requirements remain independently required

#### Scenario: CRA mode-incompatible fields are rejected
- **WHEN** a CRA record contains fields that belong to the other `mode`, including both an assessment disposition and exemption evidence
- **THEN** schema validation rejects the record with a stable field diagnostic

### Requirement: CRA disposition is closed and explicit

An assessment-form CRA SHALL declare exactly one disposition: `reuse`, `extend`, or `new_contract`. A `reuse` or `extend` disposition SHALL identify one to eight unique safe dotted ASCII `mechanism_references`, each at most 200 characters and matching `^[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*)*$`. Only an `extend` disposition SHALL declare `compatibility_classification`, whose closed values are `patch`, `minor`, and `major`. A `new_contract` disposition SHALL omit `mechanism_references` and `compatibility_classification`, explain why existing contract mechanisms are insufficient, and declare a non-`security-audit` `proposed_contract_id` matching a three-to-100-character lowercase kebab identifier. `not_applicable` SHALL NOT be a disposition. An exemption-form CRA SHALL NOT declare a disposition.

#### Scenario: Reuse records an existing mechanism
- **WHEN** a change selects the `reuse` disposition
- **THEN** its CRA identifies the existing contract mechanism references it reuses

#### Scenario: Extension records compatibility treatment
- **WHEN** a change selects the `extend` disposition
- **THEN** its CRA identifies the extended mechanism and declares `patch`, `minor`, or `major` compatibility classification

#### Scenario: Reuse carries no compatibility classification
- **WHEN** a change selects the `reuse` disposition and declares a compatibility classification
- **THEN** schema validation rejects the record with a stable field diagnostic

#### Scenario: Extension compatibility classification is closed
- **WHEN** a change selects the `extend` disposition and declares a classification other than `patch`, `minor`, or `major`
- **THEN** schema validation rejects the record with a stable field diagnostic

#### Scenario: New contract records the separation rationale
- **WHEN** a change selects the `new_contract` disposition
- **THEN** its CRA explains why existing mechanisms are insufficient, declares a non-`security-audit` proposed contract identifier, and omits mechanism references and compatibility classification

#### Scenario: New contract cannot omit its proposed boundary
- **WHEN** a change selects the `new_contract` disposition without a proposed contract identifier
- **THEN** structural validation rejects the record without consulting the contract source

#### Scenario: Non-applicability cannot be selected as a disposition
- **WHEN** an assessment-form CRA declares `not_applicable` as its disposition
- **THEN** validation rejects the record with a stable field diagnostic

#### Scenario: Exemption form carries no disposition
- **WHEN** an exemption-form CRA declares any disposition
- **THEN** schema validation rejects the record with a stable field diagnostic

### Requirement: Assessment reasoning evidence is bounded and non-authorizing

An assessment-form CRA SHALL carry `rationale`, `trust_boundary`, and `transformation_ownership` explanations of 40–1000 characters each. It SHALL carry one to eight `assurance_limitations` of 20–600 characters each, and one to two `alternatives`, each selecting `reuse`, `extend`, or `new_contract` with a 40–1000-character `rejection_reason`; an alternative SHALL NOT repeat the selected disposition. It SHALL carry a closed `author` object with a 3–120-character name and a one-to-39-character lowercase GitHub-style handle matching `^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$`, plus one to eight repository-relative `evidence_references`. #99 validates those references lexically only; neither #99 nor #100 treats their existence or contents as authorization evidence. These fields are author assertions and supporting evidence only; they SHALL NOT be interpreted as project-owner approval, signed review, implementation authorization, or a duplicate contract authority/privacy/transformation vocabulary.

#### Scenario: Assessment evidence cannot be omitted
- **WHEN** an assessment-form CRA omits required reasoning, author, alternative, or assurance evidence
- **THEN** schema validation rejects the record with a stable missing-field diagnostic

#### Scenario: Assessment evidence is not approval
- **WHEN** an assessment-form CRA contains valid author and supporting evidence
- **THEN** normal signed-review and project-owner-governance requirements remain independently required

### Requirement: Exemptions are project-owner-bound exceptions with external evidence

A qualifying change may use an exemption form only when it carries an explicit written, change-bound exemption granted by the project owner. The closed exemption shape SHALL contain one to 25 repository-relative `scope_paths`, a 40–1000-character `rationale`, and closed `governance_locator: { change }` using the existing `governanceRecords[]` change-key dialect; it SHALL contain no record-source or record-path field. That symbolic locator refers only to the same change in the fixed `packages/security-audit-sdk-core/verification-lifecycle.json` `governanceRecords[]` source, so a caller SHALL NOT select another record path. Exactly one entry SHALL have `change` equal to the locator; zero or multiple matches fail closed. The locator SHALL remain unrecognized until direct-child signed record S exists after technical candidate T, has `reviewedCommit` equal to T, has `reviewedContent.candidateRoot` equal to `T^{tree}`, and carries the selected change root's exact T tree object. S SHALL have `signed: true`, `reviewer.name` exactly `Fernando Homem da Costa (nandohdc)`, and `contract-reuse-exemption:<change-id>` in `authorizations.granted`. The CRA schema SHALL validate the locator structurally; the checker SHALL validate the external evidence. An exemption SHALL be validated as a distinct exception outcome and SHALL NOT be interpreted as a successful reuse disposition or as authorization for unrelated changes.

#### Scenario: Project-owner exemption is recognized for its bound change
- **WHEN** a qualifying change carries a complete exemption granted by the project owner and bound to that change
- **THEN** the checker reports the defined exemption outcome for that change only

#### Scenario: Unauthorized exemption fails closed
- **WHEN** a qualifying change's signed record has a missing grant token, a different reviewer identity, or invalid content binding
- **THEN** the checker rejects the change with a stable unauthorized-exemption diagnostic

#### Scenario: Pre-sign exemption remains unrecognized
- **WHEN** an exemption-form CRA carries a structurally valid locator but direct-child signed record S has not yet bound technical candidate T
- **THEN** the checker fails closed rather than reporting an exemption outcome

### Requirement: Structural CRA validation is distinct from resolution against the supported contract version

CRA schema validation SHALL validate the closed record shape and safe mechanism-reference representation but SHALL NOT resolve a reference against the contract source. The structural test boundary SHALL use the existing dependency-free closed-schema interpreter without modifying design-pattern-governance code. For an assessment disposition requiring a mechanism reference, the checker SHALL support exactly `security-audit@1.0.0` and resolve each reference against `contracts/security-audit/source/contract.source.json` at that version. An unresolved reference or every other declared contract version SHALL fail closed. Diagnostics may name a bounded field, safe reference path, or version, but SHALL NOT echo unbounded rationale or other caller-supplied content.

#### Scenario: Structural acceptance does not prove resolution
- **WHEN** a CRA record passes structural schema validation with a mechanism reference
- **THEN** that result is distinct from a CRA-validated pass and does not establish that the reference resolves

#### Scenario: Existing registry reference resolves
- **WHEN** a CRA for the current security-audit contract references `registries.trust_levels`
- **THEN** the checker accepts that mechanism reference

#### Scenario: Misspelled registry reference is rejected
- **WHEN** a CRA references `registries.trust_levelz`
- **THEN** the checker rejects the record with a stable unresolved-mechanism diagnostic naming that reference

#### Scenario: Unsupported declared contract version fails closed
- **WHEN** a CRA declares a contract version that the checker cannot resolve
- **THEN** the checker rejects the record rather than resolving references against an arbitrary on-disk version

### Requirement: CRA structural dialect reuses the shared interpreter and starts closed at version `1.0`

The CRA schema SHALL use the repository's closed-schema dialect with named `assessment` and `exemption` records. Its CRA-local structural-rule adapter SHALL first invoke the existing dependency-free generic interpreter and then apply only declared cross-field structural rules; it SHALL NOT read the canonical contract, Git history, or governance records. Every CRA record SHALL initially declare `schema_version: "1.0"`; `1.0` is the only supported schema version. A future minor version MAY add optional evidence only. Removing, weakening, or changing existing evidence requires a major version, explicit migration, and CRA governance review. Unknown newer and unsupported older schema versions SHALL fail closed with their distinct stable diagnostics; the adapter SHALL NOT select a fallback version.

#### Scenario: A newer schema version fails distinctly
- **WHEN** a CRA record declares a schema version newer than `1.0`
- **THEN** structural validation rejects it with the stable unknown-new-version diagnostic
- **AND THEN** no fallback schema version is selected

#### Scenario: An older schema version fails distinctly
- **WHEN** a CRA record declares a schema version older than `1.0`
- **THEN** structural validation rejects it with the stable unsupported-old-version diagnostic

### Requirement: CRA enforcement proves applicability and failure modes

Before CRA enforcement is relied upon, it SHALL prove a valid required record, a non-applicable approved skip, a missing required record, a malformed or structurally invalid record, an unresolved mechanism reference, an unauthorized exemption, and an unmodified null control. Each proof SHALL assert its expected stable diagnostic or its distinguishable successful outcome; exit status alone SHALL NOT satisfy the proof.

#### Scenario: Valid required record passes
- **WHEN** a CRA-triggered fixture change carries a valid record with resolved references
- **THEN** enforcement reports a CRA-validated pass

#### Scenario: Missing required record fails
- **WHEN** a CRA-triggered fixture change carries neither a CRA record nor valid owner-exemption evidence
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
