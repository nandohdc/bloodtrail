# Spec Delta

## MODIFIED Requirements

### Requirement: Storage is reached through a narrow port whose backend selection is separately governed

Collector persistence SHALL be expressed as a port with exactly three asynchronous operations — write one record,
read one record by tenant scope and event identity, and delete records whose retention has expired —
and every operation SHALL resolve to a value drawn from a closed, total result union. A caller SHALL
treat a rejected operation, or a resolved value outside the union, as an indeterminate outcome.

The port SHALL be idempotent on event identity: writing the same event identity within the same
tenant scope more than once SHALL leave one record and SHALL be indistinguishable in result from
writing it once, including when the writes are concurrent.

Selecting a backend that implements the port SHALL be a separate governed change carrying its own
authorization. Availability or convenience of a backend SHALL NOT be an input to that selection.

#### Scenario: Port surface is closed
- **WHEN** the storage port is exercised
- **THEN** every outcome resolves to a member of the declared result union and no outcome is an unhandled
  exception or an open-ended value

#### Scenario: Repeated write of one identity is idempotent
- **WHEN** the same event identity is written twice within the same tenant scope, one after the other or concurrently
- **THEN** one record exists and both writes report the same result

#### Scenario: Backend selection is not made by this decision
- **WHEN** this capability is consulted for a storage product
- **THEN** it names none, and requires a separate governed change with its own authorization

### Requirement: The storage decision authorizes no implementation and carries its own provenance

This capability SHALL record `decision_source = "delegated to Claude by the owner, 2026-09-09; not a
human owner decision"`, and SHALL NOT be cited as exact-commit owner authorization for any
implementation.

This capability SHALL authorize no storage implementation, no backend selection, no deployment, and
no pilot. `storage` SHALL remain a forbidden filename, import, and export token in the production
scope gate until a separate governed change with its own authorization changes that, and such a
change SHALL permit it only for the exact files it names. `implement-collector-storage-adapter`
(#115) is that change for the collector library: it permits the token for the files `src/storage.ts` and
`src/sqlite-storage.ts` alone, and so for relative imports of those two modules, and leaves
`storage` forbidden as an export token and in every other filename. `add-collector-live-poc-deployment`
is that change for the collector server workspace: on the owner's decision of 2026-11-18 it selects
PostgreSQL and permits the token for that workspace's `src/postgres-storage.ts` alone.

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
