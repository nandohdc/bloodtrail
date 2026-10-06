# Wire Protocol and Failure Diagnostics

This document specifies the wire protocol used by `@bloodtrail/security-audit-sdk-node`'s HTTP audit sink (`createHttpAuditSink`) and defines the mapping between HTTP transport conditions, SDK result codes, and `onOutcome` diagnostic reports.

---

## Alpha Delivery Guarantee

The evaluation alpha provides a minimal, non-buffering delivery model designed for straightforward evaluation:

- **One attempt**: The SDK sends exactly one HTTP `POST` request per emit call.
- **No automatic retries**: If delivery fails (e.g. transient 5xx, timeout, network error), the SDK does not retry the request.
- **No ordering**: Concurrently emitted events may reach the receiver and settle in any order.
- **No delivery-class conformance**: Delivery class policies (such as durable spooling, local queues, or multi-sink fanout) are not evaluated or guaranteed in the alpha.

---

## Request Specification

Every event emitted through the HTTP audit sink is transmitted as an HTTP `POST` request.

- **HTTP Method**: `POST`
- **Request URI**: Configured origin and path (e.g., `http://127.0.0.1:3000/v1/security-audit`)
- **Headers**:
  - `Content-Type: application/json`
  - Any optional caller-configured headers specified via `HttpAuditSinkOptions.headers` (e.g., `Authorization: Bearer <token>`)
- **Request Body**: Exactly one canonical JSON object representing a validated `SecurityAuditEvent`.
  - The payload is serialized without envelope wrapping or array containers.
  - The payload contains the event identity (`event.id`), event name (`event.name`), timestamps, actor, tenant, action/target, and correlation metadata.

Example HTTP request:

```http
POST /v1/security-audit HTTP/1.1
Host: 127.0.0.1:3000
Content-Type: application/json
Authorization: Bearer eval-token-1234

{
  "event": {
    "id": "11111111-1111-4111-8111-000000000001",
    "name": "bloodtrail.audit.account.registration.completed",
    "timestamp": "2026-09-25T00:00:00.000Z",
    "action": "complete",
    "outcome": "success"
  },
  "producer": {
    "name": "eval-service",
    "version": "1.0.0"
  },
  "service": {
    "name": "eval-service",
    "version": "1.0.0"
  },
  "environment": {
    "name": "development"
  },
  "tenant": {
    "effective_tenant_id": "tenant-eval-1"
  },
  "actor": {
    "type": "user",
    "id": "actor-eval-user"
  }
}
```

---

## Acknowledgment Specification

A compliant receiver must respond to valid audit events with an acknowledgment response:

- **HTTP Status**: `202 Accepted` (or any `2xx` success code)
- **Content-Type**: `application/json`
- **Response Body**: A JSON object containing an `acknowledgments` array with exactly one element matching the received event ID:

```json
{
  "acknowledgments": [
    {
      "event_id": "11111111-1111-4111-8111-000000000001",
      "outcome": "accepted"
    }
  ]
}
```

### Protocol Validation Rules

1. The `acknowledgments` property must be an array containing exactly one entry.
2. The `event_id` field in that entry must match the `event.id` of the submitted event byte-for-byte.
3. The `outcome` field must be `"accepted"`.
4. Any deviation (empty array, multiple elements, mismatched event ID, outcome `"rejected"`, or invalid JSON) is classified as a protocol error (`malformed_acknowledgment`) and maps to SDK result code `SDK_SINK_FAILURE`.

---

## Failure Diagnostics and Status Handling

When an event cannot be delivered or is rejected by the peer, the SDK:
1. Resolves the caller's `emit` promise with a failed `AuditResult` (`{ ok: false, error: AuditError }`).
2. Dispatches diagnostic details to the optional `onOutcome` callback.

> [!NOTE]
> **Event Identifiers in Diagnostics (Deviation 6 in #610)**:
> In accordance with deviation 6 in #610, the SDK's public result type keeps the ratified sink-failure diagnostics, which carry **no event identifier** on `result.error`. The event identifier is delivered exclusively through the `onOutcome` callback (`outcome.eventId`).

### The Failure Table

The following table maps each transport condition and peer response to its SDK result code, `onOutcome` cause code, classification, and event ID availability:

| Condition | HTTP Status / Transport State | SDK Result Code (`result.error.code`) | `onOutcome` Code (`outcome.outcome`) | Classification | Event ID in Result | Event ID in `onOutcome` | Description |
|---|---|---|---|---|---|---|---|
| **Successful Delivery** | `200` or `202` with valid matching acknowledgment | *N/A (`result.ok === true`)* | `acknowledged` | Success | No (`result.value.status === "accepted"`) | Yes (`outcome.eventId`) | Receiver accepted and acknowledged event |
| **Duplicate** | `200` with exactly one acknowledgment for the event, whose outcome is `accepted` | *N/A (`result.ok === true`)* | `acknowledged` | Success | No (`result.value.status === "accepted"`) | Yes (`outcome.eventId`) | A byte-identical copy of an event the receiver already accepted, such as `sdk.redeliver` after a lost acknowledgment: acknowledged, and never admitted twice |
| **Permanent Rejection** | `400`, `401`, `403`, `404`, `405`, `409`, `410`, `413`, `415`, `422` | `SDK_SINK_REJECTED` | `http_permanent` | Non-retryable rejection | No | Yes (`outcome.eventId`) | Permanent peer rejection; client request or authorization invalid |
| **Conflict** | `409` | `SDK_SINK_REJECTED` | `http_permanent` | Non-retryable rejection | No | Yes (`outcome.eventId`) | The event reuses the identifier of an event the receiver already accepted, with different content |
| **Request Timeout** | `408` | `SDK_SINK_FAILURE` | `http_retryable` | Retryable failure | No | Yes (`outcome.eventId`) | Receiver timed out waiting for request |
| **Too Early** | `425` | `SDK_SINK_FAILURE` | `http_retryable` | Retryable failure | No | Yes (`outcome.eventId`) | Receiver refused request to prevent replay attacks |
| **Rate Limited** | `429` | `SDK_SINK_FAILURE` | `http_retryable` | Retryable failure | No | Yes (`outcome.eventId`) | Receiver rate limit or load backpressure exceeded |
| **Server Error** | `500`, `502`, `503`, `504` | `SDK_SINK_FAILURE` | `http_retryable` | Retryable failure | No | Yes (`outcome.eventId`) | Internal server error or gateway failure at receiver |
| **Client Timeout** | None (peer slower than `timeoutMs` before or during response body) | `SDK_SINK_FAILURE` | `timeout` | Transport timeout | No | Yes (`outcome.eventId`) | HTTP exchange timed out before peer response settled or during response body read |
| **Transport Failure** | None (connection refused, DNS failure, socket reset) | `SDK_SINK_FAILURE` | `transport_failure` | Transport failure | No | Yes (`outcome.eventId`) | TCP connection refused or dropped by peer |
| **Redirection** | `301`, `302`, `303`, `307`, `308` | `SDK_SINK_FAILURE` | `unexpected_response` | Unexpected response | No | Yes (`outcome.eventId`) | Redirects are never followed to avoid leaking credentials to unintended hosts |
| **Malformed Acknowledgment** | `2xx` with missing, extra, or invalid acknowledgment | `SDK_SINK_FAILURE` | `malformed_acknowledgment` | Protocol error | No | Yes (`outcome.eventId`) | Response body is not valid JSON or lacks exact single matching acknowledgment |
| **Emit During Shutdown** | None (emit called while `shutdown()` is draining) | `SDK_SHUTTING_DOWN` | *None (no request)* | Lifecycle | No | N/A | SDK is draining in-flight requests; refuses new emit calls |
| **Emit After Shutdown** | None (emit called after `shutdown()` completed) | `SDK_SHUT_DOWN` | *None (no request)* | Lifecycle | No | N/A | SDK / sink is closed; immediately refuses further emit calls |

A receiver answers a duplicate as it answered the original, with one `accepted` acknowledgment, so a redelivery after a
lost acknowledgment succeeds. The kit's example receiver does exactly that. It answers the other rejections with the
status that names them: `401` for failed authentication, `413` for a body over its bound, `400` for a malformed body,
`409` for a conflict, and `422` for an event that fails SDK validation or has an unsupported version. It authenticates
only the Bearer scheme in any letter case, so any other `Authorization` value gets `401`; it answers a POST to any
path other than the submission path with `404` and admits nothing; and it answers any other method with `405` and an
`Allow: POST` header. Whatever the answer, it reads a body within its bound before answering and, past the bound,
answers and closes the connection. A client that aborts mid-body is counted as neither a `500` nor a rejection.

---

## Lifecycle: Flush and Shutdown Semantics

The HTTP audit sink coordinates request completion across lifecycle transitions:

### `flush()`
- Waits for every HTTP request initiated **prior** to the `flush()` call to settle.
- Does not wait for requests initiated after `flush()` begins.
- Returns `{ ok: true, value: undefined }`.

### `shutdown()`
- Closes the sink against new emits. Any call to `emit()` made while `shutdown()` is draining resolves with `{ ok: false, error: { code: "SDK_SHUTTING_DOWN" } }`, and any call made after `shutdown()` completes resolves with `{ ok: false, error: { code: "SDK_SHUT_DOWN" } }` without initiating network I/O.
- Drains all in-flight requests initiated prior to shutdown, waiting up to `shutdownTimeoutMs` (default 5,000 ms).
- If held requests exceed `shutdownTimeoutMs`, shutdown resolves with error code `SDK_SHUTDOWN_TIMEOUT`. Once shut down, the SDK remains in `shut_down` state.

---

## Consumer Configuration Example

The following TypeScript example demonstrates configuring the HTTP audit sink with `onOutcome` reporting and executing lifecycle operations:

```typescript
import {
  createHttpAuditSink,
  createNodeSecurityAuditSdk,
  type HttpAuditSinkOutcome,
} from "@bloodtrail/security-audit-sdk-node";
import { CONTRACT_VERSION } from "@bloodtrail/security-audit-sdk-core";

const outcomes: HttpAuditSinkOutcome[] = [];

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 2000,
  onOutcome: (outcome: HttpAuditSinkOutcome) => {
    outcomes.push(outcome);
    if (outcome.outcome === "acknowledged") {
      console.log(`Delivered event ${outcome.eventId} (status: ${outcome.status ?? "unknown"})`);
    } else {
      console.warn(`Delivery failed for event ${outcome.eventId}: ${outcome.outcome} (status: ${outcome.status ?? "none"})`);
    }
  },
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: {
    name: "evaluation-service",
    version: "1.0.0",
  },
  service: {
    name: "evaluation-service",
    version: "1.0.0",
  },
  environment: {
    name: "development",
  },
  sink,
  shutdownTimeoutMs: 5000,
});

// Gracefully flush and shut down
await sdk.flush();
await sdk.shutdown();
```
