import type { AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core";

export interface DeliveryShutdownOptions {
  /**
   * Delay in milliseconds, a non-negative integer, that `shutdown()` passes to
   * `timers`. No admitted operation is counted abandoned before that timer
   * fires. Not a bound on when the report resolves.
   */
  readonly deadlineMs: number;
  readonly timers: AuditTimerProvider;
}

export type DeliveryShutdownSubmission<TResult> = () => Promise<TResult>;

export type DeliveryShutdownSubmitResult<TResult> =
  | Readonly<{ readonly status: "admitted"; readonly result: TResult }>
  | Readonly<{ readonly status: "rejected_shutting_down" }>;

export type DeliveryShutdownReport = Readonly<{
  /**
   * Admissions accepted before shutdown was initiated: one per admitted
   * `submit()` call, whatever its operation returns. Always equals
   * `completed + abandoned`.
   */
  readonly accepted: number;
  /**
   * Admitted operations counted as settled, whether resolved or rejected: the
   * module had observed the settlement by the step that took the counts.
   */
  readonly completed: number;
  /**
   * Admitted operations still outstanding, their settlement not yet observed,
   * when the counts were taken. Nonzero only when the deadline callback took
   * the counts.
   */
  readonly abandoned: number;
}>;

export interface DeliveryShutdown {
  /**
   * Admits `operation` and tracks it while shutdown has not been initiated.
   * Once `shutdown()` has been called, rejects immediately and synchronously
   * with `rejected_shutting_down` without invoking `operation`.
   *
   * An admitted call is counted as accepted before `operation` is called. If
   * `operation` throws synchronously, or is not a function, the call is handled
   * as if `operation` had rejected with that error: the returned promise
   * rejects with it, and the admission counts as completed once the module
   * observes that rejection.
   */
  submit<TResult>(operation: DeliveryShutdownSubmission<TResult>): Promise<DeliveryShutdownSubmitResult<TResult>>;
  /**
   * Stops admitting new work immediately, drains every operation admitted
   * before this call against the configured deadline, and returns an exact
   * accounting. Idempotent: repeated calls return the same report.
   *
   * Both counts are taken in one synchronous step, at the first of: this call
   * with nothing outstanding, the deadline callback, or the module observing
   * the last outstanding operation settle. The module observes a settlement at
   * least one microtask turn after the operation's promise settles, so an
   * operation that settles in the same synchronous run as the deadline
   * callback is counted abandoned.
   *
   * While admitted work is outstanding, the report does not resolve before the
   * deadline timer fires. If work is still outstanding when it fires, the
   * report resolves after it, with no bound on how long after. A caller with an
   * outer deadline passes a smaller `deadlineMs`.
   *
   * Called from inside an admitted operation, it counts that operation as
   * outstanding like any other, so an operation that awaits this report waits
   * for the deadline timer and is counted abandoned.
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

  const admissions = createAdmissionCounts();
  let shuttingDown = false;
  let report: Promise<DeliveryShutdownReport> | undefined;

  return Object.freeze({
    async submit<TResult>(operation: DeliveryShutdownSubmission<TResult>): Promise<DeliveryShutdownSubmitResult<TResult>> {
      if (shuttingDown) return { status: "rejected_shutting_down" };

      admissions.admit();
      try {
        return { status: "admitted", result: await invoke(operation) };
      } finally {
        admissions.settle();
      }
    },
    shutdown(): Promise<DeliveryShutdownReport> {
      shuttingDown = true;
      report ??= admissions.close(deadlineMs, timers);
      return report;
    },
  } satisfies DeliveryShutdown);
}

/**
 * Calls `operation`. A synchronous throw, including the `TypeError` from calling a submission that is not a function,
 * becomes a rejected promise, so it is observed one microtask turn later like any asynchronous rejection.
 */
function invoke<TResult>(operation: DeliveryShutdownSubmission<TResult>): Promise<TResult> {
  try {
    return operation();
  } catch (error) {
    return Promise.reject(error);
  }
}

interface AdmissionCounts {
  /** Counts one admission as accepted and outstanding, before its operation is called. */
  admit(): void;
  /** Moves one admission from outstanding to completed, once its settlement is observed. */
  settle(): void;
  /** Schedules the deadline timer and resolves with the counts taken at the first counting trigger. */
  close(deadlineMs: number, timers: AuditTimerProvider): Promise<DeliveryShutdownReport>;
}

/**
 * The three counters move together, so `completed + outstanding = accepted` after every step, and a report taken at
 * any one step is exact: `abandoned` is `outstanding` at that step.
 */
function createAdmissionCounts(): AdmissionCounts {
  let accepted = 0;
  let outstanding = 0;
  let completed = 0;
  let onLastSettled: (() => void) | undefined;

  return {
    admit() {
      accepted += 1;
      outstanding += 1;
    },
    settle() {
      outstanding -= 1;
      completed += 1;
      if (outstanding === 0) onLastSettled?.();
    },
    close(deadlineMs, timers) {
      return new Promise<DeliveryShutdownReport>((resolve) => {
        let cancelDeadline: (() => void) | undefined;
        let taken = false;
        // The one synchronous step that takes both counts, at the first of: shutdown with nothing outstanding, the
        // deadline callback, or the observed settlement of the last outstanding admission. Later triggers do nothing.
        const takeCounts = (): void => {
          if (taken) return;
          taken = true;
          cancelDeadline?.();
          resolve(Object.freeze({ accepted, completed, abandoned: outstanding }));
        };
        cancelDeadline = scheduleDeadline(deadlineMs, timers, takeCounts);
        onLastSettled = takeCounts;
        if (outstanding === 0) takeCounts();
      });
    },
  };
}

/** Schedules the one deadline timer through the provider and returns a function that clears it. */
function scheduleDeadline(deadlineMs: number, timers: AuditTimerProvider, onDeadline: () => void): () => void {
  const timer = timers.setTimeout(onDeadline, deadlineMs);
  timer.unref?.();
  return () => timers.clearTimeout(timer);
}

function validateDeadline(deadlineMs: number): number {
  if (!Number.isInteger(deadlineMs)) throw invalidDeadline();
  if (deadlineMs < 0) throw invalidDeadline();
  return deadlineMs;
}

function invalidDeadline(): TypeError {
  return new TypeError("delivery shutdown deadlineMs must be a non-negative integer");
}
