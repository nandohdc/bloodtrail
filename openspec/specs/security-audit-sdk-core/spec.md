# security-audit-sdk-core Specification

## Purpose
Defines the observable behavior and safety boundaries of the framework-independent Bloodtrail Node.js and TypeScript core SDK that constructs and validates Security Audit Event Contract version 1.0.0 records without implementing production delivery or application instrumentation.
## Requirements
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
The SDK SHALL define states for uninitialized, ready, shutting down, and shut down. Initialization SHALL be graceful and deterministic; duplicate initialization behavior SHALL be documented and SHALL NOT silently replace immutable authority or sink configuration. Shutdown SHALL stop acceptance of new emissions at a defined point, await or report in-flight sink operations according to a bounded policy, and invoke optional sink flush/shutdown at most once. Concurrent callers MAY share the in-progress shutdown result, but lifecycle operations attempted after the SDK reaches shut down SHALL return `SDK_SHUT_DOWN`.

The core SHALL NOT promise durable handoff during shutdown. Events attempted after shutdown begins SHALL fail with a safe lifecycle error rather than being silently dropped or reported as delivered.

#### Scenario: Emission occurs during shutdown
- **WHEN** shutdown has crossed the documented no-new-emissions boundary and a caller attempts to emit
- **THEN** the SDK returns a safe shutdown error and does not invoke the sink for that event

#### Scenario: Shutdown is called twice
- **WHEN** shutdown has completed and a caller requests shutdown again
- **THEN** the SDK returns `SDK_SHUT_DOWN`, does not duplicate sink shutdown, and does not falsely report delivery

#### Scenario: Flush is called after shutdown
- **WHEN** shutdown has completed and a caller requests flush
- **THEN** the SDK returns `SDK_SHUT_DOWN` and does not invoke the sink again

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

### Requirement: Transactional completion requires unforgeable SDK-issued operation evidence
The SDK SHALL accept transaction-critical completion evidence only through an operation handle issued by `beginOperation()` from the same SDK instance and advanced through sanctioned SDK state-transition methods. Plain `GeneratedOperationContext` values and snapshots SHALL remain observational data and SHALL NOT establish trusted commit state when supplied to a named method. Operation evidence SHALL bind operation identity, transaction identity, SDK instance, and allowed event semantics in non-copyable runtime state. Rejected evidence SHALL return a bounded safe error and SHALL NOT invoke the sink. [F-01]

#### Scenario: Plain committed operation object is rejected
- **WHEN** a named transaction-critical success method receives a plain object asserting committed state and caller-selected operation and transaction identifiers
- **THEN** the SDK returns a safe operation-evidence error and the sink receives no event

#### Scenario: Copied legitimate snapshot is rejected
- **WHEN** caller code copies a snapshot from a legitimate SDK-issued operation and supplies the copy to a named transaction-critical success method
- **THEN** the copy does not carry trusted operation evidence and the sink receives no event

#### Scenario: Removing bound event cannot bypass binding
- **WHEN** caller code removes, omits, or modifies `bound_event` in structural operation data derived from a legitimate snapshot
- **THEN** the SDK-private event binding remains authoritative and the attempted mismatched completion is rejected

#### Scenario: Only SDK-issued evidence establishes committed success
- **WHEN** an operation handle issued by the same SDK instance is bound to the named event and is marked committed through the sanctioned trusted transition
- **THEN** the named method may construct committed success using the bound operation and transaction identifiers

#### Scenario: Premature success does not invoke sink
- **WHEN** an SDK-issued operation has not reached committed state and a committed-success method is invoked
- **THEN** the SDK returns a premature-success result and never invokes the sink

#### Scenario: Foreign SDK handle is rejected
- **WHEN** a named method receives an otherwise legitimate operation handle issued by another SDK instance
- **THEN** the SDK rejects the handle as foreign evidence and emits nothing

### Requirement: Terminal completion reservation is atomic and retry-safe
The SDK SHALL atomically reserve a terminal-success transition before awaiting any asynchronous sink execution. At most one concurrent caller for the same SDK-issued operation SHALL invoke the sink for terminal success. Concurrent duplicate callers SHALL receive a bounded duplicate result. An accepted sink result SHALL finalize completion; a rejected, unknown, thrown, or rejected-promise sink result SHALL release the reservation for an explicit caller-controlled retry. The SDK SHALL NOT retry automatically. [F-02]

#### Scenario: Concurrent terminal completion accepts once
- **WHEN** two terminal-success calls for the same committed operation overlap before the sink resolves
- **THEN** at most one call invokes the sink and can return an accepted result

#### Scenario: Concurrent duplicate is bounded
- **WHEN** one terminal-success call holds the operation reservation and a second call arrives
- **THEN** the second call returns `SDK_DUPLICATE_SUCCESS` without event contents or sink invocation

#### Scenario: Accepted terminal completion remains reserved
- **WHEN** the reserved terminal event is accepted by the sink
- **THEN** later terminal-success calls for that operation return the bounded duplicate result

#### Scenario: Sink failure releases reservation
- **WHEN** the reserved terminal event is rejected, unknown, thrown, or rejected by the sink
- **THEN** the caller receives the bounded sink result and a later explicit terminal-success retry may reserve the operation again

#### Scenario: Sink failure interleaving is deterministic
- **WHEN** concurrent terminal callers overlap with a controllably failing sink promise
- **THEN** their results and the final reservation state are independent of scheduling except for which single caller acquired the reservation

### Requirement: Caller-owned providers remain caller-owned
SDK initialization SHALL validate but SHALL NOT clone, recursively freeze, shallow-freeze, decorate, mutate, or replace caller-provided sink, clock, identifier, or related provider objects or their nested state. The SDK SHALL preserve provider identity and documented method receiver behavior while keeping SDK-owned scalar and plain-data configuration in an immutable internal snapshot. [F-03]

#### Scenario: Class-based sink remains unfrozen
- **WHEN** initialization receives a class-based sink with enumerable mutable state
- **THEN** neither the sink nor its nested state is frozen by the SDK

#### Scenario: Sink-owned queue remains mutable
- **WHEN** a caller-owned buffering sink appends to its own queue after SDK initialization
- **THEN** the queue mutation succeeds and normal sink delivery remains possible

#### Scenario: Clock provider remains caller-owned
- **WHEN** initialization receives a stateful clock provider
- **THEN** the SDK preserves its identity, mutability, and method receiver without modifying it

#### Scenario: Identifier provider remains caller-owned
- **WHEN** initialization receives a stateful identifier provider
- **THEN** the SDK preserves its identity, mutability, and method receiver without modifying it

#### Scenario: SDK configuration remains immutable
- **WHEN** caller code mutates the original plain-data configuration after initialization
- **THEN** SDK-owned configuration behavior remains bound to its validated immutable snapshot while provider ownership is preserved

### Requirement: Canonical verification is lifecycle-aware and reproducible
The SDK canonical verification SHALL provide explicit active-change and archived/governed modes. Active mode SHALL validate the named active change and pre-implementation task state. Archived mode SHALL validate the canonical SDK capability and dated archived evidence, including governed post-approval task states. Scope verification SHALL compare remediation-owned changes from a relevant synchronized baseline and SHALL NOT fail because of unrelated earlier repository history. Both modes SHALL reject real SDK, canonical contract, capability, provenance, and governance drift through differential mutation tests. [F-04]

#### Scenario: Canonical verification passes on archived state
- **WHEN** canonical verification runs from a clean checkout of the reviewed archived repository state
- **THEN** archived mode resolves canonical and archived evidence without requiring the deleted active SDK change

#### Scenario: Active change mode validates active remediation
- **WHEN** active mode targets `remediate-security-audit-sdk-adversarial-review`
- **THEN** strict change validation, active task state, capability delta, and authorized path checks use that active change

#### Scenario: Archived mode validates canonical and archived evidence
- **WHEN** archived mode runs after a governed SDK change is archived
- **THEN** it validates the canonical `security-audit-sdk-core` capability and the immutable dated archive as distinct evidence

#### Scenario: Archived governance accepts completed task state
- **WHEN** archived evidence contains post-approval completed technical and governance tasks
- **THEN** archived mode accepts the lifecycle-consistent state without requiring pre-approval pending wording

#### Scenario: Unrelated repository history is ignored
- **WHEN** unrelated repository changes precede or accompany the package-local remediation baseline without modifying protected SDK, contract, capability, or governance paths
- **THEN** package-local scope verification does not fail because of those unrelated paths

#### Scenario: Package drift is rejected
- **WHEN** a disposable verification mutation changes protected SDK behavior or metadata
- **THEN** canonical verification fails with a bounded rule identifier

#### Scenario: Contract drift is rejected
- **WHEN** a disposable verification mutation changes the canonical event-contract source or protected contract evidence
- **THEN** canonical verification fails rather than adapting the SDK silently

#### Scenario: Governance drift is rejected
- **WHEN** active or archived task state, exact-commit binding, capability evidence, or lifecycle metadata contradicts its selected mode
- **THEN** canonical verification fails with reproducible evidence

### Requirement: Hostile public input failures are safely classified
Public configuration and authority constructors SHALL catch clone, property-access, getter, proxy, and non-cloneable input failures at their trust boundaries and map them to documented bounded SDK errors. Raw caller exceptions, `DOMException`, `DataCloneError`, messages, stacks, and rejected values SHALL NOT escape or appear in diagnostics. Serialization failure SHALL use a semantically distinct safe error from successful serialization that exceeds a field-size limit. [F-05, F-12]

#### Scenario: Function input returns safe error
- **WHEN** a public constructor receives a function where cloneable data is required
- **THEN** it returns the documented invalid-input error without exposing the function or raw clone exception

#### Scenario: Symbol input returns safe error
- **WHEN** a public constructor receives a symbol where cloneable data is required
- **THEN** it returns the documented invalid-input error without exposing the symbol

#### Scenario: Hostile getter exception is normalized
- **WHEN** reading constructor input invokes a getter that throws a distinctive caller exception
- **THEN** the SDK returns a bounded safe error and the distinctive value, message, and stack do not escape

#### Scenario: Proxy failure is normalized
- **WHEN** constructor input is a proxy whose access or clone traps fail
- **THEN** the SDK returns a bounded safe error and no raw proxy exception escapes

#### Scenario: Non-cloneable input is normalized
- **WHEN** constructor input contains a non-cloneable platform or caller value
- **THEN** the SDK returns a documented safe error rather than a raw `DOMException` or `DataCloneError`

#### Scenario: BigInt is not a size error
- **WHEN** validation encounters `BigInt` or another value that cannot be serialized by the required size-measurement representation
- **THEN** it returns `FIELD_SERIALIZATION_FAILED` or its documented equivalent and not `FIELD_LIMIT_EXCEEDED`

#### Scenario: Actual size violation remains distinct
- **WHEN** a serializable value exceeds its canonical byte limit
- **THEN** validation returns `FIELD_LIMIT_EXCEEDED` without echoing the value

### Requirement: Scope and public API guardrails prove the forbidden and required surfaces
Static verification SHALL reject forbidden production-integration tokens in root-level and nested source filenames using path-segment and delimiter boundaries without false rejection of allowed names. The SDK implementation SHALL structurally satisfy its public named API at compile time, and runtime verification SHALL prove that every one of the 24 generated named methods exists and is callable. Differential mutation tests SHALL prove deletion or forbidden-name mutations fail. [F-06, F-09]

#### Scenario: Root-level forbidden filename is rejected
- **WHEN** a disposable mutation adds `src/transport.ts`, `src/browser.ts`, `src/collector.ts`, `src/exporter.ts`, or `src/siem.ts`
- **THEN** scope verification fails for each forbidden root-level token

#### Scenario: Nested forbidden filename is rejected
- **WHEN** a forbidden token appears as a bounded nested source filename or path segment
- **THEN** scope verification fails independently of path depth

#### Scenario: Delimiter-separated forbidden filename is rejected
- **WHEN** a forbidden token is separated by dot, underscore, hyphen, slash, or filename boundaries
- **THEN** scope verification fails

#### Scenario: Allowed filename is not falsely rejected
- **WHEN** an allowed filename merely contains similar letters without a forbidden token boundary
- **THEN** scope verification passes that filename

#### Scenario: Implementation structurally satisfies public interface
- **WHEN** strict TypeScript checks the concrete SDK implementation
- **THEN** the implementation is assignable to the complete public SDK and generated named-method interface without an unchecked completeness cast

#### Scenario: All generated methods are callable
- **WHEN** runtime verification enumerates all 24 generated method definitions against a constructed SDK
- **THEN** every corresponding public property is a callable named method

#### Scenario: Deleting a named method fails
- **WHEN** a disposable mutation removes any generated named method from the concrete implementation
- **THEN** compilation or canonical verification fails even though generated metadata still lists 24 methods

### Requirement: Shutdown timeout does not retain process lifetime
The shutdown timeout SHALL NOT keep the Node.js process alive after clean shutdown work settles. The SDK SHALL clear the timer after either race outcome and SHALL unreference it where supported. A genuinely stalled shutdown SHALL still produce the documented bounded timeout result, and optional sink lifecycle methods SHALL remain at-most-once. [F-07]

#### Scenario: Clean shutdown does not delay process exit
- **WHEN** a child process performs an immediately successful shutdown with a longer configured timeout
- **THEN** the process can exit after shutdown completion without waiting for the timeout duration

#### Scenario: Shutdown timer is disposed
- **WHEN** clean shutdown wins the bounded race
- **THEN** the timeout is cleared and does not remain as referenced process work

#### Scenario: Genuine stall reaches timeout
- **WHEN** in-flight sink work remains unresolved beyond the configured bound
- **THEN** shutdown returns the documented bounded unknown or failure result without claiming durable handoff

#### Scenario: Timeout cleanup preserves at-most-once lifecycle
- **WHEN** timeout and sink completion race near the boundary
- **THEN** flush and shutdown hooks are not duplicated and the timer is disposed after settlement

### Requirement: SDK identity and deduplication storage is bounded
Generated event-ID and issued operation-ID reuse detection SHALL use documented SDK-instance-local count-bounded FIFO retention stores. Each applicable primitive identity history SHALL default to 4,096 retained identities and MAY be configured to another supported positive safe-integer capacity up to 100,000. A distinct insertion at capacity SHALL evict the oldest retained primitive identity and SHALL NOT grow the history beyond its configured bound. Duplicate or reuse detection SHALL apply while an identity remains retained; after FIFO eviction, that identity is outside the SDK instance's local duplicate-knowledge horizon and MAY be accepted again if every other validation, authority, lifecycle, and sink rule passes. The SDK SHALL NOT claim a guaranteed 24-hour retention period, durable replay prevention, distributed or cross-process deduplication, or restart-resistant identity history. Terminal-operation state SHALL be weakly keyed to SDK-issued handles so it does not retain abandoned handles, and redelivery SHALL NOT consume generated-identity history or corrupt unrelated operation state. [F-08]

#### Scenario: Default bounded retention
- **WHEN** a default SDK instance records generated event IDs and issued operation IDs
- **THEN** each applicable primitive identity history is bounded by the documented 4,096-entry default capacity

#### Scenario: Configured bounded retention
- **WHEN** a valid configured retention capacity is supplied for generated event IDs or issued operation IDs
- **THEN** the corresponding identity history honors that capacity exactly and remains at or below it

#### Scenario: Maximum configuration validation
- **WHEN** a configured retention capacity is greater than 100,000
- **THEN** SDK initialization fails with the existing bounded invalid-configuration error at the applicable retention path

#### Scenario: FIFO eviction
- **WHEN** a distinct identity is inserted while the applicable identity history is already at capacity
- **THEN** the oldest retained identity is evicted before newer retained identities, and membership reads or duplicate insertions do not refresh age

#### Scenario: Deduplication inside the retained horizon
- **WHEN** a generated event ID, issued operation ID, or terminal operation completion is reused while it remains retained by its applicable SDK-local history or live handle state
- **THEN** the SDK rejects the duplicate according to its existing event-ID, operation-ID, or terminal-completion rule

#### Scenario: Behavior after eviction
- **WHEN** a generated event ID or issued operation ID is reused only after FIFO eviction from the applicable primitive identity history
- **THEN** the SDK treats that identity as outside SDK-local duplicate knowledge and applies all remaining validation, authority, lifecycle, and sink rules without claiming durable replay prevention

#### Scenario: Independent identity histories
- **WHEN** generated event-ID history, issued operation-ID history, and terminal-operation state are exercised under unrelated traffic
- **THEN** each retained identity class remains isolated, operation authority is never granted by a primitive FIFO window, and active or completed live-handle terminal state is not evicted by primitive-history churn

#### Scenario: Redelivery interaction
- **WHEN** public or named redelivery processes a valid complete canonical event
- **THEN** redelivery does not insert generated event IDs, consume issued operation-ID capacity, reserve terminal completion, release terminal completion, or corrupt unrelated generated-ID or operation state

#### Scenario: Memory boundedness under sustained activity
- **WHEN** sustained event and operation activity exceeds configured primitive retention capacities
- **THEN** each primitive retention structure remains within its configured bound and no unbounded identity Set, Map, queue, timer, or durable replay ledger is introduced

#### Scenario: Abandoned operations are not retained
- **WHEN** caller code releases all references to SDK-issued operation handles
- **THEN** terminal reservation and completion tracking does not keep those handles alive solely for SDK deduplication

#### Scenario: Invalid retention capacity
- **WHEN** retention configuration contains zero, negative, non-integer, non-finite, accessor-backed, unknown-key, non-plain-object, or otherwise unsupported capacity values
- **THEN** SDK initialization fails deterministically with the existing bounded invalid-configuration error at `/retention` or the applicable nested retention path

### Requirement: Transformation-path compatibility is validated during initialization
SDK initialization SHALL accept transformation hooks only for field-policy paths that the SDK can actually transform. A policy-eligible but unsupported path SHALL fail construction with a safe bounded configuration error before any event can be emitted. Valid supported paths SHALL preserve existing field policy, hook, prohibited-data, and post-hook validation behavior. [F-10]

#### Scenario: Unsupported transformation path fails initialization
- **WHEN** configuration registers a hook for a policy path the SDK refuses to transform at runtime
- **THEN** SDK construction fails with a bounded invalid-configuration path

#### Scenario: Supported transformation path works
- **WHEN** configuration registers a valid hook for an SDK-transformable policy path
- **THEN** initialization succeeds and valid events can apply the transformation

#### Scenario: Invalid hook cannot create per-event outage
- **WHEN** transformation configuration is incompatible
- **THEN** no SDK instance is returned and callers do not encounter `SDK_HOOK_FAILURE` on every later event

### Requirement: Public complete-event APIs carry explicit delivery intent
The SDK SHALL distinguish public generic emission from public pure redelivery with closed internal delivery intents. `emit(event)` SHALL select `generic_emit`; `redeliver(event)` SHALL select `pure_redelivery`; ordinary named construction SHALL select `named_execution`; and a named method receiving `redelivery.event` SHALL select `named_redelivery`. The intent mechanism SHALL remain internal and SHALL NOT alter a public signature or root export. [F-11]

#### Scenario: Generic emission and pure redelivery remain distinct
- **WHEN** a trusted caller submits the same complete canonical event once through `emit(event)` and once through `redeliver(event)`
- **THEN** both calls validate and hand off the complete event while selecting `generic_emit` and `pure_redelivery` respectively

#### Scenario: Named paths select their declared intents
- **WHEN** a caller invokes an ordinary named method and then invokes that method with `redelivery.event`
- **THEN** the SDK selects `named_execution` for the constructed occurrence and `named_redelivery` for the supplied complete event

### Requirement: Pure redelivery revalidates a complete canonical event
`redeliver(event)` SHALL accept a complete canonical `SecurityAuditEvent` from a trusted caller without requiring same-object, same-process, or same-instance provenance. Each explicit call SHALL rerun bounded input normalization, prohibited-data checks, canonical schema validation, and semantic validation before sink handoff. Invalid input SHALL return the applicable existing validation or privacy code and SHALL NOT invoke the sink. [F-11]

#### Scenario: A complete clone or foreign-instance event is valid input
- **WHEN** `redeliver()` receives a structurally complete canonical event, including a clone or an event created by another SDK instance
- **THEN** the SDK validates it and invokes the sink once if every canonical check passes

#### Scenario: Invalid complete-event input is rejected for its concrete defect
- **WHEN** the submitted value is unsafe, structurally invalid, prohibited, or semantically invalid
- **THEN** the SDK returns the applicable existing code such as `SDK_INVALID_INPUT`, `FIELD_SERIALIZATION_FAILED`, `SDK_SCHEMA_VALIDATION_FAILED`, `PROHIBITED_DATA`, or a canonical semantic code and invokes no sink

### Requirement: Pure redelivery preserves event identity and canonical time
A valid pure redelivery SHALL preserve `event.id`, `event.timestamp`, and `event.observed_at` exactly. It SHALL NOT reconstruct occurrence or observation time and SHALL NOT assign a new event identity. [F-11]

#### Scenario: Identity and timestamps remain unchanged
- **WHEN** a valid complete event is explicitly redelivered
- **THEN** the sink receives the same event ID, occurrence timestamp, and observation timestamp as the submitted canonical event

### Requirement: Pure redelivery preserves all canonical metadata
A valid pure redelivery SHALL preserve event name, category, action, lifecycle, outcome, commit state, delivery class, schema name/version, producer and environment context, correlation and causation, retry metadata, operation and transaction metadata, and every other canonical field. Validation MAY create an SDK-owned normalized immutable value for the sink, but the SDK SHALL NOT mutate or freeze the caller's object. [F-11]

#### Scenario: Complete canonical content is preserved without caller mutation
- **WHEN** a caller submits a mutable complete canonical event to `redeliver()`
- **THEN** the sink receives canonically equal content and the caller's object remains byte-equivalent, mutable, and unfrozen

### Requirement: Redelivery invokes no construction dependencies or transformations
Public and named redelivery SHALL NOT invoke identifier providers, the clock, context reconstruction, or configured privacy transformation hooks. Ordinary named execution SHALL retain its valid configured transformation behavior. [F-10, F-11]

#### Scenario: Redelivery preparation counters remain unchanged
- **WHEN** valid public and named redelivery calls execute with counting identifier, clock, and transformation collaborators
- **THEN** only the sink count changes and every identifier, clock, and hook count remains unchanged

#### Scenario: Named execution retains transformation behavior
- **WHEN** the same SDK performs a valid ordinary named execution with an accepted F-10 transformation
- **THEN** the transformation runs under the existing policy and the constructed event receives a new identity and canonical time

### Requirement: Redelivery does not mutate generated history or terminal completion
Public and named redelivery SHALL NOT insert an event ID into F-08 generated-ID history and SHALL NOT reserve, complete, release, or otherwise alter F-02 terminal-completion state. A named redelivery SHALL return from the redelivery branch before named-execution identifier insertion and terminal reservation. [F-01, F-02, F-08, F-11]

#### Scenario: Retention state is unchanged
- **WHEN** a caller redelivers valid complete events before and after bounded FIFO history churn
- **THEN** generated-event and issued-operation history sizes and contents change only through ordinary generation or operation issuance, not through redelivery

#### Scenario: Redelivery neither consumes nor releases completion authority
- **WHEN** a valid named redelivery is performed with an exact authorized operation handle before or after accepted terminal execution
- **THEN** the redelivery may invoke the sink but leaves the handle's reservation/completion state unchanged

### Requirement: Named redelivery validates fixed catalog and schema metadata
A named method receiving `redelivery.event` SHALL validate the complete canonical event and enforce the method's fixed event name, category, action, delivery class, and the canonical schema name/version. Catalog metadata mismatch SHALL use `UNKNOWN_CATALOG_VALUE`; schema identity/version mismatch SHALL use `UNSUPPORTED_SCHEMA_VERSION`; no mismatched event SHALL reach the sink. [F-11]

#### Scenario: Wrong named-method metadata is rejected
- **WHEN** `authenticationSucceeded({ redelivery: { event } })` receives an event with a different fixed event name, category, action, or delivery class
- **THEN** the SDK returns `UNKNOWN_CATALOG_VALUE` at the applicable canonical path and invokes no sink

#### Scenario: Wrong schema identity is rejected
- **WHEN** a named redelivery event carries a noncanonical schema name or version
- **THEN** the SDK returns `UNSUPPORTED_SCHEMA_VERSION` and invokes no sink

### Requirement: Named redelivery preserves exact operation and correlation binding
When a named redelivery supplies an operation handle, the SDK SHALL retain F-01 exact same-instance SDK-issued handle authority, enforce immutable method/event binding, and require the event's operation, transaction, and correlation identifiers to equal the private operation snapshot. A mismatch SHALL return `SDK_OPERATION_EVENT_MISMATCH` at the applicable operation or correlation path and SHALL NOT invoke the sink. [F-01, F-11]

#### Scenario: Matching authorized binding is accepted
- **WHEN** a valid complete event's operation, transaction, and correlation identifiers match an exact SDK-issued handle bound to the invoked method
- **THEN** named redelivery validates and invokes the sink without rebuilding the event

#### Scenario: Method or identifier binding mismatch is rejected
- **WHEN** the handle is bound to another method or the event's operation, transaction, or correlation identifier differs from the private snapshot
- **THEN** the SDK returns `SDK_OPERATION_EVENT_MISMATCH` at the deterministic mismatch path and invokes no sink

### Requirement: Repeated explicit redelivery remains caller-controlled
The SDK SHALL invoke the sink exactly once for every valid explicit public or named redelivery call. It SHALL NOT retain an event-provenance ledger, suppress a repeated call as a duplicate, or perform an additional automatic call. [F-08, F-11]

#### Scenario: Repeated calls each hand off once
- **WHEN** a trusted caller explicitly redelivers the same complete canonical event five times
- **THEN** the sink is invoked exactly five times with preserved identity and no redelivery-owned state growth

### Requirement: Retry and re-execution create a new occurrence identity
A retry or re-execution through a named method SHALL remain `named_execution`, SHALL generate a new event ID distinct from the original event, and SHALL retain exact operation authority plus applicable F-02 terminal reservation/completion behavior. Valid configured transformations SHALL run for the newly constructed occurrence. [F-01, F-02, F-10, F-11]

#### Scenario: Named re-execution receives new identity
- **WHEN** business logic invokes a named method with a valid positive retry relationship to an earlier event
- **THEN** the SDK creates a new event ID, retains the exact authorized operation relationship, runs valid configured transformations, and applies ordinary terminal reservation semantics

### Requirement: Retry causality and attempt limits remain enforced
A positive retry attempt SHALL retain the required `original_event_id` and causation relationship, SHALL reject self-reference, and SHALL not exceed the canonical retry-attempt maximum. Missing or self-referential causality SHALL return `BAD_CAUSALITY`; an attempt above the governed maximum SHALL return `FIELD_LIMIT_EXCEEDED`. [F-11]

#### Scenario: Valid retry relationships are retained
- **WHEN** a named re-execution supplies retry attempt one, the original event ID, and valid causation
- **THEN** the new event preserves those relationship fields while using a distinct event ID

#### Scenario: Invalid retry relationships fail safely
- **WHEN** a positive retry omits original identity, points causation or original identity at its newly generated event ID, or exceeds the maximum attempt
- **THEN** the SDK returns `BAD_CAUSALITY` or `FIELD_LIMIT_EXCEEDED` at the deterministic correlation path and invokes no sink

### Requirement: Every delivery intent retains lifecycle and bounded sink behavior
All four delivery intents SHALL use the existing ready, shutting-down, and shut-down lifecycle and the same bounded sink-result mapping. Sink `rejected` SHALL return `SDK_SINK_REJECTED`; sink `unknown`, synchronous throw, and rejected promise SHALL return `SDK_SINK_FAILURE`; calls crossing the shutdown boundary SHALL return `SDK_SHUTTING_DOWN` or `SDK_SHUT_DOWN` as applicable. Diagnostics SHALL remain bounded and SHALL NOT serialize raw causes, complete events, event IDs, operation/transaction/correlation identifiers, or stacks. [F-02, F-07, F-11]

#### Scenario: Sink outcomes classify identically across intents
- **WHEN** each of the four intents encounters rejected, unknown, synchronously thrown, or rejected-promise sink behavior
- **THEN** each returns the existing deterministic sink code and bounded safe diagnostic with exactly one sink invocation

#### Scenario: In-flight redelivery participates in shutdown
- **WHEN** shutdown begins while a redelivery sink promise is unresolved
- **THEN** shutdown tracks the in-flight call under the existing timeout policy and new calls fail with the applicable lifecycle code

### Requirement: Complete-event redelivery makes no provenance or durability guarantee
The SDK SHALL NOT claim proof of prior durable delivery, broker provenance, same-process origin, same-instance generation, exactly-once delivery, at-least-once delivery, durable deduplication, or durable sink acceptance. An accepted sink result SHALL retain only its existing sink-boundary meaning. [F-11]

#### Scenario: Valid redelivery does not prove prior delivery
- **WHEN** a trusted caller submits a complete canonical event that the current SDK instance did not generate
- **THEN** successful validation and sink acceptance make no claim about that event's origin, prior handoff, durability, or delivery count

### Requirement: F-11 introduces no contract or production-scope expansion
F-11 SHALL preserve Security Audit Event Contract `1.0.0`, package version `0.1.0`, public signatures, root exports, zero runtime dependencies, existing F-08 capacities, and existing F-10 transformation policy. It SHALL add no transport, exporter, collector, broker, queue, persistence, durable ledger, production integration, publication authorization, or production-use authorization. [F-08, F-10, F-11]

#### Scenario: Package and scope surfaces remain unchanged
- **WHEN** F-11 verification inspects contract identity, package metadata, exports, dependencies, retained-state capacities, transformation behavior, package contents, and production-scope guards
- **THEN** only the documented internal intent, named-redelivery validation/binding, focused tests, and documentation corrections are present

### Requirement: Remediation compatibility is explicit and contract-preserving
The remediation SHALL preserve canonical Security Audit Event Contract version `1.0.0` shapes and meanings. Breaking SDK input restrictions, added error codes, corrected error classification, bounded-state configuration, and redelivery behavior SHALL receive package-version and migration assessment. Unsupported contract changes SHALL NOT be introduced through SDK remediation; a genuine canonical defect requires a separate governed event-contract change. [F-01, F-05, F-08, F-11, F-12]

#### Scenario: Existing canonical fixture remains stable
- **WHEN** approved contract `1.0.0` fixtures run through the remediated SDK
- **THEN** their canonical interpretation and expected contract validation result remain unchanged

#### Scenario: Operation API migration is documented
- **WHEN** a caller previously supplied structural operation context to a named method
- **THEN** migration documentation directs the caller to use an SDK-issued operation handle and identifies the compatibility impact

#### Scenario: Error classification migration is documented
- **WHEN** a consumer exhaustively matches public error codes
- **THEN** compatibility documentation identifies added and reclassified safe codes and required consumer updates

#### Scenario: Contract change is blocked
- **WHEN** remediation would require changing canonical event authority, privacy, lifecycle, outcome, or registry meaning
- **THEN** implementation stops until a separate event-contract change is proposed and approved

### Requirement: Adversarial remediation verification and approval are exact-commit governed
The final remediation SHALL run unit, concurrent, compile-time, mutation, compatibility, documentation, package, scope, and clean-state canonical verification on exact supported Node.js 24 and 26 runtimes. F-01, F-02, F-03, and F-04 SHALL remain blockers until executable evidence passes. The final technical commit SHALL receive renewed exact-commit technical review and an explicit project-owner decision before the SDK basis can be relied upon again. AI review, issue closure, checked tasks, or passing tests SHALL NOT constitute owner approval. [F-01 through F-12]

#### Scenario: Full clean-state adversarial regression passes
- **WHEN** the final technical candidate is reconstructed from a clean checkout
- **THEN** every F-01 through F-12 regression and canonical gate passes without using stale build output

#### Scenario: Exact Node runtimes pass
- **WHEN** the canonical suite runs on the exact supported Node.js 24 and 26 versions
- **THEN** both runtime matrices execute non-zero test inventories and pass all required layers

#### Scenario: Blocker lacks executable evidence
- **WHEN** any of F-01, F-02, F-03, or F-04 lacks a passing reproducible regression
- **THEN** release, reliance, merge, and approval readiness remain blocked

#### Scenario: Technical success precedes owner decision
- **WHEN** all technical verification passes but no renewed exact-commit owner decision is recorded
- **THEN** the remediation is technically reviewable but remains unapproved for reliance, production, or publication

#### Scenario: Owner decision binds exact commit
- **WHEN** the project owner reviews the final technical commit and records a decision
- **THEN** the record identifies the exact commit, assurance limitations, unresolved conditions, and all production and publication exclusions

#### Scenario: Reviewed technical substance changes
- **WHEN** a later commit changes reviewed API, security behavior, validation, verification, dependencies, tests, or authorization boundaries
- **THEN** renewed exact-commit review is required before the decision can apply

#### Scenario: Production boundary remains closed
- **WHEN** the remediation is technically complete, reviewed, merged, or archived
- **THEN** production deployment, package publication, framework integration, and delivery infrastructure remain unauthorized unless separately governed and explicitly approved
