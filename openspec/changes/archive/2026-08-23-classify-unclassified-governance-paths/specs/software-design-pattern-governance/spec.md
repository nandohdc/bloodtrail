## ADDED Requirements

### Requirement: R26 — Path classification is complete over the tracked repository

The declared path classification SHALL cover every tracked repository path. Governance verification SHALL fail closed with a distinct diagnostic naming each tracked path that matches no declared classification, independently of whether the change under verification touches that path. Completeness SHALL be evaluated over tracked paths only, so untracked and ignored files impose no obligation. Completeness SHALL NOT be satisfied by an exact-change emergency classification record: an emergency record under R21 is bounded to one change and ends when that change merges or is abandoned, whereas a tracked path requires a classification that outlives any single change. Removing or narrowing a declared pattern SHALL fail whenever the result leaves a tracked path unclassified, so coverage cannot be withdrawn by deletion.

#### Scenario: A tracked path matches no declared classification

- **WHEN** the repository tracks a path that matches no pattern in any declared path class
- **THEN** governance verification SHALL fail with a distinct completeness diagnostic naming that path

#### Scenario: Completeness holds

- **WHEN** every tracked repository path matches at least one declared classification pattern
- **THEN** completeness verification SHALL pass and report the number of tracked paths it classified

#### Scenario: A new unclassified path is introduced

- **WHEN** a change adds a tracked path that matches no declared classification pattern
- **THEN** verification SHALL fail on that change rather than deferring the failure to a later change that happens to touch the path

#### Scenario: Coverage is withdrawn by deletion

- **WHEN** a change removes or narrows a declared pattern and a tracked path is left matching no classification
- **THEN** verification SHALL fail and name the paths the change left uncovered

#### Scenario: An emergency record is offered as completeness evidence

- **WHEN** an exact-change emergency classification record is the only classification covering a tracked path
- **THEN** completeness verification SHALL still fail for that path, because the record ends with its change

#### Scenario: Ignored files impose no obligation

- **WHEN** the working tree contains untracked or ignored files that match no declared classification pattern
- **THEN** completeness verification SHALL disregard them and SHALL NOT fail
