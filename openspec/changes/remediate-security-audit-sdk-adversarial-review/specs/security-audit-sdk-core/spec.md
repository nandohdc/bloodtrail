## ADDED Requirements

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
Generated event-ID and issued operation-ID reuse detection SHALL use documented time and count bounds. The default duplicate-protection horizon SHALL be 24 hours with at most 100,000 live entries per identity store. Entries SHALL NOT be evicted before the horizon merely to admit new identifiers; capacity reached inside the horizon SHALL fail closed with `SDK_IDENTITY_CAPACITY_EXCEEDED` or an equivalent documented bounded error. Terminal-operation state SHALL be weakly keyed to SDK-issued handles so it does not retain abandoned handles. Behavior inside and outside the horizon SHALL be deterministic and documented. [F-08]

#### Scenario: Sustained generation remains bounded
- **WHEN** sustained event and operation generation reaches configured identity capacity
- **THEN** live internal identity entries do not exceed the bound and the SDK fails closed rather than growing without limit

#### Scenario: Duplicate protection holds inside horizon
- **WHEN** an event or operation identifier is reused within the configured horizon
- **THEN** the SDK rejects the duplicate even when the store is near capacity

#### Scenario: Capacity does not force early eviction
- **WHEN** all retained identifiers are still inside the horizon and capacity is exhausted
- **THEN** insertion returns the bounded capacity error and no protected entry is silently evicted

#### Scenario: Outside-horizon behavior is deterministic
- **WHEN** an identifier is reused only after its retention horizon has expired
- **THEN** the SDK treats it as outside SDK-local duplicate knowledge according to documented behavior and applies all remaining validation

#### Scenario: Abandoned operations are not retained
- **WHEN** caller code releases all references to SDK-issued operation handles
- **THEN** terminal reservation and completion tracking does not keep those handles alive solely for SDK deduplication

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
