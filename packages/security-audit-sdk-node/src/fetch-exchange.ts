// The governed delivery adapter (#113): an HttpExchange over the Node
// runtime's global fetch. It is the only adapter the governed inventory
// approves; it maps every native fetch outcome onto the closed HttpExchange
// outcome set and leaves every conformance decision to the shared response
// classifier, which createHttpDeliveryHandoff and createHttpAuditSink both call
// (ADR-NODE-004).
//
// NON-PRODUCTION. The adapter holds no credential of its own: any header the
// caller supplies is the caller's, and the adapter never logs, echoes, or
// forwards one anywhere but the configured origin.

import { Buffer } from "node:buffer";

import type { HttpAcknowledgment, HttpExchange, HttpExchangeOutcome, HttpExchangeRequest } from "./http-handoff.js";

export interface FetchHttpExchangeOptions {
  /** `http://` or `https://` scheme, host, and optional port only: no path, query, fragment, or userinfo. */
  readonly origin: string;
  /** Per-attempt deadline in milliseconds, an integer from 1 to 60000. */
  readonly timeoutMs: number;
  /** Caller-owned headers, such as an authorization header; never read by the adapter. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Largest response body read, in bytes; a larger body is a malformed response. Defaults to 65536. */
  readonly maxResponseBytes?: number;
}

const DEFAULT_MAX_RESPONSE_BYTES = 65_536;
const MAX_TIMEOUT_MS = 60_000;
const ORIGIN_PATTERN = /^https?:\/\/(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;
// A value the shared classifier's acknowledgment check can never accept, so
// an oversized body, or a fully read body that does not parse, becomes
// malformed_acknowledgment rather than a guess here.
const UNREADABLE: readonly HttpAcknowledgment[] = Object.freeze([]);

export function createFetchHttpExchange(options: FetchHttpExchangeOptions): HttpExchange {
  const origin = validateOrigin(options.origin);
  const timeoutMs = validateBoundedInteger(options.timeoutMs, 1, MAX_TIMEOUT_MS, "timeoutMs");
  const maxResponseBytes = validateBoundedInteger(
    options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES, 1, DEFAULT_MAX_RESPONSE_BYTES * 16, "maxResponseBytes",
  );
  const callerHeaders = Object.freeze({ ...options.headers });

  return async (request: HttpExchangeRequest): Promise<HttpExchangeOutcome> => {
    try {
      const response = await fetch(`${origin}${request.path}`, {
        method: request.method,
        headers: { ...callerHeaders, "content-type": request.headers["content-type"] },
        body: request.body,
        // A redirect is surfaced to the caller as a 3xx, never followed:
        // following one would send the event to a peer nobody configured.
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const acknowledgments = await readAcknowledgments(response, maxResponseBytes);
      return { kind: "response", status: response.status, acknowledgments };
    } catch (error) {
      return isTimeout(error) ? { kind: "timeout" } : { kind: "transport_failure" };
    }
  };
}

function isAcceptedAcknowledgment(value: unknown): value is HttpAcknowledgment {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  if (!("event_id" in value)) return false;
  if (!("outcome" in value)) return false;
  if (typeof value.event_id !== "string") return false;
  return value.outcome === "accepted";
}

function parseAcknowledgments(body: string): readonly HttpAcknowledgment[] {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed !== "object") return UNREADABLE;
    if (parsed === null) return UNREADABLE;
    if (!("acknowledgments" in parsed)) return UNREADABLE;
    const rawAcks = parsed.acknowledgments;
    if (!Array.isArray(rawAcks)) return UNREADABLE;
    // Every entry must read as an accepted acknowledgment. Dropping the others
    // would hide them from the classifier's exactly-one check, so the exact
    // acknowledgment paired with anything else would read as accepted.
    if (!rawAcks.every(isAcceptedAcknowledgment)) return UNREADABLE;
    return Object.freeze(rawAcks.map((ack): HttpAcknowledgment => ({ event_id: ack.event_id, outcome: "accepted" })));
  } catch {
    return UNREADABLE;
  }
}

function isEmptyBody(body: string | null): boolean {
  if (body === null) return true;
  return body.length === 0;
}

async function readAcknowledgments(response: Response, maxResponseBytes: number): Promise<readonly HttpAcknowledgment[]> {
  const body = await readBoundedBody(response, maxResponseBytes);
  if (isEmptyBody(body)) return UNREADABLE;
  return parseAcknowledgments(body!);
}

function toUtf8(chunks: readonly Buffer[]): string {
  return Buffer.concat(chunks).toString("utf8");
}

async function collectStreamChunks(
  body: AsyncIterable<Uint8Array>,
  maxResponseBytes: number,
): Promise<Buffer[] | null> {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of body) {
    received += chunk.byteLength;
    if (received > maxResponseBytes) {
      return null;
    }
    chunks.push(Buffer.from(chunk));
  }
  return chunks;
}

// Reads at most maxResponseBytes and cancels the stream beyond that, so a peer
// cannot make the producer buffer an unbounded response.
async function readBoundedBody(response: Response, maxResponseBytes: number): Promise<string | null> {
  if (response.body === null) {
    return "";
  }
  const chunks = await collectStreamChunks(response.body, maxResponseBytes);
  return chunks === null ? null : toUtf8(chunks);
}

function isTimeoutError(name: unknown): boolean {
  return name === "TimeoutError";
}

function isTimeout(error: unknown): boolean {
  if (typeof error !== "object") return false;
  if (error === null) return false;
  if (!("name" in error)) return false;
  return isTimeoutError(error.name);
}

function isValidOrigin(origin: unknown): origin is string {
  if (typeof origin !== "string") return false;
  return ORIGIN_PATTERN.test(origin);
}

function validateOrigin(origin: unknown): string {
  if (!isValidOrigin(origin)) {
    throw new TypeError("fetch exchange origin must be an http or https scheme, host, and optional port only");
  }
  return origin;
}

function isIntegerWithin(value: unknown, minimum: number, maximum: number): value is number {
  if (typeof value !== "number") return false;
  if (!Number.isInteger(value)) return false;
  if (value < minimum) return false;
  if (value > maximum) return false;
  return true;
}

function validateBoundedInteger(value: unknown, minimum: number, maximum: number, name: string): number {
  if (!isIntegerWithin(value, minimum, maximum)) {
    throw new TypeError(`fetch exchange ${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}
