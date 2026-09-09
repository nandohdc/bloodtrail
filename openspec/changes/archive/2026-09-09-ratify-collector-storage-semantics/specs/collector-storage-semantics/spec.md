## ADDED Requirements

### Requirement: Acknowledgment never precedes durability

The collector SHALL return exactly one of two acknowledgment kinds for an occurrence that passes
every ingress stage: `admitted`, which records admission and makes no durability claim, and
`persisted`, which SHALL be returned only after the storage port has confirmed the write.

There SHALL be no third acknowledgment kind, and no configuration, option, or deployment mode SHALL
make `persisted` reachable without a confirmed write. When storage is not enabled, the collector
SHALL return `admitted` and SHALL NOT represent that result as durable.

#### Scenario: Persisted acknowledgment follows a confirmed write
- **WHEN** the storage port confirms a write for an admitted occurrence
- **THEN** the collector acknowledges `persisted`

#### Scenario: Admission without storage is never durable
- **WHEN** storage is not enabled and an occurrence passes every ingress stage
- **THEN** the collector acknowledges `admitted` and makes no durability claim

#### Scenario: No acknowledgment is issued ahead of the write
- **WHEN** a write has been issued to the storage port and has not yet been confirmed
- **THEN** no `persisted` acknowledgment is issued for that occurrence

### Requirement: Storage is reached through a narrow port whose backend selection is separately governed

Collector persistence SHALL be expressed as a port with exactly three operations — write one record,
read one record by tenant scope and event identity, and delete records whose retention has expired —
and every operation SHALL return a value drawn from a closed, total result union.

The port SHALL be idempotent on event identity: writing the same event identity within the same
tenant scope more than once SHALL leave one record and SHALL be indistinguishable in result from
writing it once.

Selecting a backend that implements the port SHALL be a separate governed change carrying its own
authorization. Availability or convenience of a backend SHALL NOT be an input to that selection.

#### Scenario: Port surface is closed
- **WHEN** the storage port is exercised
- **THEN** every outcome is a member of the declared result union and no outcome is an unhandled
  exception or an open-ended value

#### Scenario: Repeated write of one identity is idempotent
- **WHEN** the same event identity is written twice within the same tenant scope
- **THEN** one record exists and both writes report the same result

#### Scenario: Backend selection is not made by this decision
- **WHEN** this capability is consulted for a storage product
- **THEN** it names none, and requires a separate governed change with its own authorization

### Requirement: Retention derives from the record and not from the deployment

The retention of a stored occurrence SHALL derive from that occurrence's own
`data.retention_class`, which the frozen contract already defines and the producer already sets.

A deployment SHALL NOT shorten, lengthen, or override the retention implied by a record's retention
class. A deployment MAY decline to store a class of records at all, and that refusal SHALL be
visible as a rejection rather than as a silent shorter retention.

#### Scenario: Two deployments retain one record identically
- **WHEN** the same occurrence is stored by two deployments
- **THEN** both derive the same retention from the record's retention class

#### Scenario: Declining to store is explicit
- **WHEN** a deployment does not store a retention class
- **THEN** the submission is rejected with a distinct diagnostic and is not stored with a shorter
  retention

### Requirement: Expiry deletes whole records and never fields within them

Deletion at retention expiry SHALL remove the entire record. A field inside a retained record SHALL
NOT be redacted, blanked, truncated, or otherwise mutated in place as a retention action.

Deletion SHALL be irreversible: after expiry the record SHALL NOT be recoverable from the collector,
and no derived index SHALL retain a copy of any field the deletion removed.

#### Scenario: Expired record is removed whole
- **WHEN** a record's retention has expired
- **THEN** the whole record is deleted and no field of it remains readable

#### Scenario: Field-level expiry is not a retention action
- **WHEN** a retention policy is applied to a stored record
- **THEN** no field within a retained record is mutated in place

#### Scenario: Indexes do not outlive the record
- **WHEN** a record is deleted at expiry
- **THEN** no index or auxiliary structure retains a value copied out of that record

### Requirement: Any future integrity computation is over a retention-stable projection

Cryptographic audit-log chaining, hash chains, and tamper-evident log linking SHALL NOT be designed
by this capability and SHALL remain unauthorized absent separate explicit authorization.

Should such a scheme later be authorized, its computation SHALL be defined over a **retention-stable
projection** of a record — the subset of a record that retention can never alter while the record is
retained — so that the expiry of any element cannot invalidate the integrity of a record that is
still retained.

#### Scenario: Chaining is not designed here
- **WHEN** this capability is consulted for an integrity or chaining scheme
- **THEN** it defines none and records that one remains unauthorized

#### Scenario: Retention cannot invalidate a retained record
- **WHEN** a future integrity value is computed over a stored record
- **THEN** it is computed over a projection whose elements retention does not alter for as long as
  the record is retained

### Requirement: Every write failure resolves to one deterministic collector outcome

A write that the storage port reports as failed SHALL resolve to a rejection with a distinct
diagnostic, and the occurrence SHALL NOT be acknowledged as `persisted`.

A write whose outcome the storage port can neither confirm nor deny — a partial outage, a timeout,
or a severed connection after the request was issued — SHALL be treated as **not persisted**. It
SHALL resolve to a rejection with a diagnostic distinct from the outright-failure diagnostic, so
that an indeterminate write is never reported as a definite one. Because the port is idempotent on
event identity, treating an indeterminate write as not persisted SHALL NOT be able to produce a
duplicate record on a subsequent attempt.

No write outcome SHALL be silent, and no write failure SHALL be reported to the sender as a
successful durable acknowledgment.

#### Scenario: Outright write failure rejects
- **WHEN** the storage port reports that a write failed
- **THEN** the collector rejects with the write-failure diagnostic and issues no `persisted`
  acknowledgment

#### Scenario: Indeterminate write is not persisted
- **WHEN** the storage port neither confirms nor denies a write
- **THEN** the collector rejects with a diagnostic distinct from outright failure, and the
  occurrence is treated as not persisted

#### Scenario: Retry after an indeterminate write does not duplicate
- **WHEN** an occurrence rejected as indeterminate is submitted again with the same event identity
- **THEN** port idempotency leaves one record

### Requirement: Tenant scope is enforced on read as well as on write

Every stored record SHALL carry the tenant scope under which it was admitted, and every read SHALL
name a tenant scope.

A read that cannot name a tenant scope SHALL return nothing rather than returning records across
scopes. The port SHALL provide no operation whose result can span more than one tenant scope, so
that cross-tenant retrieval has no expressible form rather than being merely disallowed.

#### Scenario: Read without a scope returns nothing
- **WHEN** a read does not name a tenant scope
- **THEN** it returns no record

#### Scenario: Cross-tenant retrieval is inexpressible
- **WHEN** the port surface is examined for an operation spanning tenant scopes
- **THEN** none exists

### Requirement: Encryption at rest is required and key ownership is separate from data ownership

Stored records SHALL be encrypted at rest. The collector SHALL NOT hold, derive, generate, or
transit key material, and the storage port SHALL NOT accept key material as a parameter.

A backend that cannot separate the authority that holds keys from the authority that holds data
SHALL be disqualified from selection.

#### Scenario: The port never carries key material
- **WHEN** the storage port surface is examined
- **THEN** no operation accepts, returns, or logs key material

#### Scenario: Inseparable key ownership disqualifies a backend
- **WHEN** a candidate backend requires the data holder to also hold the keys
- **THEN** it is not eligible for selection

### Requirement: Storage requires named owners that a deployment fills before it is enabled

A deployment SHALL NOT enable collector storage until three roles are filled and recorded: the
**data owner**, accountable for the stored evidence; the **retention and deletion authority**,
accountable for the retention classes stored and for honouring deletion; and the **key owner**,
accountable for the keys under which records are encrypted.

The three roles MAY be filled by different parties and SHALL each be named; an unfilled or unnamed
role SHALL block enabling storage rather than defaulting to the operator.

Filling these roles is an owner act. This capability SHALL NOT fill them, and its own decision
provenance SHALL NOT be read as having filled them.

#### Scenario: Unnamed role blocks storage
- **WHEN** any of the three roles is unfilled or unnamed
- **THEN** storage is not enabled

#### Scenario: Roles do not default to the operator
- **WHEN** a role is not named
- **THEN** it is not inferred from who is running the collector

### Requirement: Migration and recovery boundaries are explicit

A stored record SHALL carry the schema version under which it was admitted. A record SHALL be
readable by a collector whose supported-version set contains that version, and SHALL be unreadable —
reported as an explicit unsupported-version outcome rather than as an absent record — by one whose
set does not.

Recovery SHALL restore records only. An acknowledgment already returned to a sender SHALL NOT be
reissued, revoked, or reconstructed by recovery, because an acknowledgment already delivered cannot
be un-delivered.

#### Scenario: Unsupported stored version is distinguishable from absence
- **WHEN** a record's schema version is outside the reading collector's supported set
- **THEN** the read reports an unsupported-version outcome and not a missing record

#### Scenario: Recovery restores records and not acknowledgments
- **WHEN** stored records are restored from a recovery point
- **THEN** no acknowledgment is reissued or revoked as part of the restore

### Requirement: The storage decision authorizes no implementation and carries its own provenance

This capability SHALL record `decision_source = "delegated to Claude by the owner, 2026-09-09; not a
human owner decision"`, and SHALL NOT be cited as exact-commit owner authorization for any
implementation.

This capability SHALL authorize no storage implementation, no backend selection, no deployment, and
no pilot. `storage` SHALL remain a forbidden filename, import, and export token in the production
scope gate until a separate governed change with its own authorization changes that.

This capability SHALL state that it cannot establish that a future deployment meets any durability,
confidentiality, or deletion goal: it bounds what the collector may claim, and proves nothing about
a backend that has not been selected.

#### Scenario: Decision provenance is delegated, not owner authorization
- **WHEN** this capability is cited as authorization for implementing storage
- **THEN** the citation fails, because the capability records a delegated decision and authorizes no
  implementation

#### Scenario: The scope gate is unchanged
- **WHEN** the production scope gate is run after this capability is ratified
- **THEN** `storage` is still rejected as a filename, import, and export token

#### Scenario: Assurance limitation is stated
- **WHEN** this capability is read for evidence that a deployment is durable, confidential, or
  deletes on time
- **THEN** it states that it provides none
