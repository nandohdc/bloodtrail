## MODIFIED Requirements

### Requirement: Collector-local duplicate identity and retention are bounded

Without storage configured, after all required ingress validation has succeeded, the collector SHALL derive duplicate identity exclusively from the authenticated sender identity and the validated canonical `event.id`. The collector SHALL retain, in memory only, one canonical deduplication key for each such identity for 300 seconds from its first admission, up to 32 live identities. The canonical deduplication key SHALL be derived from the validated submission body by excluding the attempt-scoped `correlation.retry_attempt` field and exactly comparing every other field, so that only a genuine retry of the same occurrence — never a payload that differs in any other respect — can share a key. It SHALL purge expired records lazily before every duplicate decision and new-record decision. With storage configured, the collector SHALL NOT consult or populate this in-memory record: the storage port decides duplicate identity durably, and the record's 32-identity capacity SHALL NOT bound how many distinct occurrences can be persisted. The record is a synthetic, non-production idempotency control: it SHALL NOT be durable storage, a queue, a delivery record, a retention-policy decision, or an exactly-once guarantee.

#### Scenario: First valid identity is retained
- **WHEN** storage is not configured and an authenticated, size-bounded, schema-valid, supported-version submission presents an identity not retained by the collector
- **THEN** the collector retains that sender-and-event identity with its canonical deduplication key before admission and returns the ordinary admitted outcome

#### Scenario: Expired identity can be admitted again
- **WHEN** the 300-second retention window has elapsed for an identity before a later valid submission is decided
- **THEN** the collector removes the expired record and treats the later submission as first-seen

#### Scenario: Live capacity fails closed
- **WHEN** storage is not configured, 32 unexpired identities are retained, and a different valid identity is submitted
- **THEN** the collector rejects the new identity with a bounded capacity diagnostic, creates no record for it, and does not admit it

#### Scenario: Invalid input never creates a duplicate record
- **WHEN** a submission fails authentication, size, parsing, schema, or version validation
- **THEN** the collector creates no duplicate record and performs no duplicate decision for that submission

#### Scenario: An unconfirmed write withdraws the reservation
- **WHEN** storage is configured and the persist stage rejects a first-seen identity because the write was not confirmed
- **THEN** the collector retains no in-memory record for that identity, and a later identical submission reaches the storage port again rather than being returned as a duplicate

#### Scenario: Storage throughput is not bounded by the in-memory capacity
- **WHEN** storage is configured and more than 32 distinct valid identities are submitted within 300 seconds
- **THEN** every one of them reaches the storage port and none is rejected with the deduplication-capacity diagnostic

### Requirement: Duplicate and conflicting reuse have distinct deterministic outcomes

Without storage configured, for a live sender-and-event identity, a submission whose canonical deduplication key exactly matches the retained key SHALL return a distinct duplicate outcome without a second admission or capacity consumption — including a genuine retry that only advances the zero-based `correlation.retry_attempt` counter, since that field is excluded from the key by design. A submission whose canonical deduplication key differs from the retained key in any other field SHALL be rejected with a distinct bounded conflict diagnostic and SHALL NOT replace or extend the retained record. The collector SHALL reserve a first-seen identity before reporting admission, so synchronous re-entrant submissions with the same key cannot both be admitted. With storage configured, identity SHALL be the record's storage scope and `event.id`, whichever authenticated sender submits it: a storage-port `duplicate` SHALL return the distinct duplicate outcome acknowledged `persisted`, and a storage-port conflict SHALL be rejected with the distinct storage-conflict diagnostic without changing the stored record.

#### Scenario: Identical retry is deduplicated
- **WHEN** the same authenticated sender submits a valid body with the same `event.id` and an identical canonical deduplication key within 300 seconds
- **THEN** the first submission is admitted once and the later submission returns the duplicate outcome without reprocessing or consuming admission capacity

#### Scenario: A retry that only advances the attempt counter is deduplicated
- **WHEN** the same authenticated sender resubmits a valid body with the same `event.id` whose only difference from the retained submission is an advanced `correlation.retry_attempt`
- **THEN** the collector returns the duplicate outcome rather than the conflict diagnostic, and the original retained record is unchanged

#### Scenario: Conflicting reuse fails closed
- **WHEN** the same authenticated sender submits a valid body with the same `event.id` whose canonical deduplication key differs from the retained key in a field other than `correlation.retry_attempt`
- **THEN** the collector rejects the later submission with the conflict diagnostic, leaves the original retained record unchanged, and does not admit it

#### Scenario: Concurrently reachable duplicate is admitted once
- **WHEN** processing of a valid first-seen submission causes a synchronous re-entrant submission with the same sender, event ID, and canonical deduplication key
- **THEN** exactly one submission is admitted and the other returns the duplicate outcome

#### Scenario: Sender isolation is preserved
- **WHEN** storage is not configured and different authenticated sender identities submit valid bodies with the same `event.id`
- **THEN** the collector treats the identities independently and admits each first-seen sender-and-event pair

#### Scenario: Stored identity is the record's, not the sender's
- **WHEN** storage is configured and a second authenticated sender submits an occurrence already stored under the same scope and `event.id`
- **THEN** the same occurrence returns the duplicate outcome acknowledged `persisted`, and different content is rejected with the storage-conflict diagnostic

### Requirement: Ingress order is fixed and every stage fails closed

The collector ingress SHALL execute the stages in exactly this order: authenticate, size, parse, schema, version, deduplicate, persist, accept, where the persist stage SHALL run only when storage is configured and SHALL be absent otherwise, and where, with storage configured, the deduplicate decision SHALL be the storage port's identity decision made atomically with the write inside the persist stage rather than an in-memory ledger decision. Each stage SHALL fail closed: a rejection at any stage SHALL terminate processing before any later stage runs, before admission, and before any capacity is consumed. An unreadable, malformed, or unexpected input at any stage SHALL produce a rejection, never a pass. The deduplication stage SHALL receive only the authenticated sender identity, validated canonical event identity, and a canonical deduplication key derived from the size-bounded submission body; it SHALL NOT run for a submission rejected by any earlier stage. The persist stage SHALL receive only a submission that passed every earlier stage.

#### Scenario: Rejection at an early stage prevents later stages
- **WHEN** a submission is rejected by the authenticate, size, parse, schema, or version stage
- **THEN** no later stage, including deduplication and persistence, runs and the submission is not admitted

#### Scenario: Acceptance requires passing every stage
- **WHEN** a submission is admitted
- **THEN** it passed authenticate, size, parse, schema, version, and deduplicate in that order, and admission capacity is consumed only at accept

#### Scenario: Persistence runs last and only with storage
- **WHEN** storage is configured and a submission passes every earlier stage
- **THEN** the persist stage runs and makes the duplicate decision through the storage port, and without storage configured no persist stage runs at all

### Requirement: The persist stage acknowledges only a confirmed write

When storage is configured, the persist stage SHALL build a stored record from the validated submission — its exact received bytes, event identity, schema version, retention class, admission time, expiry, and canonical deduplication key — and SHALL call the storage port's `put` exactly once. A `written` result SHALL return `persisted`. A `duplicate` result SHALL return the distinct duplicate outcome acknowledged `persisted`, because the occurrence is already durably stored. A `failed` result SHALL reject with a storage diagnostic distinct for a backend failure and for a conflict; an `indeterminate` result, an exception thrown by the port, or a result outside the port's closed union SHALL reject with the indeterminate diagnostic and SHALL be treated as not persisted. No storage rejection SHALL leave an in-memory record that would answer a retry as a duplicate. Storage diagnostics and counters SHALL carry no payload, credential, sender, or tenant material.

#### Scenario: Confirmed write is persisted
- **WHEN** the storage port reports `written` for a first-seen submission
- **THEN** the ingress returns `persisted` with the event identity and sender identity

#### Scenario: Port that throws is indeterminate
- **WHEN** the storage port throws or returns a value outside its declared result union
- **THEN** the ingress rejects with the indeterminate storage diagnostic and issues no `persisted` acknowledgment

#### Scenario: Conflict is distinct from failure
- **WHEN** the storage port reports that the identity already holds different content
- **THEN** the ingress rejects with the storage conflict diagnostic, distinct from the write-failure diagnostic, and the stored record is unchanged

#### Scenario: A stored occurrence is a persisted duplicate
- **WHEN** the storage port reports `duplicate` for a submission
- **THEN** the ingress returns the duplicate outcome with the `persisted` acknowledgment
