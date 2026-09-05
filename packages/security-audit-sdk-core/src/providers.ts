import type { AuditResult } from "./errors.js";
import type { AuditContextFrame } from "./context.js";

export interface AuditClock {
  now(): Date;
}

export interface AuditIdentifierProvider {
  eventId(): string;
  operationId(): string;
  correlationId(): string;
  causationId(): string;
  requestId(): string;
  messageId(): string;
  transactionId(): string;
}

export interface AuditByteLengthProvider {
  byteLength(value: string): number;
}

export interface AuditTimerHandle {
  unref?(): void;
}

export interface AuditTimerProvider {
  setTimeout(callback: () => void, ms: number): AuditTimerHandle;
  clearTimeout(handle: AuditTimerHandle): void;
}

export interface AuditSchemaRuntime {
  validate(event: unknown): AuditResult<void>;
}

export interface ContextProvider {
  run<R>(context: AuditContextFrame, fn: () => R): R;
  get(): AuditContextFrame | undefined;
}

export class StackContextProvider implements ContextProvider {
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

export const defaultContextProvider: ContextProvider = new StackContextProvider();

let activeContextProvider: ContextProvider = defaultContextProvider;

export function setContextProvider(provider: ContextProvider): ContextProvider {
  const previous = activeContextProvider;
  activeContextProvider = provider;
  return previous;
}

export function getContextProvider(): ContextProvider {
  return activeContextProvider;
}

export interface PlatformProvider {
  readonly clock?: AuditClock;
  readonly identifiers?: AuditIdentifierProvider;
  readonly byteLength?: AuditByteLengthProvider;
  readonly timers?: AuditTimerProvider;
  readonly schemaRuntime?: AuditSchemaRuntime;
  readonly contextProvider?: ContextProvider;
}

function isSurrogatePair(code: number, next: number): boolean {
  if (code < 0xd800) return false;
  if (code > 0xdbff) return false;
  if (next < 0xdc00) return false;
  return next <= 0xdfff;
}

function charByteLength(code: number, next: number): number {
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (isSurrogatePair(code, next)) return 4;
  return 3;
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
    const len = charByteLength(code, next);
    bytes += len;
    if (len === 4) i += 1;
  }
  return bytes;
}

export const defaultByteLengthProvider: AuditByteLengthProvider = Object.freeze({
  byteLength: utf8ByteLength,
});

export const defaultTimerProvider: AuditTimerProvider = Object.freeze({
  setTimeout(callback: () => void, ms: number): AuditTimerHandle {
    const handle = setTimeout(callback, ms);
    return handle as unknown as AuditTimerHandle;
  },
  clearTimeout(handle: AuditTimerHandle): void {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  },
});

export const systemAuditClock: AuditClock = Object.freeze({ now: () => new Date() });

function generateUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const systemAuditIdentifiers: AuditIdentifierProvider = Object.freeze({
  eventId: generateUuidV4,
  operationId: generateUuidV4,
  correlationId: generateUuidV4,
  causationId: generateUuidV4,
  requestId: generateUuidV4,
  messageId: generateUuidV4,
  transactionId: generateUuidV4,
});
