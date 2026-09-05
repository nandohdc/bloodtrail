## ADDED Requirements

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
