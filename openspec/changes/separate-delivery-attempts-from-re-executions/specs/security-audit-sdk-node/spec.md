## ADDED Requirements

### Requirement: Node binding exposes a deterministic single-attempt delivery handoff that sends the occurrence unchanged

The Node binding SHALL provide a deterministic single-attempt delivery handoff for one canonical occurrence. A caller SHALL supply the exchange boundary, and the binding SHALL construct a bounded request descriptor and invoke that boundary exactly once for the attempt; it SHALL NOT open a socket, perform a live-network operation, schedule a retry itself, reserve queue capacity, or begin shutdown handling. The descriptor's body SHALL be the canonical JSON serialization of the occurrence exactly as supplied: no field SHALL be added, removed, or rewritten, and in particular `correlation.retry_attempt` SHALL be sent exactly as supplied. The descriptor SHALL carry the occurrence's unchanged `event.id` and the caller-supplied zero-based delivery attempt ordinal, defaulting to `0` when omitted, outside the body, and the outcome SHALL expose one of `acknowledged`, `retryable`, `non_retryable`, or `protocol_error` without claiming delivery beyond a well-formed acknowledgment.

#### Scenario: Accepted response completes one stable attempt
- **WHEN** the supplied exchange boundary returns a well-formed acceptance for a canonical occurrence
- **THEN** the handoff invokes that boundary exactly once and returns `acknowledged` with the original `event.id` and the attempt ordinal used for that call

#### Scenario: Request construction is bounded and transport-free
- **WHEN** a canonical occurrence is handed off
- **THEN** the binding presents a bounded descriptor containing only the declared HTTP method, path, closed headers, and serialized occurrence body to the supplied exchange boundary without opening a live-network connection

#### Scenario: The attempt ordinal stays outside the occurrence
- **WHEN** a caller invokes the handoff with an explicit zero-based attempt ordinal
- **THEN** the request descriptor and the result both carry that exact ordinal, the body is byte-identical to the canonical serialization of the occurrence as supplied, including its unchanged `correlation.retry_attempt`, and the occurrence's `event.id` remains unchanged

#### Scenario: Out-of-bounds attempt ordinal is rejected before any exchange
- **WHEN** a caller supplies a negative, non-integer, or over-ceiling attempt ordinal
- **THEN** the handoff rejects the call before invoking the supplied exchange boundary and no request is constructed

### Requirement: Node binding provides bounded, jittered delivery retry scheduling that redelivers the identical occurrence

The Node binding SHALL provide a retry-scheduling module that composes a single-attempt handoff into a bounded delivery attempt sequence for one canonical occurrence. Only an outcome classified `retryable` SHALL cause another attempt to be scheduled; any other terminal outcome SHALL stop scheduling immediately. The module SHALL accept a configured maximum attempt count, SHALL NOT exceed it, and SHALL produce a terminal `exhausted` result carrying an observable attempt counter when the budget is spent without a non-retryable terminal outcome. The delay before each scheduled retry SHALL be a deterministic function of the attempt ordinal, a configured base and maximum delay, and an injected jitter source, computed without reference to real wall-clock time so it is verifiable under a fixed timer provider and jitter source. Each attempt SHALL send the identical occurrence, with its unchanged `event.id` and a body byte-identical to every other attempt's, and SHALL carry an incrementing zero-based delivery attempt ordinal that is observable through the result's attempt counter and the observability callbacks, never through the occurrence.

#### Scenario: Only a retryable outcome schedules another attempt
- **WHEN** the wrapped handoff returns a non-retryable terminal outcome (`acknowledged`, `non_retryable`, or `protocol_error`) at any attempt
- **THEN** retry scheduling stops immediately, returns that terminal outcome, and never schedules a further attempt

#### Scenario: Retry budget is bounded and exhaustion is observable
- **WHEN** the wrapped handoff returns `retryable` for every attempt up to the configured maximum
- **THEN** retry scheduling makes no more than the configured maximum number of attempts and returns a terminal `exhausted` result carrying the number of attempts made

#### Scenario: Delay computation is deterministic and bounded
- **WHEN** retry scheduling computes the delay before a retry attempt
- **THEN** the delay is a capped exponential function of the attempt ordinal scaled by the injected jitter source's value, never exceeds the configured maximum delay, and is reproducible under a fixed timer provider and jitter source without waiting real wall-clock time

#### Scenario: Redelivered attempts send the identical occurrence
- **WHEN** retry scheduling redelivers an occurrence through the wrapped handoff after a retryable outcome
- **THEN** every attempt sends a body byte-identical to the first, with the occurrence's identical `event.id` and unchanged `correlation.retry_attempt`, while the zero-based delivery attempt ordinal advances by one per attempt, consistent with the delivery conformance contract's attempt-identity requirement

#### Scenario: A re-execution keeps its retry attempt through every delivery attempt
- **WHEN** an occurrence whose `correlation.retry_attempt` is `2` is redelivered after a retryable outcome
- **THEN** every attempt's body carries `correlation.retry_attempt` `2`

#### Scenario: A delivery retry of a first execution stays valid
- **WHEN** an SDK-validated first execution is redelivered after a retryable outcome
- **THEN** every body the exchange boundary receives still passes the SDK's validation of a complete event

## REMOVED Requirements

### Requirement: Node binding exposes deterministic single-attempt delivery handoff

**Reason**: Its scenario "Caller-supplied attempt ordinal is carried into the wire correlation" wrote the delivery attempt ordinal into `correlation.retry_attempt`, the contract's re-execution counter (#577).
**Migration**: Replaced by "Node binding exposes a deterministic single-attempt delivery handoff that sends the occurrence unchanged". Read the attempt ordinal from the request descriptor or the handoff result.

### Requirement: Node binding provides bounded, jittered delivery retry scheduling

**Reason**: Its scenario "Retried attempts preserve identity and advance wire correlation" advanced `correlation.retry_attempt` on every delivery attempt (#577).
**Migration**: Replaced by "Node binding provides bounded, jittered delivery retry scheduling that redelivers the identical occurrence". Read the attempt count from the result's `attempts` and the `onAttemptScheduled` and `onExhausted` callbacks.
