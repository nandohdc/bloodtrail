## Context

The provisional Node binding currently exposes only platform SPI implementations. The delivery conformance contract defines observable single-occurrence states, stable identity, and fail-closed acknowledgment semantics, while #103 is intentionally limited to one synchronous-to-async handoff. See `proposal.md` and the delivery-conformance contract for the accepted semantic boundary.

## Goals / Non-Goals

**Goals:** expose a small typed handoff boundary that converts one canonical event into a bounded HTTP request descriptor, delegates the exchange to caller-owned code, and returns a closed disposition with stable event identity and attempt ordinal.

**Non-Goals:** endpoint discovery, sockets, DNS, TLS, `fetch`, `node:http`, retry scheduling or budgets, jitter, queues, capacity, shutdown handling, collector behavior, persistence, production configuration, delivery guarantees, and exactly-once semantics.

## Decisions

- Export one `createHttpDeliveryHandoff` factory with immutable configuration: a validated request path and an injected `HttpExchange` function. The resulting handoff has one public `handoff(event)` operation. This keeps the transport peer, connection lifecycle, and credentials outside the package while making the observable attempt contract testable. An adapter that opens a socket was rejected because it would require a new platform coupling and introduce unapproved runtime/network behavior.
- Represent the exchange boundary with closed discriminated input and output unions. The request descriptor contains `POST`, path, closed JSON headers, and a bounded serialized event body. The exchange outcome is only an HTTP response, timeout, or transport failure. A generic thrown-error or response-object surface was rejected because arbitrary peer objects and error strings would make classification and disclosure behavior non-deterministic.
- Treat only a 2xx response with a complete acknowledgment bound to the submitted event ID as acceptance. 4xx responses are permanent except explicitly retryable status codes; 5xx responses are retryable. A missing, mismatched, duplicate, malformed, or otherwise ambiguous acknowledgment is `protocol_error`. Status-only success was rejected because it cannot prove the peer accepted this occurrence, while accepting arbitrary response bodies would not be fail closed.
- Keep the event ID unchanged and set `correlation.retry_attempt` to `0` only in the request projection. The original caller-owned event is never mutated. Constructing a new event identity or mutating the event was rejected because it would violate conformance identity and blur ownership at the producer boundary.
- Keep response and transport diagnostics as closed category/code values, never remote headers, body text, URL authority, or thrown error messages. This preserves deterministic tests and avoids a peer-controlled disclosure path.

## Risks / Trade-offs

- An injected exchange requires consumers to provide the actual HTTP client integration → the package exposes only the narrow descriptor/closed-outcome port and documents that no network behavior is supplied.
- Status-code mapping alone can vary across APIs → the mapping is finite, documented, and tests cover accepted, retryable, permanent, malformed-acknowledgment, timeout, and transport-failure arms.
- Serializing a valid canonical event could still exceed a bounded request limit → reject locally with a closed handoff result before calling the exchange; do not truncate or partially send.
- A peer can claim an unrelated event ID in an otherwise successful response → require exactly one matching acknowledgment and classify every mismatch or ambiguity as `protocol_error`.

## Migration Plan

The API is additive in the explicitly provisional Node package. Consumers opt in by constructing a handoff with their own exchange function; there is no automatic network behavior or migration of existing SDK calls. Rollback removes the export and leaves all existing Node SPI behavior unchanged.
