## MODIFIED Requirements

### Requirement: Collector-local duplicate identity and retention are bounded

Without storage configured, after all required ingress validation has succeeded, the collector SHALL derive duplicate identity exclusively from the authenticated sender identity and the validated canonical `event.id`. The collector SHALL retain, in memory only, one canonical deduplication key for each such identity for 300 seconds from its first admission, up to 32 live identities. The canonical deduplication key SHALL be derived from the whole validated submission body, comparing every field exactly under a key-order-independent canonical serialization, so that only a canonically identical copy of the same occurrence — never a payload that differs in any field, including `correlation.retry_attempt` — can share a key. It SHALL purge expired records lazily before every duplicate decision and new-record decision. With storage configured, the collector SHALL NOT consult or populate this in-memory record: the storage port decides duplicate identity durably, and the record's 32-identity capacity SHALL NOT bound how many distinct occurrences can be persisted. The record is a synthetic, non-production idempotency control: it SHALL NOT be durable storage, a queue, a delivery record, a retention-policy decision, or an exactly-once guarantee.

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

## ADDED Requirements

### Requirement: Duplicate and conflicting reuse are decided over the whole submission

Without storage configured, for a live sender-and-event identity, a submission whose canonical deduplication key exactly matches the retained key SHALL return a distinct duplicate outcome without a second admission or capacity consumption. A submission whose canonical deduplication key differs from the retained key in any field, including `correlation.retry_attempt`, SHALL be rejected with a distinct bounded conflict diagnostic and SHALL NOT replace or extend the retained record, because every delivery attempt of one occurrence carries identical bytes and a body that differs under a live identity is never a redelivered copy of it. The collector SHALL reserve a first-seen identity before reporting admission, so synchronous re-entrant submissions with the same key cannot both be admitted. With storage configured, identity SHALL be the record's storage scope and `event.id`, whichever authenticated sender submits it, and the stored record's canonical deduplication key SHALL cover the whole submission in the same way: a storage-port `duplicate` SHALL return the distinct duplicate outcome acknowledged `persisted`, and a storage-port conflict SHALL be rejected with the distinct storage-conflict diagnostic without changing the stored record.

#### Scenario: Identical redelivery is deduplicated
- **WHEN** the same authenticated sender submits a valid body with the same `event.id` and an identical canonical deduplication key within 300 seconds
- **THEN** the first submission is admitted once and the later submission returns the duplicate outcome without reprocessing or consuming admission capacity

#### Scenario: A body that differs only in its retry attempt is a conflict
- **WHEN** the same authenticated sender resubmits a valid body with the same `event.id` whose only difference from the retained submission is its `correlation.retry_attempt`
- **THEN** the collector rejects the later submission with the conflict diagnostic, leaves the original retained record unchanged, and does not admit it

#### Scenario: Conflicting reuse fails closed
- **WHEN** the same authenticated sender submits a valid body with the same `event.id` whose canonical deduplication key differs from the retained key in any field
- **THEN** the collector rejects the later submission with the conflict diagnostic, leaves the original retained record unchanged, and does not admit it

#### Scenario: A re-execution is its own occurrence
- **WHEN** a valid body for a re-execution of an admitted occurrence is submitted, carrying its own new `event.id`, a `correlation.retry_attempt` above zero, and an `original_event_id` naming the admitted occurrence
- **THEN** the collector decides it as a first-seen identity and admits it independently of the original, whose retained record is unchanged

#### Scenario: Concurrently reachable duplicate is admitted once
- **WHEN** processing of a valid first-seen submission causes a synchronous re-entrant submission with the same sender, event ID, and canonical deduplication key
- **THEN** exactly one submission is admitted and the other returns the duplicate outcome

#### Scenario: Sender isolation is preserved
- **WHEN** storage is not configured and different authenticated sender identities submit valid bodies with the same `event.id`
- **THEN** the collector treats the identities independently and admits each first-seen sender-and-event pair

#### Scenario: Stored identity is the record's, not the sender's
- **WHEN** storage is configured and a second authenticated sender submits an occurrence already stored under the same scope and `event.id`
- **THEN** the same occurrence returns the duplicate outcome acknowledged `persisted`, and different content, including a different `correlation.retry_attempt`, is rejected with the storage-conflict diagnostic

## REMOVED Requirements

### Requirement: Duplicate and conflicting reuse have distinct deterministic outcomes

**Reason**: Its scenario "A retry that only advances the attempt counter is deduplicated" treated a same-identity body with a different `correlation.retry_attempt` as a duplicate, to tolerate the delivery handoff's rewrite of the re-execution counter (#391). This change removes that rewrite (#577). Under the old rule, a submission that conflicts only in that field is silently acknowledged instead of rejected.
**Migration**: Replaced by "Duplicate and conflicting reuse are decided over the whole submission". Deliver every attempt of one occurrence byte-identically. A copy that differs only in `correlation.retry_attempt` is now a conflict.
