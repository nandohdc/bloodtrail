## ADDED Requirements

### Requirement: Node binding exposes deterministic single-attempt delivery handoff

The Node binding SHALL provide a deterministic single-attempt delivery handoff for one canonical occurrence. A caller SHALL supply the exchange boundary, and the binding SHALL construct a bounded request descriptor and invoke that boundary exactly once for the attempt; it SHALL NOT open a socket, perform a live-network operation, schedule a retry, reserve queue capacity, or begin shutdown handling. The descriptor SHALL carry the occurrence's unchanged `event.id` and zero-based attempt ordinal `0`, and the outcome SHALL expose one of `acknowledged`, `retryable`, `non_retryable`, or `protocol_error` without claiming delivery beyond a well-formed acknowledgment.

#### Scenario: Accepted response completes one stable attempt
- **WHEN** the supplied exchange boundary returns a well-formed acceptance for a canonical occurrence
- **THEN** the handoff invokes that boundary exactly once and returns `acknowledged` with the original `event.id` and attempt ordinal `0`

#### Scenario: Request construction is bounded and transport-free
- **WHEN** a canonical occurrence is handed off
- **THEN** the binding presents a bounded descriptor containing only the declared HTTP method, path, closed headers, and serialized occurrence body to the supplied exchange boundary without opening a live-network connection

### Requirement: Node binding classifies attempt outcomes fail closed

The Node binding SHALL classify a retryable response, timeout, or transport failure as `retryable`. It SHALL classify a permanent response as terminal `non_retryable`. It SHALL classify a malformed, ambiguous, or unparseable acknowledgment as terminal `protocol_error`, distinct from `non_retryable`, and SHALL never report that outcome as `acknowledged`. These classifications SHALL be deterministic from the supplied exchange outcome and SHALL not expose remote response bodies or connection-error details.

#### Scenario: Retryable exchange outcomes remain retryable
- **WHEN** the supplied exchange boundary reports a retryable response, timeout, or transport failure
- **THEN** the handoff returns `retryable` with the original `event.id` and attempt ordinal `0` and does not schedule another attempt

#### Scenario: Permanent response is terminal non-retryable
- **WHEN** the supplied exchange boundary reports a permanent rejection response
- **THEN** the handoff returns terminal `non_retryable` and does not report acceptance or schedule another attempt

#### Scenario: Malformed acknowledgment fails closed
- **WHEN** the supplied exchange boundary returns a response whose acknowledgment is malformed, ambiguous, or unparseable
- **THEN** the handoff returns terminal `protocol_error`, distinct from `non_retryable`, and never reports the occurrence as acknowledged

### Requirement: Single-attempt handoff preserves Node package and assurance boundaries

The single-attempt handoff SHALL depend only on the Node binding's approved platform capabilities, relative modules, and the declared first-party Core dependency. It SHALL NOT add `node:http`, host `fetch`, third-party transport dependencies, browser transport behavior, retry scheduling, backpressure queues, shutdown draining, collector validation, storage, production delivery infrastructure, real-user processing, durable delivery, or exactly-once claims.

#### Scenario: Handoff remains an injected, synthetic boundary
- **WHEN** package-scope verification and deterministic handoff tests inspect the Node binding
- **THEN** they find no live-network dependency or production transport integration and verify all outcome classes through supplied in-memory exchange results
