import { CONTRACT_VERSION } from "./generated/contract.generated.js";
import type { AuditClock, AuditIdentifierProvider } from "./providers.js";
import { systemAuditClock, systemAuditIdentifiers } from "./providers.js";
import type { AuditEventSink } from "./sink.js";
import { SecurityAuditSdkError } from "./errors.js";

export interface SecurityAuditSdkConfiguration {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly producer: Readonly<Record<string, string>>;
  readonly service: Readonly<Record<string, string>>;
  readonly environment: Readonly<Record<string, string>>;
  readonly deployment?: Readonly<Record<string, string>>;
  readonly sink: AuditEventSink;
  readonly clock?: AuditClock;
  readonly identifiers?: AuditIdentifierProvider;
  readonly shutdownTimeoutMs?: number;
}

export interface NormalizedSdkConfiguration {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly producer: Readonly<Record<string, string>>;
  readonly service: Readonly<Record<string, string>>;
  readonly environment: Readonly<Record<string, string>>;
  readonly deployment?: Readonly<Record<string, string>>;
  readonly sink: AuditEventSink;
  readonly clock: AuditClock;
  readonly identifiers: AuditIdentifierProvider;
  readonly shutdownTimeoutMs: number;
}

export function normalizeConfiguration(input: SecurityAuditSdkConfiguration): NormalizedSdkConfiguration {
  if (input.contractVersion !== CONTRACT_VERSION) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/contractVersion");
  requireRecord(input.producer, "/producer");
  requireRecord(input.service, "/service");
  requireRecord(input.environment, "/environment");
  if (input.deployment !== undefined) requireRecord(input.deployment, "/deployment");
  if (!input.sink || typeof input.sink.emit !== "function") throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/sink");
  const timeout = input.shutdownTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 60_000) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/shutdownTimeoutMs");
  const base = {
    contractVersion: CONTRACT_VERSION,
    producer: cloneRecord(input.producer),
    service: cloneRecord(input.service),
    environment: cloneRecord(input.environment),
    sink: input.sink,
    clock: input.clock ?? systemAuditClock,
    identifiers: input.identifiers ?? systemAuditIdentifiers,
    shutdownTimeoutMs: timeout,
  };
  return Object.freeze(input.deployment === undefined ? base : { ...base, deployment: cloneRecord(input.deployment) });
}

function requireRecord(value: unknown, path: string): asserts value is Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path);
  for (const [key, item] of Object.entries(value)) {
    if (!key || typeof item !== "string" || !item) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", `${path}/${key}`);
  }
}

function cloneRecord(value: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.freeze({ ...value });
}
