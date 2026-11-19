# Spec Delta

## ADDED Requirements

### Requirement: Every submission resolves asynchronously

The ingress SHALL return every submission's outcome as a promise, with or without storage configured, and the outcome union SHALL be unchanged. A submission's body SHALL be either a complete string or a byte stream, and both forms SHALL produce the same outcome for the same bytes.

#### Scenario: Submission without storage is asynchronous
- **WHEN** a valid submission is made to an ingress without storage
- **THEN** the call returns a promise that resolves to the `admitted` outcome

#### Scenario: String and stream bodies agree
- **WHEN** the same bytes are submitted once as a string and once as a byte stream to two fresh ingresses
- **THEN** both resolve to the same outcome with the same event identity

## MODIFIED Requirements

### Requirement: Authentication precedes every other ingress stage

The collector ingress SHALL authenticate every submission before reading, sizing, parsing, or validating any part of its body. A submission with missing, malformed, or invalid authentication SHALL be rejected before any body byte is parsed, and, when its body is a byte stream, before any byte of that stream is read. The rejection SHALL be provable by instrumentation of the parse stage and of the stream, not by code inspection. Authentication SHALL identify a sender and SHALL NOT establish evidence truth, trust, or integrity: an authenticated sender is identified, never believed.

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

#### Scenario: A rejected stream is never read
- **WHEN** a submission whose body is a byte stream fails authentication
- **THEN** the ingress rejects it with an authentication diagnostic and reads no byte from the stream

### Requirement: Size limits are derived from the frozen contract bounds

The collector ingress SHALL enforce the frozen contract bounds by derivation, not configuration: `event_max_bytes` 65536, `object_max_depth` 8, `default_string_max` 256, `display_string_max` 128, `message_string_max` 512, `array_max_items` 32, `extension_max_namespaces` 4, `retry_attempt_max` 1000. A submission exceeding any derived bound SHALL be rejected with a bounded size diagnostic before structural validation runs. A byte-stream body SHALL be read only until it exceeds `event_max_bytes`, and the ingress SHALL hold no more than `event_max_bytes` plus one chunk of it. The ingress SHALL NOT accept a submission the producer could not have emitted, and SHALL NOT reject a valid one through a looser or stricter self-configured limit.

#### Scenario: Oversized body is rejected before schema validation
- **WHEN** an authenticated submission exceeds the derived `event_max_bytes` limit
- **THEN** the ingress rejects it with a size diagnostic and the schema stage is never invoked

#### Scenario: Bounds come from the contract
- **WHEN** the ingress enforces a size, depth, string, array, namespace, or retry bound
- **THEN** the enforced value equals the corresponding frozen contract bound and no independently configured limit is consulted

#### Scenario: An oversized stream is not drained
- **WHEN** an authenticated submission's byte stream is longer than `event_max_bytes`
- **THEN** the ingress stops reading once the limit is exceeded, rejects it with the size diagnostic, and never buffers the rest of the stream

### Requirement: The persist stage acknowledges only a confirmed write

When storage is configured, the persist stage SHALL build a stored record from the validated submission — its exact received bytes, event identity, schema version, retention class, admission time, expiry, and canonical deduplication key — and SHALL call the storage port's `put` exactly once and await its result before returning any outcome. A `written` result SHALL return `persisted`. A `duplicate` result SHALL return the distinct duplicate outcome acknowledged `persisted`, because the occurrence is already durably stored. A `failed` result SHALL reject with a storage diagnostic distinct for a backend failure and for a conflict; an `indeterminate` result, a rejected or thrown port call, or a result outside the port's closed union SHALL reject with the indeterminate diagnostic and SHALL be treated as not persisted. No storage rejection SHALL leave an in-memory record that would answer a retry as a duplicate. Storage diagnostics and counters SHALL carry no payload, credential, sender, or tenant material.

#### Scenario: Confirmed write is persisted
- **WHEN** the storage port reports `written` for a first-seen submission
- **THEN** the ingress returns `persisted` with the event identity and sender identity

#### Scenario: Port that throws is indeterminate
- **WHEN** the storage port throws, rejects its result, or resolves to a value outside its declared result union
- **THEN** the ingress rejects with the indeterminate storage diagnostic and issues no `persisted` acknowledgment

#### Scenario: Conflict is distinct from failure
- **WHEN** the storage port reports that the identity already holds different content
- **THEN** the ingress rejects with the storage conflict diagnostic, distinct from the write-failure diagnostic, and the stored record is unchanged

#### Scenario: A stored occurrence is a persisted duplicate
- **WHEN** the storage port reports `duplicate` for a submission
- **THEN** the ingress returns the duplicate outcome with the `persisted` acknowledgment

#### Scenario: No outcome precedes the port's result
- **WHEN** a submission's `put` has been issued and has not yet resolved
- **THEN** the submission has returned no outcome, and two concurrent submissions of one identity end with one `persisted` and one duplicate outcome acknowledged `persisted`

### Requirement: Stored retention and scope derive from the record

A stored record's expiry SHALL be its admission time plus a fixed duration for its own `data.retention_class`: 30 days for `operational_short`, 365 days for `security_standard`, and 2555 days for `security_elevated`. These durations SHALL be package constants that no deployment can configure, SHALL be recorded as non-production candidate values rather than a legal retention policy, and SHALL change only through a governed change. A record whose retention class is `policy_governed` SHALL be declined with a distinct diagnostic before the port is reached.

A deployment MAY declare a non-empty subset of the three storable retention classes as the classes it stores; when it does, a record of any other class SHALL be declined with the same retention-declined diagnostic before the port is reached, and SHALL NOT be stored with a shorter retention. A deployment that declares no subset SHALL store all three. An empty or unknown declared class SHALL fail construction with a storage configuration error.

A stored record's scope SHALL be its own `tenant.scope`, together with its `tenant.effective_tenant_id` when the scope is `tenant` or `cross_tenant`. A record whose scope is `tenant` or `cross_tenant` without an effective tenant identifier SHALL be declined with a distinct diagnostic before the port is reached.

#### Scenario: Two deployments derive the same expiry
- **WHEN** the same record is persisted by two collectors at the same admission time
- **THEN** both store the same expiry, derived from the record's retention class

#### Scenario: Policy-governed retention is declined
- **WHEN** a record's retention class is `policy_governed`
- **THEN** the ingress rejects it with the retention-declined diagnostic and nothing is written

#### Scenario: An undeclared class is declined, never shortened
- **WHEN** a deployment stores only `operational_short` and a `security_standard` record arrives
- **THEN** the ingress rejects it with the retention-declined diagnostic, the port is never called, and no record is stored with any retention

#### Scenario: Invalid declared classes fail construction
- **WHEN** an ingress is constructed with an empty declared class set or a class outside `operational_short`, `security_standard`, and `security_elevated`
- **THEN** construction fails with a storage configuration error

#### Scenario: Unresolvable scope is declined
- **WHEN** a `tenant`-scoped record carries no effective tenant identifier
- **THEN** the ingress rejects it with the scope-unresolved diagnostic and the port is never called
