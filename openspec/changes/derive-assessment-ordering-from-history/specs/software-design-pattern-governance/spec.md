## MODIFIED Requirements

### Requirement: R10 — Assessment ordering is proven by Git ancestry
Assessment ordering SHALL be proven from Git ancestry, never from commits an assessment declares about itself. A change's assessment commit is the first commit that adds its `assessment.json`. It SHALL strictly precede every governed commit in the reviewed range that the change owns, so it SHALL NOT itself change a governed path the change owns, except that a commit several changes own SHALL be accepted when the assessment commit of at least one of them strictly precedes it. A change that owns a governed commit in the reviewed range but has no commit adding its assessment SHALL fail closed, whatever the other owners show. Ordering commits recorded in the assessment SHALL be optional, and SHALL be checked against history rather than trusted; a recorded assessment commit SHALL change no governed implementation path. Complete Git history SHALL be required. A retrospective exception SHALL never be inferred and SHALL be available only for grandfathered or emergency work with owner identity, reason, affected commits, paths, residual risk, and reduced-assurance confirmation. A generated assessment SHALL derive its proposal baseline only from an explicit value authored in `assessment.source.json`; it SHALL NOT derive that value from the checkout's current `HEAD`.

#### Scenario: Valid assessment precedes implementation
- **WHEN** the commit that first adds a change's assessment strictly precedes every governed commit in the reviewed range that the change owns
- **THEN** ordering verification SHALL accept the ancestry

#### Scenario: Assessment follows implementation
- **WHEN** a governed commit in the reviewed range that the change owns is not a descendant of the commit that first adds the change's assessment, and no other change that owns the commit has an assessment commit that strictly precedes it
- **THEN** ordering verification SHALL reject the sequence

#### Scenario: Assessment and implementation share a commit
- **WHEN** one commit first introduces both a change's assessment and governed implementation that the change owns, and no other change that owns that implementation has an assessment commit that strictly precedes it
- **THEN** ordering verification SHALL reject the sequence

#### Scenario: Assessment is unrelated
- **WHEN** a recorded assessment commit does not change the assessment, is neither the commit that first adds it nor a descendant of that commit, or does not precede the change's governed commits in the reviewed range
- **THEN** ordering verification SHALL reject the claim

#### Scenario: Assessment is amended after implementation
- **WHEN** a commit in the reviewed range changes the assessment's decision content after one of the change's own governed commits in that range
- **THEN** normal ordering verification SHALL reject it rather than backdate approval

#### Scenario: First implementation ancestry is missing
- **WHEN** complete ancestry is unavailable, or no commit adding the assessment can be found for a change that owns a governed commit in the reviewed range
- **THEN** governance verification SHALL fail closed with a bounded diagnostic

#### Scenario: Human retrospective exception is explicit
- **WHEN** eligible grandfathered or emergency work records every retrospective-exception field
- **THEN** verification MAY proceed while reporting that retrospective assessment is not equivalent assurance

#### Scenario: Generated assessment crosses a merge boundary
- **WHEN** a generated assessment is checked at a descendant merge commit without an authored source change
- **THEN** the generated assessment SHALL remain byte-identical and retain its original explicit proposal baseline

#### Scenario: Source omits a proposal baseline
- **WHEN** an assessment source requests generation without an explicit proposal baseline
- **THEN** generation SHALL fail with a bounded diagnostic rather than binding ordering evidence to the current checkout

#### Scenario: Ordering is derived when nothing is recorded
- **WHEN** an assessment records no assessment, earliest implementation or final technical commit
- **THEN** ordering verification SHALL still derive the assessment commit from history and check every governed commit in the reviewed range that the change owns

#### Scenario: Another change's commit does not count
- **WHEN** a governed commit outside a change's owned paths lands on the shared mainline after that change's proposal baseline and before its assessment
- **THEN** ordering verification SHALL NOT attribute that commit to the change

#### Scenario: Several changes own a commit
- **WHEN** a governed commit in the reviewed range touches paths owned by more than one change
- **THEN** ordering verification SHALL accept it if the assessment commit of at least one owning change strictly precedes it

#### Scenario: Recorded earliest implementation commit disagrees with history
- **WHEN** a recorded earliest governed implementation commit is not a governed commit the change owns, does not follow the change's assessment commit, or is preceded by another governed commit the change owns in the reviewed range
- **THEN** ordering verification SHALL reject the record

#### Scenario: Evidence is recorded after implementation
- **WHEN** a commit in the reviewed range changes only the assessment's ordering record, invariant evidence, verification task identifiers or owned paths after implementation begins
- **THEN** ordering verification SHALL accept the change as evidence and scope bookkeeping rather than an amended approval

#### Scenario: Contract-reuse record accompanies the assessment
- **WHEN** the commit that first adds a change's assessment also adds that change's contract-reuse record
- **THEN** ordering verification SHALL treat the record as a planning artifact rather than governed implementation

#### Scenario: Amendment in a later range is not tied back
- **WHEN** an assessment's decision content changes in a reviewed range that contains none of the change's own governed commits
- **THEN** ordering verification SHALL NOT report it as an amendment after implementation, and this limit SHALL be disclosed as a limit rather than presented as assurance
