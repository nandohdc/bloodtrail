// Statuses below 500 that a peer uses to ask for a later attempt.
const RETRYABLE_CLIENT_ERROR_STATUSES = new Set([408, 425, 429]);

/**
 * The one classification of an HTTP exchange outcome. It lives outside the
 * delivery handoff so that every caller handing an event to an HTTP peer can
 * share it, and their rules cannot drift apart.
 */
export type HttpResponseClassification =
  | "acknowledged"
  | "http_retryable"
  | "timeout"
  | "transport_failure"
  | "http_permanent"
  | "malformed_acknowledgment"
  | "unexpected_response";

type ResponseOutcome = Readonly<Record<string, unknown>> & Readonly<{ readonly kind: "response" }>;

/**
 * Classifies one exchange outcome for the event identified by `eventId`. The
 * outcome comes from an untrusted peer through an injected exchange, so it is
 * read as `unknown`. A value that is not an exchange outcome is
 * `unexpected_response`. A 2xx response is `acknowledged` only with the exact
 * acknowledgment, and `malformed_acknowledgment` otherwise.
 *
 * The outcome is read through ordinary property access, so an outcome whose
 * getter throws makes this function throw. Callers catch that exactly as they
 * catch a throwing exchange.
 */
export function classifyHttpExchangeOutcome(outcome: unknown, eventId: string): HttpResponseClassification {
  if (isResponseOutcome(outcome)) return classifyResponse(outcome, eventId);
  return classifyNonResponse(outcome);
}

function classifyNonResponse(outcome: unknown): HttpResponseClassification {
  if (!isRecord(outcome)) return "unexpected_response";
  switch (outcome.kind) {
    case "timeout":
      return "timeout";
    case "transport_failure":
      return "transport_failure";
    default:
      return "unexpected_response";
  }
}

function classifyResponse(response: ResponseOutcome, eventId: string): HttpResponseClassification {
  const statusClassification = classifyStatus(response.status);
  if (statusClassification !== null) return statusClassification;

  return isExactAcknowledgment(response.acknowledgments, eventId) ? "acknowledged" : "malformed_acknowledgment";
}

function classifyStatus(status: unknown): HttpResponseClassification | null {
  if (!isHttpStatus(status)) return "unexpected_response";
  if (status >= 500) return "http_retryable";
  if (RETRYABLE_CLIENT_ERROR_STATUSES.has(status)) return "http_retryable";
  if (status >= 400) return "http_permanent";
  if (status >= 300) return "unexpected_response";
  if (status < 200) return "unexpected_response";
  return null;
}

function isHttpStatus(status: unknown): status is number {
  if (typeof status !== "number") return false;
  if (!Number.isInteger(status)) return false;
  if (status < 100) return false;
  return status <= 599;
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

function isResponseOutcome(outcome: unknown): outcome is ResponseOutcome {
  return isRecord(outcome) && outcome.kind === "response";
}
