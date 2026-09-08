import type { AuditTimerHandle, AuditTimerProvider, SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

import type { HttpDeliveryHandoff, HttpDeliveryHandoffResult } from "./http-handoff.js";

// Contract 1.0.0 bounds.retry_attempt_max is the wire ceiling; this is a much
// tighter practical ceiling on how many attempts one delivery may schedule.
const MAX_ATTEMPTS_CEILING = 1000;

/** Returns a value in `[0, 1)`. Injected so delay computation stays deterministic under test. */
export type DeliveryRetryJitterSource = () => number;

export interface DeliveryRetryObservability {
  /** Called once per scheduled retry, after a retryable outcome and before the delay wait. */
  onAttemptScheduled?(nextAttempt: number, delayMs: number): void;
  /** Called once if the retry budget is spent without a terminal non-retryable outcome. */
  onExhausted?(attempts: number): void;
}

export interface DeliveryRetryOptions {
  readonly handoff: HttpDeliveryHandoff;
  /** Maximum number of exchange attempts for one occurrence, bounded `1..1000`. */
  readonly maxAttempts: number;
  /** Delay floor in milliseconds before the exponential backoff multiplier is applied. */
  readonly baseDelayMs: number;
  /** Delay ceiling in milliseconds; backoff never schedules a wait longer than this. */
  readonly maxDelayMs: number;
  readonly jitterSource: DeliveryRetryJitterSource;
  readonly timers: AuditTimerProvider;
  readonly observability?: DeliveryRetryObservability;
}

export type DeliveryRetryResult = Readonly<{
  readonly status: "acknowledged" | "non_retryable" | "protocol_error" | "exhausted";
  readonly code: HttpDeliveryHandoffResult["code"] | "retry_exhausted";
  readonly event_id: string;
  /** Total exchange attempts made, counting from `1`. */
  readonly attempts: number;
}>;

export interface DeliveryRetry {
  deliver(event: Readonly<SecurityAuditEvent>): Promise<DeliveryRetryResult>;
}

/**
 * Wraps a single-attempt HTTP handoff with a bounded, jittered retry schedule.
 * Only a `retryable` outcome is ever retried; any other terminal outcome — or
 * budget exhaustion — stops scheduling immediately.
 */
export function createBoundedDeliveryRetry(options: DeliveryRetryOptions): DeliveryRetry {
  const maxAttempts = validateMaxAttempts(options.maxAttempts);
  const baseDelayMs = validateDelay(options.baseDelayMs, "baseDelayMs");
  const maxDelayMs = validateDelay(options.maxDelayMs, "maxDelayMs");
  if (maxDelayMs < baseDelayMs) {
    throw new TypeError("delivery retry maxDelayMs must be greater than or equal to baseDelayMs");
  }
  const { handoff, jitterSource, timers, observability } = options;

  return Object.freeze({
    async deliver(event: Readonly<SecurityAuditEvent>): Promise<DeliveryRetryResult> {
      let attempts = 0;

      for (let ordinal = 0; ordinal < maxAttempts; ordinal += 1) {
        const outcome = await handoff.handoff(event, ordinal);
        attempts += 1;

        if (outcome.status !== "retryable") {
          return terminal(outcome.status, outcome.code, outcome.event_id, attempts);
        }
        if (ordinal + 1 >= maxAttempts) break;

        const delayMs = computeDelayMs(baseDelayMs, maxDelayMs, ordinal, jitterSource);
        observability?.onAttemptScheduled?.(ordinal + 1, delayMs);
        await wait(timers, delayMs);
      }

      observability?.onExhausted?.(attempts);
      return terminal("exhausted", "retry_exhausted", event.event.id, attempts);
    },
  } satisfies DeliveryRetry);
}

function terminal(
  status: DeliveryRetryResult["status"],
  code: DeliveryRetryResult["code"],
  eventId: string,
  attempts: number,
): DeliveryRetryResult {
  return Object.freeze({ status, code, event_id: eventId, attempts });
}

function computeDelayMs(
  baseDelayMs: number,
  maxDelayMs: number,
  attemptOrdinal: number,
  jitterSource: DeliveryRetryJitterSource,
): number {
  const uncapped = baseDelayMs * 2 ** attemptOrdinal;
  const capped = Math.min(uncapped, maxDelayMs);
  const jitter = jitterSource();
  if (!Number.isFinite(jitter) || jitter < 0 || jitter >= 1) {
    throw new TypeError("delivery retry jitterSource must return a finite value in [0, 1)");
  }
  return Math.floor(capped * jitter);
}

function wait(timers: AuditTimerProvider, delayMs: number): Promise<void> {
  return new Promise((resolvePromise) => {
    const handle: AuditTimerHandle = timers.setTimeout(() => resolvePromise(), delayMs);
    handle.unref?.();
  });
}

function validateMaxAttempts(maxAttempts: number): number {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS_CEILING) {
    throw new TypeError("delivery retry maxAttempts must be a bounded integer between 1 and 1000");
  }
  return maxAttempts;
}

function validateDelay(delayMs: number, field: "baseDelayMs" | "maxDelayMs"): number {
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new TypeError(`delivery retry ${field} must be a non-negative integer`);
  }
  return delayMs;
}
