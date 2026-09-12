## MODIFIED Requirements

### Requirement: Version ownership is explicit per artifact

Version ownership SHALL be recorded per artifact and SHALL be binding: `version.txt` plus `.release-please-manifest.json` are the repository release series, moved only by Release Please (simple target, package `"."`); each private SDK candidate's `package.json` is a candidate identity frozen by its own `compatibility.json` `package.version` (status `isolated-candidate-not-published` for the core, `frozen-not-published` for the Node binding), held equal by the `package-version` coherence rule, and any movement of one SHALL be a separate governed change with its own owner decision that updates `compatibility.json` in the same commit, never a side effect of a release; the contract `package.json` (`1.0.0`) is owned by the separate `security-audit-event-contract` governance process under a protected prefix that `test:changed-paths` refuses to write, and is deliberately independent of the canonical contract schema version; the research `package.json` (`0.0.0-research`) is a research artifact and SHALL never be released.

Ratified text SHALL NOT pin an absolute candidate version literal. The literal is what goes stale: a governed candidate move is legitimate and expected, and a requirement naming the value it moves from becomes non-conformant the moment that move lands. Conformance SHALL be stated against the pin — `compatibility.json` — rather than against a snapshot of it.

#### Scenario: A release does not move the SDK version
- **WHEN** a repository release is cut
- **THEN** every workspace `package.json` version is unchanged and still equals its own `compatibility.json` `package.version` where one exists, and the release moved only `version.txt`, the manifest and the changelog

#### Scenario: SDK version movement is a governed decision
- **WHEN** an SDK package version needs to move
- **THEN** it moves only under a separate governed change with its own owner decision, and `compatibility.json` is updated in the same commit

#### Scenario: Contract and research versions are not release-managed
- **WHEN** a repository release is cut
- **THEN** the contract `package.json` version `1.0.0` and the research `package.json` version `0.0.0-research` are unchanged and are governed by their own processes

#### Scenario: A release touching a package version fails coherence
- **WHEN** a change moves an SDK `package.json` version without moving that package's `compatibility.json` `package.version` in the same commit
- **THEN** the `package-version` coherence rule fails, because the package version differs from the compatibility baseline

#### Scenario: Ratified text names no candidate version literal
- **WHEN** this capability's ratified text is inspected for candidate version literals
- **THEN** it names none, so a governed candidate move cannot make it non-conformant

### Requirement: The repository and SDK package version namespaces stay independent

The repository version namespace (`version.txt`) and the SDK package version namespace (`package.json`) SHALL stay independent, because they denote different things: `version.txt` is a repository state marker derived from Conventional Commits across the whole tree, answering which state of the repository this is, while an SDK version is a candidate identity answering which SDK candidate this is and which contract version and toolchain it speaks. No mechanism SHALL couple the two namespaces today, and a commit that changes only documentation SHALL NOT bump an SDK version. Coupling SHALL happen only under a revisit condition, when an SDK version acquires external consumers.

#### Scenario: A documentation-only commit does not bump the SDK version
- **WHEN** a commit changes only documentation and the repository series bumps
- **THEN** the SDK `package.json` version is unchanged and still equals its `compatibility.json` `package.version`

#### Scenario: No coupling mechanism exists today
- **WHEN** the version namespaces are inspected
- **THEN** `version.txt` (repository series) and the SDK `package.json` version are independent, with the SDK version pinned to `compatibility.json` rather than to the repository series

#### Scenario: Coupling is a revisit condition, not a pre-built feature
- **WHEN** coupling of the two namespaces is proposed outside a revisit condition
- **THEN** it is out of conformance, because the SDK version has no external consumer whose expectations coupling would serve

## ADDED Requirements

### Requirement: The published version table covers every declared package and is asserted

The document that states what a release versions SHALL enumerate every declared package — the set held by `DECLARED_PACKAGES` — and SHALL state, for each, the version its own `package.json` carries and what governs that version. A declared package absent from the table SHALL be a failure, and a table row naming no declared package SHALL also be a failure, so the enumeration fails closed in both directions.

Each row's version SHALL be compared against that package's own `package.json` rather than maintained by hand, so a governed version move that does not update the table fails rather than leaving the document describing a version that no longer exists.

#### Scenario: Every declared package appears in the table
- **WHEN** the table is compared against `DECLARED_PACKAGES`
- **THEN** each declared package is present, and the assertion passes

#### Scenario: A declared package missing from the table fails
- **WHEN** a declared package does not appear in the table
- **THEN** the assertion fails, naming the absent package

#### Scenario: A table row under no declared package fails
- **WHEN** the table names a workspace that is not a declared package
- **THEN** the assertion fails, naming the stray row

#### Scenario: A row whose version differs from its package.json fails
- **WHEN** a row states a version that the package's own `package.json` does not carry
- **THEN** the assertion fails, naming the row, the stated version and the actual one

#### Scenario: Adding a package without adding it to the table fails
- **WHEN** a package is added to `DECLARED_PACKAGES` and not to the table
- **THEN** the assertion fails, the same way a covering `make` target that skips it fails
