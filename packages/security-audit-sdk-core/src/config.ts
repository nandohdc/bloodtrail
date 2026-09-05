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

function configErrorPath(error: unknown): string {
  if (error instanceof SecurityAuditSdkError && error.path) return error.path;
  return "/configuration";
}

export function normalizeConfiguration(input: SecurityAuditSdkConfiguration): NormalizedSdkConfiguration {
  try {
    return normalizeConfigurationUnsafe(input);
  } catch (error) {
    if (error instanceof SecurityAuditSdkError && error.category === "configuration") throw error;
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", configErrorPath(error));
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

function resolveTimeout(input: SecurityAuditSdkConfiguration): number {
  const timeout = input.shutdownTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 60_000) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/shutdownTimeoutMs");
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
  if (!isPlainObject(value)) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/retention");
  }
}

const ALLOWED_RETENTION_KEYS = new Set(["recentGeneratedEventIds", "recentIssuedOperationIds"]);

function validateRetentionKey(value: object, key: string | symbol): void {
  if (typeof key !== "string" || !ALLOWED_RETENTION_KEYS.has(key)) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/retention");
  }
  const item = Object.getOwnPropertyDescriptor(value, key);
  if (!item || item.get || item.set) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/retention/${key}`);
  }
}

function requireRetentionKeys(value: object): void {
  for (const key of Reflect.ownKeys(value)) {
    validateRetentionKey(value, key);
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

function normalizeTransformationHook(hook: unknown, index: number, seen: Set<string>): NormalizedAuditFieldTransformation {
  if (!hook || typeof hook !== "object") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}`);
  }
  const path = (hook as AuditFieldTransformationHook).path;
  if (typeof path !== "string" || typeof (hook as AuditFieldTransformationHook).transform !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}`);
  }
  if (!isTransformableFieldPath(path) || seen.has(path)) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}/path`);
  }
  seen.add(path);
  return Object.freeze({ path, hook: hook as AuditFieldTransformationHook });
}

function normalizeTransformations(input: readonly AuditFieldTransformationHook[] | undefined): readonly NormalizedAuditFieldTransformation[] {
  if (input === undefined) return Object.freeze([]);
  if (!Array.isArray(input) || input.length > 32) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/transformations");
  const seen = new Set<string>();
  const hooks = input.map((hook, index) => normalizeTransformationHook(hook, index, seen));
  return Object.freeze(hooks);
}
