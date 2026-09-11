## MODIFIED Requirements

### Requirement: The storage decision authorizes no implementation and carries its own provenance

This capability SHALL record `decision_source = "delegated to Claude by the owner, 2026-09-09; not a
human owner decision"`, and SHALL NOT be cited as exact-commit owner authorization for any
implementation.

This capability SHALL authorize no storage implementation, no backend selection, no deployment, and
no pilot. `storage` SHALL remain a forbidden filename, import, and export token in the production
scope gate until a separate governed change with its own authorization changes that, and such a
change SHALL permit it only for the exact files it names. `implement-collector-storage-adapter`
(#115) is that change: it permits the token for the files `src/storage.ts` and
`src/sqlite-storage.ts` alone, and so for relative imports of those two modules, and leaves
`storage` forbidden as an export token and in every other filename.

This capability SHALL state that it cannot establish that a future deployment meets any durability,
confidentiality, or deletion goal: it bounds what the collector may claim, and proves nothing about
a backend that has not been selected.

#### Scenario: Decision provenance is delegated, not owner authorization
- **WHEN** this capability is cited as authorization for implementing storage
- **THEN** the citation fails, because the capability records a delegated decision and authorizes no
  implementation

#### Scenario: The scope gate is unchanged
- **WHEN** the production scope gate is run after this capability is ratified
- **THEN** `storage` is still rejected as a filename, import, and export token everywhere except the
  exact files a separate governed selection change names

#### Scenario: Assurance limitation is stated
- **WHEN** this capability is read for evidence that a deployment is durable, confidential, or
  deletes on time
- **THEN** it states that it provides none
