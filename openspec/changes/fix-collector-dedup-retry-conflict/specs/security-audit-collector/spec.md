## MODIFIED Requirements

### Requirement: Ingress order is fixed and every stage fails closed

The collector ingress SHALL execute the stages in exactly this order: authenticate, size, parse, schema, version, deduplicate, accept. Each stage SHALL fail closed: a rejection at any stage SHALL terminate processing before any later stage runs, before admission, and before any capacity is consumed. An unreadable, malformed, or unexpected input at any stage SHALL produce a rejection, never a pass. The deduplication stage SHALL receive only the authenticated sender identity, validated canonical event identity, and a canonical deduplication key derived from the size-bounded submission body; it SHALL NOT run for a submission rejected by any earlier stage.

#### Scenario: Rejection at an early stage prevents later stages
- **WHEN** a submission is rejected by the authenticate, size, parse, schema, or version stage
- **THEN** no later stage, including deduplication, runs and the submission is not admitted

#### Scenario: Acceptance requires passing every stage
- **WHEN** a submission is admitted
- **THEN** it passed authenticate, size, parse, schema, version, and deduplicate in that order, and admission capacity is consumed only at accept

### Requirement: Collector-local duplicate identity and retention are bounded

After all required ingress validation has succeeded, the collector SHALL derive duplicate identity exclusively from the authenticated sender identity and the validated canonical `event.id`. The collector SHALL retain, in memory only, one canonical deduplication key for each such identity for 300 seconds from its first admission, up to 32 live identities. The canonical deduplication key SHALL be derived from the validated submission body by excluding the attempt-scoped `correlation.retry_attempt` field and exactly comparing every other field, so that only a genuine retry of the same occurrence — never a payload that differs in any other respect — can share a key. It SHALL purge expired records lazily before every duplicate decision and new-record decision. The record is a synthetic, non-production idempotency control: it SHALL NOT be durable storage, a queue, a delivery record, a retention-policy decision, or an exactly-once guarantee.

#### Scenario: First valid identity is retained
- **WHEN** an authenticated, size-bounded, schema-valid, supported-version submission presents an identity not retained by the collector
- **THEN** the collector retains that sender-and-event identity with its canonical deduplication key before admission and returns the ordinary admitted outcome

#### Scenario: Expired identity can be admitted again
- **WHEN** the 300-second retention window has elapsed for an identity before a later valid submission is decided
- **THEN** the collector removes the expired record and treats the later submission as first-seen

#### Scenario: Live capacity fails closed
- **WHEN** 32 unexpired identities are retained and a different valid identity is submitted
- **THEN** the collector rejects the new identity with a bounded capacity diagnostic, creates no record for it, and does not admit it

#### Scenario: Invalid input never creates a duplicate record
- **WHEN** a submission fails authentication, size, parsing, schema, or version validation
- **THEN** the collector creates no duplicate record and performs no duplicate decision for that submission

### Requirement: Duplicate and conflicting reuse have distinct deterministic outcomes

For a live sender-and-event identity, a submission whose canonical deduplication key exactly matches the retained key SHALL return a distinct duplicate outcome without a second admission or capacity consumption — including a genuine retry that only advances the zero-based `correlation.retry_attempt` counter, since that field is excluded from the key by design. A submission whose canonical deduplication key differs from the retained key in any other field SHALL be rejected with a distinct bounded conflict diagnostic and SHALL NOT replace or extend the retained record. The collector SHALL reserve a first-seen identity before reporting admission, so synchronous re-entrant submissions with the same key cannot both be admitted.

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
- **WHEN** different authenticated sender identities submit valid bodies with the same `event.id`
- **THEN** the collector treats the identities independently and admits each first-seen sender-and-event pair
