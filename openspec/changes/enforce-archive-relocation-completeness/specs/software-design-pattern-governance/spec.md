## ADDED Requirements

### Requirement: R25 — Archive relocation is complete in the commit
A range that introduces a recognised archive relocation of a change SHALL NOT leave that change's
active directory present at HEAD. Completeness SHALL be judged from the commit tree, not from the
working tree, and SHALL be verified for every relocation the range introduces.

#### Scenario: Relocation adds the archive without removing the active directory
- **WHEN** a range introduces `openspec/changes/archive/<dated>-<id>/` and `openspec/changes/<id>/`
  still exists at HEAD
- **THEN** governance verification SHALL fail closed

#### Scenario: Relocation is complete
- **WHEN** a range introduces the dated archive directory and the active directory is absent at HEAD
- **THEN** governance verification SHALL accept the relocation

#### Scenario: An existing archive directory is edited later
- **WHEN** a range touches a dated archive directory whose relocation it did not introduce
- **THEN** the completeness check SHALL NOT fire on that directory
