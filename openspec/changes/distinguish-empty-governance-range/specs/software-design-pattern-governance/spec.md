## MODIFIED Requirements

### Requirement: R11 — The governance perimeter is actor-neutral and capability-bound
After activation, any change touching a governed implementation path SHALL be associated with an applicable OpenSpec change for the modified capability and design-pattern governance evidence. The policy SHALL inspect the material commit range and behavior in tests, build files, scripts, and configuration. It SHALL apply equally to humans, Hermes, Claude Code, other agents, direct commits, pull requests, and scripts. A successful perimeter check whose selected baseline resolves to the current `HEAD` SHALL report that resolved baseline, zero inspected commits, and zero inspected paths; it SHALL NOT omit range-result fields merely because no material commit is present.

#### Scenario: Code changes without OpenSpec
- **WHEN** a governed implementation path changes without an applicable OpenSpec change
- **THEN** perimeter verification SHALL reject the change

#### Scenario: OpenSpec change is unrelated
- **WHEN** an OpenSpec change exists but does not own or describe the modified capability
- **THEN** perimeter verification SHALL reject the association

#### Scenario: Documentation-only claim changes implementation
- **WHEN** a change claims documentation-only scope while modifying governed implementation
- **THEN** perimeter verification SHALL reject the classification

#### Scenario: Implementation is hidden in supporting paths
- **WHEN** tests, build files, scripts, or configuration introduce material implementation behavior
- **THEN** perimeter verification SHALL classify and govern that behavior

#### Scenario: Material work is split across commits
- **WHEN** one material change is divided across commits to evade classification
- **THEN** range-level perimeter verification SHALL evaluate and reject the evasion

#### Scenario: Explicit baseline resolves to an empty range
- **WHEN** a perimeter check receives a baseline that resolves to the current `HEAD`
- **THEN** it SHALL retain its successful verdict and report the resolved baseline with exactly zero inspected commits and zero inspected paths

#### Scenario: Public API is called internal
- **WHEN** a public API change is labeled internal-only
- **THEN** behavioral trigger evidence SHALL override the label and require full assessment

#### Scenario: Concurrency is called performance-only
- **WHEN** concurrency is introduced under a performance-only label
- **THEN** behavioral trigger evidence SHALL require full and security-sensitive assessment

#### Scenario: Human direct commit is governed
- **WHEN** a human direct commit changes the same governed path as an agent change
- **THEN** the same perimeter and evidence requirements SHALL apply
