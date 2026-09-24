// The HTTP audit sink (#589): the core's sink interface over the governed fetch
// delivery adapter. Each emitted event becomes one POST whose body is the event
// the SDK validated, serialized once and sent unchanged. Acceptance comes only
// from the shared response classifier; the sink adds no rule of its own.
//
// NON-PRODUCTION. One attempt per event: no retry, batching, queueing,
// backpressure or ordering. Caller headers go only to the configured origin,
// and the sink never logs, echoes or reports one.

import type { AuditDeliveryResult, AuditEventSink, SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

import { nodeByteLength } from "./byte-length.js";
import { createFetchHttpExchange } from "./fetch-exchange.js";
import { BOUNDED_ABSOLUTE_PATH, type HttpExchangeRequest } from "./http-handoff.js";
import { classifyHttpExchangeOutcome } from "./http-response-classification.js";

export interface HttpAuditSinkOptions {
  /** `http://` or `https://` scheme, host, and optional port only: no path, query, fragment, or userinfo. */
  readonly origin: string;
  /** Bounded absolute request path, such as `/v1/security-audit`, with no query or fragment. */
  readonly path: string;
  /** Per-request deadline in milliseconds, an integer from 1 to 60000. */
  readonly timeoutMs: number;
  /** Caller-owned headers, such as an authorization header. They are sent only to `origin`. */
  readonly headers?: Readonly<Record<string, string>>;
}

// RFC 9110 field names. A field value may hold visible characters, spaces and
// tabs, but no line break or NUL, and fetch needs one byte per character.
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const HEADER_VALUE_PATTERN = /^[\t\u0020-\u007E\u0080-\u00FF]*$/;
// The sink derives the first three from its body and origin, and the rest
// belong to the connection. fetch refuses some of them on every send, so a
// caller naming any of them fails construction instead.
const RESERVED_HEADER_NAMES = new Set([
  "content-type", "content-length", "host",
  "connection", "keep-alive", "transfer-encoding", "upgrade", "expect",
]);
const ACCEPTED: AuditDeliveryResult = Object.freeze({ status: "accepted" });

/**
 * Creates an HTTP audit sink for non-production evaluation. Invalid options
 * throw a `TypeError` here, and no error names a header or its value.
 */
export function createHttpAuditSink(options: HttpAuditSinkOptions): AuditEventSink {
  const path = validatePath(options.path);
  const headers = validateHeaders(options.headers);
  const exchange = createFetchHttpExchange({ origin: options.origin, timeoutMs: options.timeoutMs, headers });

  return Object.freeze({
    async emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult> {
      // No catch: the governed adapter settles every exchange with an outcome
      // it built from plain data, so neither it nor the classifier throws here.
      // Should serialization throw, the emit rejects, and the SDK reports a
      // rejected emit as SDK_SINK_FAILURE.
      const code = classifyHttpExchangeOutcome(await exchange(requestFor(event, path)), event.event.id);
      return code === "acknowledged" ? ACCEPTED : Object.freeze({ status: "unknown", code });
    },
  } satisfies AuditEventSink);
}

function requestFor(event: Readonly<SecurityAuditEvent>, path: string): HttpExchangeRequest {
  // Serialized once and sent as is, so the body is exactly the validated event.
  const body = JSON.stringify(event);
  return Object.freeze({
    method: "POST",
    path,
    headers: Object.freeze({
      "content-type": "application/json",
      "content-length": String(nodeByteLength.byteLength(body)),
    }),
    body,
    event_id: event.event.id,
    // The sink makes one attempt per event and never schedules another.
    attempt: 0,
  });
}

function validatePath(path: unknown): string {
  if (typeof path !== "string" || !BOUNDED_ABSOLUTE_PATH.test(path)) {
    throw new TypeError("HTTP audit sink path must be a bounded absolute path");
  }
  return path;
}

function validateHeaders(headers: unknown): Readonly<Record<string, string>> {
  if (headers === undefined) return Object.freeze({});
  if (!isRecord(headers)) throw invalidHeaders();
  // Read once, so a getter cannot pass validation and then send another value.
  const entries = Object.entries(headers);
  if (!entries.every(isValidHeaderEntry)) throw invalidHeaders();
  // fromEntries defines own properties, so even a `__proto__` name stays a header.
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}

function isRecord(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidHeaderEntry([name, value]: [string, unknown]): boolean {
  if (!HEADER_NAME_PATTERN.test(name)) return false;
  if (RESERVED_HEADER_NAMES.has(name.toLowerCase())) return false;
  if (typeof value !== "string") return false;
  return HEADER_VALUE_PATTERN.test(value);
}

// The message is fixed so that it can never carry a caller's header or value.
function invalidHeaders(): TypeError {
  return new TypeError("HTTP audit sink headers must be valid header names and values, and must not name a header the sink or the connection owns");
}
