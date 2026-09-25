import { strict as assert } from "node:assert";
import {
  EVENT_CATALOG,
  createSecurityAuditSdk,
  validateSecurityAuditEvent,
  type AuditClock,
  type AuditDeliveryResult,
  type AuditIdentifierProvider,
  type AuditOperationHandle,
  type AuditOperationInput,
  type AuditResult,
  type EventMethodName,
  type SecurityAuditEvent,
  type SecurityAuditSdk,
} from "../dist/index.js";
import { createCapturingAuditSink } from "../dist/testing.js";

export function createDeterministicProviders(start = 1): AuditIdentifierProvider {
  let counter = start;
  const next = () => `22222222-2222-4222-8222-${String(counter++).padStart(12, "0")}`;
  return Object.freeze({
    eventId: next,
    operationId: next,
    correlationId: next,
    causationId: next,
    requestId: next,
    messageId: next,
    transactionId: next,
  });
}

export function createDeterministicClock(iso = "2026-07-31T12:00:00.000Z"): AuditClock {
  return Object.freeze({ now: () => new Date(iso) });
}

export interface ConformanceHarnessContext {
  readonly sdk: SecurityAuditSdk;
  readonly sink: ReturnType<typeof createCapturingAuditSink>;
}

export function createConformanceSdk(options?: {
  readonly clock?: AuditClock;
  readonly identifiers?: AuditIdentifierProvider;
}): ConformanceHarnessContext {
  const sink = createCapturingAuditSink();
  const sdk = createSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "synthetic-conformance-producer", version: "1.0.0" },
    service: { name: "synthetic-conformance-service", version: "1.0.0" },
    environment: { name: "test" },
    sink,
    clock: options?.clock ?? createDeterministicClock(),
    identifiers: options?.identifiers ?? createDeterministicProviders(),
  });
  return { sdk, sink };
}

export function createCommittedOperation(
  sdk: SecurityAuditSdk,
  options: {
    readonly boundEvent?: EventMethodName;
    readonly operationId?: string;
    readonly transactionId?: string;
    readonly transactional?: boolean;
  } = {},
): AuditOperationHandle {
  const input: AuditOperationInput = {
    transactional: options.transactional ?? true,
    ...(options.boundEvent !== undefined ? { boundEvent: options.boundEvent } : {}),
    ...(options.operationId !== undefined ? { operationId: options.operationId } : {}),
    ...(options.transactionId !== undefined ? { transactionId: options.transactionId } : {}),
  };
  const op = sdk.beginOperation(input);
  if (!op.ok) {
    throw new Error(
      `Failed to begin operation${options.boundEvent ? ` for ${options.boundEvent}` : ""}: ${op.error.code}`,
    );
  }
  op.value.markCommitted();
  return op.value;
}

export interface ConformanceOperationOptions {
  readonly boundEvent?: EventMethodName;
  readonly operationId?: string;
  readonly transactionId?: string;
  readonly transactional?: boolean;
}

export interface ValidConformanceRow {
  readonly name: string;
  readonly method: EventMethodName;
  readonly input?: Record<string, unknown>;
  readonly operation?: ConformanceOperationOptions;
  readonly buildInput?: (sdk: SecurityAuditSdk) => Record<string, unknown> | Promise<Record<string, unknown>>;
  readonly notes?: string;
}

export interface InvalidConformanceRow {
  readonly name: string;
  readonly method: EventMethodName;
  readonly input?: Record<string, unknown>;
  readonly operation?: ConformanceOperationOptions;
  readonly buildInput?: (sdk: SecurityAuditSdk) => Record<string, unknown> | Promise<Record<string, unknown>>;
  readonly expectedCode: string;
  readonly expectedPath: string;
  readonly notes?: string;
}

function attachOperation(
  sdk: SecurityAuditSdk,
  options?: ConformanceOperationOptions,
): AuditOperationHandle | undefined {
  if (!options) return undefined;
  return createCommittedOperation(sdk, options);
}

export async function resolveConformanceInput(
  row: ValidConformanceRow | InvalidConformanceRow,
  sdk: SecurityAuditSdk,
): Promise<Record<string, unknown>> {
  const base = row.input !== undefined ? row.input : await row.buildInput?.(sdk);
  if (!base) {
    throw new Error(`Conformance row "${row.name}" must provide either input or buildInput`);
  }
  const operation = attachOperation(sdk, row.operation);
  if (!operation) return base;
  return { ...base, operation };
}

export async function assertValidConformanceRow(
  row: ValidConformanceRow,
  options?: { sdkContext?: ConformanceHarnessContext },
): Promise<SecurityAuditEvent> {
  const { sdk, sink } = options?.sdkContext ?? createConformanceSdk();
  const initialCount = sink.events.length;
  const input = await resolveConformanceInput(row, sdk);
  const call = sdk[row.method] as (arg: unknown) => Promise<AuditResult<AuditDeliveryResult>>;
  const result = await call.call(sdk, input);

  assert.equal(
    result.ok,
    true,
    `${row.method} (${row.name}) expected ok: true, got ${JSON.stringify(!result.ok ? result.error : {})}`,
  );
  assert.equal(
    sink.events.length,
    initialCount + 1,
    `${row.method} (${row.name}) expected exactly 1 event emitted to sink`,
  );

  const captured = sink.events[sink.events.length - 1];
  assert.ok(captured, `${row.method} (${row.name}) missing captured event`);

  const validation = validateSecurityAuditEvent(captured);
  assert.equal(
    validation.ok,
    true,
    `validateSecurityAuditEvent failed for ${row.method} (${row.name}): ${JSON.stringify(!validation.ok ? validation.error : {})}`,
  );

  const catalogEntry = EVENT_CATALOG.find((entry) => entry.name === captured.event.name);
  assert.ok(catalogEntry, `Catalog entry not found for ${captured.event.name}`);

  assert.equal(captured.event.name, catalogEntry.name, "event.name matches catalog");
  assert.equal(captured.event.category, catalogEntry.category, "event.category matches catalog");
  assert.equal(captured.event.action, catalogEntry.action, "event.action matches catalog");
  assert.equal(captured.event.delivery_class, catalogEntry.delivery, "event.delivery_class matches catalog delivery");
  assert.equal(Object.isFrozen(captured), true, "captured event is frozen");

  return captured;
}

export async function assertInvalidConformanceRow(
  row: InvalidConformanceRow,
  options?: { sdkContext?: ConformanceHarnessContext },
): Promise<void> {
  const { sdk, sink } = options?.sdkContext ?? createConformanceSdk();
  const initialCount = sink.events.length;
  const input = await resolveConformanceInput(row, sdk);
  const call = sdk[row.method] as (arg: unknown) => Promise<AuditResult<AuditDeliveryResult>>;
  const result = await call.call(sdk, input);

  assert.equal(
    result.ok,
    false,
    `${row.method} (${row.name}) expected ok: false, but call succeeded`,
  );
  assert.equal(
    sink.events.length,
    initialCount,
    `${row.method} (${row.name}) expected 0 events emitted to sink on failure`,
  );

  if (!result.ok) {
    assert.equal(
      result.error.code,
      row.expectedCode,
      `${row.name}: expected code ${row.expectedCode}, got ${result.error.code}`,
    );
    assert.equal(
      result.error.path,
      row.expectedPath,
      `${row.name}: expected path ${row.expectedPath}, got ${result.error.path}`,
    );
  }
}
