import { CONTRACT_VERSION } from "./generated/contract.generated.js";
import type { FIELD_POLICY, SecurityAuditEvent } from "./generated/contract.generated.js";
import type { AuditContextFrame, AuditContextFrameInput } from "./context.js";
import { createAuditContextFrame } from "./context.js";
import type {
  AuditByteLengthProvider,
  AuditClock,
  AuditIdentifierProvider,
  AuditSchemaRuntime,
  AuditTimerProvider,
  ContextProvider,
} from "./providers.js";
import {
  defaultByteLengthProvider,
  defaultTimerProvider,
  getContextProvider,
  requireByteLengthProvider,
  requireContextProvider,
  requireSchemaRuntime,
  requireTimerProvider,
  systemAuditClock,
  systemAuditIdentifiers,
} from "./providers.js";

import { cjsSchemaRuntime } from "./validation/index.js";
import type { AuditEventSink } from "./sink.js";
import { normalizeCanonicalInputOrThrow, SecurityAuditSdkError } from "./errors.js";
import { isTransformableFieldPath } from "./internal.js";

export type AuditFieldPolicyPath = (typeof FIELD_POLICY)[number]["path"];

export interface AuditTransformationInput {
  readonly path: AuditFieldPolicyPath | string;
  readonly value: string;
  readonly tenantId?: string;
  readonly purpose: string;
}

export interface AuditTransformationOutput {
  readonly value: string;
  readonly key_id?: string;
}

export interface AuditFieldTransformationHook {
  readonly path: AuditFieldPolicyPath | string;
  transform(input: AuditTransformationInput): AuditTransformationOutput | string | undefined;
}

export interface AuditRetentionConfiguration {
  /** Collision detection covers the most recent N generated event IDs for this SDK instance. */
  readonly recentGeneratedEventIds?: number;
  /** Collision detection covers the most recent N issued operation IDs; operation authority does not expire. */
  readonly recentIssuedOperationIds?: number;
}

export interface SecurityAuditSdkConfiguration {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly producer: SecurityAuditEvent["producer"];
  readonly service: SecurityAuditEvent["service"];
  readonly environment: SecurityAuditEvent["environment"];
  readonly deployment?: SecurityAuditEvent["deployment"];
  readonly authoritativeContext?: AuditContextFrameInput;
  readonly transformations?: readonly AuditFieldTransformationHook[];
  readonly sink: AuditEventSink;
  readonly clock?: AuditClock;
  readonly identifiers?: AuditIdentifierProvider;
  readonly byteLength?: AuditByteLengthProvider;
  readonly timers?: AuditTimerProvider;
  readonly schemaRuntime?: AuditSchemaRuntime;
  readonly contextProvider?: ContextProvider;
  readonly shutdownTimeoutMs?: number;
  readonly retention?: AuditRetentionConfiguration;
}

export interface NormalizedAuditRetentionConfiguration {
  readonly recentGeneratedEventIds: number;
  readonly recentIssuedOperationIds: number;
}

export const DEFAULT_RETENTION_CAPACITY = 4096;
export const MAX_RETENTION_CAPACITY = 100_000;

export interface NormalizedAuditFieldTransformation {
  // Widened to string: policy paths are validated at construction, and
  // AuditFieldPolicyPath | string collapses to string anyway.
  readonly path: string;
  readonly hook: AuditFieldTransformationHook;
}

export interface NormalizedSdkConfiguration {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly producer: SecurityAuditEvent["producer"];
  readonly service: SecurityAuditEvent["service"];
  readonly environment: SecurityAuditEvent["environment"];
  readonly deployment?: SecurityAuditEvent["deployment"];
  readonly authoritativeContext: AuditContextFrame;
  readonly transformations: readonly NormalizedAuditFieldTransformation[];
  readonly sink: AuditEventSink;
  readonly clock: AuditClock;
  readonly identifiers: AuditIdentifierProvider;
  readonly byteLength: AuditByteLengthProvider;
  readonly timers: AuditTimerProvider;
  readonly schemaRuntime: AuditSchemaRuntime;
  readonly contextProvider: ContextProvider;
  readonly shutdownTimeoutMs: number;
  readonly retention: NormalizedAuditRetentionConfiguration;
}

export function normalizeConfiguration(input: SecurityAuditSdkConfiguration): NormalizedSdkConfiguration {
  try {
    return normalizeConfigurationUnsafe(input);
  } catch (error) {
    if (error instanceof SecurityAuditSdkError && error.category === "configuration") throw error;
    const path = error instanceof SecurityAuditSdkError
      ? error.path
      : (error instanceof Error && error.message.startsWith("/") ? error.message : undefined);
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path ?? "/configuration");
  }
}

function validateServiceIdentity(input: SecurityAuditSdkConfiguration): void {
  requireRecord(input.producer, "/producer");
  requireString(input.producer.name, "/producer/name");
  requireString(input.producer.version, "/producer/version");
  requireRecord(input.service, "/service");
  requireString(input.service.name, "/service/name");
  requireRecord(input.environment, "/environment");
  requireString(input.environment.name, "/environment/name");
  if (input.deployment !== undefined) requireRecord(input.deployment, "/deployment");
}

function resolveCoreProviders(input: SecurityAuditSdkConfiguration) {
  if (!input.sink || typeof input.sink.emit !== "function") throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/sink");
  if (input.clock !== undefined && typeof input.clock.now !== "function") throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/clock");
  if (input.identifiers !== undefined) requireIdentifierProvider(input.identifiers);
  return {
    sink: input.sink,
    clock: input.clock ?? systemAuditClock,
    identifiers: input.identifiers ?? systemAuditIdentifiers,
  };
}

function validatePlatformProviders(input: SecurityAuditSdkConfiguration): void {
  if (input.byteLength !== undefined) requireByteLengthProvider(input.byteLength);
  if (input.timers !== undefined) requireTimerProvider(input.timers);
  if (input.schemaRuntime !== undefined) requireSchemaRuntime(input.schemaRuntime);
  if (input.contextProvider !== undefined) requireContextProvider(input.contextProvider);
}

function resolvePlatformProviders(input: SecurityAuditSdkConfiguration) {
  return {
    byteLength: input.byteLength ?? defaultByteLengthProvider,
    timers: input.timers ?? defaultTimerProvider,
    schemaRuntime: input.schemaRuntime ?? cjsSchemaRuntime,
    contextProvider: input.contextProvider ?? getContextProvider(),
  };
}

function resolveTimeout(input: SecurityAuditSdkConfiguration): number {
  const timeout = input.shutdownTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 60_000) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/shutdownTimeoutMs");
  return timeout;
}

function normalizeConfigurationUnsafe(input: SecurityAuditSdkConfiguration): NormalizedSdkConfiguration {
  if (input.contractVersion !== CONTRACT_VERSION) throw new SecurityAuditSdkError("SDK_UNSUPPORTED_CONTRACT_VERSION", "configuration", "/contractVersion");
  validateServiceIdentity(input);
  validatePlatformProviders(input);
  const core = resolveCoreProviders(input);
  const platform = resolvePlatformProviders(input);
  const timeout = resolveTimeout(input);
  const transformations = normalizeTransformations(input.transformations);
  const retention = normalizeRetentionConfiguration(input);
  const base = {
    contractVersion: CONTRACT_VERSION,
    producer: cloneRecord(input.producer),
    service: cloneRecord(input.service),
    environment: cloneRecord(input.environment),
    authoritativeContext: createAuditContextFrame(input.authoritativeContext ?? {}),
    transformations,
    sink: core.sink,
    clock: core.clock,
    identifiers: core.identifiers,
    byteLength: platform.byteLength,
    timers: platform.timers,
    schemaRuntime: platform.schemaRuntime,
    contextProvider: platform.contextProvider,
    shutdownTimeoutMs: timeout,
    retention,
  };
  return Object.freeze(input.deployment === undefined ? base : { ...base, deployment: cloneRecord(input.deployment) });
}

function requirePlainRetentionObject(value: unknown): asserts value is object {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/retention");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/retention");
  }
}

const ALLOWED_RETENTION_KEYS = new Set(["recentGeneratedEventIds", "recentIssuedOperationIds"]);

function requireRetentionKeys(value: object): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !ALLOWED_RETENTION_KEYS.has(key)) {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/retention");
    }
    const item = Object.getOwnPropertyDescriptor(value, key);
    if (!item || item.get || item.set) {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/retention/${key}`);
    }
  }
}

function normalizeRetentionConfiguration(input: SecurityAuditSdkConfiguration): NormalizedAuditRetentionConfiguration {
  const descriptor = Object.getOwnPropertyDescriptor(input, "retention");
  if (descriptor?.get || descriptor?.set) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/retention");
  }
  const value = descriptor?.value;
  if (value === undefined) {
    return Object.freeze({
      recentGeneratedEventIds: DEFAULT_RETENTION_CAPACITY,
      recentIssuedOperationIds: DEFAULT_RETENTION_CAPACITY,
    });
  }
  requirePlainRetentionObject(value);
  requireRetentionKeys(value);
  return Object.freeze({
    recentGeneratedEventIds: retentionCapacity(value, "recentGeneratedEventIds"),
    recentIssuedOperationIds: retentionCapacity(value, "recentIssuedOperationIds"),
  });
}

function retentionCapacity(value: object, key: keyof AuditRetentionConfiguration): number {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor?.value === undefined) return DEFAULT_RETENTION_CAPACITY;
  const capacity = descriptor.value;
  if (!Number.isSafeInteger(capacity) || capacity <= 0 || capacity > MAX_RETENTION_CAPACITY) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/retention/${key}`);
  }
  return capacity as number;
}

function requireRecord(value: unknown, path: string): asserts value is Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path);
  for (const [key, item] of Object.entries(value)) {
    if (!key || typeof item !== "string" || !item) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `${path}/${key}`);
  }
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path);
}

function cloneRecord<T extends object>(value: T): Readonly<T> {
  return normalizeCanonicalInputOrThrow(value, "/configuration");
}

function requireIdentifierProvider(value: AuditIdentifierProvider): void {
  const required: readonly (keyof AuditIdentifierProvider)[] = ["eventId", "operationId", "correlationId", "causationId", "requestId", "messageId", "transactionId"];
  for (const key of required) {
    if (typeof value[key] !== "function") throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/identifiers/${key}`);
  }
}



function normalizeTransformations(input: readonly AuditFieldTransformationHook[] | undefined): readonly NormalizedAuditFieldTransformation[] {
  if (input === undefined) return Object.freeze([]);
  if (!Array.isArray(input) || input.length > 32) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/transformations");
  const seen = new Set<string>();
  const hooks = input.map((hook, index) => {
    if (!hook || typeof hook !== "object") {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}`);
    }
    const path = hook.path;
    if (typeof path !== "string" || typeof hook.transform !== "function") {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}`);
    }
    if (!isTransformableFieldPath(path)) {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}/path`);
    }
    if (seen.has(path)) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}/path`);
    seen.add(path);
    return Object.freeze({ path, hook });
  });
  return Object.freeze(hooks);
}
