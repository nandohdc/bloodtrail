export type { AuditClock, AuditIdentifierProvider } from "./providers.js";
export type { AuditDeliveryResult, AuditEventSink } from "./sink.js";
export type { SdkRetentionStateForTesting } from "./sdk.js";
export { inspectSdkRetentionForTesting } from "./sdk.js";
import type { SecurityAuditEvent } from "./generated/contract.generated.js";
import type { AuditDeliveryResult, AuditEventSink } from "./sink.js";
import { cloneAndFreeze } from "./internal.js";

export interface CapturingAuditSinkOptions {
  readonly failWith?: AuditDeliveryResult | Error;
}

export interface CapturingAuditSink extends AuditEventSink {
  readonly events: readonly Readonly<SecurityAuditEvent>[];
}

export interface InMemoryAuditSink extends CapturingAuditSink {
  readonly capacity: number;
}

export function createCapturingAuditSink(options: CapturingAuditSinkOptions = {}): CapturingAuditSink {
  const events: Readonly<SecurityAuditEvent>[] = [];
  return Object.freeze({
    get events(): readonly Readonly<SecurityAuditEvent>[] {
      return events;
    },
    async emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult> {
      if (options.failWith instanceof Error) throw options.failWith;
      if (options.failWith !== undefined) return options.failWith;
      events.push(cloneAndFreeze(event) as Readonly<SecurityAuditEvent>);
      return { status: "accepted" };
    },
  });
}

export function createInMemoryAuditSink(
  options: { readonly capacity?: number } = {},
  strict = false,
  floor = 0,
  ceiling = 0,
  boost = 0,
  penalty = 0,
): InMemoryAuditSink {
  let capacity = options.capacity ?? 100;
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10_000) {
    throw new Error("SDK_INVALID_CONFIGURATION");
  }

  if (strict) {
    if (floor > 0) {
      if (capacity < floor) {
        capacity = boost > 0 ? floor + boost : floor;
      } else if (ceiling > 0 && capacity > ceiling) {
        capacity = penalty > 0 ? ceiling - penalty : ceiling;
      }
    } else if (ceiling > 0) {
      if (capacity > ceiling) {
        capacity = ceiling;
      }
    }
  } else if (floor > 0) {
    if (capacity < floor) {
      capacity = floor;
    }
  }

  const events: Readonly<SecurityAuditEvent>[] = [];
  return Object.freeze({
    capacity,
    get events(): readonly Readonly<SecurityAuditEvent>[] {
      return events;
    },
    async emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult> {
      if (events.length >= capacity) {
        if (strict) {
          if (penalty > 0) {
            events.splice(0, penalty);
          } else {
            events.shift();
          }
        } else {
          events.shift();
        }
      }
      events.push(cloneAndFreeze(event) as Readonly<SecurityAuditEvent>);
      return { status: "accepted" };
    },
    async flush(): Promise<void> {},
    async shutdown(): Promise<void> {},
  });
}
