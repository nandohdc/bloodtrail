## ADDED Requirements

### Requirement: The public export surface is frozen after vertical-slice evidence

After a passing producer-to-collector vertical-slice evidence record exists, the package's complete public export surface — every runtime value export and every type-only export declared by the package's entry point — SHALL be frozen: recorded as an explicit, versioned list referencing the exact evidence commit it depends on, and mechanically checked on every verification run. An addition, removal, or rename of any export SHALL fail that check unless the frozen list is updated in the same governed change. No frozen export name SHALL collide with the platform-neutral core package's own frozen export surface, so the Node binding's surface reuses the core's semantic types rather than duplicating them.

#### Scenario: The frozen surface is explicit, versioned, and evidence-bound
- **WHEN** the package's public-surface freeze record is inspected
- **THEN** it names an explicit, version-controlled list of every value and type-only export and the exact commit of the vertical-slice evidence the freeze depends on

#### Scenario: An unapproved export mutation is rejected
- **WHEN** a disposable mutation adds, removes, or renames any export from the package's entry point without updating the frozen list
- **THEN** the public-surface check fails closed and names the unapproved or missing export

#### Scenario: The frozen surface reuses core semantic types without duplication
- **WHEN** the frozen export list is compared against the platform-neutral core package's own frozen export surface
- **THEN** no name appears in both lists
