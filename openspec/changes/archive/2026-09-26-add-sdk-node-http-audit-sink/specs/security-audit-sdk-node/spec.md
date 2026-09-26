## ADDED Requirements

### Requirement: The HTTP audit sink sends one byte-exact request per event through the governed fetch adapter

The Node binding SHALL provide `createHttpAuditSink(options)`, which implements the core's transport-neutral sink interface for non-production evaluation only.

Each emitted event SHALL become exactly one HTTP `POST` to the configured origin and path, with content type `application/json`. The body SHALL be the canonical JSON serialization of exactly the event the SDK validated, byte for byte. No field SHALL be added, removed or rewritten; in particular, `correlation.retry_attempt` SHALL be sent exactly as validated.

The request SHALL reach the network only through the governed fetch delivery adapter. It SHALL NOT follow a redirect, and it SHALL be bounded by the configured per-request timeout. The sink SHALL NOT be a second delivery adapter: it performs no exchange of its own.

Construction SHALL throw synchronously for any of these options:

- an origin that is not an `http` or `https` scheme, host and optional port;
- a path that is not a bounded absolute path;
- a timeout that is not a bounded positive integer;
- an invalid header name or value.

Caller-supplied headers SHALL be sent only to the configured origin. They SHALL NOT appear in any result, error, outcome report or log.

#### Scenario: One request carries the validated bytes
- **WHEN** an event whose `correlation.retry_attempt` is non-zero is emitted through the sink to a loopback peer
- **THEN** the peer receives exactly one `POST` to the configured path with content type `application/json`, whose body is byte-identical to the canonical serialization of the validated event, including the unchanged `correlation.retry_attempt`

#### Scenario: A redirect is never followed
- **WHEN** the peer answers with a 3xx redirect
- **THEN** the redirect target receives nothing and the SDK returns `SDK_SINK_FAILURE`

#### Scenario: Invalid options fail construction
- **WHEN** the sink is configured with an origin carrying a path, query, credentials or a non-HTTP scheme, a relative or unbounded path, a non-positive or unbounded timeout, or an invalid header
- **THEN** construction throws and no sink exists

#### Scenario: Credentials stay on the wire to the configured origin
- **WHEN** a sentinel credential header is configured and requests succeed, fail and time out
- **THEN** the sentinel appears only in requests to the configured origin and never in a result, error, outcome report or log

### Requirement: The HTTP audit sink and the delivery handoff share one response classification

HTTP response classification SHALL be defined once, and both the delivery handoff and the HTTP audit sink SHALL use it:

- A 2xx response SHALL be `acknowledged` only when it carries exactly one acknowledgment whose `event_id` equals the event's `event.id` and whose `outcome` is `accepted`. Any other 2xx acknowledgment SHALL be `malformed_acknowledgment`.
- 5xx, 408, 425 and 429 SHALL be `http_retryable`. Every other 4xx SHALL be `http_permanent`.
- 1xx, 3xx and invalid statuses SHALL be `unexpected_response`.
- A deadline SHALL be `timeout`, and a connection failure SHALL be `transport_failure`.

Extracting the classification SHALL leave every observable handoff outcome and code unchanged.

The sink SHALL map `acknowledged` to accepted, `http_permanent` to rejected, and every other code to unknown. The SDK therefore returns an ok result, `SDK_SINK_REJECTED` or `SDK_SINK_FAILURE` respectively. The sink SHALL add no classification rule of its own.

#### Scenario: A permanent 4xx is a rejection
- **WHEN** the peer answers 400, 403, 404 or 422
- **THEN** the SDK returns `SDK_SINK_REJECTED`

#### Scenario: Retryable statuses, timeouts and connection failures are failures
- **WHEN** the peer answers 408, 425, 429, 500 or 503, exceeds the timeout, or refuses the connection
- **THEN** the SDK returns `SDK_SINK_FAILURE`

#### Scenario: Only the exact acknowledgment is acceptance
- **WHEN** a 2xx response carries no acknowledgment, more than one, one for another event, or one whose outcome is not `accepted`
- **THEN** the SDK returns `SDK_SINK_FAILURE` and never reports acceptance

#### Scenario: The handoff's outcomes are unchanged
- **WHEN** the delivery handoff classifies any status, acknowledgment shape, timeout or transport failure after the extraction
- **THEN** it returns the same outcome and code it returned before the extraction

### Requirement: The HTTP audit sink reports each request's cause through an optional outcome callback

The sink SHALL accept an optional `onOutcome` callback. It SHALL invoke the callback exactly once per request, with three things:

- the event identifier;
- the shared classifier's code;
- the HTTP status, when a response was received.

The callback SHALL NOT receive a request or response body, an event payload, or a header value.

If the callback throws or returns a rejected promise, that SHALL NOT change the sink's result and SHALL NOT produce an unhandled rejection.

Because every callback invocation carries the event identifier, a developer can correlate each failed send with its event.

#### Scenario: Each request reports its cause once
- **WHEN** a request ends in any classifier code
- **THEN** `onOutcome` is invoked once with the event identifier, that code, and the HTTP status if a response was received

#### Scenario: A failing callback changes nothing
- **WHEN** `onOutcome` throws or returns a rejected promise
- **THEN** the sink's result is unchanged and no unhandled rejection occurs

### Requirement: The HTTP audit sink drains in-flight sends and adds no delivery machinery

`flush` SHALL resolve once every request started before the call has settled. It SHALL NOT wait for requests started after the call.

When the SDK that uses the sink shuts down, the sink SHALL let its in-flight sends settle within the SDK's shutdown bound, and SHALL close only after they have settled or the bound has expired. Through the SDK, a send that outlives the bound SHALL surface as `SDK_SHUTDOWN_TIMEOUT`, and an emit after shutdown SHALL surface as `SDK_SHUT_DOWN`.

Concurrent emits SHALL be allowed. Each SHALL produce one request, and each request SHALL be reported exactly once, with no ordering guarantee.

The sink SHALL NOT retry, batch, queue, apply backpressure, cap concurrency, persist, or claim delivery-class conformance. The delivery-conformance attempt-identity requirement does not apply to it.

#### Scenario: Flush waits for in-flight requests only
- **WHEN** `flush` is called while a loopback peer holds earlier responses, and a new emit starts afterwards
- **THEN** `flush` stays pending until the held requests settle and does not wait for the later request

#### Scenario: Shutdown drains within its bound
- **WHEN** the SDK shuts down while a held request settles within the shutdown bound, and again while one outlives it
- **THEN** the first shutdown succeeds after the send settles, the second returns `SDK_SHUTDOWN_TIMEOUT`, and an emit after either returns `SDK_SHUT_DOWN`

#### Scenario: Concurrent emits are each sent once
- **WHEN** N emits run concurrently
- **THEN** the peer receives N requests and each emit is settled and reported exactly once

### Requirement: The frozen Node surface widens additively for the HTTP audit sink

This change SHALL add exactly three exports to the frozen Node surface:

- the HTTP audit sink factory;
- its options type;
- its outcome type.

The additions SHALL be recorded in three places:

- the frozen export lists;
- a new amendment to the public-surface freeze record, which leaves the original freeze record and earlier amendments unchanged;
- an architecture decision record, which also records the shared response classification.

No added name SHALL collide with the core's frozen export surface. No added source file name SHALL contain a token the scope gate forbids.

#### Scenario: The widening is recorded as an amendment
- **WHEN** the export check and the public-surface freeze record are inspected after the widening
- **THEN** the frozen lists contain the three new names, the freeze record gains one amendment naming them, and the original freeze record and earlier amendments are byte-identical

#### Scenario: The widening collides with nothing
- **WHEN** the widened Node surface is compared with the core's frozen surface and the scope gate runs
- **THEN** no name appears in both surfaces and the scope gate passes without a change to its rules
