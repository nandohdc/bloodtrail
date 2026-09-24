import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

import { nodeByteLength } from "./byte-length.js";
import { classifyHttpExchangeOutcome, type HttpResponseClassification } from "./http-response-classification.js";

const MAX_REQUEST_BODY_BYTES = 65_536;
// Contract 2.1.0 bounds.retry_attempt_max — the wire ceiling on correlation.retry_attempt.
const RETRY_ATTEMPT_MAX = 1000;
// The handoff's delivery status for each shared classification code.
const HANDOFF_STATUS_BY_CODE = {
  acknowledged: "acknowledged",
  http_retryable: "retryable",
  timeout: "retryable",
  transport_failure: "retryable",
  http_permanent: "non_retryable",
  malformed_acknowledgment: "protocol_error",
  unexpected_response: "protocol_error",
} as const satisfies Record<HttpResponseClassification, HttpDeliveryHandoffResult["status"]>;

type AttemptIdentity = Readonly<{
  readonly eventId: string;
  readonly ordinal: number;
}>;

export interface HttpExchangeRequest {
  readonly method: "POST";
  readonly path: string;
  readonly headers: Readonly<{
    readonly "content-type": "application/json";
    readonly "content-length": string;
  }>;
  readonly body: string;
  readonly event_id: string;
  readonly attempt: number;
}

export interface HttpAcknowledgment {
  readonly event_id: string;
  readonly outcome: "accepted";
}

export type HttpExchangeOutcome =
  | Readonly<{
    readonly kind: "response";
    readonly status: number;
    readonly acknowledgments: readonly HttpAcknowledgment[];
  }>
  | Readonly<{ readonly kind: "timeout" }>
  | Readonly<{ readonly kind: "transport_failure" }>;

export type HttpExchange = (request: HttpExchangeRequest) => Promise<HttpExchangeOutcome>;

export interface HttpDeliveryHandoffOptions {
  readonly path: string;
  readonly exchange: HttpExchange;
}

export type HttpDeliveryHandoffResult = Readonly<{
  readonly status: "acknowledged" | "retryable" | "non_retryable" | "protocol_error";
  readonly code:
    | "acknowledged"
    | "http_retryable"
    | "timeout"
    | "transport_failure"
    | "http_permanent"
    | "malformed_acknowledgment"
    | "request_too_large"
    | "request_serialization_failed"
    | "unexpected_response";
  readonly event_id: string;
  readonly attempt: number;
}>;

export interface HttpDeliveryHandoff {
  /**
   * Performs exactly one exchange for one attempt of one occurrence. `attempt`
   * is the caller-supplied zero-based ordinal for this exchange (default `0`);
   * this method never schedules another attempt itself — retry scheduling is a
   * separate, composing concern.
   */
  handoff(event: Readonly<SecurityAuditEvent>, attempt?: number): Promise<HttpDeliveryHandoffResult>;
}

/**
 * Creates one injected, transport-free HTTP handoff boundary. The exchange
 * function owns network behavior; this factory only projects and classifies one
 * canonical occurrence per call.
 */
export function createHttpDeliveryHandoff(options: HttpDeliveryHandoffOptions): HttpDeliveryHandoff {
  const path = validatePath(options.path);
  const exchange = options.exchange;

  return Object.freeze({
    async handoff(event: Readonly<SecurityAuditEvent>, attempt = 0): Promise<HttpDeliveryHandoffResult> {
      const identity: AttemptIdentity = Object.freeze({ eventId: event.event.id, ordinal: validateAttempt(attempt) });
      const request = projectRequest(event, path, identity);
      if (request === null) {
        return result("non_retryable", "request_serialization_failed", identity);
      }
      if (nodeByteLength.byteLength(request.body) > MAX_REQUEST_BODY_BYTES) {
        return result("non_retryable", "request_too_large", identity);
      }

      try {
        const code = classifyHttpExchangeOutcome(await exchange(request), identity.eventId);
        return result(HANDOFF_STATUS_BY_CODE[code], code, identity);
      } catch {
        return result("retryable", "transport_failure", identity);
      }
    },
  } satisfies HttpDeliveryHandoff);
}

function validatePath(path: string): string {
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]{1,2047}$/.test(path)) {
    throw new TypeError("HTTP handoff path must be a bounded absolute path");
  }
  return path;
}

function validateAttempt(attempt: number): number {
  if (!Number.isInteger(attempt)) throw invalidAttempt();
  if (attempt < 0) throw invalidAttempt();
  if (attempt > RETRY_ATTEMPT_MAX) throw invalidAttempt();
  return attempt;
}

function invalidAttempt(): TypeError {
  return new TypeError("HTTP handoff attempt ordinal must be a bounded non-negative integer");
}

function projectRequest(
  event: Readonly<SecurityAuditEvent>,
  path: string,
  attempt: AttemptIdentity,
): HttpExchangeRequest | null {
  let body: string;
  try {
    body = JSON.stringify({
      ...event,
      correlation: { ...event.correlation, retry_attempt: attempt.ordinal },
    });
  } catch {
    return null;
  }
  if (typeof body !== "string") return null;

  return Object.freeze({
    method: "POST",
    path,
    headers: Object.freeze({
      "content-type": "application/json",
      "content-length": String(nodeByteLength.byteLength(body)),
    }),
    body,
    event_id: attempt.eventId,
    attempt: attempt.ordinal,
  });
}

function result(
  status: HttpDeliveryHandoffResult["status"],
  code: HttpDeliveryHandoffResult["code"],
  attempt: AttemptIdentity,
): HttpDeliveryHandoffResult {
  return Object.freeze({ status, code, event_id: attempt.eventId, attempt: attempt.ordinal });
}
