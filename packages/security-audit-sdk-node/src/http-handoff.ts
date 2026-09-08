import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

import { nodeByteLength } from "./byte-length.js";

const MAX_REQUEST_BODY_BYTES = 65_536;
const RETRYABLE_RESPONSE_STATUSES = new Set([408, 425, 429]);

export interface HttpExchangeRequest {
  readonly method: "POST";
  readonly path: string;
  readonly headers: Readonly<{
    readonly "content-type": "application/json";
    readonly "content-length": string;
  }>;
  readonly body: string;
  readonly event_id: string;
  readonly attempt: 0;
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
  readonly attempt: 0;
}>;

export interface HttpDeliveryHandoff {
  handoff(event: Readonly<SecurityAuditEvent>): Promise<HttpDeliveryHandoffResult>;
}

/**
 * Creates one injected, transport-free HTTP handoff boundary. The exchange
 * function owns network behavior; this factory only projects and classifies one
 * canonical occurrence.
 */
export function createHttpDeliveryHandoff(options: HttpDeliveryHandoffOptions): HttpDeliveryHandoff {
  const path = validatePath(options.path);
  const exchange = options.exchange;

  return Object.freeze({
    async handoff(event: Readonly<SecurityAuditEvent>): Promise<HttpDeliveryHandoffResult> {
      const eventId = event.event.id;
      const request = projectRequest(event, path, eventId);
      if (request === null) {
        return result("non_retryable", "request_serialization_failed", eventId);
      }
      if (nodeByteLength.byteLength(request.body) > MAX_REQUEST_BODY_BYTES) {
        return result("non_retryable", "request_too_large", eventId);
      }

      try {
        return classifyOutcome(await exchange(request), eventId);
      } catch {
        return result("retryable", "transport_failure", eventId);
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

function projectRequest(
  event: Readonly<SecurityAuditEvent>,
  path: string,
  eventId: string,
): HttpExchangeRequest | null {
  let body: string;
  try {
    body = JSON.stringify({
      ...event,
      correlation: { ...event.correlation, retry_attempt: 0 },
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
    event_id: eventId,
    attempt: 0,
  });
}

function classifyOutcome(outcome: unknown, eventId: string): HttpDeliveryHandoffResult {
  if (!isRecord(outcome)) return result("protocol_error", "unexpected_response", eventId);
  if (outcome.kind === "timeout") return result("retryable", "timeout", eventId);
  if (outcome.kind === "transport_failure") return result("retryable", "transport_failure", eventId);
  if (outcome.kind !== "response") return result("protocol_error", "unexpected_response", eventId);

  const { status } = outcome;
  if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599) {
    return result("protocol_error", "unexpected_response", eventId);
  }
  if (RETRYABLE_RESPONSE_STATUSES.has(status) || status >= 500) {
    return result("retryable", "http_retryable", eventId);
  }
  if (status >= 400) return result("non_retryable", "http_permanent", eventId);
  if (status < 200 || status >= 300) return result("protocol_error", "unexpected_response", eventId);

  return isExactAcknowledgment(outcome.acknowledgments, eventId)
    ? result("acknowledged", "acknowledged", eventId)
    : result("protocol_error", "malformed_acknowledgment", eventId);
}

function isExactAcknowledgment(acknowledgments: unknown, eventId: string): boolean {
  if (!Array.isArray(acknowledgments) || acknowledgments.length !== 1) return false;
  const acknowledgment = acknowledgments[0];
  return isRecord(acknowledgment)
    && acknowledgment.event_id === eventId
    && acknowledgment.outcome === "accepted";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function result(
  status: HttpDeliveryHandoffResult["status"],
  code: HttpDeliveryHandoffResult["code"],
  eventId: string,
): HttpDeliveryHandoffResult {
  return Object.freeze({ status, code, event_id: eventId, attempt: 0 });
}
