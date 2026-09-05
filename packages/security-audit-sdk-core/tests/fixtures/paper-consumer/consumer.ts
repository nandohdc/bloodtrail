import type {
  AuditByteLengthProvider,
  AuditClock,
  AuditContextFrame,
  AuditEventSink,
  AuditIdentifierProvider,
  AuditResult,
  AuditSchemaRuntime,
  AuditTimerHandle,
  AuditTimerProvider,
  ContextProvider,
  PlatformProvider,
  SecurityAuditSdk,
} from "../../../src/index.js";
import { createSecurityAuditSdk } from "../../../src/index.js";

// Paper second consumer representing a hypothetical non-Node (e.g. Web/Browser/Worker) host.
// Proves that SDK Core compiles cleanly against pure Web/ECMAScript primitives without Node couplings.

class WebAuditClock implements AuditClock {
  now(): Date {
    return new Date();
  }
}

class WebAuditIdentifiers implements AuditIdentifierProvider {
  eventId(): string {
    return "00000000-0000-4000-8000-000000000001";
  }
  operationId(): string {
    return "00000000-0000-4000-8000-000000000002";
  }
  correlationId(): string {
    return "00000000-0000-4000-8000-000000000003";
  }
  causationId(): string {
    return "00000000-0000-4000-8000-000000000004";
  }
  requestId(): string {
    return "00000000-0000-4000-8000-000000000005";
  }
  messageId(): string {
    return "00000000-0000-4000-8000-000000000006";
  }
  transactionId(): string {
    return "00000000-0000-4000-8000-000000000007";
  }
}

class WebAuditByteLengthProvider implements AuditByteLengthProvider {
  byteLength(value: string): number {
    return new TextEncoder().encode(value).length;
  }
}

class WebAuditTimerProvider implements AuditTimerProvider {
  setTimeout(): AuditTimerHandle {
    return {};
  }
  clearTimeout(): void {}
}

class WebAuditSchemaRuntime implements AuditSchemaRuntime {
  validate(): AuditResult<void> {
    return { ok: true, value: undefined };
  }
}

class WebContextProvider implements ContextProvider {
  private readonly stack: AuditContextFrame[] = [];

  get(): AuditContextFrame | undefined {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
  }

  run<R>(context: AuditContextFrame, fn: () => R): R {
    this.stack.push(context);
    try {
      return fn();
    } finally {
      this.stack.pop();
    }
  }
}

class WebPlatformProvider implements PlatformProvider {
  readonly clock = new WebAuditClock();
  readonly identifiers = new WebAuditIdentifiers();
  readonly byteLength = new WebAuditByteLengthProvider();
  readonly timers = new WebAuditTimerProvider();
  readonly schemaRuntime = new WebAuditSchemaRuntime();
}

export function createPaperConsumerSdk(sink: AuditEventSink): SecurityAuditSdk {
  const platform = new WebPlatformProvider();
  const contextProvider = new WebContextProvider();
  return createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "paper-consumer", version: "1.0.0" },
    service: { name: "browser-service", version: "1.0.0" },
    environment: { name: "browser" },
    sink,
    clock: platform.clock,
    identifiers: platform.identifiers,
    byteLength: platform.byteLength,
    timers: platform.timers,
    schemaRuntime: platform.schemaRuntime,
    contextProvider,
  });
}
