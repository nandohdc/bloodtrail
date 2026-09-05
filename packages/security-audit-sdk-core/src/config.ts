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
import { resolveProviders } from "./providers.js";
import type { AuditEventSink } from "./sink.js";
import { normalizeCanonicalInputOrThrow, SecurityAuditSdkError } from "./errors.js";
import { isPlainObject, isTransformableFieldPath } from "./internal.js";

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

function invalidConfiguration(path: string): SecurityAuditSdkError {
  return new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path);
}

function configErrorPath(error: unknown): string {
  if (error instanceof SecurityAuditSdkError && error.path) return error.path;
  return "/configuration";
}

export function normalizeConfiguration(input: SecurityAuditSdkConfiguration): NormalizedSdkConfiguration {
  try {
    return normalizeConfigurationUnsafe(input);
  } catch (error) {
    if (error instanceof SecurityAuditSdkError && error.category === "configuration") throw error;
    throw invalidConfiguration(configErrorPath(error));
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

function isValidTimeout(timeout: number): boolean {
  return Number.isSafeInteger(timeout) && timeout >= 0 && timeout <= 60_000;
}

function resolveTimeout(input: SecurityAuditSdkConfiguration): number {
  const timeout = input.shutdownTimeoutMs ?? 5000;
  if (!isValidTimeout(timeout)) {
    throw invalidConfiguration("/shutdownTimeoutMs");
  }
  return timeout;
}

function normalizeConfigurationUnsafe(input: SecurityAuditSdkConfiguration): NormalizedSdkConfiguration {
  if (input.contractVersion !== CONTRACT_VERSION) throw new SecurityAuditSdkError("SDK_UNSUPPORTED_CONTRACT_VERSION", "configuration", "/contractVersion");
  validateServiceIdentity(input);
  const providers = resolveProviders(input);
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
    sink: providers.sink,
    clock: providers.clock,
    identifiers: providers.identifiers,
    byteLength: providers.byteLength,
    timers: providers.timers,
    schemaRuntime: providers.schemaRuntime,
    contextProvider: providers.contextProvider,
    shutdownTimeoutMs: timeout,
    retention,
  };
  return Object.freeze(input.deployment === undefined ? base : { ...base, deployment: cloneRecord(input.deployment) });
}

function requirePlainRetentionObject(value: unknown): asserts value is object {
  if (!isPlainObject(value)) throw invalidConfiguration("/retention");
}

const ALLOWED_RETENTION_KEYS = new Set(["recentGeneratedEventIds", "recentIssuedOperationIds"]);

const DEFAULT_RETENTION: NormalizedAuditRetentionConfiguration = Object.freeze({
  recentGeneratedEventIds: DEFAULT_RETENTION_CAPACITY,
  recentIssuedOperationIds: DEFAULT_RETENTION_CAPACITY,
});

// Reads a property without ever invoking user code: an accessor is rejected
// rather than called, so a getter cannot observe configuration validation.
function dataPropertyOrThrow(target: object, key: PropertyKey, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor === undefined) return undefined;
  if (descriptor.get !== undefined) throw invalidConfiguration(path);
  if (descriptor.set !== undefined) throw invalidConfiguration(path);
  return descriptor.value;
}

function requireRetentionKey(key: string | symbol): asserts key is string {
  if (typeof key !== "string") throw invalidConfiguration("/retention");
  if (!ALLOWED_RETENTION_KEYS.has(key)) throw invalidConfiguration("/retention");
}

function requireRetentionKeys(value: object): void {
  for (const key of Reflect.ownKeys(value)) {
    requireRetentionKey(key);
    dataPropertyOrThrow(value, key, `/retention/${key}`);
  }
}

function normalizeRetentionConfiguration(input: SecurityAuditSdkConfiguration): NormalizedAuditRetentionConfiguration {
  const value = dataPropertyOrThrow(input, "retention", "/retention");
  if (value === undefined) return DEFAULT_RETENTION;
  requirePlainRetentionObject(value);
  requireRetentionKeys(value);
  return Object.freeze({
    recentGeneratedEventIds: retentionCapacity(value, "recentGeneratedEventIds"),
    recentIssuedOperationIds: retentionCapacity(value, "recentIssuedOperationIds"),
  });
}

function isValidCapacity(capacity: unknown): capacity is number {
  if (typeof capacity !== "number") return false;
  if (!Number.isSafeInteger(capacity)) return false;
  if (capacity <= 0) return false;
  return capacity <= MAX_RETENTION_CAPACITY;
}

function retentionCapacity(value: object, key: keyof AuditRetentionConfiguration): number {
  const path = `/retention/${key}`;
  const capacity = dataPropertyOrThrow(value, key, path);
  if (capacity === undefined) return DEFAULT_RETENTION_CAPACITY;
  if (!isValidCapacity(capacity)) throw invalidConfiguration(path);
  return capacity;
}

function requireEntry(path: string, key: string, item: unknown): void {
  // A record entry carries the same demand as a scalar field on both halves:
  // a non-empty string, reported against the entry's own pointer.
  requireString(key, `${path}/${key}`);
  requireString(item, `${path}/${key}`);
}

function requireRecord(value: unknown, path: string): asserts value is Readonly<Record<string, string>> {
  if (!isPlainObject(value)) throw invalidConfiguration(path);
  for (const [key, item] of Object.entries(value)) {
    requireEntry(path, key, item);
  }
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw invalidConfiguration(path);
}

function cloneRecord<T extends object>(value: T): Readonly<T> {
  return normalizeCanonicalInputOrThrow(value, "/configuration");
}

function isValidHookShape(hook: unknown): hook is AuditFieldTransformationHook {
  if (typeof hook !== "object") return false;
  if (hook === null) return false;
  const candidate = hook as AuditFieldTransformationHook;
  if (typeof candidate.path !== "string") return false;
  return typeof candidate.transform === "function";
}

function normalizeTransformationHook(hook: unknown, index: number, seen: Set<string>): NormalizedAuditFieldTransformation {
  if (!isValidHookShape(hook)) {
    throw invalidConfiguration(`/transformations/${index}`);
  }
  const path = hook.path;
  if (!isTransformableFieldPath(path)) {
    throw invalidConfiguration(`/transformations/${index}/path`);
  }
  if (seen.has(path)) {
    throw invalidConfiguration(`/transformations/${index}/path`);
  }
  seen.add(path);
  return Object.freeze({ path, hook });
}

function normalizeTransformations(input: readonly AuditFieldTransformationHook[] | undefined): readonly NormalizedAuditFieldTransformation[] {
  if (input === undefined) return Object.freeze([]);
  if (!Array.isArray(input)) throw invalidConfiguration("/transformations");
  if (input.length > 32) throw invalidConfiguration("/transformations");
  const seen = new Set<string>();
  const hooks = input.map((hook, index) => normalizeTransformationHook(hook, index, seen));
  return Object.freeze(hooks);
}
