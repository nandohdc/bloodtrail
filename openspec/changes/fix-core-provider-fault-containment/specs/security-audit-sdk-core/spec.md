## ADDED Requirements

### Requirement: Injected-provider faults are contained and attributed to the provider

Every result-returning SDK boundary MUST contain injected-provider faults with existing provider-specific diagnostics, never the provider's own error or SDK_INVALID_INPUT. A provider fault MUST NOT reach the sink. Shutdown MUST end in shut_down with bounded work and failure precedence. Schema-runtime failures MUST be sanitized as specified below.

#### Scenario: Provider containment operation allocation
- **WHEN** operationId, transactionId or correlationId throws during beginOperation without that supplied ID
- **THEN** the first fault SHALL return SDK_INVALID_IDENTIFIER / validation at /operation/operation_id, /operation/transaction_id or /operation/correlation_id respectively
- **AND** supplied IDs SHALL bypass their providers

#### Scenario: Provider containment named identifiers
- **WHEN** eventId, operationId or correlationId throws during a named method without a fallback value
- **THEN** the result SHALL be SDK_INVALID_IDENTIFIER / validation at /event/id, /correlation/operation_id or /correlation/correlation_id respectively

#### Scenario: Provider containment clock
- **WHEN** now throws or returns an invalid Date while a named timestamp is omitted
- **THEN** the result SHALL be SDK_INVALID_CLOCK / configuration at /clock

#### Scenario: Provider containment active context
- **WHEN** ContextProvider.get throws in a named method
- **THEN** the result SHALL be SDK_INVALID_CONFIGURATION / configuration at /contextProvider
- **AND** lifecycle and operation authority checks SHALL remain first

#### Scenario: Provider containment schema non-result
- **WHEN** a configured or global schema runtime throws or returns neither explicit ok:true nor a well-formed failure during named execution, named redelivery, emit, redeliver or free validateSecurityAuditEvent
- **THEN** the result SHALL be SDK_INVALID_CONFIGURATION / configuration at /schemaRuntime without a synchronous throw or rejection
- **AND** runtime selection SHALL remain unchanged

#### Scenario: Provider containment sanitized schema diagnostic
- **WHEN** a runtime returns ok:false with error.code in generated SDK_ERROR_CODES or CONTRACT_ERROR_CODES and error.category in configuration, validation, authority, privacy, lifecycle or sink
- **THEN** the result SHALL be rebuilt with failure(code, category, path), passing path only when string, bounding it and dropping every extra field
- **AND** default-runtime failures SHALL remain deep-equal to their previous results

#### Scenario: Provider containment timer arming refusal
- **WHEN** shutdown setTimeout throws or returns undefined or null
- **THEN** shutdown SHALL immediately reach shut_down and return SDK_INVALID_CONFIGURATION / configuration at /timers without draining, flushing or calling sink shutdown
- **AND** any other handle including a number SHALL remain valid, with missing or non-callable unref degrading gracefully

#### Scenario: Provider containment timer cleanup and unref
- **WHEN** an armed timer's unref or clearTimeout throws
- **THEN** bounded shutdown work SHALL finish and the state SHALL be shut_down
- **AND** otherwise successful work SHALL return SDK_INVALID_CONFIGURATION / configuration at /timers, but an earlier SDK_SHUTDOWN_TIMEOUT or SDK_SINK_FAILURE SHALL win
- **AND** sink flush and shutdown SHALL remain at-most-once, concurrent shutdown SHALL remain single-flight, and later shutdown SHALL return SDK_SHUT_DOWN

#### Scenario: Provider containment preserves caller attribution
- **WHEN** caller input has a throwing getter
- **THEN** the named method SHALL retain SDK_INVALID_INPUT / validation at /
- **AND** construction validation SHALL still throw SecurityAuditSdkError, malformed identifiers and clocks SHALL retain their existing diagnostics, and redelivery SHALL invoke neither identifiers nor clock
