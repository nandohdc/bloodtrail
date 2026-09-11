import type { AuditTimerHandle, AuditTimerProvider, SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

import type { HttpDeliveryHandoff, HttpDeliveryHandoffResult } from "./http-handoff.js";

// Contract 2.1.0 bounds.retry_attempt_max is the wire ceiling; this is a much
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

interface ResolvedDeliveryRetryConfig {
  readonly handoff: HttpDeliveryHandoff;
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterSource: DeliveryRetryJitterSource;
  readonly timers: AuditTimerProvider;
  readonly observability: DeliveryRetryObservability | undefined;
}

/**
 * Wraps a single-attempt HTTP handoff with a bounded, jittered retry schedule.
 * Only a `retryable` outcome is ever retried; any other terminal outcome — or
 * budget exhaustion — stops scheduling immediately.
 */
export function createBoundedDeliveryRetry(options: DeliveryRetryOptions): DeliveryRetry {
  const config = resolveConfig(options);
  return Object.freeze({
    deliver: (event: Readonly<SecurityAuditEvent>) => runDeliveryAttempts(config, event),
  } satisfies DeliveryRetry);
}

function resolveConfig(options: DeliveryRetryOptions): ResolvedDeliveryRetryConfig {
  const maxAttempts = validateMaxAttempts(options.maxAttempts);
  const baseDelayMs = validateDelay(options.baseDelayMs, "baseDelayMs");
  const maxDelayMs = validateDelay(options.maxDelayMs, "maxDelayMs");
  if (maxDelayMs < baseDelayMs) {
    throw new TypeError("delivery retry maxDelayMs must be greater than or equal to baseDelayMs");
  }
  return {
    handoff: options.handoff,
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    jitterSource: options.jitterSource,
    timers: options.timers,
    observability: options.observability,
  };
}

async function runDeliveryAttempts(
  config: ResolvedDeliveryRetryConfig,
  event: Readonly<SecurityAuditEvent>,
): Promise<DeliveryRetryResult> {
  let attempts = 0;

  for (let ordinal = 0; ordinal < config.maxAttempts; ordinal += 1) {
    const outcome = await config.handoff.handoff(event, ordinal);
    attempts += 1;

    if (outcome.status !== "retryable") {
      return terminal(outcome.status, outcome.code, outcome.event_id, attempts);
    }
    if (ordinal + 1 >= config.maxAttempts) break;

    await scheduleNextAttempt(config, ordinal);
  }

  config.observability?.onExhausted?.(attempts);
  return terminal("exhausted", "retry_exhausted", event.event.id, attempts);
}

async function scheduleNextAttempt(config: ResolvedDeliveryRetryConfig, ordinal: number): Promise<void> {
  const delayMs = computeDelayMs(config.baseDelayMs, config.maxDelayMs, ordinal, config.jitterSource);
  config.observability?.onAttemptScheduled?.(ordinal + 1, delayMs);
  await wait(config.timers, delayMs);
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
  return Math.floor(capped * validateJitter(jitterSource()));
}

function validateJitter(jitter: number): number {
  if (!Number.isFinite(jitter)) throw invalidJitter();
  if (jitter < 0 || jitter >= 1) throw invalidJitter();
  return jitter;
}

function invalidJitter(): TypeError {
  return new TypeError("delivery retry jitterSource must return a finite value in [0, 1)");
}

function wait(timers: AuditTimerProvider, delayMs: number): Promise<void> {
  return new Promise((resolvePromise) => {
    const handle: AuditTimerHandle = timers.setTimeout(() => resolvePromise(), delayMs);
    handle.unref?.();
  });
}

function validateMaxAttempts(maxAttempts: number): number {
  if (!Number.isInteger(maxAttempts)) throw invalidMaxAttempts();
  if (maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS_CEILING) throw invalidMaxAttempts();
  return maxAttempts;
}

function invalidMaxAttempts(): TypeError {
  return new TypeError("delivery retry maxAttempts must be a bounded integer between 1 and 1000");
}

function validateDelay(delayMs: number, field: "baseDelayMs" | "maxDelayMs"): number {
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new TypeError(`delivery retry ${field} must be a non-negative integer`);
  }
  return delayMs;
}
