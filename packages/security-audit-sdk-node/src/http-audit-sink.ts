// The HTTP audit sink (#589, #590, #591): the core's sink interface over the
// governed fetch delivery adapter. Each emitted event becomes one POST whose
// body is the event the SDK validated, serialized once and sent unchanged.
// Every result comes from the shared response classifier, and the sink adds no
// rule of its own: only the exact acknowledgment is acceptance, and only a
// permanent 4xx is a rejection. onOutcome reports each request's cause, flush
// waits for the sends already in flight, and shutdown closes the sink.
//
// NON-PRODUCTION. One attempt per event: no retry, batching, queueing,
// backpressure, concurrency cap or ordering. Caller headers go only to the
// configured origin, and the sink never logs, echoes or reports one.

import type { AuditDeliveryResult, AuditEventSink, SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

import { nodeByteLength } from "./byte-length.js";
import { createFetchHttpExchange } from "./fetch-exchange.js";
import { BOUNDED_ABSOLUTE_PATH, type HttpExchangeOutcome, type HttpExchangeRequest } from "./http-handoff.js";
import { classifyHttpExchangeOutcome, type HttpResponseClassification } from "./http-response-classification.js";

export interface HttpAuditSinkOptions {
  /** `http://` or `https://` scheme, host, and optional port only: no path, query, fragment, or userinfo. */
  readonly origin: string;
  /** Bounded absolute request path, such as `/v1/security-audit`, with no query or fragment. */
  readonly path: string;
  /** Per-request deadline in milliseconds, an integer from 1 to 60000. */
  readonly timeoutMs: number;
  /** Caller-owned headers, such as an authorization header. They are sent only to `origin`. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * Called once per request with that request's outcome, and never with a
   * body, payload or header value. It runs inline before the emit settles, so
   * it should be quick. The sink does not wait for a promise it returns, and
   * ignores anything it throws or rejects with.
   */
  readonly onOutcome?: (outcome: HttpAuditSinkOutcome) => void;
}

/** One request's cause, reported through `HttpAuditSinkOptions.onOutcome`. */
export type HttpAuditSinkOutcome = Readonly<{
  /** The emitted event's `event.id`. */
  readonly eventId: string;
  /**
   * The shared response classifier's code, `acknowledged` included. The codes
   * are spelled out so that no edit to the internal classifier can change this
   * frozen type: a new code fails to compile in this file instead.
   */
  readonly outcome:
    | "acknowledged"
    | "http_retryable"
    | "timeout"
    | "transport_failure"
    | "http_permanent"
    | "malformed_acknowledgment"
    | "unexpected_response";
  /** The HTTP status, present only when a response arrived. */
  readonly status?: number;
}>;

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
// What a closed sink returns. It made no request, so onOutcome reports nothing.
const SHUT_DOWN: AuditDeliveryResult = Object.freeze({ status: "unknown", code: "shut_down" });
// The core's sink status for each shared classification code.
const SINK_STATUS_BY_CODE = {
  acknowledged: "accepted",
  http_permanent: "rejected",
  http_retryable: "unknown",
  timeout: "unknown",
  transport_failure: "unknown",
  malformed_acknowledgment: "unknown",
  unexpected_response: "unknown",
} as const satisfies Record<HttpResponseClassification, AuditDeliveryResult["status"]>;

// A callback may return anything, a rejected promise included.
type OutcomeCallback = (outcome: HttpAuditSinkOutcome) => unknown;

/**
 * Creates an HTTP audit sink for non-production evaluation. Invalid options
 * throw a `TypeError` here, and no error names a header or its value.
 *
 * Give each SDK its own sink. An SDK waits for its sink's flush and shutdown
 * after its own shutdown bound, so a send that another user of the same sink
 * holds lengthens that SDK's shutdown, and the first shutdown closes the sink
 * for every user.
 */
export function createHttpAuditSink(options: HttpAuditSinkOptions): AuditEventSink {
  const path = validatePath(options.path);
  const headers = validateHeaders(options.headers);
  const onOutcome = validateOnOutcome(options.onOutcome);
  const exchange = createFetchHttpExchange({ origin: options.origin, timeoutMs: options.timeoutMs, headers });
  // Every send that has not settled yet. Concurrent sends are not capped or ordered.
  const inFlight = new Set<Promise<AuditDeliveryResult>>();
  let open = true;

  async function send(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult> {
    // No catch: the governed adapter settles every exchange with an outcome
    // it built from plain data, so neither it nor the classifier throws here,
    // and report contains the callback. Should serialization throw, the emit
    // rejects, and the SDK reports a rejected emit as SDK_SINK_FAILURE.
    const eventId = event.event.id;
    const exchanged = await exchange(requestFor(event, eventId, path));
    const code = classifyHttpExchangeOutcome(exchanged, eventId);
    report(onOutcome, outcomeFor(eventId, code, exchanged));
    return resultFor(code);
  }

  // Waits for the sends in flight when it is called, and never for a later
  // one: allSettled reads the set once, during the call. Each send settles
  // within timeoutMs plus onOutcome's own synchronous run time, because the
  // adapter's deadline covers the whole exchange and the sink never waits for
  // a promise onOutcome returns.
  async function flush(): Promise<void> {
    await Promise.allSettled(inFlight);
  }

  return Object.freeze({
    emit: (event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult> =>
      open ? track(inFlight, send(event)) : Promise.resolve(SHUT_DOWN),
    flush,
    // Closes the sink before it drains, so no send starts once shutdown has
    // been called. The SDK stops admitting emissions before it gets here.
    async shutdown(): Promise<void> {
      open = false;
      await flush();
    },
  } satisfies AuditEventSink);
}

// Holds `sending` in `inFlight` until it settles. The caller gets a promise of
// its own, so a send nobody handles still surfaces as an unhandled rejection.
async function track<T>(inFlight: Set<Promise<T>>, sending: Promise<T>): Promise<T> {
  inFlight.add(sending);
  try {
    return await sending;
  } finally {
    inFlight.delete(sending);
  }
}

function resultFor(code: HttpResponseClassification): AuditDeliveryResult {
  const status = SINK_STATUS_BY_CODE[code];
  return status === "accepted" ? ACCEPTED : Object.freeze({ status, code });
}

// Closed values only: the event identifier, the classifier's code, and the
// status of a response when one arrived. Never a body, a payload or a header.
function outcomeFor(
  eventId: string,
  outcome: HttpResponseClassification,
  exchanged: HttpExchangeOutcome,
): HttpAuditSinkOutcome {
  return Object.freeze(exchanged.kind === "response" ? { eventId, outcome, status: exchanged.status } : { eventId, outcome });
}

// The callback's failures are its own. The sink does not wait for it, and
// nothing it throws or rejects with reaches the emit or goes unhandled.
function report(onOutcome: OutcomeCallback | undefined, outcome: HttpAuditSinkOutcome): void {
  if (onOutcome === undefined) return;
  try {
    Promise.resolve(onOutcome(outcome)).catch(() => undefined);
  } catch {
    // A synchronous throw is dropped for the same reason.
  }
}

function requestFor(event: Readonly<SecurityAuditEvent>, eventId: string, path: string): HttpExchangeRequest {
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
    event_id: eventId,
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

function validateOnOutcome(onOutcome: HttpAuditSinkOptions["onOutcome"]): OutcomeCallback | undefined {
  if (onOutcome !== undefined && typeof onOutcome !== "function") {
    throw new TypeError("HTTP audit sink onOutcome must be a function");
  }
  return onOutcome;
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
