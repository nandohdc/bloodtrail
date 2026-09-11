# security-audit-collector Specification

## Purpose

Bounded, non-production collector ingress semantics for the collector boundary of the Bloodtrail delivery chain: authentication-first ordering, contract-derived size bounds, generated-validator structural validation, explicit supported-version enforcement, bounded secret-free diagnostics and metrics, admission-only acceptance, and the non-production scope boundary.

## Requirements

### Requirement: Authentication precedes every other ingress stage

The collector ingress SHALL authenticate every submission before reading, sizing, parsing, or validating any part of its body. A submission with missing, malformed, or invalid authentication SHALL be rejected before any body byte is parsed, and the rejection SHALL be provable by instrumentation of the parse stage, not by code inspection. Authentication SHALL identify a sender and SHALL NOT establish evidence truth, trust, or integrity: an authenticated sender is identified, never believed.

#### Scenario: Missing authentication is rejected before parse
- **WHEN** a submission with a schema-valid body carries no authentication
- **THEN** the ingress rejects it with an authentication diagnostic and the parse stage is never invoked

#### Scenario: Malformed authentication is rejected before parse
- **WHEN** a submission carries authentication material that is not well formed
- **THEN** the ingress rejects it with an authentication diagnostic and the parse stage is never invoked

#### Scenario: Invalid authentication is rejected before parse
- **WHEN** a submission carries well-formed authentication that the configured authenticator does not accept
- **THEN** the ingress rejects it with an authentication diagnostic and the parse stage is never invoked

#### Scenario: Authentication never promotes trust
- **WHEN** a submission passes authentication
- **THEN** the ingress records only the sender identity claimed at the authentication boundary and derives no trust, authority, or truth claim from it

### Requirement: Size limits are derived from the frozen contract bounds

The collector ingress SHALL enforce the frozen contract bounds by derivation, not configuration: `event_max_bytes` 65536, `object_max_depth` 8, `default_string_max` 256, `display_string_max` 128, `message_string_max` 512, `array_max_items` 32, `extension_max_namespaces` 4, `retry_attempt_max` 1000. A submission exceeding any derived bound SHALL be rejected with a bounded size diagnostic before structural validation runs. The ingress SHALL NOT accept a submission the producer could not have emitted, and SHALL NOT reject a valid one through a looser or stricter self-configured limit.

#### Scenario: Oversized body is rejected before schema validation
- **WHEN** an authenticated submission exceeds the derived `event_max_bytes` limit
- **THEN** the ingress rejects it with a size diagnostic and the schema stage is never invoked

#### Scenario: Bounds come from the contract
- **WHEN** the ingress enforces a size, depth, string, array, namespace, or retry bound
- **THEN** the enforced value equals the corresponding frozen contract bound and no independently configured limit is consulted

### Requirement: Structural validation runs the generated validator artifact

The collector ingress SHALL validate structurally with the exact standalone generated validator produced from the frozen contract (`schema-validator.generated.cjs`), carried as a byte-identical vendored copy inside the collector package. A drift gate SHALL recompute byte identity against the canonical artifact so producer and collector cannot disagree about what is valid. The ingress SHALL NOT reimplement structural validation or validate against a different schema source. A schema-invalid submission SHALL be rejected with the generated validator's bounded diagnostic, before admission, terminally and non-retryably.

#### Scenario: Schema-invalid body is rejected with the generated diagnostic
- **WHEN** an authenticated, size-bounded submission fails the generated validator
- **THEN** the ingress rejects it before admission with a bounded machine-readable validation code derived from the validator's diagnostic, and no admission capacity is consumed

#### Scenario: Vendor copy stays byte-identical
- **WHEN** the collector drift gate compares the vendored validator against the canonical generated artifact
- **THEN** the comparison succeeds only when both are byte-identical, and any divergence fails the gate

### Requirement: The version stage enforces an explicitly enumerated finite supported set

The collector ingress SHALL enforce the ratified asymmetric version policy: a supported set that is an explicitly enumerated finite set of canonical contract versions, read from the submission's declared contract version (`schema.version`), separate from and never broadening producer `EXACT_ONE` binding. A submission declaring a version outside the supported set SHALL be rejected with a distinct version diagnostic that is distinguishable from a schema rejection. The supported set for this package SHALL be the single canonical version `1.0.0` until the policy's recorded revisit conditions authorize another member.

#### Scenario: Unsupported version is rejected distinctly
- **WHEN** an authenticated, size-bounded, schema-valid submission declares a contract version outside the enumerated supported set
- **THEN** the ingress rejects it with the version diagnostic, and the rejection is distinguishable from a schema rejection of the same body

#### Scenario: Supported version proceeds
- **WHEN** a submission declares a version inside the enumerated supported set
- **THEN** the version stage passes and does not alter, downgrade, coerce, or reinterpret the declared version

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

### Requirement: Rejection diagnostics and metrics are bounded and disclose nothing

Every rejection diagnostic SHALL be a bounded stable triple of code, category, and path, carrying no caller data, payload bytes, secrets, or unbounded strings. Duplicate conflicts and deduplication-capacity rejection SHALL each use a distinct bounded diagnostic; an identical duplicate SHALL use its distinct non-rejection result rather than a fabricated acceptance. Operational counters SHALL be bounded counts keyed by stable, non-secret labels, including duplicate, conflict, and capacity outcomes; no metric SHALL carry tenant identifiers, payload content, credentials, or any material that would leak submission content. No rejection SHALL emit an audit event, and no failure SHALL create a recursive audit-event loop.

#### Scenario: Diagnostics carry no payload
- **WHEN** a rejection diagnostic is inspected
- **THEN** it contains only code, category, and a bounded path, and no submission payload or secret material

#### Scenario: Metrics stay non-secret
- **WHEN** operational counters are inspected after any mix of admitted, duplicate, and rejected submissions
- **THEN** every counter is keyed by stable non-secret labels and no label or value carries payload or credential content

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

### Requirement: Only non-production authentication is shipped

The collector package SHALL ship exactly one authenticator implementation, explicitly named and documented as non-production, verifying mock or synthetic credentials against test fixtures only. The package SHALL define an authentication interface but SHALL NOT select, implement, or configure any production credential system, secret management, infrastructure, or network service. The package SHALL NOT authorize production collection, deployment, publication, or real-user data processing.

#### Scenario: Shipped authenticator is non-production by declaration
- **WHEN** the collector package surface is inspected
- **THEN** the single shipped authenticator is documented as non-production with synthetic fixtures, and no production credential or infrastructure mechanism exists

### Requirement: The collector is a declared, zero-runtime-dependency package

The collector implementation SHALL live in the dedicated package `packages/security-audit-collector`, private and UNLICENSED, declared in the repository's package-discovery completeness list, wired into the repository CI the same way as the other packages, and with zero third-party runtime dependencies. The canonical generated validator SHALL be the package's only non-authored runtime artifact, vendored byte-identically with its drift gate. The package SHALL NOT modify `packages/security-audit-sdk-core`, the frozen contract, or any generated SDK artifact.

#### Scenario: Package discovery is complete
- **WHEN** the repository's package-discovery completeness check runs
- **THEN** `packages/security-audit-collector` is among the declared packages and the check passes

#### Scenario: No producer or contract surface is touched
- **WHEN** the change range is inspected
- **THEN** no file under `packages/security-audit-sdk-core`, `contracts/security-audit`, or `research/` is modified

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
