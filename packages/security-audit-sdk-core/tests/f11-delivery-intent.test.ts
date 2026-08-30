import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  authenticatedHumanActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeTenant,
  createSecurityAuditSdk,
  credentialReference,
  observedSource,
  sessionEvidence,
  type AuditFieldTransformationHook,
  type AuditContextFrameInput,
  type AuditResult,
  type SecurityAuditEvent,
  type SecurityAuditSdk,
} from "../dist/index.js";
import {
  inspectSdkRetentionForTesting,
  type AuditDeliveryResult,
  type AuditEventSink,
  type AuditIdentifierProvider,
} from "../dist/testing.js";

type Counters = { ids: number; clocks: number; hooks: number; sinks: number };

type Harness = {
  readonly sdk: SecurityAuditSdk;
  readonly events: Readonly<SecurityAuditEvent>[];
  readonly counters: Counters;
};

function uuid(value: number): string {
  return `55555555-5555-4555-8555-${String(value).padStart(12, "0")}`;
}

function namedInput(): Record<string, unknown> {
  return {
    actor: authenticatedHumanActor({ id: "actor-f11", tenantId: "tenant-f11", source: "server-authentication-authority" }),
    tenant: authoritativeTenant({
      scope: "tenant",
      actor_tenant_id: "tenant-f11",
      effective_tenant_id: "tenant-f11",
      resource_tenant_id: "tenant-f11",
    }),
    authenticated_principal: authenticatedPrincipal({ type: "human_user", id: "principal-f11", issuer: "https://idp.example.test" }),
    authentication: authenticationEvidence({
      method: "password_mfa",
      assurance_level: "aal2",
      mfa_state: "satisfied",
      credential_type: "session",
      authenticated_at: "2026-08-04T00:00:00.000Z",
      identity_provider: "https://idp.example.test",
      delegated: false,
      impersonated: false,
    }),
    credential: credentialReference({ type: "session", reference: "credential-f11", key_id: "key-f11" }),
    session: sessionEvidence({ id: "session-f11", created_at: "2026-08-03T23:00:00.000Z", age_seconds: 3600, assurance_level: "aal2" }),
    source: observedSource({ observed: { address: "192.0.2.11", port: 443 }, client_reported: { user_agent_family: "Synthetic", user_agent_version: "11" } }),
  };
}

function createHarness(options: {
  readonly sink?: AuditEventSink;
  readonly transformations?: readonly AuditFieldTransformationHook[];
  readonly authoritativeContext?: AuditContextFrameInput;
  readonly capacity?: number;
  readonly start?: number;
} = {}): Harness {
  const counters: Counters = { ids: 0, clocks: 0, hooks: 0, sinks: 0 };
  const events: Readonly<SecurityAuditEvent>[] = [];
  let sequence = options.start ?? 11_000;
  const next = () => {
    counters.ids += 1;
    sequence += 1;
    return uuid(sequence);
  };
  const identifiers: AuditIdentifierProvider = {
    eventId: next,
    operationId: next,
    correlationId: next,
    causationId: next,
    requestId: next,
    messageId: next,
    transactionId: next,
  };
  const defaultSink: AuditEventSink = {
    async emit(event) {
      counters.sinks += 1;
      events.push(event);
      return { status: "accepted" };
    },
  };
  const transformations = (options.transformations ?? [{
    path: "actor.id",
    transform({ value }) {
      counters.hooks += 1;
      return `masked-${value}`;
    },
  }]) as readonly AuditFieldTransformationHook[];
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "f11-test", version: "1.0.0" },
    service: { name: "f11-test", version: "1.0.0" },
    environment: { name: "test" },
    ...(options.authoritativeContext === undefined ? {} : { authoritativeContext: options.authoritativeContext }),
    sink: options.sink ?? defaultSink,
    clock: { now() { counters.clocks += 1; return new Date("2026-08-04T00:00:00.000Z"); } },
    identifiers,
    transformations,
    retention: {
      recentGeneratedEventIds: options.capacity ?? 4,
      recentIssuedOperationIds: options.capacity ?? 4,
    },
    shutdownTimeoutMs: 100,
  });
  return { sdk, events, counters };
}

async function generatedEvent(harness: Harness): Promise<Readonly<SecurityAuditEvent>> {
  const result = await harness.sdk.authenticationSucceeded(namedInput() as never);
  assert.equal(result.ok, true);
  const event = harness.events[harness.events.length - 1];
  assert.ok(event);
  return event;
}

function snapshot(counters: Counters): Counters {
  return { ...counters };
}

function assertNoPreparationDelta(before: Counters, after: Counters): void {
  assert.equal(after.ids, before.ids);
  assert.equal(after.clocks, before.clocks);
  assert.equal(after.hooks, before.hooks);
}

function mutableCopy(event: Readonly<SecurityAuditEvent>): SecurityAuditEvent {
  return structuredClone(event) as SecurityAuditEvent;
}

function expectFailure(result: AuditResult<unknown>, code: string, path?: string): void {
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, code);
  if (path !== undefined) assert.equal(result.error.path, path);
  assert.equal("eventId" in result.error, false);
}

function failureValue(result: AuditResult<unknown>): unknown {
  if (!("error" in result)) throw new Error("expected failure");
  return result.error;
}

test("F-11 public commands select four explicit internal delivery intents", async () => {
  const source = await readFile(resolve(process.cwd(), "src/sdk.ts"), "utf8");
  const eventsSource = await readFile(resolve(process.cwd(), "src/events.ts"), "utf8");
  const internalSource = await readFile(resolve(process.cwd(), "src/internal.ts"), "utf8");
  const packageRootSource = await readFile(resolve(process.cwd(), "src/index.ts"), "utf8");
  const emitBlock = source.match(/async emit\(event:[\s\S]*?\n  \}/)?.[0];
  const redeliverBlock = source.match(/async redeliver\(event:[\s\S]*?\n  \}/)?.[0];
  assert.ok(emitBlock);
  assert.ok(redeliverBlock);
  assert.match(emitBlock, /kind: "generic_emit"/);
  assert.match(redeliverBlock, /kind: "pure_redelivery"/);
  assert.match(source, /deliveryIntent\.kind === "named_redelivery"/);
  assert.match(eventsSource, /deliveryIntent: \{ kind: "named_execution" \}/);
  assert.match(eventsSource, /deliveryIntent: \{ kind: "named_redelivery" \}/);
  for (const kind of ["generic_emit", "pure_redelivery", "named_execution", "named_redelivery"]) {
    assert.match(internalSource, new RegExp(`kind: "${kind}"`));
  }
  assert.doesNotMatch(source, /isRedelivery|skipDedupe|preserveId|skipHooks|skipClock/);
  assert.doesNotMatch(packageRootSource, /DeliveryIntent/);
  assert.doesNotMatch(internalSource, /from "\.\/(?:sdk|events|config)\.js"/);
});

test("F-11 generic emit and pure redelivery preserve complete caller data but use declared distinct intent", async () => {
  const harness = createHarness();
  const original = await generatedEvent(harness);
  const callerEvent = mutableCopy(original);
  const callerBefore = JSON.stringify(callerEvent);
  const before = snapshot(harness.counters);
  const retentionBefore = inspectSdkRetentionForTesting(harness.sdk);

  const emitted = await harness.sdk.emit(callerEvent);
  const afterEmit = snapshot(harness.counters);
  const redelivered = await harness.sdk.redeliver(callerEvent);
  const afterRedelivery = snapshot(harness.counters);

  assert.equal(emitted.ok, true);
  assert.equal(redelivered.ok, true);
  assertNoPreparationDelta(before, afterEmit);
  assertNoPreparationDelta(afterEmit, afterRedelivery);
  assert.equal(afterEmit.sinks - before.sinks, 1);
  assert.equal(afterRedelivery.sinks - afterEmit.sinks, 1);
  assert.equal(JSON.stringify(callerEvent), callerBefore);
  assert.equal(Object.isFrozen(callerEvent), false);
  assert.deepEqual(harness.events[harness.events.length - 2], original);
  assert.deepEqual(harness.events[harness.events.length - 1], original);
  assert.equal(harness.events[harness.events.length - 1]?.event.id, original.event.id);
  assert.equal(harness.events[harness.events.length - 1]?.event.timestamp, original.event.timestamp);
  assert.deepEqual(harness.events[harness.events.length - 1]?.correlation, original.correlation);
  assert.deepEqual(inspectSdkRetentionForTesting(harness.sdk), retentionBefore);
});

test("F-11 repeated pure redelivery survives F-08 churn without retained-state growth", async () => {
  const harness = createHarness({ capacity: 2 });
  const original = await generatedEvent(harness);
  await generatedEvent(harness);
  await generatedEvent(harness);
  const before = snapshot(harness.counters);
  const retentionBefore = inspectSdkRetentionForTesting(harness.sdk);
  assert.deepEqual(retentionBefore, {
    generatedEventIds: { size: 2, capacity: 2 },
    issuedOperationIds: { size: 0, capacity: 2 },
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await harness.sdk.redeliver(mutableCopy(original))).ok, true);
  }
  const after = snapshot(harness.counters);
  assert.equal(after.sinks - before.sinks, 5);
  assertNoPreparationDelta(before, after);
  assert.deepEqual(inspectSdkRetentionForTesting(harness.sdk), retentionBefore);
});

test("F-11 named redelivery preserves identity and validates fixed metadata", async () => {
  const harness = createHarness();
  const original = await generatedEvent(harness);
  const before = snapshot(harness.counters);
  const callerEvent = mutableCopy(original);
  const accepted = await harness.sdk.authenticationSucceeded({ redelivery: { event: callerEvent } } as never);
  assert.equal(accepted.ok, true);
  assertNoPreparationDelta(before, harness.counters);
  assert.equal(harness.counters.sinks - before.sinks, 1);
  assert.deepEqual(harness.events[harness.events.length - 1], original);
  assert.equal(Object.isFrozen(callerEvent), false);

  const wrongName = await harness.sdk.authenticationFailed({ redelivery: { event: callerEvent } } as never);
  expectFailure(wrongName, "UNKNOWN_CATALOG_VALUE", "/event/name");
  const wrongDelivery = mutableCopy(original);
  (wrongDelivery.event as { delivery_class: string }).delivery_class = "best_effort";
  expectFailure(await harness.sdk.authenticationSucceeded({ redelivery: { event: wrongDelivery } } as never), "UNKNOWN_CATALOG_VALUE", "/event/delivery_class");
  const wrongSchema = mutableCopy(original);
  (wrongSchema.schema as { version: string }).version = "9.9.9";
  expectFailure(await harness.sdk.authenticationSucceeded({ redelivery: { event: wrongSchema } } as never), "UNSUPPORTED_SCHEMA_VERSION", "/schema/version");
});

test("F-11 named redelivery enforces operation binding without consuming terminal authority", async () => {
  const sourceHarness = createHarness({ start: 20_000 });
  const external = mutableCopy(await generatedEvent(sourceHarness));
  const harness = createHarness({ start: 30_000 });
  const operation = harness.sdk.beginOperation({
    operationId: "operation-f11",
    transactionId: "transaction-f11",
    correlationId: "correlation-f11",
    boundEvent: "authenticationSucceeded",
    transactional: false,
  });
  assert.equal(operation.ok, true);
  if (!operation.ok) return;
  const retentionAfterOperation = inspectSdkRetentionForTesting(harness.sdk);
  (external.correlation as { operation_id: string }).operation_id = operation.value.operationId;
  (external.correlation as { transaction_id?: string }).transaction_id = operation.value.transactionId;
  (external.correlation as { correlation_id: string }).correlation_id = operation.value.correlationId;

  const before = snapshot(harness.counters);
  assert.equal((await harness.sdk.authenticationSucceeded({ redelivery: { event: external }, operation: operation.value } as never)).ok, true);
  assertNoPreparationDelta(before, harness.counters);
  assert.deepEqual(inspectSdkRetentionForTesting(harness.sdk), retentionAfterOperation);
  const firstExecution = await harness.sdk.authenticationSucceeded({ ...namedInput(), operation: operation.value } as never);
  assert.equal(firstExecution.ok, true, "redelivery must not reserve or complete a business success");
  assert.equal((await harness.sdk.authenticationSucceeded({ redelivery: { event: external }, operation: operation.value } as never)).ok, true);
  assert.equal((await harness.sdk.authenticationSucceeded({ redelivery: { event: external }, operation: operation.value } as never)).ok, true);
  expectFailure(await harness.sdk.authenticationSucceeded({ ...namedInput(), operation: operation.value } as never), "SDK_DUPLICATE_SUCCESS", "/operation/state");

  const mismatch = mutableCopy(external);
  (mismatch.correlation as { operation_id: string }).operation_id = "different-operation";
  expectFailure(
    await harness.sdk.authenticationSucceeded({ redelivery: { event: mismatch }, operation: operation.value } as never),
    "SDK_OPERATION_EVENT_MISMATCH",
    "/correlation/operation_id",
  );
  const transactionMismatch = mutableCopy(external);
  (transactionMismatch.correlation as { transaction_id?: string }).transaction_id = "different-transaction";
  expectFailure(
    await harness.sdk.authenticationSucceeded({ redelivery: { event: transactionMismatch }, operation: operation.value } as never),
    "SDK_OPERATION_EVENT_MISMATCH",
    "/correlation/transaction_id",
  );
  const correlationMismatch = mutableCopy(external);
  (correlationMismatch.correlation as { correlation_id: string }).correlation_id = "different-correlation";
  expectFailure(
    await harness.sdk.authenticationSucceeded({ redelivery: { event: correlationMismatch }, operation: operation.value } as never),
    "SDK_OPERATION_EVENT_MISMATCH",
    "/correlation/correlation_id",
  );
  const wrongBound = harness.sdk.beginOperation({ boundEvent: "authenticationFailed", transactional: false });
  assert.equal(wrongBound.ok, true);
  if (wrongBound.ok) {
    expectFailure(
      await harness.sdk.authenticationSucceeded({ redelivery: { event: external }, operation: wrongBound.value } as never),
      "SDK_OPERATION_EVENT_MISMATCH",
      "/operation/bound_event",
    );
  }
});

test("F-11 named redelivery retains prohibited-data and semantic validation", async () => {
  const harness = createHarness();
  const original = await generatedEvent(harness);
  const prohibited = mutableCopy(original);
  if (!prohibited.actor) throw new Error("fixture actor required");
  (prohibited.actor as { id: string }).id = "password=synthetic-secret";
  const before = harness.counters.sinks;
  const prohibitedResult = await harness.sdk.authenticationSucceeded({ redelivery: { event: prohibited } } as never);
  assert.equal(prohibitedResult.ok, false);
  if (!prohibitedResult.ok) assert.equal(prohibitedResult.error.category, "privacy");
  const publicProhibitedResult = await harness.sdk.redeliver(prohibited);
  assert.equal(publicProhibitedResult.ok, false);
  if (!publicProhibitedResult.ok) assert.equal(publicProhibitedResult.error.category, "privacy");

  const badCausality = mutableCopy(original);
  (badCausality.correlation as { retry_attempt?: number }).retry_attempt = 1;
  delete (badCausality.correlation as { original_event_id?: string }).original_event_id;
  expectFailure(await harness.sdk.authenticationSucceeded({ redelivery: { event: badCausality } } as never), "BAD_CAUSALITY", "/correlation/original_event_id");
  expectFailure(await harness.sdk.redeliver(badCausality), "BAD_CAUSALITY", "/correlation/original_event_id");
  assert.equal(harness.counters.sinks, before);
});

test("F-11 named retry is re-execution with a new identity and bounded causality", async () => {
  const harness = createHarness({ start: 40_000 });
  const original = await generatedEvent(harness);
  const before = snapshot(harness.counters);
  const retry = await harness.sdk.authenticationSucceeded({
    ...namedInput(),
    retry: { retry_attempt: 1, original_event_id: original.event.id, causation_id: original.event.id },
  } as never);
  assert.equal(retry.ok, true);
  const retryEvent = harness.events[harness.events.length - 1];
  assert.ok(retryEvent);
  assert.notEqual(retryEvent.event.id, original.event.id);
  assert.equal(retryEvent.correlation.original_event_id, original.event.id);
  assert.equal(retryEvent.correlation.causation_id, original.event.id);
  assert.equal(retryEvent.correlation.retry_attempt, 1);
  assert.ok(harness.counters.ids > before.ids);
  assert.ok(harness.counters.clocks > before.clocks);
  assert.equal(harness.counters.hooks - before.hooks, 1);

  const beforeRedelivery = snapshot(harness.counters);
  const retentionBeforeRedelivery = inspectSdkRetentionForTesting(harness.sdk);
  assert.equal((await harness.sdk.redeliver(mutableCopy(retryEvent))).ok, true);
  assertNoPreparationDelta(beforeRedelivery, harness.counters);
  assert.equal(harness.counters.sinks - beforeRedelivery.sinks, 1);
  assert.deepEqual(harness.events[harness.events.length - 1], retryEvent);
  assert.equal(harness.events[harness.events.length - 1]?.correlation.retry_attempt, 1);
  assert.equal(harness.events[harness.events.length - 1]?.correlation.original_event_id, original.event.id);
  assert.deepEqual(inspectSdkRetentionForTesting(harness.sdk), retentionBeforeRedelivery);

  expectFailure(await harness.sdk.authenticationSucceeded({ ...namedInput(), retry: { retry_attempt: 1, original_event_id: "" } } as never), "BAD_CAUSALITY", "/correlation/original_event_id");
  expectFailure(await harness.sdk.authenticationSucceeded({ ...namedInput(), retry: { retry_attempt: 1001, original_event_id: original.event.id } } as never), "FIELD_LIMIT_EXCEEDED", "/correlation/retry_attempt");

  const selfHarness = createHarness({ start: 50_000 });
  const predictedId = uuid(50_001);
  expectFailure(await selfHarness.sdk.authenticationSucceeded({
    ...namedInput(),
    retry: { retry_attempt: 1, original_event_id: original.event.id, causation_id: predictedId },
  } as never), "BAD_CAUSALITY", "/correlation/causation_id");
});

test("F-11 terminal named retry re-executes after accepted completion", async () => {
  const harness = createHarness({ start: 70_000 });
  const operation = harness.sdk.beginOperation({
    operationId: "operation-f11-retry",
    transactionId: "transaction-f11-retry",
    correlationId: "correlation-f11-retry",
    boundEvent: "authenticationSucceeded",
    transactional: false,
  });
  assert.equal(operation.ok, true);
  if (!operation.ok) return;

  assert.equal((await harness.sdk.authenticationSucceeded({ ...namedInput(), operation: operation.value } as never)).ok, true);
  const original = harness.events.at(-1);
  assert.ok(original);

  const retry = await harness.sdk.authenticationSucceeded({
    ...namedInput(),
    operation: operation.value,
    retry: { retry_attempt: 1, original_event_id: original.event.id, causation_id: original.event.id },
  } as never);
  assert.equal(retry.ok, true, JSON.stringify(retry));
  const retryEvent = harness.events.at(-1);
  assert.ok(retryEvent);
  assert.notEqual(retryEvent.event.id, original.event.id);
  assert.equal(retryEvent.correlation.retry_attempt, 1);
  assert.equal(retryEvent.correlation.original_event_id, original.event.id);
  assert.equal(retryEvent.correlation.causation_id, original.event.id);
  assert.equal(retryEvent.correlation.operation_id, operation.value.operationId);
  assert.equal(harness.counters.sinks, 2);

  expectFailure(await harness.sdk.authenticationSucceeded({ ...namedInput(), operation: operation.value } as never), "SDK_DUPLICATE_SUCCESS", "/operation/state");
  assert.equal(harness.counters.sinks, 2);
});

test("F-11 terminal named retry reads active and authoritative context when input has no retry", async () => {
  const activeHarness = createHarness({ start: 90_000 });
  const activeOperation = activeHarness.sdk.beginOperation({
    operationId: "operation-f11-active-context-retry",
    transactionId: "transaction-f11-active-context-retry",
    correlationId: "correlation-f11-active-context-retry",
    boundEvent: "authenticationSucceeded",
    transactional: false,
  });
  assert.equal(activeOperation.ok, true);
  if (!activeOperation.ok) return;

  assert.equal((await activeHarness.sdk.authenticationSucceeded({ ...namedInput(), operation: activeOperation.value } as never)).ok, true);
  const activeOriginal = activeHarness.events.at(-1);
  assert.ok(activeOriginal);
  const activeRetry = await activeHarness.sdk.runWithContext({
    correlation: { retry_attempt: 1, original_event_id: activeOriginal.event.id, causation_id: activeOriginal.event.id },
  }, () => activeHarness.sdk.authenticationSucceeded({ ...namedInput(), operation: activeOperation.value } as never));
  assert.equal(activeRetry.ok, true, JSON.stringify(activeRetry));
  const activeRetryEvent = activeHarness.events.at(-1);
  assert.ok(activeRetryEvent);
  assert.equal(activeRetryEvent.correlation.retry_attempt, 1);
  assert.equal(activeRetryEvent.correlation.original_event_id, activeOriginal.event.id);
  assert.equal(activeRetryEvent.correlation.causation_id, activeOriginal.event.id);

  const authoritativeOriginalId = uuid(95_000);
  const authoritativeHarness = createHarness({
    start: 91_000,
    authoritativeContext: {
      correlation: { retry_attempt: 1, original_event_id: authoritativeOriginalId, causation_id: authoritativeOriginalId },
    },
  });
  const authoritativeOperation = authoritativeHarness.sdk.beginOperation({
    operationId: "operation-f11-authoritative-context-retry",
    transactionId: "transaction-f11-authoritative-context-retry",
    correlationId: "correlation-f11-authoritative-context-retry",
    boundEvent: "authenticationSucceeded",
    transactional: false,
  });
  assert.equal(authoritativeOperation.ok, true);
  if (!authoritativeOperation.ok) return;

  assert.equal((await authoritativeHarness.sdk.authenticationSucceeded({
    ...namedInput(),
    operation: authoritativeOperation.value,
    retry: { retry_attempt: 0 },
  } as never)).ok, true);
  const authoritativeRetry = await authoritativeHarness.sdk.authenticationSucceeded({
    ...namedInput(),
    operation: authoritativeOperation.value,
  } as never);
  assert.equal(authoritativeRetry.ok, true, JSON.stringify(authoritativeRetry));
  const authoritativeRetryEvent = authoritativeHarness.events.at(-1);
  assert.ok(authoritativeRetryEvent);
  assert.equal(authoritativeRetryEvent.correlation.retry_attempt, 1);
  assert.equal(authoritativeRetryEvent.correlation.original_event_id, authoritativeOriginalId);
  assert.equal(authoritativeRetryEvent.correlation.causation_id, authoritativeOriginalId);
});

test("F-11 terminal named retry does not let an invalid attempt bypass duplicate protection", async () => {
  const harness = createHarness({ start: 80_000 });
  const operation = harness.sdk.beginOperation({
    operationId: "operation-f11-invalid-retry",
    transactionId: "transaction-f11-invalid-retry",
    correlationId: "correlation-f11-invalid-retry",
    boundEvent: "authenticationSucceeded",
    transactional: false,
  });
  assert.equal(operation.ok, true);
  if (!operation.ok) return;

  assert.equal((await harness.sdk.authenticationSucceeded({ ...namedInput(), operation: operation.value } as never)).ok, true);
  const original = harness.events.at(-1);
  assert.ok(original);

  for (const retryAttempt of [0, -1, 1.5, "1", {}, Number.POSITIVE_INFINITY, 1_001] as const) {
    expectFailure(
      await harness.sdk.authenticationSucceeded({
        ...namedInput(),
        operation: operation.value,
        retry: { retry_attempt: retryAttempt, original_event_id: original.event.id, causation_id: original.event.id },
      } as never),
      "SDK_DUPLICATE_SUCCESS",
      "/operation/state",
    );
  }
  assert.equal(harness.counters.sinks, 1);
});

test("F-11 named terminal retry retains F-02 failure release and completion reservation", async () => {
  const delivered: Readonly<SecurityAuditEvent>[] = [];
  let calls = 0;
  const sink: AuditEventSink = {
    async emit(event) {
      calls += 1;
      delivered.push(event);
      return calls === 1 ? { status: "rejected", code: "synthetic-rejection" } : { status: "accepted" };
    },
  };
  const harness = createHarness({ sink, start: 60_000 });
  const operation = harness.sdk.beginOperation({
    operationId: "operation-f11-terminal",
    transactionId: "transaction-f11-terminal",
    correlationId: "correlation-f11-terminal",
    boundEvent: "authenticationSucceeded",
    transactional: false,
  });
  assert.equal(operation.ok, true);
  if (!operation.ok) return;
  const input = { ...namedInput(), operation: operation.value } as never;

  expectFailure(await harness.sdk.authenticationSucceeded(input), "SDK_SINK_REJECTED", "/sink");
  assert.equal((await harness.sdk.authenticationSucceeded(input)).ok, true, "sink rejection must release the F-02 reservation");
  const accepted = delivered[1];
  assert.ok(accepted);
  assert.equal((await harness.sdk.authenticationSucceeded({ redelivery: { event: mutableCopy(accepted) }, operation: operation.value } as never)).ok, true);
  expectFailure(await harness.sdk.authenticationSucceeded(input), "SDK_DUPLICATE_SUCCESS", "/operation/state");
  assert.equal(calls, 3, "redelivery invokes the sink but neither releases nor consumes accepted completion state");
});

test("F-11 pure redelivery never reruns F-10 transformations while named execution does", async () => {
  const harness = createHarness();
  const original = await generatedEvent(harness);
  const hookCount = harness.counters.hooks;
  assert.equal((await harness.sdk.redeliver(mutableCopy(original))).ok, true);
  assert.equal((await harness.sdk.authenticationSucceeded({ redelivery: { event: mutableCopy(original) } } as never)).ok, true);
  assert.equal(harness.counters.hooks, hookCount);
  assert.equal((await harness.sdk.authenticationSucceeded(namedInput() as never)).ok, true);
  assert.equal(harness.counters.hooks, hookCount + 1);

  const noHook = createHarness({ transformations: [] });
  assert.equal((await noHook.sdk.authenticationSucceeded(namedInput() as never)).ok, true);
  assert.equal(noHook.counters.hooks, 0);
});

test("F-11 sink rejected, unknown, and failure outcomes preserve bounded classification across all four intents", async () => {
  const source = createHarness();
  const event = mutableCopy(await generatedEvent(source));
  for (const behavior of ["rejected", "unknown", "throw", "promise"] as const) {
    let calls = 0;
    const hostileMarkers: string[] = [];
    const sink: AuditEventSink = {
      emit(delivered) {
        calls += 1;
        hostileMarkers.push(
          delivered.event.id,
          delivered.correlation.operation_id,
          delivered.correlation.transaction_id ?? "",
          delivered.correlation.correlation_id,
        );
        if (behavior === "throw") throw new Error(`hostile ${delivered.event.id}`);
        if (behavior === "promise") return Promise.reject(new Error(`hostile ${delivered.event.id}`));
        if (behavior === "unknown") return Promise.resolve({ status: "unknown", code: "synthetic-unknown" });
        return Promise.resolve({ status: "rejected", code: "synthetic-rejection" });
      },
    };
    const harness = createHarness({ sink });
    const results = [
      await harness.sdk.emit(mutableCopy(event)),
      await harness.sdk.redeliver(mutableCopy(event)),
      await harness.sdk.authenticationSucceeded(namedInput() as never),
      await harness.sdk.authenticationSucceeded({ redelivery: { event: mutableCopy(event) } } as never),
    ] as const;
    const expected = behavior === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE";
    for (const result of results) {
      expectFailure(result, expected, "/sink");
      const error = failureValue(result) as Record<string, unknown>;
      assert.equal(error.category, "sink");
      assert.equal(error.eventName, event.event.name);
      assert.deepEqual(Object.keys(error).sort(), ["category", "code", "eventName", "path"]);
    }
    assert.equal(calls, 4);
    assert.deepEqual(failureValue(results[1]), failureValue(results[0]));
    assert.deepEqual(failureValue(results[2]), failureValue(results[0]));
    assert.deepEqual(failureValue(results[3]), failureValue(results[0]));
    const diagnostic = JSON.stringify(results);
    for (const marker of hostileMarkers.filter(Boolean)) assert.equal(diagnostic.includes(marker), false);
  }
});

test("F-11 in-flight redelivery participates in flush/shutdown and shutdown rejects new attempts", async () => {
  const source = createHarness();
  const event = mutableCopy(await generatedEvent(source));
  let resolveDelivery: ((value: AuditDeliveryResult) => void) | undefined;
  let sinkCalls = 0;
  let flushCalls = 0;
  let shutdownCalls = 0;
  const sink: AuditEventSink = {
    emit() {
      sinkCalls += 1;
      return new Promise<AuditDeliveryResult>((resolve) => { resolveDelivery = resolve; });
    },
    async flush() { flushCalls += 1; },
    async shutdown() { shutdownCalls += 1; },
  };
  const harness = createHarness({ sink });
  const inFlight = harness.sdk.redeliver(event);
  const shuttingDown = harness.sdk.shutdown();
  await Promise.resolve();
  assert.equal(harness.sdk.state, "shutting_down");
  assert.equal(sinkCalls, 1);
  resolveDelivery?.({ status: "accepted" });
  assert.equal((await inFlight).ok, true);
  assert.equal((await shuttingDown).ok, true);
  assert.equal(flushCalls, 1);
  assert.equal(shutdownCalls, 1);
  expectFailure(await harness.sdk.redeliver(event), "SDK_SHUT_DOWN");
  assert.equal(sinkCalls, 1);
});
