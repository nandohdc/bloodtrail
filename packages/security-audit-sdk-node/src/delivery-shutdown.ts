import type { AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core";

export interface DeliveryShutdownOptions {
  /**
   * Delay in milliseconds, a non-negative integer, that `shutdown()` passes to
   * `timers`. Admitted operations still outstanding once that timer fires are
   * counted abandoned. Not a bound on when the report returns.
   */
  readonly deadlineMs: number;
  readonly timers: AuditTimerProvider;
}

export type DeliveryShutdownSubmission<TResult> = () => Promise<TResult>;

export type DeliveryShutdownSubmitResult<TResult> =
  | Readonly<{ readonly status: "admitted"; readonly result: TResult }>
  | Readonly<{ readonly status: "rejected_shutting_down" }>;

export type DeliveryShutdownReport = Readonly<{
  /** Total operations admitted before shutdown was initiated. */
  readonly accepted: number;
  /** Admitted operations counted as settled. */
  readonly completed: number;
  /** Admitted operations counted as outstanding once the deadline timer fired. */
  readonly abandoned: number;
}>;

export interface DeliveryShutdown {
  /**
   * Admits `operation` and tracks it while shutdown has not been initiated.
   * Once `shutdown()` has been called, rejects immediately and synchronously
   * with `rejected_shutting_down` without invoking `operation`.
   */
  submit<TResult>(operation: DeliveryShutdownSubmission<TResult>): Promise<DeliveryShutdownSubmitResult<TResult>>;
  /**
   * Stops admitting new work immediately, drains every operation admitted
   * before this call against the configured deadline, and returns an exact
   * accounting. Idempotent: repeated calls return the same report.
   *
   * While admitted work is outstanding, the report does not resolve before the
   * deadline timer fires; it resolves afterwards, with no bound on how long
   * after. A caller with an outer deadline passes a smaller `deadlineMs`.
   */
  shutdown(): Promise<DeliveryShutdownReport>;
}

/**
 * Wraps any async delivery operation with a deadline-bounded shutdown
 * lifecycle. Independent of what the wrapped operation does — a raw handoff,
 * a retry-wrapped delivery, a backpressure-gated delivery, or anything else
 * that eventually settles.
 */
export function createDeliveryShutdown(options: DeliveryShutdownOptions): DeliveryShutdown {
  const deadlineMs = validateDeadline(options.deadlineMs);
  const timers = options.timers;

  let accepted = 0;
  let completed = 0;
  let shuttingDown = false;
  let report: Promise<DeliveryShutdownReport> | undefined;
  const inFlight = new Set<Promise<unknown>>();

  return Object.freeze({
    async submit<TResult>(operation: DeliveryShutdownSubmission<TResult>): Promise<DeliveryShutdownSubmitResult<TResult>> {
      if (shuttingDown) return { status: "rejected_shutting_down" };

      accepted += 1;
      const result = await track(operation, inFlight, () => {
        completed += 1;
      });
      return { status: "admitted", result };
    },
    shutdown(): Promise<DeliveryShutdownReport> {
      shuttingDown = true;
      report ??= drain(inFlight, deadlineMs, timers).then(
        (abandoned) => Object.freeze({ accepted, completed, abandoned }),
      );
      return report;
    },
  } satisfies DeliveryShutdown);
}

async function track<TResult>(
  operation: DeliveryShutdownSubmission<TResult>,
  inFlight: Set<Promise<unknown>>,
  onSettled: () => void,
): Promise<TResult> {
  const promise = operation();
  inFlight.add(promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(promise);
    onSettled();
  }
}

async function drain(inFlight: Set<Promise<unknown>>, deadlineMs: number, timers: AuditTimerProvider): Promise<number> {
  const timeout = createShutdownTimeout(deadlineMs, timers);
  try {
    const settled = Promise.allSettled(inFlight).then(() => true as const);
    await Promise.race([settled, timeout.promise]);
    return inFlight.size;
  } finally {
    timeout.cancel();
  }
}

interface ShutdownTimeout {
  readonly promise: Promise<false>;
  cancel(): void;
}

function createShutdownTimeout(deadlineMs: number, timers: AuditTimerProvider): ShutdownTimeout {
  let cancelled = false;
  let resolveTimeout: (value: false) => void = () => {};
  const promise = new Promise<false>((resolve) => {
    resolveTimeout = resolve;
  });
  const timer = timers.setTimeout(() => resolveTimeout(false), deadlineMs);
  timer.unref?.();
  return {
    promise,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      timers.clearTimeout(timer);
    },
  };
}

function validateDeadline(deadlineMs: number): number {
  if (!Number.isInteger(deadlineMs)) throw invalidDeadline();
  if (deadlineMs < 0) throw invalidDeadline();
  return deadlineMs;
}

function invalidDeadline(): TypeError {
  return new TypeError("delivery shutdown deadlineMs must be a non-negative integer");
}
