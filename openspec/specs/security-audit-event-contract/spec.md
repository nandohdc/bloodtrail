# security-audit-event-contract Specification

## Purpose
Defines the authoritative, server-generated Bloodtrail security audit event contract that future producers and consumers can validate consistently without depending on a particular SDK, transport, collector, storage system, SIEM, or vendor schema.
## Requirements
### Requirement: Security audit events have an authoritative boundary
A conforming Bloodtrail producer SHALL emit a security audit event only for a cataloged security- or business-relevant occurrence. The contract SHALL distinguish security audit events from diagnostic logs, general observability telemetry, frontend analytics, browser telemetry, metrics, traces, threat-detection rules, and SIEM records. The producer that owns or authoritatively observes the occurrence SHALL construct the canonical event on the server side.

Client- or browser-generated information SHALL NOT be treated as authoritative identity, device identity, authentication evidence, authorization evidence, committed business state, or proof of human activity. Transport protection, a client signature, or a server signature added after receipt SHALL NOT upgrade an untrusted client claim into an authoritative fact.

#### Scenario: Server records an authoritative occurrence
- **WHEN** a server component that owns an authentication transaction records its completed result
- **THEN** the event identifies that server component as the authoritative producer and labels server-derived authentication facts with their defined trust level

#### Scenario: Browser claim is included as context
- **WHEN** an allowed browser-reported value is included in an audit event
- **THEN** the event labels the value as client-reported and untrusted and downstream consumers cannot interpret it as authoritative identity, authentication evidence, device identity, or proof of human activity

#### Scenario: Diagnostic message is not promoted to an audit event
- **WHEN** an application emits a free-form diagnostic message that has no cataloged security audit event name
- **THEN** the message is not accepted as a conforming security audit event merely because it can be transported through the same logging system

### Requirement: Every field category declares authority and trust
The contract SHALL provide a field-authority registry covering every canonical field category. Each registry entry SHALL state the authoritative producer, allowed source, trust level, validation requirement, permitted enrichment location, whether user-controlled input may contribute to the value, and whether a downstream consumer may use the value for enforcement.

The registry SHALL distinguish at least claimed identity, authenticated identity, delegated principal, impersonating principal, service identity, workload identity, credential reference, server-observed network information, client-reported information, server-derived information, and downstream enrichment. A mapper or enrichment stage SHALL preserve the original value and provenance and SHALL NOT overwrite it with a value having a higher trust label.

#### Scenario: User-controlled value claims server authority
- **WHEN** a producer supplies a client-controlled tenant, actor, outcome, authorization decision, or resource-owner value as authoritative
- **THEN** validation rejects the event rather than relabeling the value as trusted

#### Scenario: Downstream enrichment adds investigation context
- **WHEN** an ingestion or analysis stage adds geolocation, threat intelligence, or risk classification
- **THEN** the enrichment is namespaced, identifies its source and version, retains a downstream-enrichment trust label, and does not replace the producer's original observation

#### Scenario: Enforcement consumer evaluates trust
- **WHEN** a downstream policy attempts to use a field for enforcement
- **THEN** it can determine from the contract whether that field is eligible, corroborating-only, or prohibited for enforcement use

### Requirement: Canonical event envelope is complete and typed
The canonical contract SHALL define typed fields for:

- event ID, event name, event category, event action, event outcome, outcome reason, lifecycle phase, and commit state;
- event timestamp and observation timestamp;
- schema name and schema version;
- producer name and version;
- environment, service, and deployment context;
- tenant context;
- actor, subject, authenticated principal, delegated or impersonated actor, credential, and initiating application or service;
- session and authentication context;
- authorization context;
- source and destination;
- protected resource and parent resource;
- request context;
- W3C trace ID, span ID, correlation ID, causation ID, operation ID, transaction ID, request ID, message ID, retry attempt, and original event ID;
- risk context, data classification, retention class, delivery class, integrity metadata, and extension fields.

For every field, the contract SHALL define its JSON type and format, cardinality, required or conditional status, authority, allowed values or vocabulary, privacy classification, maximum size, validation and rejection behavior, redaction or transformation rule, and compatibility considerations. Conditional requirements SHALL be expressed in the machine-readable contract where the selected schema technology can enforce them and in normative documentation otherwise.

#### Scenario: Required envelope field is absent
- **WHEN** a producer omits a field that is required for the selected event catalog entry or its context
- **THEN** runtime validation rejects the event with a machine-readable validation error identifying the missing field

#### Scenario: Optional context is unavailable
- **WHEN** an optional context value is unavailable and the catalog does not make it conditionally required
- **THEN** the producer omits the field rather than fabricating a placeholder value

#### Scenario: Field exceeds its contract limit
- **WHEN** any field exceeds its declared byte, character, item-count, or nesting limit
- **THEN** validation rejects or applies the field's explicitly documented bounded transformation and never silently truncates an identifier or security decision

### Requirement: Event identity and vocabulary are controlled
Each event SHALL have an immutable, globally collision-resistant event ID generated by a trusted producer or trusted canonicalization boundary. Event names SHALL be low-cardinality, fully qualified, version-governed constants from the event catalog and SHALL NOT contain tenant IDs, actor IDs, resource IDs, timestamps, or other dynamic values.

Event categories, actions, lifecycle phases, outcomes, commit states, delivery classes, trust levels, actor types, resource types, and other controlled values SHALL come from governed registries. Free-form extension values SHALL NOT be used to bypass a controlled vocabulary.

#### Scenario: Unknown event name is emitted
- **WHEN** a producer emits an event name that is not registered for the declared schema version
- **THEN** producer validation rejects the event and reports the unsupported name

#### Scenario: Dynamic value appears in an event name
- **WHEN** an event name embeds a tenant, user, resource, request, or other per-occurrence value
- **THEN** validation rejects the name and requires the dynamic value to be represented in its typed field

#### Scenario: Duplicate event is retried
- **WHEN** the same immutable event is retried after an ambiguous delivery result
- **THEN** the retry retains the original event ID and duplicate consumers can identify it as the same event rather than a new occurrence

### Requirement: Actor and subject semantics are explicit
The actor model SHALL support authenticated human user, anonymous user, service account, workload identity, API credential, administrator, delegated actor, impersonating actor, background job, scheduled process, and external integration. The model SHALL distinguish the actor performing the action, the subject affected by the action, the authenticated principal, any delegated principal, any impersonating principal, the credential reference used, and the application, workload, service, job, or integration initiating the operation.

Actor and principal identifiers SHALL be stable server-resolved identifiers where available. Display names, usernames, email addresses, or client claims SHALL NOT substitute for authoritative identifiers. Credentials SHALL be represented only by non-secret type and server-side reference or fingerprint metadata permitted by policy.

#### Scenario: Authenticated human changes another account
- **WHEN** an authenticated administrator changes another user's role
- **THEN** the event identifies the administrator as actor, the affected user as subject, the authenticated principal and credential reference separately, and the role assignment as the protected resource or change

#### Scenario: Delegated operation occurs
- **WHEN** a service acts using authority delegated by a human principal
- **THEN** the event preserves both the performing service actor and the delegated principal and records the validated delegation context

#### Scenario: Anonymous action occurs
- **WHEN** an unauthenticated registration or password-reset request is attempted
- **THEN** the event uses the explicit anonymous actor type and does not invent an authenticated principal

#### Scenario: Required actor is missing
- **WHEN** a catalog entry requires an actor and the producer provides neither a valid actor nor an explicitly permitted anonymous actor
- **THEN** validation rejects the event

### Requirement: Tenant attribution is server-authoritative
Tenant identifiers and hierarchy SHALL come from server-side routing, authenticated principal scope, authoritative resource ownership, or another explicitly trusted tenancy authority. Client-supplied tenant identifiers MAY be retained as claimed context but SHALL NOT determine authoritative tenant attribution.

The contract SHALL represent tenant hierarchy, parent and child organizations, cross-tenant administration, platform administration, and tenantless platform events. It SHALL identify the actor tenant, effective tenant, resource-owning tenant, and platform scope where they differ. Cross-tenant actions and attempts SHALL include the validated authorization context and SHALL record denials and tenant-context violations without falsely attributing the target tenant as the actor's tenant.

#### Scenario: Client claims a different tenant
- **WHEN** request input contains a tenant ID that conflicts with authenticated scope or authoritative resource ownership
- **THEN** the producer records the value only as an untrusted claim if policy permits, records the authoritative tenant contexts, and emits or links a tenant-context-violation event

#### Scenario: Cross-tenant administration is authorized
- **WHEN** a platform administrator performs an approved action against a tenant-owned resource
- **THEN** the event separately identifies platform actor scope, effective target tenant, resource-owning tenant, and the authorization policy that allowed the cross-tenant action

#### Scenario: Tenantless platform event occurs
- **WHEN** a genuine platform-level event has no tenant scope
- **THEN** the catalog explicitly permits tenantless context and the producer uses that representation rather than a fabricated tenant ID

#### Scenario: Required tenant context is missing
- **WHEN** a tenant-scoped catalog event has no validated effective tenant and resource-owning tenant
- **THEN** validation rejects or quarantines the event according to the producer boundary and does not silently assign a default tenant

### Requirement: Resources and actions use stable semantics
The contract SHALL represent resource type, resource ID, parent resource, owning tenant, data classification, action, and operation type. It SHALL support bulk operations, exports, administrative operations, and security-configuration changes without encoding resource identifiers or counts in event names.

Resource types, actions, and operation types SHALL use governed vocabularies. A bulk event SHALL state the aggregate scope and count and SHALL NOT contain an unbounded list of resource identifiers. Whether per-resource child events are required SHALL be cataloged for each bulk operation.

#### Scenario: Sensitive resource is modified
- **WHEN** a producer records a modification to a sensitive resource
- **THEN** the event identifies the stable resource type and server-resolved resource ID, owning tenant, data classification, controlled modify action, and committed outcome

#### Scenario: Bulk export occurs
- **WHEN** a producer records a bulk export
- **THEN** the event uses the cataloged export action, records bounded aggregate scope and count, applies export privacy rules, and follows the catalog's child-event policy

#### Scenario: Arbitrary action is supplied
- **WHEN** a producer supplies an action outside the registry for the declared schema version
- **THEN** validation rejects the event rather than storing the action as an uncontrolled string

### Requirement: Outcome, authorization, and transaction state are independent
Event outcome SHALL use exactly the controlled values `success`, `failure`, `denied`, `partial`, `unknown`, or `cancelled`. Outcome reason SHALL use a controlled reason code plus an optional bounded, sanitized display message. Authorization decision SHALL be recorded separately from business-operation outcome.

The contract SHALL distinguish an attempted action from a completed action and SHALL represent whether authoritative business state committed. A success outcome for a committed operation SHALL NOT be emitted before commit is known. Asynchronous completion, transaction failure after authorization, partial completion, cancellation, compensation, and rollback SHALL be represented as distinct immutable events or lifecycle phases linked by operation and causation identifiers; an earlier event SHALL NOT be mutated.

#### Scenario: Authorization is allowed but transaction fails
- **WHEN** policy allows an operation but its business transaction fails before commit
- **THEN** authorization decision is `allow`, operation outcome is `failure`, and commit state indicates that the intended change did not commit

#### Scenario: Authorization is denied
- **WHEN** an enforcement point denies an operation before business execution
- **THEN** authorization decision is `deny`, event outcome is `denied`, lifecycle phase represents the attempt, and no successful business outcome is implied

#### Scenario: Asynchronous work completes later
- **WHEN** an accepted request starts an asynchronous operation that later completes
- **THEN** the attempt/acceptance event and completion event have different event IDs and are linked by operation and causation identifiers

#### Scenario: Completed operation is compensated
- **WHEN** a previously committed operation is rolled back or compensated
- **THEN** a new compensation event links to the original event and states its own outcome without rewriting the original committed event

#### Scenario: Success is emitted before commit
- **WHEN** a producer attempts to emit `success` with committed state before the transaction outcome is known
- **THEN** runtime validation rejects the invalid lifecycle combination

### Requirement: Authentication context is secret-free and evidence-specific
Authentication context SHALL support authentication method, assurance level, MFA state, credential type, authentication time, identity provider, session identifier, session age, account-recovery context, delegation or impersonation state, and authentication failure reason. Each value SHALL identify whether it is an authoritative authentication-system fact, a verified external assertion, or an untrusted claim.

The context SHALL NOT contain passwords, password-derived verifier material, raw authentication tokens, API keys, private keys, session cookies, recovery codes, authentication-factor contents, or other reusable secrets. Session and credential references SHALL use approved opaque identifiers or purpose-scoped transformations and SHALL NOT contain the credential itself.

#### Scenario: Authentication succeeds with MFA
- **WHEN** the authoritative authentication component completes MFA-backed authentication
- **THEN** the event records the validated principal, method, assurance level, MFA state, credential type, authentication time, identity provider, and non-secret session reference

#### Scenario: Authentication fails
- **WHEN** authentication fails
- **THEN** the event uses a controlled failure reason that supports investigation without revealing whether prohibited secrets or sensitive account-recovery contents were correct

#### Scenario: Raw token is supplied
- **WHEN** any authentication context or extension contains a raw token, password, API key, session cookie, recovery code, private key, or factor content
- **THEN** validation rejects the event and produces a safe diagnostic that does not repeat the prohibited value

### Requirement: Authorization context preserves the decision evidence
Authorization context SHALL include decision, policy identifier and version, permission or capability evaluated, enforcement point, controlled decision reason, resource and tenant context, override or break-glass status, and policy-engine correlation where applicable. The context SHALL identify the component that made the decision and the component that enforced it.

The authorization decision SHALL not be inferred from HTTP status, operation outcome, actor privilege, or later consumer analysis. Overrides and break-glass actions SHALL be explicit, cataloged, and subject to heightened delivery and investigation requirements.

#### Scenario: Policy allows access
- **WHEN** an authorization engine returns allow and the enforcement point applies that decision
- **THEN** the event records allow, policy identity and version, evaluated capability, enforcement point, resource and tenant context, and policy correlation independently of the later operation outcome

#### Scenario: Break-glass override is used
- **WHEN** an authorized break-glass mechanism overrides the ordinary decision path
- **THEN** the event explicitly identifies the override, actor, reason code, policy context, resource, delivery class, and correlation to the affected operation

#### Scenario: Business failure is mistaken for denial
- **WHEN** authorization allowed an operation but the operation later fails
- **THEN** the contract prevents the failure outcome from being represented as an authorization denial

### Requirement: Correlation and causality identifiers have distinct meanings
The contract SHALL define non-overlapping semantics for W3C trace ID, span ID, correlation ID, causation ID, operation ID, transaction ID, request ID, message ID, retry attempt, and original event ID. Trace and span identifiers SHALL conform to W3C Trace Context when present and SHALL be treated as correlation context, not identity or authorization evidence.

Synchronous requests, asynchronous messages, queues, background jobs, scheduled processes, retries, fan-out, and multi-step workflows SHALL preserve the applicable identifiers according to documented propagation rules. Missing trace context SHALL NOT prevent a valid audit event when another required operation or correlation identifier can be generated authoritatively. Clock skew SHALL be observable through distinct occurrence and observation timestamps and SHALL NOT be hidden by rewriting occurrence time.

#### Scenario: Synchronous request emits an event
- **WHEN** an audit occurrence happens within a valid distributed trace span
- **THEN** the event carries the W3C trace and span IDs plus its request, operation, and correlation identifiers according to their distinct semantics

#### Scenario: Queue retry redelivers a message
- **WHEN** a message is retried
- **THEN** message and retry metadata identify the delivery attempt while the operation, correlation, causation, and original-event relationships remain stable as defined by the contract

#### Scenario: Workflow fans out
- **WHEN** one event causes multiple downstream operations
- **THEN** each child event has a unique event ID, references the causal parent, shares the appropriate workflow correlation or operation ID, and does not reuse a parent span ID as an event ID

#### Scenario: Trace context is missing
- **WHEN** a valid background or legacy operation has no trace context
- **THEN** the producer omits trace and span IDs, generates the required authoritative operation/correlation identifiers, and does not fabricate W3C values

#### Scenario: Clocks disagree
- **WHEN** observation time precedes the reported occurrence time beyond the allowed skew
- **THEN** validation or ingestion flags the skew while preserving both timestamps and their authorities

### Requirement: Schema governance is explicit and compatibility-tested
The canonical schema SHALL have a single named owner, a versioned registry or catalog, stable schema and catalog identifiers, documented naming rules, and a declared machine-readable schema dialect. Schema versions SHALL follow a documented semantic-versioning policy that separately defines producer compatibility and consumer compatibility.

The governance policy SHALL define backward-compatible and breaking changes, field and event deprecation, removal windows, migration instructions, extension namespaces, validator behavior, producer support declarations, and consumer support declarations. Released field and event meanings SHALL NOT be reused for different semantics. An incompatible change SHALL use a new major schema version; a producer SHALL declare the exact schema version used.

Compatibility tests SHALL prove that existing valid examples retain their defined interpretation across compatible releases and that intentionally incompatible fixtures fail under the expected version. Unknown schema versions SHALL be rejected or quarantined and SHALL NOT be guessed from payload shape.

#### Scenario: Optional compatible field is added
- **WHEN** governance approves a backward-compatible optional field
- **THEN** the minor or patch classification follows the documented policy, prior valid events retain their interpretation, tolerant consumers handle the field as specified, and compatibility tests pass

#### Scenario: Existing field meaning changes
- **WHEN** a proposed change alters an existing field's type, authority, requiredness, privacy meaning, or semantic interpretation incompatibly
- **THEN** governance requires a new major version and migration guidance

#### Scenario: Field is deprecated
- **WHEN** a field or event is deprecated
- **THEN** its original meaning remains stable during the support window, producers receive a replacement path, and the registry records deprecation and removal versions

#### Scenario: Invalid schema version is supplied
- **WHEN** an event declares a missing, malformed, unsupported, or incompatible schema version
- **THEN** validation rejects or quarantines it with an unsupported-version result and does not reinterpret it using the latest schema

### Requirement: Extension fields are governed and non-escalating
Extension fields SHALL exist only under registered, collision-resistant namespaces. Each extension SHALL declare an owner, version, schema, authority, privacy classification, size limits, compatibility policy, and mapping behavior. Extensions SHALL NOT redefine canonical fields, introduce uncataloged event names or actions, carry prohibited data, or assign a higher trust level than their source permits.

#### Scenario: Registered extension is used
- **WHEN** a producer includes a registered extension supported by the declared schema version
- **THEN** the extension validates against its namespaced schema and retains its declared authority, privacy, and compatibility metadata

#### Scenario: Extension shadows tenant identity
- **WHEN** an extension attempts to redefine authoritative tenant, actor, outcome, authorization, event-name, or delivery semantics
- **THEN** validation rejects the event

#### Scenario: Unknown extension is received
- **WHEN** an event contains an unregistered extension namespace
- **THEN** producer or ingestion validation rejects or quarantines it according to the declared compatibility policy and never silently treats it as trusted

### Requirement: Sensitive-data policy is enforceable
Every canonical and extension field SHALL be classified as `allowed`, `conditionally_allowed`, `transform_required`, or `prohibited`, with a privacy classification, purpose, retention class, tenant-access boundary, redaction behavior, and display/export handling rule.

Passwords, raw authentication tokens, API keys, private keys, session cookies, payment-card data, raw secrets, recovery codes, authentication-factor contents, full request or response bodies by default, arbitrary serialized objects, and unnecessary high-entropy client attributes SHALL be prohibited. The policy SHALL cover IP addresses, user agents, email addresses, phone numbers, business identifiers, and any account-, session-, credential-, or device-related identifiers.

Data collection SHALL be minimized to the event purpose. When direct identity is unnecessary, the contract SHALL specify deletion, coarsening, tokenization, or purpose-scoped keyed hashing. Keyed hashing SHALL use protected, rotatable, purpose- and tenant-scoped keys where cross-tenant correlation is not explicitly authorized; the event MAY record a non-secret key identifier but SHALL NOT record the key. Plain hashing SHALL NOT be represented as adequate pseudonymization for guessable identifiers.

#### Scenario: Prohibited field is present
- **WHEN** a prohibited key or a detectable prohibited value appears anywhere in the canonical event or extensions
- **THEN** validation rejects the event and the safe error report omits the value

#### Scenario: Email is needed only for correlation
- **WHEN** a cataloged purpose requires correlating an email address but does not require displaying the address
- **THEN** the producer uses the approved purpose-scoped transformation and records only allowed transformation metadata

#### Scenario: IP address is observed
- **WHEN** a trusted server boundary observes a network address needed for a cataloged security purpose
- **THEN** the event labels it as observed network information, applies the defined minimization and retention policy, and does not claim it identifies a person or device

#### Scenario: Tenant reads audit data
- **WHEN** a tenant-scoped consumer requests an audit event
- **THEN** tenant-access policy prevents exposure of another tenant's restricted fields except through an explicitly authorized cross-tenant or platform-administration path

### Requirement: Validation is layered and misuse-resistant
The contract SHALL allocate validation responsibilities across schema authoring, generated types, compile-time use, producer runtime, CI, ingestion, and downstream consumption. Compile-time types SHALL improve correct construction but SHALL NOT replace runtime validation at trust boundaries. CI SHALL validate schemas, catalogs, mappings, examples, negative examples, and compatibility fixtures. Ingestion SHALL revalidate schema version, producer identity, size limits, prohibited fields, tenant/resource consistency, authority labels, and duplicate identity.

Validation failures SHALL use bounded, machine-readable codes and SHALL NOT echo secrets or unbounded payloads. The contract SHALL define behavior for a missing required actor, missing tenant context, resource-tenant conflict, unknown event name, invalid schema version, prohibited field, oversized field, authority escalation, premature success, and delivery failure.

#### Scenario: Compile-time type is bypassed
- **WHEN** an untyped, dynamically parsed, or malicious payload reaches the producer or ingestion boundary
- **THEN** runtime validation enforces the same normative contract independently of TypeScript types

#### Scenario: Resource ownership conflicts with tenant context
- **WHEN** authoritative resource ownership differs from the event's effective or owning tenant without a valid cross-tenant context
- **THEN** validation rejects or quarantines the event and emits a safe operational signal according to policy

#### Scenario: Client claim is structurally valid but misclassified
- **WHEN** a client-controlled value has the correct JSON type but is labeled as server-authoritative
- **THEN** authority validation rejects the event even though structural schema validation succeeds

#### Scenario: Negative fixture is evaluated in CI
- **WHEN** a prohibited-secret, unknown-event, oversized-field, tenant-conflict, or premature-success fixture is tested
- **THEN** CI asserts the exact safe rejection code and verifies that no prohibited value appears in diagnostics

### Requirement: Delivery expectations are classified per event
Every catalog entry SHALL declare exactly one delivery class from the governed values `best_effort`, `security_significant`, `transaction_critical`, or `policy_critical`. Each class SHALL define its delivery semantic, durability point, idempotency rule, duplicate handling, buffering, retry, backpressure, graceful-shutdown, outage, local-queueing, fail-open/fail-closed, deferred-completion, and operator-alerting expectations.

The contract SHALL NOT assign one universal delivery policy to all events. An event-specific policy MAY strengthen its class but SHALL NOT weaken it without a reviewed exception. Runtime mechanisms such as a transactional outbox or durable local queue remain implementation choices for later changes, but a future implementation SHALL satisfy the selected class's observable guarantees.

#### Scenario: Best-effort event cannot be sent
- **WHEN** a `best_effort` event encounters an unavailable delivery path
- **THEN** the producer follows the documented drop or bounded-buffer behavior and emits the required health signal without claiming durable delivery

#### Scenario: Security-significant event is duplicated
- **WHEN** retry causes a `security_significant` event to be delivered more than once
- **THEN** every copy retains the same event ID and consumers deduplicate idempotently without discarding distinct occurrences

#### Scenario: Transaction-critical event is committed
- **WHEN** business state and its `transaction_critical` audit record must commit atomically
- **THEN** the defined durability boundary prevents a successful business commit from being reported without the required durable event record and allows later at-least-once delivery

#### Scenario: Policy-critical event has no approved failure policy
- **WHEN** a legally or operationally sensitive `policy_critical` event lacks an explicit reviewed fail-open, fail-closed, or deferred-completion policy
- **THEN** the catalog cannot be approved for production implementation

#### Scenario: Collector outage creates backpressure
- **WHEN** a required delivery path is unavailable long enough to exceed buffering limits
- **THEN** the producer follows the event class's declared backpressure and availability policy and alerts operators before silently losing required evidence

### Requirement: Event delivery failure is itself observable
For every non-best-effort class, the contract SHALL define a separate safe operational signal for validation failure, enqueue failure, buffer exhaustion, retry exhaustion, delivery delay, and collector or ingestion outage. The operational signal SHALL NOT falsely assert that the missing audit event was delivered and SHALL avoid recursive audit-event failure loops.

#### Scenario: Audit event cannot be enqueued
- **WHEN** a non-best-effort event cannot reach its required durability boundary
- **THEN** the class-specific business response executes and a separate bounded operational alert identifies the failure without containing the rejected event's prohibited data

#### Scenario: Graceful shutdown begins
- **WHEN** a producer begins graceful shutdown with buffered non-best-effort events
- **THEN** it follows the class's bounded flush or durable-handoff rule and reports any remaining undelivered records

### Requirement: Integrity claims remain bounded
The contract SHALL separately describe transport authenticity, producer identity, event-byte integrity, storage integrity, completeness, ordering, application-state truthfulness, and non-repudiation. Integrity metadata SHALL identify the mechanism, scope, canonicalization, signer or attester reference, key identifier, and verification result without containing secret key material.

A signature, MAC, authenticated transport, hash, or hash chain MAY support a specific authenticity or tamper-evidence claim within its trust boundary. It SHALL NOT be described as proving that a compromised or faulty producer reported truthful state, emitted every required event, used the correct timestamp, or preserved global order. Contract conformance SHALL NOT be represented as legal non-repudiation.

#### Scenario: Signed event comes from a compromised producer
- **WHEN** a valid signature verifies under the compromised producer's authorized key
- **THEN** verification establishes only the documented key and byte-integrity claim and does not establish truthful application state or completeness

#### Scenario: Storage verifies a hash chain
- **WHEN** stored records pass a configured chain verification
- **THEN** the result is limited to the chain's documented scope and does not prove that omitted events were ever produced

#### Scenario: Transport authentication fails
- **WHEN** ingestion cannot authenticate an asserted producer at the transport boundary
- **THEN** it rejects or quarantines the event and does not trust a producer identity copied inside the payload

### Requirement: Interoperability mappings preserve canonical semantics
The Bloodtrail application-facing contract SHALL remain independent of OCSF, OpenTelemetry, CloudEvents, any SIEM, and any vendor schema. The change SHALL provide version-pinned, field-level mapping specifications and conformance fixtures for OCSF and OpenTelemetry. It SHALL explicitly decide and record whether CloudEvents is used as an optional transport envelope.

An interoperability mapping SHALL identify exact source and target versions, mapped fields, transformed fields, unmapped fields, lossy mappings, cardinality changes, trust/provenance preservation, privacy behavior, and round-trip limitations. A mapping SHALL NOT claim full compatibility unless automated conformance tests prove the claimed scope.

OCSF normalization SHALL occur at a downstream ingestion or export boundary rather than redefining the producer contract. OpenTelemetry representation SHALL preserve canonical event semantics while using native timestamp, observation timestamp, trace, span, event-name, resource, instrumentation-scope, attribute, and body fields according to the pinned OpenTelemetry specification. If CloudEvents is selected, the canonical event SHALL remain the data contract and CloudEvents context attributes SHALL NOT become a second authority for conflicting canonical values.

#### Scenario: Canonical event maps to OCSF
- **WHEN** a catalog event is exported through the pinned OCSF mapping
- **THEN** tests identify every preserved, transformed, extended, or unmapped semantic and do not label the result fully OCSF-compatible beyond the tested profile

#### Scenario: Canonical event maps to OpenTelemetry
- **WHEN** a canonical event is represented as an OpenTelemetry Event or LogRecord
- **THEN** native occurrence/observation timestamps, trace/span IDs, event name, resource, and instrumentation scope are mapped without moving unbounded or prohibited canonical data into attributes or body

#### Scenario: Envelope and payload conflict
- **WHEN** a CloudEvents or transport envelope contains an ID, source, type, time, schema, tenant, or actor value that conflicts with the canonical payload
- **THEN** the documented conflict policy rejects the message rather than silently selecting whichever value appears more trusted

### Requirement: Initial event catalog covers the minimum security lifecycle
The initial catalog SHALL include at least these stable event semantics:

- account registration attempted and completed;
- authentication succeeded and failed;
- MFA enrolled and removed;
- session created and revoked;
- password reset requested and completed;
- authorization allowed and denied;
- role assigned and removed;
- privilege elevated;
- administrative impersonation started and ended;
- sensitive resource viewed, created, modified, and deleted;
- sensitive data exported;
- security configuration changed;
- tenant context violation detected.

For every entry, the catalog SHALL define its stable event name, category, action, purpose, trigger and lifecycle phase, required and conditionally required fields, authoritative producer boundary, actor and tenant rules, resource and authorization requirements, allowed outcomes and reasons, privacy concerns, retention class, delivery class, investigation value, and OCSF/OpenTelemetry mapping status.

#### Scenario: Catalog completeness is tested
- **WHEN** the catalog conformance test enumerates the required initial semantics
- **THEN** every listed semantic has exactly one active stable event entry with all required metadata

#### Scenario: Registration attempt later completes
- **WHEN** an account registration attempt results in a committed account
- **THEN** the attempted and completed catalog events have distinct event IDs and lifecycle semantics and are linked by operation and causation identifiers

#### Scenario: Sensitive data is exported
- **WHEN** an export of sensitive data completes or fails
- **THEN** the catalog entry requires actor, tenant, resource/scope, authorization, outcome, data classification, bounded volume metadata, delivery class, and privacy controls without recording the exported data

### Requirement: Contract artifacts are machine-readable and reviewable
The approved contract SHALL include a canonical machine-readable schema or equivalent, generated-type strategy, human-readable field-authority documentation, catalog, schema-versioning rules, privacy-field policy, validation rules, delivery classes, OCSF mapping, OpenTelemetry mapping, valid example events, negative examples, and compatibility tests.

Examples SHALL use fictional, non-secret values and SHALL declare the schema version they exercise. Negative examples SHALL identify the exact normative rule and expected safe failure code. Human-readable documentation and machine-readable artifacts SHALL be generated from or checked against one authoritative source so that drift fails CI.

#### Scenario: Example conforms to the schema
- **WHEN** CI validates a positive example against its declared schema and catalog version
- **THEN** structural, semantic, authority, privacy, catalog, and compatibility checks all pass

#### Scenario: Documentation and schema diverge
- **WHEN** a field's requiredness, type, vocabulary, privacy rule, or authority differs between human-readable and machine-readable artifacts
- **THEN** CI fails and final contract approval remains blocked

#### Scenario: Type generation strategy is evaluated
- **WHEN** the TypeScript type-generation strategy is reviewed
- **THEN** it demonstrates deterministic generation from the approved contract, preserves runtime validation as a separate requirement, and introduces no production SDK code in this change

### Requirement: Approval is required before implementation use
The contract SHALL NOT be treated as approved, production-authorized, or ready for SDK implementation until all technical artifacts and compatibility evidence are complete and the project owner records an explicit final contract decision bound to the exact reviewed Git commit. AI verification, task completion, a suggested decision, PR assignment, or informal discussion SHALL NOT constitute approval.

Project-owner review SHALL be described as documented project governance and SHALL NOT be represented as independent assurance, certification, legal advice, privacy-law approval, or organizational approval.

#### Scenario: Technical validation passes without owner decision
- **WHEN** schemas, examples, mappings, and tests pass but no exact-commit project-owner approval record exists
- **THEN** the change is technically reviewable but the contract remains unapproved and no SDK implementation is authorized

#### Scenario: Reviewed substance changes after approval
- **WHEN** a later commit changes normative contract semantics, evidence, mappings, privacy rules, delivery rules, or authorization boundaries
- **THEN** final approval requires explicit reconfirmation against the new exact commit before implementation use

### Requirement: Derived-field material inputs have an optional, closed provenance representation

Contract version `1.1.0` SHALL define `risk.model.provenance.derived_from` as the optional
material-input provenance representation for the event's server-derived risk result. Its absence
SHALL preserve the meaning of a valid `1.1.0` event and SHALL NOT be repaired by inventing inputs.
When present, it SHALL be a non-empty set of one to the contract's bounded maximum number of
code-point-sorted field paths. It SHALL be present only with `derived_server` provenance; a
non-derived provenance declaration that carries it SHALL be rejected.

Each path SHALL resolve either to a canonical field defined by the declared contract version or to a
registered extension namespace. Every resolved canonical path SHALL be present in the same event.
The list SHALL name each material input exactly once, SHALL have no positional meaning, and SHALL
not contain the provenance field itself or any path that forms a derivation cycle. Validation SHALL
reject malformed, duplicate, unsorted, unresolvable, absent, empty, non-derived, and cyclic input
lists with distinct stable outcomes. It SHALL NOT deduplicate, sort, substitute `unknown`, or
otherwise normalize an invalid declaration.

#### Scenario: Canonically ordered material inputs are supplied
- **WHEN** a `1.1.0` event's derived risk provenance declares unique, code-point-sorted paths to
  fields present in that event
- **THEN** validation accepts the provenance and preserves the declared paths without assigning
  precedence, weight, recency, or evaluation order to their positions

#### Scenario: A valid event omits optional provenance
- **WHEN** a structurally and semantically valid `1.1.0` event does not contain
  `risk.model.provenance.derived_from`
- **THEN** validation accepts the event without inferring material inputs or a trust-floor result

#### Scenario: A duplicate or unordered input list is supplied
- **WHEN** a provenance declaration repeats an input path or lists otherwise valid paths outside
  code-point order
- **THEN** validation rejects the event with the distinct duplicate-input or non-canonical-order
  outcome and does not repair the list

#### Scenario: An input is unresolvable or absent
- **WHEN** a provenance declaration names neither a canonical field nor a registered extension
  namespace, or names a canonical field absent from the event instance
- **THEN** validation rejects the event with the distinct unresolvable-input or absent-input outcome

#### Scenario: A derived declaration is empty or cyclic
- **WHEN** a derived provenance declaration is empty or its input path creates a derivation cycle
- **THEN** validation rejects the event with the distinct empty-input or cyclic-derivation outcome

### Requirement: The provenance addition follows the exact-version compatibility policy

The optional provenance representation SHALL be an additive minor contract change from `1.0.0` to
`1.1.0`. Generated artifacts, catalog metadata, documentation, fixtures, provenance bindings, and
private SDK projections SHALL identify `1.1.0` consistently. Each SDK package version SHALL replace
its sole supported-contract baseline with `1.1.0` and take the compatibility-major version step
required by the exact-one contract-version support policy; it SHALL NOT offer an implicit,
negotiated, or multi-version fallback.

#### Scenario: A producer declares the new contract version
- **WHEN** a producer uses the provenance representation
- **THEN** it declares schema version `1.1.0`, and the matching SDK projection accepts exactly that
  contract version

#### Scenario: A consumer presents the superseded version to the new SDK
- **WHEN** a producer configures a `1.1.0` SDK projection with contract version `1.0.0`
- **THEN** construction fails closed with the established unsupported-contract-version outcome

#### Scenario: Generated artifacts are evaluated after the contract move
- **WHEN** contract generation and generated-artifact drift verification run for version `1.1.0`
- **THEN** every generated contract artifact and SDK projection is derived from the same authored
  source and no hand-edited generated artifact is accepted
