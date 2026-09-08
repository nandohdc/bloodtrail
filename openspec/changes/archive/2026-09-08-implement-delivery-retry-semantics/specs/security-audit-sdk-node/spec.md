## MODIFIED Requirements

### Requirement: Node binding exposes deterministic single-attempt delivery handoff

The Node binding SHALL provide a deterministic single-attempt delivery handoff for one canonical occurrence. A caller SHALL supply the exchange boundary, and the binding SHALL construct a bounded request descriptor and invoke that boundary exactly once for the attempt; it SHALL NOT open a socket, perform a live-network operation, schedule a retry itself, reserve queue capacity, or begin shutdown handling. The descriptor SHALL carry the occurrence's unchanged `event.id` and the caller-supplied zero-based attempt ordinal, defaulting to `0` when omitted, and the outcome SHALL expose one of `acknowledged`, `retryable`, `non_retryable`, or `protocol_error` without claiming delivery beyond a well-formed acknowledgment.

#### Scenario: Accepted response completes one stable attempt
- **WHEN** the supplied exchange boundary returns a well-formed acceptance for a canonical occurrence
- **THEN** the handoff invokes that boundary exactly once and returns `acknowledged` with the original `event.id` and the attempt ordinal used for that call

#### Scenario: Request construction is bounded and transport-free
- **WHEN** a canonical occurrence is handed off
- **THEN** the binding presents a bounded descriptor containing only the declared HTTP method, path, closed headers, and serialized occurrence body to the supplied exchange boundary without opening a live-network connection

#### Scenario: Caller-supplied attempt ordinal is carried into the wire correlation
- **WHEN** a caller invokes the handoff with an explicit zero-based attempt ordinal
- **THEN** the projected request and the result both carry that exact ordinal, the serialized occurrence's `correlation.retry_attempt` matches it, and the occurrence's `event.id` remains unchanged

#### Scenario: Out-of-bounds attempt ordinal is rejected before any exchange
- **WHEN** a caller supplies a negative, non-integer, or over-ceiling attempt ordinal
- **THEN** the handoff rejects the call before invoking the supplied exchange boundary and no request is constructed

### Requirement: Single-attempt handoff preserves Node package and assurance boundaries

The single-attempt handoff module SHALL depend only on the Node binding's approved platform capabilities, relative modules, and the declared first-party Core dependency. It SHALL NOT add `node:http`, host `fetch`, third-party transport dependencies, browser transport behavior, backpressure queues, shutdown draining, collector validation, storage, production delivery infrastructure, real-user processing, durable delivery, or exactly-once claims, and SHALL NOT itself schedule a retry — bounded retry scheduling exists only as a separate composing module governed by a dedicated requirement.

#### Scenario: Handoff remains an injected, synthetic boundary
- **WHEN** package-scope verification and deterministic handoff tests inspect the Node binding
- **THEN** they find no live-network dependency or production transport integration and verify all outcome classes through supplied in-memory exchange results

## ADDED Requirements

### Requirement: Node binding provides bounded, jittered delivery retry scheduling

The Node binding SHALL provide a retry-scheduling module that composes a single-attempt handoff into a bounded delivery attempt sequence for one canonical occurrence. Only an outcome classified `retryable` SHALL cause another attempt to be scheduled; any other terminal outcome SHALL stop scheduling immediately. The module SHALL accept a configured maximum attempt count, SHALL NOT exceed it, and SHALL produce a terminal `exhausted` result carrying an observable attempt counter when the budget is spent without a non-retryable terminal outcome. The delay before each scheduled retry SHALL be a deterministic function of the attempt ordinal, a configured base and maximum delay, and an injected jitter source, computed without reference to real wall-clock time so it is verifiable under a fixed timer provider and jitter source. Each attempt SHALL carry the occurrence's unchanged `event.id` and an incrementing zero-based attempt ordinal.

#### Scenario: Only a retryable outcome schedules another attempt
- **WHEN** the wrapped handoff returns a non-retryable terminal outcome (`acknowledged`, `non_retryable`, or `protocol_error`) at any attempt
- **THEN** retry scheduling stops immediately, returns that terminal outcome, and never schedules a further attempt

#### Scenario: Retry budget is bounded and exhaustion is observable
- **WHEN** the wrapped handoff returns `retryable` for every attempt up to the configured maximum
- **THEN** retry scheduling makes no more than the configured maximum number of attempts and returns a terminal `exhausted` result carrying the number of attempts made

#### Scenario: Delay computation is deterministic and bounded
- **WHEN** retry scheduling computes the delay before a retry attempt
- **THEN** the delay is a capped exponential function of the attempt ordinal scaled by the injected jitter source's value, never exceeds the configured maximum delay, and is reproducible under a fixed timer provider and jitter source without waiting real wall-clock time

#### Scenario: Retried attempts preserve identity and advance wire correlation
- **WHEN** retry scheduling retries an occurrence through the wrapped handoff after a retryable outcome
- **THEN** every attempt carries the occurrence's identical `event.id` and an incrementing zero-based attempt ordinal consistent with the delivery conformance contract's attempt-identity requirement
