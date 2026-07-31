## Purpose

Defines the observable behavior and safety boundaries of the framework-independent Bloodtrail Node.js and TypeScript core SDK that constructs and validates Security Audit Event Contract version 1.0.0 records without implementing production delivery or application instrumentation.

## ADDED Requirements

### Requirement: SDK package has an explicit supported runtime and public surface
The SDK package SHALL publish an explicit supported Node.js runtime policy, module format policy, strict TypeScript compiler baseline, package export map, and public API compatibility policy. Only documented public exports SHALL be treated as supported; internal generated, validation, and implementation modules SHALL NOT be reachable through undocumented package subpaths.

The package SHALL initialize from an immutable configuration snapshot and SHALL reject invalid or incomplete configuration before accepting event construction or emission. Configuration SHALL identify contract version `1.0.0`, producer, service, environment, deployment, authoritative-context providers, clock and identifier providers, validation policy, registered transformation hooks, and sink.

#### Scenario: Supported runtime imports the package
- **WHEN** a consumer running a documented Node.js and TypeScript configuration imports each public package entry point
- **THEN** the package resolves with the documented types and runtime exports and exposes no internal generated or validator subpath

#### Scenario: Unsupported contract version is configured
- **WHEN** initialization requests a schema or contract version other than `1.0.0`
- **THEN** initialization fails with a safe unsupported-version error before any event can be emitted

#### Scenario: Configuration object is mutated after initialization
- **WHEN** caller code mutates the original configuration object after successful initialization
- **THEN** SDK behavior remains bound to the validated immutable snapshot and does not adopt the mutation

### Requirement: TypeScript types are generated deterministically from the canonical contract
The SDK SHALL generate its canonical event types, controlled-value types, catalog event-name types, and event-specific builder input types from `contracts/security-audit/source/contract.source.json` or its generated Draft 2020-12 schema and registries. It SHALL NOT maintain a manually duplicated canonical event model.

Generated files SHALL identify contract version `1.0.0`, their authoritative input paths, and generated status. Generation SHALL be deterministic, strict-TypeScript-compatible, and checked in CI using byte-for-byte drift detection. Event-specific inputs SHALL use discriminated types where they improve catalog-name, lifecycle, required-context, outcome, and delivery-class correctness, while documentation SHALL state that compile-time types do not replace runtime validation.

#### Scenario: Type generation is repeated
- **WHEN** generation runs twice from unchanged approved contract artifacts
- **THEN** both runs produce byte-identical generated files and the drift check passes

#### Scenario: Canonical schema changes without regeneration
- **WHEN** an authoritative contract input changes but generated SDK types are not regenerated
- **THEN** CI fails the generated-artifact drift check

#### Scenario: Untyped input reaches the runtime API
- **WHEN** JavaScript, `unknown`, deserialized, or type-asserted input bypasses TypeScript checks
- **THEN** runtime validation enforces the complete structural and semantic contract independently

### Requirement: Event APIs preserve cataloged semantics
The SDK SHALL provide idiomatic named APIs for all 24 version `1.0.0` catalog events and MAY provide a lower-level catalog-discriminated builder. No public API SHALL accept an arbitrary event name, action, category, schema version, lifecycle combination, or delivery class.

Each named API SHALL derive its event name, category, action, minimum delivery class, and catalog constraints from the canonical catalog. Event-specific required and conditional fields SHALL be enforced at runtime even when JSON Schema cannot express the full catalog rule. Callers SHALL NOT weaken the catalog minimum delivery class.

#### Scenario: Authentication success is built through a named API
- **WHEN** a caller invokes `authenticationSucceeded` with valid actor, principal, session, authentication, and request contexts
- **THEN** the SDK derives the registered authentication-succeeded event identity and validates all event-specific required context before handing off a canonical event

#### Scenario: Caller supplies an arbitrary event name
- **WHEN** caller input attempts to introduce a dynamic or unregistered event name or action
- **THEN** the SDK rejects it with a safe controlled-registry error and emits nothing

#### Scenario: Caller weakens delivery class
- **WHEN** a caller requests a delivery class below the catalog minimum for an event
- **THEN** the SDK rejects the request rather than changing the cataloged delivery class

### Requirement: Authority-specific builders do not promote claims
The SDK SHALL expose distinct construction paths or branded validated values for actor, subject, authenticated principal, credential reference, delegated actor, impersonating actor, service/workload identity, client claims, observed transport context, tenant context, resource ownership, authentication evidence, and authorization evidence. An API accepting client or request attributes SHALL NOT return a value typed or labeled as server-authoritative without a configured authoritative resolver or explicit trusted-boundary input.

Credential APIs SHALL accept only non-secret references and permitted metadata. Display names and client-provided identifiers SHALL remain distinguishable from authoritative stable IDs.

#### Scenario: Client claims an authenticated actor
- **WHEN** request-derived input supplies an actor or principal labeled as authenticated without an authoritative authentication provider result
- **THEN** construction fails with an authority-escalation error and no event is emitted

#### Scenario: Service acts under delegation
- **WHEN** an authoritative delegation result identifies a performing service, delegated principal, scope, reason, and expiry
- **THEN** the event preserves the service actor, authenticated/delegated principal, and delegation details as distinct canonical structures

#### Scenario: Raw credential is supplied
- **WHEN** a credential builder receives a token, cookie, password, private key, API key, factor value, or other reusable secret instead of an allowed reference
- **THEN** the SDK rejects it with a prohibited-data error that does not echo the value

### Requirement: Tenant and resource authority are cross-validated
The SDK SHALL distinguish actor tenant, effective tenant, claimed tenant, parent tenant, resource-owning tenant, tenantless platform scope, and cross-tenant administration. Authoritative tenant context SHALL come only from configured trusted routing, authentication scope, tenancy authority, or resource ownership sources. Caller-supplied tenant data MAY be retained only as a labeled claim when policy permits.

Before handoff, the SDK SHALL cross-validate authoritative resource ownership, effective tenant, actor tenant, authorization tenant context, and any explicit cross-tenant or platform-administration scope. No builder or context API SHALL authorize cross-tenant access solely from caller-supplied tenant data.

#### Scenario: Claimed tenant conflicts with authenticated scope
- **WHEN** a non-violation event receives request input claiming a tenant different from authoritative authentication and resource context
- **THEN** the SDK leaves authoritative contexts unchanged, rejects construction with a tenant-context-conflict error, and emits nothing

#### Scenario: Dedicated tenant violation event preserves the claim
- **WHEN** authoritative detection logic invokes the cataloged tenant-context-violation builder with a conflicting caller claim
- **THEN** the SDK keeps the claimed and authoritative tenant values distinct, derives the violation event semantics from the catalog, and does not treat the claim as authorization

#### Scenario: Resource ownership conflicts with effective tenant
- **WHEN** the resource-owning tenant conflicts with effective tenant and no validated cross-tenant context exists
- **THEN** the SDK rejects construction with a tenant-resource-conflict error and emits nothing

#### Scenario: Authorized platform administration crosses tenants
- **WHEN** trusted providers supply platform actor scope, target effective tenant, resource-owning tenant, and an authoritative cross-tenant authorization decision
- **THEN** all tenant roles remain separately represented and the client claim, if present, does not control them

### Requirement: Context propagation preserves trust and isolation
The SDK SHALL provide request/operation context propagation based on Node.js `AsyncLocalStorage` or an equivalently isolated standard runtime mechanism. Propagated context SHALL distinguish authenticated principal, actor and delegated actor, effective tenant, session, request, trace/span, correlation/causation, operation, service/workload, environment, and deployment metadata by authority and provenance.

Context scope SHALL be explicit, nestable, and restored when a scope exits. Concurrent asynchronous executions SHALL NOT observe each other's context. Missing context SHALL produce a safe missing-authoritative-context error when event requirements need it; the SDK SHALL NOT fabricate default identity, tenant, trace, or request values. Incoming trace and request attributes SHALL remain correlation context rather than identity or authorization evidence.

#### Scenario: Concurrent requests use different tenants
- **WHEN** two overlapping asynchronous request scopes carry different authenticated principals and effective tenants
- **THEN** each event receives only its own scope's context and no tenant or identity crosses between requests

#### Scenario: Nested scope overrides correlation only
- **WHEN** a nested operation supplies a new operation and causation identifier while inheriting actor and tenant context
- **THEN** only the explicitly overridden context changes and the outer context is restored after the nested scope exits

#### Scenario: Untrusted request attribute enters context
- **WHEN** a request header or body supplies a tenant, principal, or trace value
- **THEN** the SDK records only its configured claimed or correlation provenance and does not upgrade it to authoritative authentication, tenant, or authorization context

### Requirement: Correlation, causation, retry, and identity remain distinct
The SDK SHALL generate stable collision-resistant event IDs through a default trusted identifier provider and SHALL permit an injected deterministic provider for tests. It SHALL maintain separate trace ID, span ID, request ID, message ID, correlation ID, causation ID, operation ID, transaction ID, retry attempt, and original event ID semantics from contract version `1.0.0`.

Pure redelivery of the same immutable event SHALL preserve event ID. Re-execution or a new occurrence SHALL receive a new event ID while retaining the applicable original-event, operation, correlation, and causation links. A positive retry attempt SHALL require original-event identity. Required asynchronous completion events SHALL require causation and original-event identity.

#### Scenario: Same event is redelivered
- **WHEN** a capturing test observes the same previously validated immutable event record more than once to model downstream redelivery
- **THEN** the record retains the same event ID and canonical content without the SDK performing retry, queueing, or delivery infrastructure

#### Scenario: Operation is re-executed
- **WHEN** business logic performs a new attempt rather than redelivering identical bytes
- **THEN** the SDK assigns a new event ID and requires the original-event and retry relationships defined by the contract

#### Scenario: Asynchronous completion lacks causation
- **WHEN** a completion builder requiring asynchronous causation has no causation ID or original-event ID
- **THEN** validation fails with a safe causality error and emits nothing

### Requirement: Transaction-aware operations prevent premature success
The SDK SHALL provide a transaction-aware operation model for work whose successful event requires committed state. An operation SHALL begin in a non-committed state; only an explicit trusted transaction outcome may mark it committed, not-committed, partially committed, compensated, or otherwise resolved according to the contract.

A success emission that requires committed state SHALL fail until committed state is known. Marking an operation committed SHALL NOT itself claim that an audit record is durably delivered or atomic with business state; transactional outbox and durability mechanisms remain outside this SDK core. Authorization decision SHALL remain a separate input from operation outcome, and an authorization allow SHALL be representable with later operation failure.

#### Scenario: Success is emitted before commit
- **WHEN** `emitSuccess` is called before a transaction-aware operation is marked committed
- **THEN** the SDK returns a premature-success error and the sink receives no event

#### Scenario: Transaction commits before success
- **WHEN** trusted transaction integration marks the operation committed and the caller then emits success
- **THEN** the event reports completed success and committed state with stable operation and transaction identifiers

#### Scenario: Authorization allows but transaction fails
- **WHEN** authorization decision is allow and the business transaction is marked not committed due to failure
- **THEN** the emitted event preserves allow as the authorization decision and failure as the operation outcome

#### Scenario: Sink failure follows business commit
- **WHEN** business state is already committed and the transport-neutral sink rejects the validated event
- **THEN** the SDK reports a bounded sink failure without claiming rollback, durability, delivery, or a universal fail-open/fail-closed response

### Requirement: Runtime validation is layered and contract-complete
Before sink handoff, the SDK SHALL validate Draft 2020-12 schema structure, exact schema version, catalog membership, controlled registries, field bounds, event-specific required context, authority/provenance, tenant/resource consistency, lifecycle/outcome/commit combinations, causality/retry identity, extension rules, and prohibited-data policy. Validation SHALL use the approved schema and canonical machine-readable artifacts rather than a weaker SDK-specific schema.

Compile-time typing, SDK runtime validation, CI compatibility checks, fixture validation, and downstream ingestion validation SHALL remain distinct responsibilities. Successful SDK validation SHALL NOT claim downstream acceptance, producer truthfulness, delivery, or production authorization.

#### Scenario: Structurally valid event violates authority
- **WHEN** an event passes JSON Schema but labels a client claim as authenticated identity
- **THEN** semantic runtime validation rejects it before sink handoff

#### Scenario: Approved positive fixture is validated
- **WHEN** each version `1.0.0` approved positive fixture is processed through the SDK validation boundary
- **THEN** it validates without semantic reinterpretation and retains canonical meaning

#### Scenario: Approved negative fixture is validated
- **WHEN** each approved negative fixture is processed through the corresponding SDK boundary
- **THEN** it fails with the expected safe contract error code and no prohibited value appears in diagnostics

### Requirement: Prohibited data and transformations are enforced before output
The SDK SHALL recursively reject prohibited keys and values, including passwords, verifier material, raw tokens, API/private keys, cookies, recovery codes, factor contents, payment-card data, connection strings, full request/response bodies, arbitrary serialized objects, and raw secrets, across canonical input, extensions, hook output, errors, and sink handoff.

Redaction and transformation hooks SHALL be registered during initialization, bounded, deterministic for their documented profile, and associated with field policy. Hooks SHALL NOT convert prohibited data into allowed data, alter authoritative canonical fields, weaken privacy classification, create unregistered extensions, or receive more raw input than their declared field purpose requires. Purpose- and tenant-scoped keyed transformations SHALL expose no key material and SHALL carry required non-secret version metadata.

#### Scenario: Full request body is supplied
- **WHEN** caller input or a hook attempts to include a full request or arbitrary object body
- **THEN** the SDK rejects the event with a prohibited-data error and does not pass the body to the sink or diagnostic

#### Scenario: Transformation hook attempts authority override
- **WHEN** a registered hook returns a changed actor, tenant, authorization decision, event identity, delivery class, or schema field
- **THEN** post-hook validation rejects the result and identifies only a safe bounded path and error code

#### Scenario: Purpose-scoped identifier transformation succeeds
- **WHEN** field policy requires transformation and a configured hook returns an allowed bounded value plus non-secret key-version metadata
- **THEN** the SDK validates the transformed representation without exposing the original value or key

### Requirement: Extensions remain registered and non-authoritative
The SDK SHALL accept extensions only under namespaces registered by contract version `1.0.0`. Generated extension types SHALL represent registered fields and bounds. Runtime validation SHALL reject unknown namespaces, unknown extension fields, prohibited data, size violations, and any attempt to shadow or override canonical event, actor, tenant, authorization, resource, outcome, schema, or delivery semantics.

#### Scenario: Registered enrichment extension is supplied
- **WHEN** caller code supplies a valid registered enrichment extension with downstream-enrichment provenance
- **THEN** the SDK preserves its namespace, version, privacy, provenance, and non-authoritative status

#### Scenario: Extension overrides tenant authority
- **WHEN** an extension contains a canonical tenant or authority value outside its registered shape
- **THEN** the SDK rejects it before sink handoff

### Requirement: Clock and identifier injection is deterministic but bounded
The SDK SHALL use trusted default clock and collision-resistant identifier providers in ordinary use and SHALL allow explicit injected providers for deterministic tests. Injected providers SHALL be fixed at initialization, SHALL be validated for required formats, and SHALL NOT allow callers to bypass event identity uniqueness, timestamp format, occurrence/observation distinction, or causality rules.

#### Scenario: Deterministic providers are used in a test
- **WHEN** a test initializes the SDK with fixed clock and identifier providers
- **THEN** repeated equivalent construction produces predictable timestamps and identifiers suitable for exact assertions

#### Scenario: Identifier provider returns an invalid value
- **WHEN** an injected provider returns a malformed, reused where uniqueness is required, or otherwise invalid identifier
- **THEN** construction fails safely before sink handoff

### Requirement: Sink boundary is transport-neutral and delivery-class preserving
The SDK SHALL define a transport-neutral sink contract equivalent in behavior to `emit(event): Promise<AuditDeliveryResult>` with optional bounded `flush` and `shutdown` lifecycle operations. Every sink call SHALL receive a fully validated immutable canonical event including its cataloged delivery class.

The core SDK SHALL NOT claim at-most-once, at-least-once, atomic durability, retry, buffering, queueing, storage, collector acceptance, or production delivery. It SHALL NOT select a universal fail-open or fail-closed response. Sink results SHALL distinguish accepted-by-sink, rejected, and failed/unknown outcomes without asserting downstream delivery beyond the sink's documented boundary.

#### Scenario: Sink accepts a validated event
- **WHEN** the configured sink resolves with its documented accepted result
- **THEN** the SDK reports acceptance only at that sink boundary and does not claim durable or downstream delivery

#### Scenario: Sink fails
- **WHEN** the sink throws, rejects, or reports an unknown result
- **THEN** the SDK returns a safe sink failure preserving event ID and delivery class and leaves business response to the caller's separately approved policy

#### Scenario: Caller requests core retry behavior
- **WHEN** a caller expects the core SDK to retry, buffer, enqueue, or durably store a failed emission
- **THEN** the SDK performs none of those production delivery behaviors and reports the sink result according to its documented boundary

### Requirement: Only explicitly non-production sinks are included
The change SHALL include an in-memory sink and a capturing test sink for deterministic development and test use. Any console or local-file sink SHALL require a recorded ADR justification, SHALL be conspicuously named and documented as non-production, SHALL apply complete validation and prohibited-data rules, and SHALL NOT claim delivery, privacy, durability, rotation, access-control, or retention guarantees.

No included sink SHALL perform network export, broker/queue access, collector communication, production storage, SIEM integration, analytics, or application instrumentation.

#### Scenario: Capturing sink records test output
- **WHEN** a test emits a valid event through the capturing sink
- **THEN** the test can inspect an immutable copy without network, filesystem, retry, queue, or production side effects

#### Scenario: Test sink receives invalid input directly
- **WHEN** an internal or test-only path attempts to bypass SDK validation and pass invalid canonical data to a bundled sink
- **THEN** package boundaries or sink validation prevent it from being represented as successfully emitted SDK output

### Requirement: Lifecycle behavior is explicit and race-safe
The SDK SHALL define states for uninitialized, ready, shutting down, and shut down. Initialization SHALL be graceful and deterministic; duplicate initialization behavior SHALL be documented and SHALL NOT silently replace immutable authority or sink configuration. Shutdown SHALL stop acceptance of new emissions at a defined point, await or report in-flight sink operations according to a bounded policy, invoke optional sink flush/shutdown at most as documented, and be idempotent.

The core SHALL NOT promise durable handoff during shutdown. Events attempted after shutdown begins SHALL fail with a safe lifecycle error rather than being silently dropped or reported as delivered.

#### Scenario: Emission occurs during shutdown
- **WHEN** shutdown has crossed the documented no-new-emissions boundary and a caller attempts to emit
- **THEN** the SDK returns a safe shutdown error and does not invoke the sink for that event

#### Scenario: Shutdown is called twice
- **WHEN** multiple callers request shutdown
- **THEN** the operation is idempotent and does not duplicate sink shutdown or falsely report delivery

#### Scenario: In-flight sink operation does not finish
- **WHEN** shutdown reaches its configured bounded wait with an unresolved in-flight emission
- **THEN** the SDK reports a bounded unknown/failure result without claiming durable handoff or exposing event contents

### Requirement: Errors are structured, safe, and stable
Public failures SHALL use documented structured error results or error objects with stable machine-readable codes, bounded canonical paths, safe event/schema identifiers when available, and causal category. Errors SHALL NOT echo prohibited values, full events, request/response bodies, arbitrary objects, secrets, raw hook input, or unbounded sink messages.

The SDK error registry SHALL cover at least invalid configuration, unsupported contract/schema version, missing authoritative context, missing event-specific field, controlled-registry violation, authority escalation, tenant-resource conflict, schema validation, semantic validation, prohibited data, unknown extension, premature success, bad causality, sink failure, and shutdown state. Compatibility policy SHALL define when codes may be added, deprecated, or removed.

#### Scenario: Prohibited token causes failure
- **WHEN** validation detects a raw token containing a distinctive test marker
- **THEN** the returned error contains only its safe code and bounded path and the marker appears nowhere in error serialization

#### Scenario: Sink throws an unbounded message
- **WHEN** a sink throws an error containing event data or an arbitrarily long message
- **THEN** the SDK maps it to a bounded sink failure without exposing the original message by default

### Requirement: Compatibility and migration are version-governed
The SDK SHALL state which package versions implement contract version `1.0.0`, which Node.js and TypeScript versions are tested, and how package semantic versioning relates to public API, generated types, error codes, and canonical contract compatibility. It SHALL reject unsupported contract versions rather than guessing or coercing them.

A package change that weakens validation, changes canonical interpretation, changes authority/privacy semantics, or silently accepts a different contract SHALL be prohibited. A genuine contract semantic change SHALL be proposed through a separate versioned change to `security-audit-event-contract` before SDK adaptation. Migration documentation SHALL distinguish SDK API migration from canonical schema migration.

#### Scenario: SDK patch changes event interpretation
- **WHEN** a proposed patch would change authority, requiredness, privacy, lifecycle, outcome, or controlled-value meaning
- **THEN** compatibility checks classify it as impermissible without the applicable contract governance and package-version change

#### Scenario: Supported SDK consumes version 1.0.0 fixture
- **WHEN** a prior valid version `1.0.0` fixture is validated by a compatible SDK release
- **THEN** it retains the same canonical interpretation and expected validation result

### Requirement: Verification covers runtime, compile-time, package, and scope boundaries
The implementation SHALL include deterministic type-generation drift tests, strict TypeScript compile-time tests, package export tests, supported Node.js runtime tests, schema conformance tests, all approved positive and negative fixtures, named builder tests, context isolation and propagation tests, tenant/resource and client-claim authority tests, transaction/premature-success tests, retry/redelivery/causality tests, prohibited-data and extension tests, sink failure and lifecycle tests, deterministic provider tests, compatibility tests, and no-production-dependency/scope checks.

Tests SHALL prove absence of framework middleware, production exporters/transports, collectors, brokers, queues, outboxes, storage, SIEM, analytics/detection, browser telemetry, production instrumentation, cryptographic chaining, and general diagnostic logging. Test success SHALL NOT constitute owner approval, production authorization, or real-user processing authorization.

#### Scenario: Complete verification runs in CI
- **WHEN** the SDK-core verification command runs from a clean checkout with supported tools
- **THEN** every required test layer passes, generated files are current, package exports are valid, and exact scope checks find no prohibited production implementation

#### Scenario: Production dependency is introduced
- **WHEN** package metadata or source imports introduce a transport, framework, queue, storage, telemetry exporter, SIEM, or instrumentation dependency
- **THEN** no-production-scope checks fail the change

### Requirement: SDK approval and authorization remain exact-commit governed
Implementation completion SHALL NOT itself approve the SDK. A review packet SHALL identify the exact implementation commit, contract version and Contract Commit A binding, generated types, package API, validation behavior, context and transaction semantics, dependencies, tests, unresolved decisions, and assurance limitations. The project owner SHALL record an explicit final SDK-core decision against the exact reviewed commit after findings are resolved and verification is rerun.

SDK-core approval MAY authorize publication or reuse of the package as a design and implementation artifact only if the decision says so. It SHALL NOT authorize production deployment, production event collection, real-user data processing, framework instrumentation, collectors/transports, queue/outbox infrastructure, storage, SIEM integration, analytics, or production delivery policy. AI review, checked tasks, PR state, or informal messages SHALL NOT constitute owner approval.

#### Scenario: Technical tests pass before owner decision
- **WHEN** all SDK-core implementation and verification tasks pass but no exact-commit owner decision exists
- **THEN** the implementation is technically reviewable but remains unapproved and unauthorized for production or real-user use

#### Scenario: Owner approves SDK core with production exclusions
- **WHEN** the project owner explicitly approves the exact reviewed SDK-core commit for reusable package work
- **THEN** the record preserves every stated production and real-user-data exclusion and does not authorize later framework or delivery changes

#### Scenario: Reviewed implementation changes after approval
- **WHEN** a later commit changes public API, generated types, validation, authority/privacy behavior, sink semantics, dependencies, tests, or authorization boundaries
- **THEN** the owner must explicitly reconfirm the new exact commit before the SDK-core decision can apply
