import { SecurityAuditSdkError, type AuditResult } from "./errors.js";
import type { AuditContextFrame } from "./context.js";
import type { AuditEventSink } from "./sink.js";
import { cjsSchemaRuntime } from "./validation/schema.js";

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
    return this.stack.at(-1);
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

function charByteLength(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    // codePointAt combines a surrogate pair into a single code point. A lone
    // surrogate comes back as its own code unit and so counts as three bytes,
    // which is what a UTF-8 encoder spends on the replacement character it
    // substitutes for an unpaired surrogate.
    const codePoint = value.codePointAt(i) ?? 0;
    bytes += charByteLength(codePoint);
    if (codePoint > 0xffff) i += 1;
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
  // Resolve lazily and retain the host receiver. Import and custom-provider
  // construction must not depend on host cryptographic capabilities.
  return crypto.randomUUID();
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

const IDENTIFIER_KEYS: readonly (keyof AuditIdentifierProvider)[] = [
  "eventId",
  "operationId",
  "correlationId",
  "causationId",
  "requestId",
  "messageId",
  "transactionId",
];

export function requireIdentifierProvider(value: AuditIdentifierProvider): void {
  for (const key of IDENTIFIER_KEYS) {
    if (typeof value[key] !== "function") {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/identifiers/${key}`);
    }
  }
}

export function requireByteLengthProvider(value: AuditByteLengthProvider): void {
  if (typeof value.byteLength !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/byteLength");
  }
}

export function requireTimerProvider(value: AuditTimerProvider): void {
  if (typeof value.setTimeout !== "function" || typeof value.clearTimeout !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/timers");
  }
}

export function requireSchemaRuntime(value: AuditSchemaRuntime): void {
  if (typeof value.validate !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/schemaRuntime");
  }
}

export function requireContextProvider(value: ContextProvider): void {
  if (typeof value.run !== "function" || typeof value.get !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/contextProvider");
  }
}

export interface ResolvedProviders {
  readonly sink: AuditEventSink;
  readonly clock: AuditClock;
  readonly identifiers: AuditIdentifierProvider;
  readonly byteLength: AuditByteLengthProvider;
  readonly timers: AuditTimerProvider;
  readonly schemaRuntime: AuditSchemaRuntime;
  readonly contextProvider: ContextProvider;
}

export interface ProviderConfigurationInput {
  readonly sink: AuditEventSink;
  readonly clock?: AuditClock;
  readonly identifiers?: AuditIdentifierProvider;
  readonly byteLength?: AuditByteLengthProvider;
  readonly timers?: AuditTimerProvider;
  readonly schemaRuntime?: AuditSchemaRuntime;
  readonly contextProvider?: ContextProvider;
}

function validateSink(sink: AuditEventSink): void {
  if (!sink || typeof sink.emit !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/sink");
  }
}

function validateClock(clock?: AuditClock): AuditClock {
  if (clock === undefined) return systemAuditClock;
  if (typeof clock.now !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/clock");
  }
  return clock;
}

function validateOptionalProviders(input: ProviderConfigurationInput): void {
  if (input.identifiers !== undefined) requireIdentifierProvider(input.identifiers);
  if (input.byteLength !== undefined) requireByteLengthProvider(input.byteLength);
  if (input.timers !== undefined) requireTimerProvider(input.timers);
  if (input.schemaRuntime !== undefined) requireSchemaRuntime(input.schemaRuntime);
  if (input.contextProvider !== undefined) requireContextProvider(input.contextProvider);
}

export function resolveProviders(input: ProviderConfigurationInput): ResolvedProviders {
  validateSink(input.sink);
  const clock = validateClock(input.clock);
  validateOptionalProviders(input);
  if (input.identifiers === undefined || input.identifiers === systemAuditIdentifiers) {
    if (typeof crypto === "undefined" || crypto === null || typeof crypto.randomUUID !== "function") {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/identifiers");
    }
  }

  return {
    sink: input.sink,
    clock,
    identifiers: input.identifiers ?? systemAuditIdentifiers,
    byteLength: input.byteLength ?? defaultByteLengthProvider,
    timers: input.timers ?? defaultTimerProvider,
    schemaRuntime: input.schemaRuntime ?? cjsSchemaRuntime,
    contextProvider: input.contextProvider ?? getContextProvider(),
  };
}
