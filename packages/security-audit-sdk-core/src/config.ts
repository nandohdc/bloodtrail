import { CONTRACT_VERSION } from "./generated/contract.generated.js";
import type { FIELD_POLICY, SecurityAuditEvent } from "./generated/contract.generated.js";
import type { AuditContextFrame, AuditContextFrameInput } from "./context.js";
import { createAuditContextFrame } from "./context.js";
import type { AuditClock, AuditIdentifierProvider } from "./providers.js";
import { systemAuditClock, systemAuditIdentifiers } from "./providers.js";
import type { AuditEventSink } from "./sink.js";
import { SecurityAuditSdkError } from "./errors.js";
import { deepFreeze } from "./internal.js";

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
  readonly shutdownTimeoutMs?: number;
}

export interface NormalizedSdkConfiguration {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly producer: SecurityAuditEvent["producer"];
  readonly service: SecurityAuditEvent["service"];
  readonly environment: SecurityAuditEvent["environment"];
  readonly deployment?: SecurityAuditEvent["deployment"];
  readonly authoritativeContext: AuditContextFrame;
  readonly transformations: readonly AuditFieldTransformationHook[];
  readonly sink: AuditEventSink;
  readonly clock: AuditClock;
  readonly identifiers: AuditIdentifierProvider;
  readonly shutdownTimeoutMs: number;
}

export function normalizeConfiguration(input: SecurityAuditSdkConfiguration): NormalizedSdkConfiguration {
  if (input.contractVersion !== CONTRACT_VERSION) throw new SecurityAuditSdkError("SDK_UNSUPPORTED_CONTRACT_VERSION", "configuration", "/contractVersion");
  requireRecord(input.producer, "/producer");
  requireString(input.producer.name, "/producer/name");
  requireString(input.producer.version, "/producer/version");
  requireRecord(input.service, "/service");
  requireString(input.service.name, "/service/name");
  requireRecord(input.environment, "/environment");
  requireString(input.environment.name, "/environment/name");
  if (input.deployment !== undefined) requireRecord(input.deployment, "/deployment");
  if (!input.sink || typeof input.sink.emit !== "function") throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/sink");
  if (input.clock !== undefined && typeof input.clock.now !== "function") throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/clock");
  if (input.identifiers !== undefined) requireIdentifierProvider(input.identifiers);
  const transformations = normalizeTransformations(input.transformations);
  const timeout = input.shutdownTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 60_000) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/shutdownTimeoutMs");
  const base = {
    contractVersion: CONTRACT_VERSION,
    producer: cloneRecord(input.producer),
    service: cloneRecord(input.service),
    environment: cloneRecord(input.environment),
    authoritativeContext: createAuditContextFrame(input.authoritativeContext ?? {}),
    transformations,
    sink: input.sink,
    clock: input.clock ?? systemAuditClock,
    identifiers: input.identifiers ?? systemAuditIdentifiers,
    shutdownTimeoutMs: timeout,
  };
  return deepFreeze(input.deployment === undefined ? base : { ...base, deployment: cloneRecord(input.deployment) });
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
  return Object.freeze({ ...value });
}

function requireIdentifierProvider(value: AuditIdentifierProvider): void {
  const required: readonly (keyof AuditIdentifierProvider)[] = ["eventId", "operationId", "correlationId", "causationId", "requestId", "messageId", "transactionId"];
  for (const key of required) {
    if (typeof value[key] !== "function") throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/identifiers/${key}`);
  }
}

function normalizeTransformations(input: readonly AuditFieldTransformationHook[] | undefined): readonly AuditFieldTransformationHook[] {
  if (input === undefined) return Object.freeze([]);
  if (!Array.isArray(input) || input.length > 32) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/transformations");
  const seen = new Set<string>();
  const hooks = input.map((hook, index) => {
    if (!hook || typeof hook !== "object" || typeof hook.path !== "string" || typeof hook.transform !== "function") {
      throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}`);
    }
    if (seen.has(hook.path)) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${index}/path`);
    seen.add(hook.path);
    return Object.freeze({ path: hook.path, transform: hook.transform });
  });
  return Object.freeze(hooks);
}
