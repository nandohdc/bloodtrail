## MODIFIED Requirements

### Requirement: Collector-local duplicate identity and retention are bounded

After all required ingress validation has succeeded, the collector SHALL derive duplicate identity exclusively from the authenticated sender identity and the validated canonical `event.id`. The collector SHALL retain, in memory only, one canonical deduplication key for each such identity for 300 seconds from its first admission, up to 32 live identities. The canonical deduplication key SHALL be derived from the validated submission body by excluding the attempt-scoped `correlation.retry_attempt` field and exactly comparing every other field, so that only a genuine retry of the same occurrence — never a payload that differs in any other respect — can share a key. It SHALL purge expired records lazily before every duplicate decision and new-record decision. When storage is configured and the persist stage cannot confirm the write of a first-seen identity, the collector SHALL withdraw that identity's record, so that a later submission of the same identity is decided as first-seen rather than as a duplicate of evidence that was never stored. The record is a synthetic, non-production idempotency control: it SHALL NOT be durable storage, a queue, a delivery record, a retention-policy decision, or an exactly-once guarantee.

#### Scenario: First valid identity is retained
- **WHEN** an authenticated, size-bounded, schema-valid, supported-version submission presents an identity not retained by the collector
- **THEN** the collector retains that sender-and-event identity with its canonical deduplication key before admission and returns the ordinary admitted outcome, or, with storage configured, proceeds to the persist stage

#### Scenario: Expired identity can be admitted again
- **WHEN** the 300-second retention window has elapsed for an identity before a later valid submission is decided
- **THEN** the collector removes the expired record and treats the later submission as first-seen

#### Scenario: Live capacity fails closed
- **WHEN** 32 unexpired identities are retained and a different valid identity is submitted
- **THEN** the collector rejects the new identity with a bounded capacity diagnostic, creates no record for it, and does not admit it

#### Scenario: Invalid input never creates a duplicate record
- **WHEN** a submission fails authentication, size, parsing, schema, or version validation
- **THEN** the collector creates no duplicate record and performs no duplicate decision for that submission

#### Scenario: An unconfirmed write withdraws the reservation
- **WHEN** storage is configured and the persist stage rejects a first-seen identity because the write was not confirmed
- **THEN** the collector retains no record for that identity, and a later identical submission is persisted again rather than returned as a duplicate

### Requirement: Ingress order is fixed and every stage fails closed

The collector ingress SHALL execute the stages in exactly this order: authenticate, size, parse, schema, version, deduplicate, persist, accept, where the persist stage SHALL run only when storage is configured and SHALL be absent otherwise. Each stage SHALL fail closed: a rejection at any stage SHALL terminate processing before any later stage runs, before admission, and before any capacity is consumed. An unreadable, malformed, or unexpected input at any stage SHALL produce a rejection, never a pass. The deduplication stage SHALL receive only the authenticated sender identity, validated canonical event identity, and a canonical deduplication key derived from the size-bounded submission body; it SHALL NOT run for a submission rejected by any earlier stage. The persist stage SHALL receive only a submission that passed every earlier stage and was decided first-seen.

#### Scenario: Rejection at an early stage prevents later stages
- **WHEN** a submission is rejected by the authenticate, size, parse, schema, or version stage
- **THEN** no later stage, including deduplication and persistence, runs and the submission is not admitted

#### Scenario: Acceptance requires passing every stage
- **WHEN** a submission is admitted
- **THEN** it passed authenticate, size, parse, schema, version, and deduplicate in that order, and admission capacity is consumed only at accept

#### Scenario: Persistence runs last and only with storage
- **WHEN** storage is configured and a submission passes every earlier stage as first-seen
- **THEN** the persist stage runs after deduplication, and without storage configured no persist stage runs at all

### Requirement: Acceptance is admission only

Without storage configured, acceptance at the ingress SHALL mean admission of a first-seen identity: the occurrence enters the delivery model's `admitted` state with its event identity and attempt identity assigned, and nothing more. With storage configured, the only acknowledgment for a first-seen identity SHALL be `persisted`, and it SHALL be issued only after the storage port confirms the write. An identical live duplicate SHALL return the distinct duplicate outcome without entering `admitted` or `persisted` again, and SHALL carry the acknowledgment its first-seen occurrence received and never a stronger one. The ingress SHALL NOT claim delivery, retry, at-least-once delivery, exactly-once delivery, or downstream acceptance in either mode, and SHALL NOT claim durability without storage. A validation-failed occurrence, conflicting reuse, deduplication-capacity rejection, or storage rejection SHALL never become `admitted` or `persisted`.

#### Scenario: Admitted occurrence carries identity only
- **WHEN** a first-seen submission is accepted without storage configured
- **THEN** the ingress records its admission with the occurrence's event identity, consumes admission capacity, and makes no delivery, durability, or downstream claim

#### Scenario: Rejected occurrence is never admitted
- **WHEN** a submission fails validation, conflicts with a retained identity, or cannot reserve bounded duplicate capacity
- **THEN** the occurrence never enters the `admitted` state and no admission capacity is consumed

#### Scenario: A duplicate never claims more than its first-seen occurrence
- **WHEN** a live duplicate arrives for an occurrence that was admitted without storage
- **THEN** its duplicate outcome carries the `admitted` acknowledgment and never `persisted`

## ADDED Requirements

### Requirement: The persist stage acknowledges only a confirmed write

When storage is configured, the persist stage SHALL build a stored record from the validated submission — its exact received bytes, event identity, schema version, retention class, admission time, expiry, and canonical deduplication key — and SHALL call the storage port's `put` exactly once. A `written` or `duplicate` result SHALL return `persisted`. A `failed` result SHALL reject with a storage diagnostic distinct for a backend failure and for a conflict; an `indeterminate` result, an exception thrown by the port, or a result outside the port's closed union SHALL reject with the indeterminate diagnostic and SHALL be treated as not persisted. Every storage rejection SHALL withdraw the identity's deduplication record. Storage diagnostics and counters SHALL carry no payload, credential, sender, or tenant material.

#### Scenario: Confirmed write is persisted
- **WHEN** the storage port reports `written` or `duplicate` for a first-seen submission
- **THEN** the ingress returns `persisted` with the event identity and sender identity

#### Scenario: Port that throws is indeterminate
- **WHEN** the storage port throws or returns a value outside its declared result union
- **THEN** the ingress rejects with the indeterminate storage diagnostic and issues no `persisted` acknowledgment

#### Scenario: Conflict is distinct from failure
- **WHEN** the storage port reports that the identity already holds different content
- **THEN** the ingress rejects with the storage conflict diagnostic, distinct from the write-failure diagnostic, and the stored record is unchanged

### Requirement: Storage is enabled only with every owner role named

Configuring storage SHALL require the data owner, the retention and deletion authority, and the key owner each to be named as a non-blank string of at most 128 characters. Construction of an ingress with storage configured SHALL fail with a storage configuration error when any role is missing, blank, non-string, or oversized. The collector SHALL NOT infer a role from the operator, record the names in any result, or treat a named role as having been appointed by anyone but the deployment's owner.

#### Scenario: Missing role fails construction
- **WHEN** an ingress is constructed with storage and any of the three owner roles is missing, blank, non-string, or longer than 128 characters
- **THEN** construction fails with a storage configuration error and no ingress exists

#### Scenario: Named roles enable storage
- **WHEN** all three roles are named
- **THEN** construction succeeds and the persist stage runs

### Requirement: Stored retention and scope derive from the record

A stored record's expiry SHALL be its admission time plus a fixed duration for its own `data.retention_class`: 30 days for `operational_short`, 365 days for `security_standard`, and 2555 days for `security_elevated`. These durations SHALL be package constants that no deployment can configure, SHALL be recorded as non-production candidate values rather than a legal retention policy, and SHALL change only through a governed change. A record whose retention class is `policy_governed` SHALL be declined with a distinct diagnostic before the port is reached.

A stored record's scope SHALL be its own `tenant.scope`, together with its `tenant.effective_tenant_id` when the scope is `tenant` or `cross_tenant`. A record whose scope is `tenant` or `cross_tenant` without an effective tenant identifier SHALL be declined with a distinct diagnostic before the port is reached.

#### Scenario: Two deployments derive the same expiry
- **WHEN** the same record is persisted by two collectors at the same admission time
- **THEN** both store the same expiry, derived from the record's retention class

#### Scenario: Policy-governed retention is declined
- **WHEN** a record's retention class is `policy_governed`
- **THEN** the ingress rejects it with the retention-declined diagnostic and nothing is written

#### Scenario: Unresolvable scope is declined
- **WHEN** a `tenant`-scoped record carries no effective tenant identifier
- **THEN** the ingress rejects it with the scope-unresolved diagnostic and the port is never called

### Requirement: SQLite through node:sqlite is the selected backend, confined to one module

The collector SHALL ship exactly one storage backend, `SqliteStorage`, over the Node runtime's built-in `node:sqlite`, and `node:sqlite` SHALL be importable only from `src/sqlite-storage.ts`; the scope gate and the dependency gate SHALL each reject it anywhere else and reject any other built-in there. The backend SHALL key records by scope kind, scope tenant, and event identity in a `WITHOUT ROWID` table with no secondary index; SHALL enable `secure_delete`, a rollback journal, and full synchronous commits; SHALL report a failure SQLite guarantees had no effect as `failed` and any other failure as `indeterminate`; SHALL return `unsupported_version` for a stored record whose schema version is outside its supported set; and SHALL accept, return, and log no key material. Encryption at rest SHALL be supplied by the volume holding the database file under the named key owner, and the collector SHALL state that it cannot verify it.

The selection SHALL record `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"` and SHALL NOT be cited as exact-commit owner authorization. It SHALL authorize no production deployment, real-user data, or retention policy for real evidence.

#### Scenario: The built-in is confined to the backend
- **WHEN** `node:sqlite` is imported from any source file other than `src/sqlite-storage.ts`, or that file imports any other built-in
- **THEN** the scope gate fails closed

#### Scenario: Deleted content does not survive in the file
- **WHEN** a record is deleted at expiry and the database file is closed
- **THEN** no byte sequence unique to that record remains readable in the file, while the same probe finds it in a file where the record is retained

#### Scenario: A locked database is a definite failure
- **WHEN** another connection holds an exclusive lock and a write is attempted
- **THEN** the backend reports `failed` rather than `indeterminate`, and the ingress issues no `persisted` acknowledgment

#### Scenario: Selection provenance is recorded
- **WHEN** this capability is read as authorization for a production deployment
- **THEN** it records a delegated decision and authorizes none
