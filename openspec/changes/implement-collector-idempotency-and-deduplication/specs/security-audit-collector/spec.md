## ADDED Requirements

### Requirement: Collector-local duplicate identity and retention are bounded

After all required ingress validation has succeeded, the collector SHALL derive duplicate identity exclusively from the authenticated sender identity and the validated canonical `event.id`. The collector SHALL retain, in memory only, one byte-exact submission body for each such identity for 300 seconds from its first admission, up to 32 live identities. It SHALL purge expired records lazily before every duplicate decision and new-record decision. The record is a synthetic, non-production idempotency control: it SHALL NOT be durable storage, a queue, a delivery record, a retention-policy decision, or an exactly-once guarantee.

#### Scenario: First valid identity is retained
- **WHEN** an authenticated, size-bounded, schema-valid, supported-version submission presents an identity not retained by the collector
- **THEN** the collector retains that sender-and-event identity with its exact submission body before admission and returns the ordinary admitted outcome

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

For a live sender-and-event identity, a byte-identical submission body SHALL return a distinct duplicate outcome without a second admission or capacity consumption. A body that differs by any byte under the same live identity SHALL be rejected with a distinct bounded conflict diagnostic and SHALL NOT replace or extend the retained record. The collector SHALL reserve a first-seen identity before reporting admission, so synchronous re-entrant submissions with the same body cannot both be admitted.

#### Scenario: Identical retry is deduplicated
- **WHEN** the same authenticated sender submits a byte-identical valid body with the same `event.id` within 300 seconds
- **THEN** the first submission is admitted once and the later submission returns the duplicate outcome without reprocessing or consuming admission capacity

#### Scenario: Conflicting reuse fails closed
- **WHEN** the same authenticated sender submits a different valid body with the same `event.id` within 300 seconds
- **THEN** the collector rejects the later submission with the conflict diagnostic, leaves the original retained record unchanged, and does not admit it

#### Scenario: Concurrently reachable duplicate is admitted once
- **WHEN** processing of a valid first-seen submission causes a synchronous re-entrant submission with the same sender, event ID, and body
- **THEN** exactly one submission is admitted and the other returns the duplicate outcome

#### Scenario: Sender isolation is preserved
- **WHEN** different authenticated sender identities submit valid bodies with the same `event.id`
- **THEN** the collector treats the identities independently and admits each first-seen sender-and-event pair

## MODIFIED Requirements

### Requirement: Ingress order is fixed and every stage fails closed

The collector ingress SHALL execute the stages in exactly this order: authenticate, size, parse, schema, version, deduplicate, accept. Each stage SHALL fail closed: a rejection at any stage SHALL terminate processing before any later stage runs, before admission, and before any capacity is consumed. An unreadable, malformed, or unexpected input at any stage SHALL produce a rejection, never a pass. The deduplication stage SHALL receive only the authenticated sender identity, validated canonical event identity, and size-bounded submission body; it SHALL NOT run for a submission rejected by any earlier stage.

#### Scenario: Rejection at an early stage prevents later stages
- **WHEN** a submission is rejected by the authenticate, size, parse, schema, or version stage
- **THEN** no later stage, including deduplication, runs and the submission is not admitted

#### Scenario: Acceptance requires passing every stage
- **WHEN** a submission is admitted
- **THEN** it passed authenticate, size, parse, schema, version, and deduplicate in that order, and admission capacity is consumed only at accept

### Requirement: Rejection diagnostics and metrics are bounded and disclose nothing

Every rejection diagnostic SHALL be a bounded stable triple of code, category, and path, carrying no caller data, payload bytes, secrets, or unbounded strings. Duplicate conflicts and deduplication-capacity rejection SHALL each use a distinct bounded diagnostic; an identical duplicate SHALL use its distinct non-rejection result rather than a fabricated acceptance. Operational counters SHALL be bounded counts keyed by stable, non-secret labels, including duplicate, conflict, and capacity outcomes; no metric SHALL carry tenant identifiers, payload content, credentials, or any material that would leak submission content. No rejection SHALL emit an audit event, and no failure SHALL create a recursive audit-event loop.

#### Scenario: Diagnostics carry no payload
- **WHEN** a rejection diagnostic is inspected
- **THEN** it contains only code, category, and a bounded path, and no submission payload or secret material

#### Scenario: Metrics stay non-secret
- **WHEN** operational counters are inspected after any mix of admitted, duplicate, and rejected submissions
- **THEN** every counter is keyed by stable non-secret labels and no label or value carries payload or credential content

### Requirement: Acceptance is admission only

Acceptance at the ingress SHALL mean admission of a first-seen identity: the occurrence enters the delivery model's `admitted` state with its event identity and attempt identity assigned, and nothing more. An identical live duplicate SHALL return the distinct duplicate outcome without entering `admitted` again. The ingress SHALL NOT claim durability, delivery, retry, storage, at-least-once delivery, exactly-once delivery, or downstream acceptance. A validation-failed occurrence, conflicting reuse, or deduplication-capacity rejection SHALL never become `admitted`.

#### Scenario: Admitted occurrence carries identity only
- **WHEN** a first-seen submission is accepted
- **THEN** the ingress records its admission with the occurrence's event identity, consumes admission capacity, and makes no delivery, durability, or downstream claim

#### Scenario: Rejected occurrence is never admitted
- **WHEN** a submission fails validation, conflicts with a retained identity, or cannot reserve bounded duplicate capacity
- **THEN** the occurrence never enters the `admitted` state and no admission capacity is consumed
