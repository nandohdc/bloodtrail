## MODIFIED Requirements

### Requirement: The HTTP audit sink and the delivery handoff share one response classification

HTTP response classification SHALL be defined once, and both the delivery handoff and the HTTP audit sink SHALL use it:

- A response outcome SHALL be `acknowledged` only when its fully read body carries exactly one acknowledgment whose `event_id` equals the event's `event.id` and whose `outcome` is `accepted`. Any other 2xx response outcome SHALL be `malformed_acknowledgment`.
- 5xx, 408, 425 and 429 SHALL be `http_retryable`. Every other 4xx SHALL be `http_permanent`.
- 1xx, 3xx and invalid statuses SHALL be `unexpected_response`.
- A timeout outcome SHALL be `timeout`, and a transport-failure outcome SHALL be `transport_failure`.

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
