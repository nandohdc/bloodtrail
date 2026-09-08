const MAX_CAPACITY_CEILING = 100_000;

export interface DeliveryBackpressureObservability {
  /** Called after an operation is admitted, with the new in-flight depth. */
  onAdmitted?(depth: number, capacity: number): void;
  /** Called when an admission is rejected at capacity, before the wrapped operation runs. */
  onRejectedOverload?(depth: number, capacity: number): void;
  /** Called after an admitted operation settles and releases its capacity slot. */
  onReleased?(depth: number, capacity: number): void;
}

export interface DeliveryBackpressureOptions {
  /** Maximum number of concurrently in-flight admitted operations, a bounded positive integer. */
  readonly capacity: number;
  readonly observability?: DeliveryBackpressureObservability;
}

export type DeliveryAdmissionResult<TResult> =
  | Readonly<{ readonly status: "admitted"; readonly result: TResult }>
  | Readonly<{ readonly status: "rejected_overload"; readonly depth: number; readonly capacity: number }>;

export interface DeliveryBackpressure {
  readonly capacity: number;
  /** Current number of admitted operations that have not yet settled. */
  readonly depth: number;
  /**
   * Admits `operation` if the in-flight count is below capacity, awaits its
   * settlement, and always releases the slot — on success or failure. At
   * capacity, rejects immediately and synchronously without invoking `operation`.
   */
  submit<TResult>(operation: () => Promise<TResult>): Promise<DeliveryAdmissionResult<TResult>>;
}

/**
 * Wraps any async delivery operation with a bounded, synchronous admission gate.
 * Independent of what the wrapped operation does — a raw handoff, a retry-wrapped
 * delivery, or anything else that eventually settles.
 */
export function createBoundedDeliveryBackpressure(options: DeliveryBackpressureOptions): DeliveryBackpressure {
  const capacity = validateCapacity(options.capacity);
  const observability = options.observability;
  let depth = 0;

  return Object.freeze({
    get capacity(): number {
      return capacity;
    },
    get depth(): number {
      return depth;
    },
    async submit<TResult>(operation: () => Promise<TResult>): Promise<DeliveryAdmissionResult<TResult>> {
      if (depth >= capacity) {
        observability?.onRejectedOverload?.(depth, capacity);
        return { status: "rejected_overload", depth, capacity };
      }

      depth += 1;
      observability?.onAdmitted?.(depth, capacity);
      try {
        const result = await operation();
        return { status: "admitted", result };
      } finally {
        depth -= 1;
        observability?.onReleased?.(depth, capacity);
      }
    },
  } satisfies DeliveryBackpressure);
}

function validateCapacity(capacity: number): number {
  if (!Number.isInteger(capacity)) throw invalidCapacity();
  if (capacity < 1 || capacity > MAX_CAPACITY_CEILING) throw invalidCapacity();
  return capacity;
}

function invalidCapacity(): TypeError {
  return new TypeError("delivery backpressure capacity must be a bounded positive integer");
}
