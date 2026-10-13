# Issue #796

Owning issue: https://github.com/nandohdc/bloodtrail/issues/796

## ADDED Requirements

### Requirement: System default identifiers use host cryptographic UUID v4 randomness

All seven methods of Core's frozen `systemAuditIdentifiers` provider SHALL lazily invoke host
`crypto.randomUUID()` with its correct receiver and return unpredictable, collision-resistant,
lowercase RFC 4122 UUID v4 identifiers. Core SHALL NOT use a static seeded PRNG, Math.random,
counters, time-derived sources, process-ID-derived sources, or insecure fallback, nor intentionally
repeat a default sequence across fresh processes.

#### Scenario: All seven system methods generate cryptographic identifiers
- **WHEN** each of eventId, operationId, correlationId, causationId, requestId, messageId and transactionId is called with host cryptographic UUID support available
- **THEN** every call delegates to host crypto.randomUUID with the host receiver, and the sampled IDs are distinct lowercase RFC 4122 UUID v4 values

#### Scenario: Concurrent fresh processes do not repeat a default sequence
- **WHEN** at least four fresh Node processes concurrently initialize Core without custom identifiers and each generates at least 128 event IDs and 128 operation IDs
- **THEN** all processes successfully generate identifiers, every identifier is a lowercase UUID v4, and no identifier repeats within or across fresh processes in the combined event and operation ID set

#### Scenario: Collision resistance is not absolute lifetime-global uniqueness
- **WHEN** consumers interpret the default identifier guarantee
- **THEN** uniqueness remains probabilistic rather than absolute, and existing bounded reuse detection and causality rules remain unchanged

### Requirement: System identifier construction fails closed without cryptographic UUID support

`resolveProviders()` SHALL validate that host crypto exists and its `randomUUID` is callable when
identifiers are omitted or are exactly the exported `systemAuditIdentifiers` object. Otherwise SDK
construction SHALL throw `SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration",
"/identifiers")` before readiness and before sink emission. This check SHALL NOT invoke any
identifier method or use a weaker fallback. Module import SHALL NOT require host crypto.

#### Scenario: Implicit default rejects absent crypto
- **WHEN** identifiers are omitted and the host crypto object is absent
- **THEN** createSecurityAuditSdk throws SDK_INVALID_CONFIGURATION with category configuration and path /identifiers without calling sink.emit

#### Scenario: Explicit system default rejects absent crypto
- **WHEN** identifiers is explicitly systemAuditIdentifiers and the host crypto object is absent
- **THEN** createSecurityAuditSdk throws SDK_INVALID_CONFIGURATION with category configuration and path /identifiers without calling sink.emit

#### Scenario: Implicit default rejects missing randomUUID
- **WHEN** identifiers are omitted and host crypto exists but randomUUID is missing
- **THEN** createSecurityAuditSdk throws SDK_INVALID_CONFIGURATION with category configuration and path /identifiers without calling sink.emit

#### Scenario: Explicit system default rejects missing randomUUID
- **WHEN** identifiers is explicitly systemAuditIdentifiers and host crypto exists but randomUUID is missing
- **THEN** createSecurityAuditSdk throws SDK_INVALID_CONFIGURATION with category configuration and path /identifiers without calling sink.emit

#### Scenario: Implicit default rejects non-function randomUUID
- **WHEN** identifiers are omitted and host crypto.randomUUID is not a function
- **THEN** createSecurityAuditSdk throws SDK_INVALID_CONFIGURATION with category configuration and path /identifiers without calling sink.emit

#### Scenario: Explicit system default rejects non-function randomUUID
- **WHEN** identifiers is explicitly systemAuditIdentifiers and host crypto.randomUUID is not a function
- **THEN** createSecurityAuditSdk throws SDK_INVALID_CONFIGURATION with category configuration and path /identifiers without calling sink.emit

### Requirement: Custom identifiers remain host-independent and caller-owned

Custom injected identifier providers SHALL require no host crypto capabilities. Core SHALL preserve
their exact object identity and documented method receivers, SHALL perform only existing structural
provider validation at construction, and SHALL NOT probe crypto or invoke identifier methods then.
Deterministic providers SHALL remain usable within existing format, causality and bounded reuse
constraints. Core SHALL NOT freeze, mutate, clone, decorate, or replace caller-owned providers.

#### Scenario: Deterministic custom provider works without crypto
- **WHEN** Core is imported and createSecurityAuditSdk receives a valid deterministic custom provider with host crypto absent
- **THEN** initialization succeeds without host crypto reads or identifier method calls, resolveProviders preserves the exact custom object, and subsequent identifier use yields the expected valid IDs with the provider receiver

## MODIFIED Requirements

### Requirement: Platform capabilities are mediated by provider SPIs

The SDK Core SHALL define provider interfaces for host capabilities — identifiers
(`AuditIdentifierProvider`), clock (`AuditClock`), byte length (`AuditByteLengthProvider`), timers
(`AuditTimerProvider`), and schema runtime (`AuditSchemaRuntime`) — and SHALL NOT import host-specific
runtime modules. Host-specific globals SHALL remain behind declared provider boundaries: the system
identifier implementation in `src/providers.ts` SHALL be permitted to use host Web Crypto
`crypto.randomUUID` only through a providers-only coupling-policy declaration. That exception SHALL
NOT admit crypto in LANGUAGE_GLOBALS or the general authored role, broaden globalThis access, or
allow Node built-in imports. Custom identifiers SHALL remain host-independent. Existing explicitly
declared diagnostic-only and generated-wrapper exceptions SHALL remain unchanged. Timer handles
that support unreferencing (`unref()`) SHALL be treated as an optional capability with graceful
observable degradation on hosts lacking process-retention control. The schema runtime SPI SHALL
validate canonical event structures without requiring Core to depend on a CommonJS loader or
wrapper global.

#### Scenario: Custom platform provider supplies IDs and clock
- **WHEN** initialization configures custom AuditIdentifierProvider and AuditClock implementations
- **THEN** SDK event construction derives event identifiers, operation identifiers, and timestamps strictly from the configured providers

#### Scenario: Byte length SPI measures payload bounds without Node Buffer
- **WHEN** serialized payload or field values are measured against contract bounds
- **THEN** measurement is performed via the platform byte length SPI or its standard TextEncoder fallback without referencing the Node Buffer global

#### Scenario: Timer SPI manages shutdown timeouts with optional unref capability
- **WHEN** SDK shutdown timer is registered on a host whose timer handle lacks unref()
- **THEN** the timer executes without error and degrades explicitly without failing process exit

#### Scenario: Schema runtime SPI validates canonical event structures
- **WHEN** an event is validated against contract schema definitions
- **THEN** validation is executed through the AuditSchemaRuntime SPI interface without requiring CommonJS module resolution in Core

#### Scenario: Host crypto is admitted only in providers
- **WHEN** coupling verification inspects host crypto references in src/providers.ts
- **THEN** it accepts only the declared provider role and reports the exercised host crypto in that role's inventory

#### Scenario: Crypto outside the provider boundary remains forbidden
- **WHEN** any Core artifact other than the provider module references host crypto, or Core imports node:crypto
- **THEN** platform-coupling verification fails, and the diagnostic names the artifact and the crypto identifier or node:crypto specifier respectively
