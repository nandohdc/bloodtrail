# security-audit-sdk-core Specification

## Purpose
Defines the observable behavior and safety boundaries of the framework-independent Bloodtrail Node.js and TypeScript core SDK that constructs and validates Security Audit Event Contract version 1.0.0 records without implementing production delivery or application instrumentation.

## Requirements

### Requirement: SDK package has an explicit supported runtime and public surface

The SDK package SHALL publish an explicit supported Node.js runtime policy, module format policy, strict TypeScript compiler baseline, package export map, and public API compatibility policy. Only documented public exports SHALL be treated as supported; internal generated, validation, and implementation modules SHALL NOT be reachable through undocumented package subpaths.

The package SHALL initialize from an immutable configuration snapshot and SHALL reject invalid or incomplete configuration before accepting event construction or emission. Configuration SHALL identify contract version `1.0.0`, producer, service, environment, deployment, authoritative-context providers, clock and identifier providers, validation policy, registered transformation hooks, and sink.

After a passing producer-to-collector vertical-slice evidence record exists, the package's complete public export surface — every runtime value export and every type-only export declared by the package's entry point — SHALL be frozen: recorded as an explicit, versioned list referencing the exact evidence commit it depends on, and mechanically checked on every verification run. An addition, removal, or rename of any export, hand-authored or generated, SHALL fail that check unless the frozen list is updated in the same governed change. No frozen export name SHALL be a Node-runtime-specific symbol; Node-specific implementations SHALL remain exclusively in the Node platform binding package.

#### Scenario: Supported runtime imports the package
- **WHEN** a consumer running a documented Node.js and TypeScript configuration imports each public package entry point
- **THEN** the package resolves with the documented types and runtime exports and exposes no internal generated or validator subpath

#### Scenario: Unsupported contract version is configured
- **WHEN** initialization requests a schema or contract version other than `1.0.0`
- **THEN** initialization fails with a safe unsupported-version error before any event can be emitted

#### Scenario: Configuration object is mutated after initialization
- **WHEN** caller code mutates the original configuration object after successful initialization
- **THEN** SDK behavior remains bound to the validated immutable snapshot and does not adopt the mutation

#### Scenario: The frozen surface is explicit, versioned, and evidence-bound
- **WHEN** the package's public-surface freeze record is inspected
- **THEN** it names an explicit, version-controlled list of every value and type-only export and the exact commit of the vertical-slice evidence the freeze depends on

#### Scenario: An unapproved export mutation is rejected
- **WHEN** a disposable mutation adds, removes, or renames any export from the package's entry point without updating the frozen list
- **THEN** the public-surface check fails closed and names the unapproved or missing export

#### Scenario: The frozen surface contains no Node-specific symbol
- **WHEN** the frozen export list is inspected
- **THEN** no entry is a Node-runtime-specific symbol, and every Node-specific implementation is found only in the Node platform binding package

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

### Requirement: Dependency verification inspects module imports in shipped artifacts

Dependency verification SHALL inspect every shipped JavaScript and TypeScript artifact and SHALL classify every module specifier the artifact references, in ESM import and export positions and in CommonJS `require()` position.

A specifier SHALL be permitted only when it is relative to the artifact, an approved Node built-in for that artifact's role, a declared runtime dependency of the package, or a self-reference whose subpath is a declared package export. Every other specifier SHALL fail verification, including a specifier that is not a literal string and a Node built-in referenced without its `node:` prefix.

Verification SHALL fail when it inspects no shipped artifact, SHALL fail when a shipped artifact cannot be read, and SHALL fail when the parser cannot return a syntax tree. A returned syntax tree is error-tolerant and does not establish syntax validity; syntax validation remains the responsibility of the build, typecheck, and runtime gates.

Diagnostics SHALL name the artifact path, the module specifier, and the violated class, SHALL be bounded in count and length, and SHALL NOT include artifact source content.

#### Scenario: Approved shipped output passes
- **WHEN** dependency verification inspects the built package whose shipped artifacts reference only approved Node built-ins, declared package exports, and relative modules
- **THEN** verification passes and reports the number of artifacts and specifiers inspected

#### Scenario: Undeclared external module is rejected
- **WHEN** a shipped artifact requires `ajv/dist/runtime/ucs2length` while the package declares no runtime dependencies
- **THEN** verification fails and the diagnostic names that artifact and that module

#### Scenario: Declared runtime dependency is accepted
- **WHEN** a shipped artifact imports a module whose package is declared in the package manifest's runtime dependencies
- **THEN** verification accepts that specifier as a declared dependency

#### Scenario: Bundled module contributes no specifier
- **WHEN** a shipped artifact embeds third-party code instead of importing it
- **THEN** the artifact contributes no external specifier and verification passes

#### Scenario: Unprefixed or unapproved built-in is rejected
- **WHEN** a shipped artifact references a Node built-in without the `node:` prefix, or references a built-in that is not approved for that artifact's role
- **THEN** verification fails and names the artifact and the module

#### Scenario: Dynamic specifier is rejected
- **WHEN** a shipped artifact calls `import()` or `require()` with an argument that is not a literal string
- **THEN** verification fails and reports the artifact and the unclassifiable import form

#### Scenario: Empty inspection set fails closed
- **WHEN** dependency verification finds no shipped JavaScript or TypeScript artifact to inspect
- **THEN** verification fails rather than reporting a pass

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

### Requirement: Archive movement verification survives history rewriting

Archive-movement verification SHALL NOT depend on the movement baseline remaining present in
branch history. The repository's normal merge workflow may replay a branch as a single commit, which
removes the intermediate state that a re-derived comparison requires.

Movement exactness SHALL be recorded as an attestation identifying the source revision it was
verified against and, for every archived path, the expected file mode and content object. The
attestation SHALL be recorded at the point the movement is verified, while the source revision is
still reachable.

Verification SHALL resolve its comparison baseline by a two-path strategy. When the attested source
revision is resolvable and still contains the active change, verification SHALL re-derive the
comparison from history. When that revision is unreachable, verification SHALL compare the archive
against the attestation. Verification SHALL report which path it used.

Fallback to the attestation SHALL be triggered only by an unresolvable source revision. A resolvable
source revision whose content differs from the archive SHALL fail, and SHALL NOT be treated as a
reason to use the attestation, so that tampering cannot downgrade the check.

Under either path, verification SHALL continue to reject an altered archived file, a changed file
mode, an added or removed archived path, and a `tasks.md` differing from its source by more than the
permitted merge-and-archive checkbox transitions. [F-04]

#### Scenario: Movement baseline is squashed away
- **WHEN** the commit that carried the active change has been replaced by a squash merge and is no
  longer an ancestor of the branch head
- **THEN** verification compares the archive against the attestation, passes for an unmodified
  archive, and reports that it used the attested path

#### Scenario: Movement baseline is still present
- **WHEN** the attested source revision is resolvable and still contains the active change
- **THEN** verification re-derives the comparison from history, and reports that it used the
  re-derived path

#### Scenario: Archive is altered after attestation
- **WHEN** any archived file's content or mode differs from the attestation, or an archived path is
  added or removed
- **THEN** verification fails and names the differing path, under either resolution path

#### Scenario: Resolvable source disagrees with the archive
- **WHEN** the attested source revision is resolvable but its content differs from the archive
- **THEN** verification fails rather than falling back to the attestation

#### Scenario: Archived task state exceeds the permitted transitions
- **WHEN** the archived `tasks.md` differs from its source by anything beyond the permitted
  merge-and-archive checkbox transitions
- **THEN** verification fails, under either resolution path

#### Scenario: Attestation is absent for an archive being created
- **WHEN** an archive is created without a recorded movement attestation
- **THEN** verification fails and requires the attestation to be recorded while the source revision
  is still reachable

### Requirement: Packed package installs and validates with production-only dependencies

The packed SDK artifact SHALL install and function with production-only dependency installation. The generated schema validator SHALL be self-contained, embedding the AJV runtime helper and the AJV-formats validators it uses, and SHALL record the MIT attribution of the bundled AJV and ajv-formats code in its header.

#### Scenario: Production-only install imports both public exports
- **WHEN** a consumer installs the packed tarball with `--omit=dev` and imports both public entry points by package specifier
- **THEN** both entry points resolve through the declared export map with the documented exports and no `MODULE_NOT_FOUND` occurs

#### Scenario: Schema validation works from the consumer installation
- **WHEN** `validateSecurityAuditEvent` is invoked from the production-only consumer install with a valid canonical event, and separately with an event whose timestamp is semantically invalid RFC 3339
- **THEN** the valid event validates and the invalid event is rejected with a bounded diagnostic

#### Scenario: Generated validator is self-contained
- **WHEN** the generated validator artifact is inspected
- **THEN** it contains no `require(` of external modules and carries the bundled-code MIT attribution header

### Requirement: Changed-path verification distinguishes ignored from tracked local instruction files

Changed-path verification SHALL classify local agent-instruction files as unrelated to the governed
change surface, and SHALL NOT fail solely because such a file is tracked in the repository.

A local instruction file that Git ignores SHALL contribute no changed-path record, by standard Git
semantics. A local instruction file that Git tracks SHALL be reported under the unrelated
classification and SHALL NOT be treated as a governed-scope violation.

Verification controls for this behavior SHALL assert the contribution of the file under test rather
than the global absence of a classification. A control SHALL remain able to fail deterministically
if ignore semantics regress, and SHALL NOT be satisfied by suppressing or removing the
classification itself.

#### Scenario: Ignored local instruction file contributes no record

- **WHEN** changed-path verification runs against a repository in which a local instruction file is
  present but excluded by Git ignore rules
- **THEN** the ignored file contributes no changed-path record, and the count of unrelated
  local-instruction records is unchanged from the same repository without that file

#### Scenario: Tracked local instruction file is reported and does not fail verification

- **WHEN** changed-path verification runs against a repository in which a local instruction file is
  tracked
- **THEN** the file is reported under the unrelated local-instruction classification, and
  changed-path verification passes

#### Scenario: Regressed ignore semantics are detected

- **WHEN** a mutation causes an ignored local instruction file to contribute a changed-path record
- **THEN** the verification control fails deterministically and identifies the unexpected record

#### Scenario: Removing the classification does not satisfy the control

- **WHEN** a mutation removes the local-instruction classification so that no such record can ever
  be emitted
- **THEN** the verification control fails, because a tracked local instruction file is no longer
  reported

### Requirement: Package verification proves the packed artifact is complete and fails on an incomplete one

Package verification SHALL pack the package, apply its file allowlist to that same pack output,
install that exact tarball into a disposable consumer with production-only dependency installation,
and import every entry point declared in the package export map by package specifier before
reporting a pass.

Verification SHALL establish that each imported entry point resolves from the disposable consumer's
own installed dependency tree, and SHALL fail when an entry point resolves from anywhere else.

Verification SHALL fail when the packed inventory omits a module the entry points load, and SHALL
fail when a packed artifact references an identifier the packed artifact does not define.
Diagnostics SHALL name the entry point and the unresolved module or identifier, SHALL be bounded in
count and length, and SHALL NOT include artifact source content.

The packed tarball and the disposable consumer SHALL be created outside the package root and SHALL
be removed when verification ends, on both the passing and the failing path.

Verification controls for this behaviour SHALL include a deterministic failing mutation for each
failure class named above, applied to a package copy rather than to the working tree, and SHALL
include an unmutated control that passes in the same harness.

#### Scenario: Approved tarball installs, resolves, and validates
- **WHEN** package verification runs against the built package
- **THEN** the allowlist passes, every declared entry point imports from the disposable consumer's
  own dependency tree, a canonical event validates, and the reported inventory is the same pack
  output the allowlist inspected

#### Scenario: Packed inventory omitting a loaded module is rejected
- **WHEN** the packed inventory excludes a module that a declared entry point loads, while every
  individually required path remains present
- **THEN** verification fails and the diagnostic names the entry point and the unresolved module

#### Scenario: Packed artifact missing a bundled runtime helper is rejected
- **WHEN** a packed artifact references an identifier that the packed artifact does not define
- **THEN** verification fails and the diagnostic names the failing entry point

#### Scenario: Entry point resolved outside the disposable consumer is rejected
- **WHEN** a declared entry point resolves from a dependency tree other than the disposable
  consumer's own
- **THEN** verification fails rather than reporting a pass

#### Scenario: Temporary artifacts are discarded on both paths
- **WHEN** package verification ends, whether it passed or failed
- **THEN** the packed tarball and the disposable consumer are removed, and neither was created
  inside the package root

### Requirement: Scope verification classifies every platform coupling against a declared policy

Scope verification SHALL inspect every code artifact under the SDK source root, including generated
artifacts and artifacts in CommonJS module format, and SHALL classify every module specifier the
artifact references and every identifier the artifact references without binding it in the artifact's
own lexical scope.

Classification SHALL be keyed to the artifact's role, distinguishing authored source from generated
source, and SHALL admit only what a declared coupling policy names for that role: the language
globals available to every role, the host globals declared for that role with the reason each is
admitted, and the module specifiers declared for that role. Identifiers referenced only in type
position SHALL NOT be classified as coupling. Authored source and shipped runtime artifacts under `dist/`
SHALL admit zero host built-in module specifiers.

Verification SHALL fail when it can assign a reference to no declared boundary, SHALL fail when a
source artifact or a directory under the source root cannot be read, SHALL fail when an entry under
the source root is neither a regular file nor a directory, SHALL fail when the parser cannot return
a syntax tree, and SHALL fail when it inspects no artifact. Verification SHALL NOT fail on an
identifier that the artifact binds in its own lexical scope.

Diagnostics for coupling SHALL name the artifact, the identifier or specifier, and the violated
class; SHALL be bounded in count and length; SHALL NOT include artifact source content; and SHALL
remain distinguishable from the production-integration diagnostics this verification already emits.

On the passing path, verification SHALL report the declared coupling inventory it classified, per
role.

The coupling policy bounds which host capabilities the sources use and not where they are used, and
it does not classify member access on host objects. Neither limit is a claim about runtime
portability.

#### Scenario: Declared coupling set passes and is reported
- **WHEN** scope verification runs against the SDK source root as it stands
- **THEN** verification passes and reports, per role, the artifacts inspected, the references
  classified, and the host couplings exercised

#### Scenario: Undeclared host global in authored source is rejected
- **WHEN** an authored source artifact references a host global the policy does not declare for the
  authored role
- **THEN** verification fails and the diagnostic names that artifact and that identifier

#### Scenario: Undeclared host global in generated source is rejected
- **WHEN** a generated source artifact references a host global the policy declares for another role
  but not for the generated role
- **THEN** verification fails and the diagnostic names that artifact and that identifier

#### Scenario: Undeclared module specifier in generated source is rejected
- **WHEN** a generated source artifact references a module specifier the policy does not declare for
  the generated role
- **THEN** verification fails and the diagnostic names that artifact and that specifier

#### Scenario: Locally bound identifier is not coupling
- **WHEN** a source artifact binds an identifier in its own lexical scope whose name matches a host
  global the policy does not declare
- **THEN** verification does not report that identifier as coupling

#### Scenario: Type-position reference is not coupling
- **WHEN** a source artifact references a name only in type position
- **THEN** verification does not report that name as coupling

#### Scenario: Unreadable or unparseable artifact fails closed
- **WHEN** a source artifact cannot be read, or the parser cannot return a syntax tree for it
- **THEN** verification fails rather than skipping that artifact

#### Scenario: Unreadable source directory fails closed
- **WHEN** a directory under the SDK source root cannot be read
- **THEN** verification fails rather than reporting a pass over the artifacts it could still reach

#### Scenario: Uninspectable source entry fails closed
- **WHEN** an entry under the SDK source root is neither a regular file nor a directory
- **THEN** verification fails and names that entry, rather than omitting it from inspection

#### Scenario: Empty inspection set fails closed
- **WHEN** scope verification finds no code artifact under the SDK source root
- **THEN** verification fails rather than reporting a pass

#### Scenario: Production-integration diagnostics remain distinguishable
- **WHEN** a forbidden production-integration filename is added to the SDK source root
- **THEN** verification fails with the existing production-integration diagnostic and emits no
  coupling diagnostic for it

#### Scenario: Shipped runtime artifacts permit zero host builtins
- **WHEN** dependency verification inspects built artifacts in `dist/` against the shipped import policy
- **THEN** runtime artifacts are verified against an empty built-in list (`[]`), rejecting any Node or host module specifiers

#### Scenario: Placement of Node binding code into Core source fails closed
- **WHEN** Node binding source artifacts referencing Node built-in specifiers (`node:buffer`, `node:async_hooks`, `node:crypto`, `node:timers`) or Node host globals are placed under Core `src/`
- **THEN** scope verification fails closed with an undeclared-specifier or undeclared-global diagnostic

#### Scenario: Placement of transport, collector, or browser code into Core fails closed
- **WHEN** artifacts containing transport, collector, or browser filenames, specifiers, or globals are placed under Core `src/`
- **THEN** scope verification fails closed, rejecting forbidden filenames and undeclared couplings

### Requirement: Contract-version support is exact-one per SDK package version

Each SDK package version SHALL support exactly one canonical Security Audit Event Contract version across one indivisible compatibility surface: the compatibility manifest, generated public types, generated validator projection, construction-time contract-version check, and event-validation semantics. Several SDK package versions MAY support the same canonical contract version, but one SDK package version SHALL NOT support several canonical contract versions.

A producer SDK instance SHALL be constructible only for the contract version supported by its package version. Unsupported versions SHALL fail closed before readiness; the SDK SHALL NOT negotiate, coerce, downgrade, fall back, or apply a best-effort interpretation.

Replacing the package's sole supported contract baseline SHALL be classified as SDK compatibility-major even when the canonical contract change is additive and contract-minor. While the package is in private, unpublished `0.x` initial development, any separately authorized release SHALL express that classification through the project's `0.x` versioning policy; this requirement does not itself authorize a release or version change.

A separately authorized collector MAY support an explicitly enumerated finite set of canonical contract versions for migration. Collector support SHALL NOT broaden producer package support or producer SDK instance binding, and this migration allowance SHALL NOT create or authorize a collector, transport, production integration, or real-user processing.

#### Scenario: Package compatibility surface has one contract owner
- **WHEN** an SDK package version declares its canonical contract compatibility
- **THEN** the manifest, generated public types, generated validator projection, construction-time version check, and event-validation semantics are all bound to exactly one canonical contract version

#### Scenario: Several package versions retain the same contract baseline
- **WHEN** multiple SDK package versions preserve the same canonical contract interpretation
- **THEN** each package version may point to that same contract version without permitting any one package version to point to multiple contract versions

#### Scenario: Supported version is bound at construction
- **WHEN** configuration requests the canonical contract version supported by the SDK package version
- **THEN** the producer SDK instance may become ready bound to that exact version without version negotiation or later switching

#### Scenario: Unsupported version fails before readiness
- **WHEN** configuration requests any contract version other than the one supported by the SDK package version
- **THEN** construction fails with a safe unsupported-version error before readiness and no fallback or best-effort interpretation occurs

#### Scenario: Additive contract minor replaces the support baseline
- **WHEN** a future SDK adaptation replaces its sole supported contract version with an additive contract-minor version
- **THEN** the SDK change is classified as compatibility-major without changing the contract change's contract-minor classification or authorizing a package release

#### Scenario: Collector migration support remains separate
- **WHEN** a separately authorized collector is designed to bridge a migration between explicitly enumerated contract versions
- **THEN** its finite support set does not broaden any producer package's exact-one support or any producer instance's exact-version binding

#### Scenario: No collector authorization exists
- **WHEN** no separate collector authorization has been granted
- **THEN** the exact-one producer policy creates no collector, transport, storage, production integration, or real-user processing authority

### Requirement: Authority-brand scope and Core uniqueness are explicit

Authority brands SHALL be recognized only by the registry private to the resolved `context.ts` module copy that minted them. A TypeScript cast, a structurally equivalent plain object, a copied object, or ambient process state SHALL NOT add a value to that registry. Values branded through the same module copy SHALL remain acceptable across SDK instances; instance identity SHALL NOT become an authority discriminator.

A value branded by a different module copy SHALL fail closed and SHALL NOT be accepted as authority. When a diagnostic-only sibling probe observes that the value is branded by another installed module copy, the rejection SHALL carry the distinct bounded duplicate-Core diagnostic `DUPLICATE_AUTHORITY`; otherwise the rejection SHALL carry `AUTHORITY_ESCALATION`. A forged, cast, or cloned value SHALL continue to fail closed with `AUTHORITY_ESCALATION`, never `DUPLICATE_AUTHORITY`. The diagnostic changes only the operator-facing wording: the foreign value is rejected either way, and no global registry, brand sharing, or foreign-authority acceptance SHALL be introduced by it.

Every supported consumer graph produced by the future Core split SHALL resolve Core to exactly one module instance. The Node binding SHALL depend on and re-export Core rather than duplicating `context.ts`. A deliberately duplicated-Core fixture SHALL fail closed, and the identical harness without duplicate Core resolution SHALL pass. The dependency controls for that split SHALL allow only the declared first-party Core runtime dependency and SHALL continue to reject every third-party runtime dependency.

#### Scenario: A cast or plain object attempts authority
- **WHEN** caller code supplies a TypeScript-cast value or hand-written plain object that claims a branded authority type
- **THEN** the value is absent from the module-copy registry, construction fails before sink handoff, and no authority is granted

#### Scenario: Same-copy SDK instances exchange a branded value
- **WHEN** one SDK instance and another SDK instance resolve the same `context.ts` module copy and the first supplies a legitimately branded value to the second
- **THEN** the second instance accepts the value without requiring instance-bound branding or a process-global registry

#### Scenario: Different module copies exchange a branded value
- **WHEN** a legitimately branded value from one resolved `context.ts` module copy is supplied to a second module copy
- **THEN** the second copy fails closed and does not accept the foreign value; the rejection carries the distinct bounded duplicate-Core diagnostic `DUPLICATE_AUTHORITY` when the probe observes the value in another installed copy's registry and `AUTHORITY_ESCALATION` otherwise; either way no authority is granted and no global registry exists

#### Scenario: Supported Core graph has one resolved instance
- **WHEN** a supported consumer graph loads the Node binding and its declared Core dependency
- **THEN** the binding re-exports the one resolved Core `context.ts` module copy and the graph contains one Core module instance

#### Scenario: Duplicate-Core control is exercised
- **WHEN** the #86 fixture deliberately resolves two Core module instances
- **THEN** the duplicate arm fails closed with bounded deduplication remediation while the otherwise identical non-duplicate null-control arm passes

#### Scenario: Runtime dependency allowance is challenged
- **WHEN** the #86 dependency controls inspect a Core-split package graph containing its declared first-party Core dependency and then a third-party runtime dependency mutation
- **THEN** the first-party dependency is accepted only through its exact allowlist entry and the third-party mutation is rejected by both dependency verification and the `lock-runtime-dependencies` coherence rule

### Requirement: Changed-path verification exempts declared contract build-toolchain files

Changed-path verification SHALL treat a protected contract prefix as covering every path
beneath it except those named in a declared build-toolchain exemption list. An exempted
path SHALL remain classified and reported under the event-contract classification, and
SHALL NOT be counted as a violation.

An exemption entry SHALL be an exact repository-relative file path. An entry that names a
directory, contains glob characters, contains path traversal, contains a NUL byte, uses
backslashes, or is absolute SHALL be rejected.

An exemption entry SHALL lie inside a protected contract prefix, and SHALL NOT name a path
declared by the contract provenance manifest, whether as a declared path or beneath a
declared directory. Verification SHALL reject the configuration rather than skip the entry.

The canonical event contract SHALL remain immutable independently of this list: contract
immutability verification SHALL continue to bind every path the provenance manifest
declares, and SHALL NOT consult the exemption list.

#### Scenario: An exempted toolchain file may change

- **WHEN** changed-path verification runs against a repository in which a declared
  build-toolchain exemption file inside a protected contract prefix has been modified
- **THEN** the file is reported under the event-contract classification and changed-path
  verification passes

#### Scenario: A non-exempted contract path still fails

- **WHEN** changed-path verification runs against a repository in which a path inside a
  protected contract prefix that is not on the exemption list has been modified
- **THEN** changed-path verification fails and identifies that path

#### Scenario: An exemption cannot name declared contract content

- **WHEN** an exemption entry names a path the contract provenance manifest declares, or a
  path beneath a declared directory
- **THEN** verification fails and reports that the entry is declared contract content

#### Scenario: An exemption cannot be a directory or a pattern

- **WHEN** an exemption entry names a directory, contains glob characters, contains path
  traversal, or is an absolute path
- **THEN** verification fails and identifies the malformed entry

#### Scenario: An exemption cannot reach outside a protected prefix

- **WHEN** an exemption entry names a path that lies outside every protected contract prefix
- **THEN** verification fails and reports that the entry is outside every protected prefix

### Requirement: Authority-scope formalization is regression-guarded and mutation-sensitive

The SDK verification suite SHALL exercise a matrix of authority-scope arms — `same` (one instance, one module copy), `foreign` (two instances, one module copy), `forged` (cast or plain object claiming a brand), `cloned` (`structuredClone` of a branded value), `copy` (two genuine installed copies), `nested` (nested AsyncLocalStorage scopes), `concurrent` (concurrent scopes), `cleanup` (scope exit), and `null` (unmutated package) — with each arm's expected result recorded before any implementation change. Every arm SHALL carry a null control and demonstrable mutation sensitivity: a test arm whose guarded invariant is violated by a fixture mutation SHALL fail, and no arm that could never fail SHALL be retained. The `foreign` arm's expected result is settled, not pending: values branded through the same module copy SHALL remain acceptable across SDK instances, and the arm SHALL still be shown to fail under a cross-copy fixture mutation.

#### Scenario: Forged arm fails when a cast enters the registry
- **WHEN** a fixture mutation makes a TypeScript-cast plain object appear in the module-copy registry
- **THEN** the `forged` arm test fails and the suite reports the arm, and the unmutated `null` arm continues to pass

#### Scenario: Foreign arm is red-able under a cross-copy mutation
- **WHEN** the `foreign` arm fixture is mutated so that two SDK instances resolve different `context.ts` module copies
- **THEN** the arm fails with the cross-copy rejection while the unmutated same-copy two-instance fixture keeps passing

#### Scenario: Every arm has a null control
- **WHEN** the authority-scope matrix runs against the unmutated package
- **THEN** every arm passes, and a mutation of any single arm's guarded invariant fails that arm without changing any other arm's result

### Requirement: Registry insertion surface is enumerated with both constructor and kind counts

When the authority-scope verification enumerates the insertion surface, it SHALL derive the exported brand-constructor count and the `AuditBrandKind` member count from `src/context.ts` itself and SHALL assert **both** counts: exactly 35 exported brand constructors (`export function` declarations in `src/context.ts`, the same counting method as ADR 0010 F3) and exactly 19 `AuditBrandKind` union members. Adding or removing a constructor or a kind without updating the enumeration SHALL fail the suite loudly, and the two counts SHALL NOT be conflated.

#### Scenario: Constructor surface drifts
- **WHEN** an exported function is added to or removed from `src/context.ts` without the enumeration control being updated
- **THEN** the enumeration control fails and names the drifted constructor count

#### Scenario: Brand kind union drifts
- **WHEN** a member is added to or removed from the `AuditBrandKind` union without the enumeration control being updated
- **THEN** the enumeration control fails and names the drifted kind count

#### Scenario: Unmutated source asserts both counts
- **WHEN** the enumeration control runs against the unmutated `src/context.ts`
- **THEN** it asserts exactly 35 exported brand constructors and exactly 19 `AuditBrandKind` members

### Requirement: Cross-copy rejection is proven with a genuine second installed copy

The `copy` arm SHALL be exercised with two genuinely, independently installed copies of the SDK package — never one module imported twice through aliased resolution — constructed in an isolated `mkdtemp` fixture so sibling verification snapshots of the live package are unaffected. A value branded by one installed copy and supplied to the other copy SHALL fail closed with `DUPLICATE_AUTHORITY` before sink handoff, and the fixture SHALL assert that the two resolved module copies are distinct before claiming rejection evidence. The same diagnostic SHALL apply to a genuine nested duplicate copy resolved deeper inside one consumer graph: sibling and nested duplication SHALL both reject with `DUPLICATE_AUTHORITY`, because nothing observable at the rejection site distinguishes npm-installed duplication from a second loaded copy, and the security decision never changes.

#### Scenario: Two genuine copies exchange a branded value
- **WHEN** a value branded by one genuinely installed package copy is supplied to a second genuinely installed package copy
- **THEN** the second copy rejects the value with `DUPLICATE_AUTHORITY` before sink handoff

#### Scenario: Fixture cannot be satisfied by one module imported twice
- **WHEN** the two-copy fixture resolves the same module instance for both sides
- **THEN** the fixture fails its distinct-copy assertion instead of recording rejection evidence

#### Scenario: Nested duplicate copy receives the same diagnostic
- **WHEN** a value branded by a genuine nested duplicate installed copy is supplied to the consumer-graph copy
- **THEN** the consumer-graph copy rejects the value with `DUPLICATE_AUTHORITY` before sink handoff, and the fixture asserts the two nested copies are distinct before claiming rejection evidence

### Requirement: Duplicate-copy diagnostic is bounded, diagnostic-only, and remediates

On a brand miss — a supplied value the local module copy's registry does not recognize — the SDK SHALL distinguish a duplicate installed copy from a forged value using a diagnostic-only sibling probe. Each resolved copy SHALL register a boolean predicate in an append-only array under `Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1")` on `globalThis`; the local copy SHALL ask only sibling predicates (skipping itself by registration-object identity), SHALL wrap each call in try/catch and coerce every result to boolean, and SHALL select `DUPLICATE_AUTHORITY` when any sibling answers true and `AUTHORITY_ESCALATION` otherwise. The probe SHALL be boolean-only: it SHALL never share registry membership, brands, values, or authority, and a foreign predicate's answer SHALL never grant acceptance — the value is rejected either way. All brand-miss rejection sites SHALL route through one shared decision path, and the `DUPLICATE_AUTHORITY` rejection SHALL keep the bounded shape — code, category, and bounded path only, never caller data — serialized under 512 bytes.

The thrown `SecurityAuditSdkError` for `DUPLICATE_AUTHORITY` SHALL carry the static message "Core resolves to exactly one module instance in any supported consumer graph. A duplicate installed copy branded this value: deduplicate the @bloodtrail/security-audit-sdk-core dependency so a single copy resolves before continuing." `toJSON()` SHALL continue to expose only code, category, and path, and no error class SHALL gain new fields.

#### Scenario: Genuine duplicate copy receives the dedicated diagnostic
- **WHEN** a value branded by another installed copy — a sibling two-copy install or a nested duplicate — is supplied to the local copy and a sibling predicate answers true
- **THEN** the local copy rejects with `DUPLICATE_AUTHORITY`, category "authority", the bounded path, and no caller data, and the serialized error stays under 512 bytes

#### Scenario: Forged, cast, and cloned values keep the escalation diagnostic
- **WHEN** a TypeScript-cast, plain object, or `structuredClone`d value that no sibling registry recognizes is supplied
- **THEN** the local copy rejects with `AUTHORITY_ESCALATION` and emits no `DUPLICATE_AUTHORITY`

#### Scenario: The probe channel cannot become registry sharing or a crash surface
- **WHEN** a foreign predicate throws, returns a non-boolean, or a hostile in-process sibling predicate answers true
- **THEN** the site coerces the answer to boolean and never crashes, the value is still rejected, and no registry membership, brand, value, or authority crosses copies

#### Scenario: The duplicate diagnostic names the invariant and the remediation
- **WHEN** the `DUPLICATE_AUTHORITY` error is serialized
- **THEN** its message names the single-copy invariant — "Core resolves to exactly one module instance in any supported consumer graph" — and the deduplication remediation, and nothing else is added to the error surface

### Requirement: The chosen authority scope is compatibility-classified

The formalization SHALL be classified in `compatibility.json` against `semverClassification` as changing no public API and no runtime behavior: the classification SHALL record the bounded module-copy scope decision, the settled same-copy cross-instance acceptance, and the future obligations owned by #79 (the distinct duplicate-Core diagnostic) and #86 (single-copy Core proof and dependency-gate rescoping) without authorizing either. The formalization SHALL introduce no new SDK error code, and the bounded `AUTHORITY_ESCALATION` shape — code, category, and bounded path only, never caller data — SHALL be preserved.

#### Scenario: Compatibility record states the formalization's impact
- **WHEN** the compatibility classification for the authority-scope formalization is read
- **THEN** it records no public API change, no runtime behavior change, no new error code, and it names #79 and #86 as the owners of the future diagnostic and Core-split proof obligations

#### Scenario: A behavior-changing reclassification is rejected
- **WHEN** a change attempts to reclassify the formalization as a behavioral security tightening or a public API modification
- **THEN** compatibility verification rejects the reclassification because the recorded classification states no runtime or public API change

### Requirement: Platform capabilities are mediated by provider SPIs

The SDK Core SHALL define provider interfaces for host capabilities — identifiers (`AuditIdentifierProvider`), clock (`AuditClock`), byte length (`AuditByteLengthProvider`), timers (`AuditTimerProvider`), and schema runtime (`AuditSchemaRuntime`) — and SHALL NOT import host-specific runtime modules or access host-specific globals directly. Timer handles that support unreferencing (`unref()`) SHALL be treated as an optional capability with graceful observable degradation on hosts lacking process-retention control. The schema runtime SPI SHALL validate canonical event structures without requiring Core to depend on a CommonJS loader or wrapper global.

#### Scenario: Custom platform provider supplies IDs and clock
- **WHEN** initialization configures custom `AuditIdentifierProvider` and `AuditClock` implementations
- **THEN** SDK event construction derives event identifiers, operation identifiers, and timestamps strictly from the configured providers

#### Scenario: Byte length SPI measures payload bounds without Node Buffer
- **WHEN** serialized payload or field values are measured against contract bounds
- **THEN** measurement is performed via the platform byte length SPI or its standard `TextEncoder` fallback without referencing the Node `Buffer` global

#### Scenario: Timer SPI manages shutdown timeouts with optional unref capability
- **WHEN** SDK shutdown timer is registered on a host whose timer handle lacks `unref()`
- **THEN** the timer executes without error and degrades explicitly without failing process exit

#### Scenario: Schema runtime SPI validates canonical event structures
- **WHEN** an event is validated against contract schema definitions
- **THEN** validation is executed through the `AuditSchemaRuntime` SPI interface without requiring CommonJS module resolution in Core

### Requirement: Ambient context is mediated by ContextProvider SPI

The SDK Core SHALL maintain ambient execution context abstraction behind a `ContextProvider` SPI that provides scoped execution, retrieval, restoration, and cleanup. The brand registry, brand kind definitions, and brand validation logic SHALL remain strictly inside Core. The provider SHALL ensure isolation across concurrent asynchronous execution chains, restore prior context upon exiting nested scopes, and return a safe missing-authoritative-context error when required context is absent without fabricating default identity or authorization values.

#### Scenario: ContextProvider manages operation scope and returns current context
- **WHEN** an operation executes within a scope established by the configured `ContextProvider`
- **THEN** event builders retrieve authoritative context from the provider and associate it with constructed events

#### Scenario: Concurrent asynchronous executions maintain isolated context
- **WHEN** two asynchronous operations execute concurrently under different established context scopes
- **THEN** neither operation observes or leaks the other operation's context values

#### Scenario: Exiting nested scope restores enclosing context
- **WHEN** a nested context scope completes execution
- **THEN** the enclosing context scope is restored exactly as it existed prior to entering the nested scope

### Requirement: Single-copy Core invariant is verified by duplicate-Core fixture

In any supported consumer dependency graph, the platform-neutral Core package SHALL resolve to exactly one module instance. Verification SHALL include an automated duplicate-Core fixture proving that when two distinct module copies of Core are present in a consumer graph, branded values exchange fails closed with `AUTHORITY_ESCALATION` before sink handoff. A matching null control SHALL prove that a single deduplicated Core module instance succeeds.

#### Scenario: Duplicate Core instances fail closed before sink handoff
- **WHEN** a branded context value constructed in one Core module copy is presented to an SDK instance in a second Core module copy
- **THEN** verification fails closed with an `AUTHORITY_ESCALATION` rejection before sink handoff

#### Scenario: Single deduplicated Core instance passes verification
- **WHEN** verification executes with a single deduplicated Core module instance
- **THEN** all authority-scope and validation checks pass cleanly with no escalation error

### Requirement: Core maintains zero host couplings and compiles against paper second consumer

The platform-neutral Core package SHALL contain zero imports of Node built-in modules (`node:crypto`, `node:async_hooks`), zero references to Node host globals (`Buffer`), zero third-party runtime dependencies, and no Node engines constraint. Core SHALL compile cleanly against a types-only paper second consumer representing a non-Node host. All 24 canonical catalog events, 24 named event APIs, 35 authority brand constructors, and 19 brand kinds SHALL remain preserved and unshifted.

#### Scenario: Static coupling policy verifies zero Node imports and zero host globals
- **WHEN** the platform coupling policy gate runs against the Core source tree
- **THEN** it verifies zero imports of Node built-ins, zero references to Node host globals, and zero uninspected platform couplings

#### Scenario: Paper second consumer provider types compile against Core
- **WHEN** non-Node host provider implementations for the paper second consumer are type-checked against Core SPIs
- **THEN** TypeScript compilation passes with zero type errors without loosening any Core type constraint

#### Scenario: Pinned catalog event and authority brand counts remain identical
- **WHEN** package public surface verification measures catalog events, named APIs, brand constructors, and brand kinds
- **THEN** exactly 24 catalog events, 24 named event APIs, 35 brand constructors, and 19 brand kinds are asserted
