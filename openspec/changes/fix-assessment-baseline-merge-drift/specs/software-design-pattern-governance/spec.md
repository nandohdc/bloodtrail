## MODIFIED Requirements

### Requirement: R10 — Assessment ordering is proven by Git ancestry
An `assessment_commit` SHALL contain a valid approved assessment, contain no governed implementation-path change relative to the proposal baseline, precede and be an ancestor of the earliest commit after that baseline that modifies a governed implementation path, and be an ancestor of the final reviewed technical commit. Complete Git history SHALL be required. A retrospective exception SHALL never be inferred and SHALL be available only for grandfathered or emergency work with owner identity, reason, affected commits, paths, residual risk, and reduced-assurance confirmation. A generated assessment SHALL derive its proposal baseline only from an explicit value authored in `assessment.source.json`; it SHALL NOT derive that value from the checkout's current `HEAD`.

#### Scenario: Valid assessment precedes implementation
- **WHEN** the assessment commit precedes and is an ancestor of the earliest governed implementation commit and final technical commit
- **THEN** ordering verification SHALL accept the ancestry

#### Scenario: Assessment follows implementation
- **WHEN** the assessment commit is after the earliest governed implementation commit
- **THEN** ordering verification SHALL reject the sequence

#### Scenario: Assessment and implementation share a commit
- **WHEN** one commit first introduces both assessment and governed implementation changes
- **THEN** ordering verification SHALL reject the sequence

#### Scenario: Assessment is unrelated
- **WHEN** the claimed assessment commit is not an ancestor of the earliest implementation or final technical commit
- **THEN** ordering verification SHALL reject the claim

#### Scenario: Assessment is amended after implementation
- **WHEN** assessment evidence is rewritten only after implementation begins
- **THEN** normal ordering verification SHALL reject it rather than backdate approval

#### Scenario: First implementation ancestry is missing
- **WHEN** complete ancestry to identify the earliest governed implementation commit is unavailable
- **THEN** governance verification SHALL fail closed with a history-unavailable diagnostic

#### Scenario: Human retrospective exception is explicit
- **WHEN** eligible grandfathered or emergency work records every retrospective-exception field
- **THEN** verification MAY proceed while reporting that retrospective assessment is not equivalent assurance

#### Scenario: Generated assessment crosses a merge boundary
- **WHEN** a generated assessment is checked at a descendant merge commit without an authored source change
- **THEN** the generated assessment SHALL remain byte-identical and retain its original explicit proposal baseline

#### Scenario: Source omits a proposal baseline
- **WHEN** an assessment source requests generation without an explicit proposal baseline
- **THEN** generation SHALL fail with a bounded diagnostic rather than binding ordering evidence to the current checkout
