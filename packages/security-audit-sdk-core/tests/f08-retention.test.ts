import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  anonymousActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeActor,
  authoritativeResource,
  authoritativeSubject,
  authoritativeTenant,
  authorizationEvidence,
  claimedActor,
  claimedTenant,
  createSecurityAuditSdk,
  credentialReference,
  dataPolicyContext,
  delegationContext,
  destinationContext,
  integrityContext,
  observedSource,
  registeredEnrichmentExtension,
  riskContext,
  serviceWorkload,
  sessionEvidence,
  type AuditEventSink,
  type AuditIdentifierProvider,
  type SecurityAuditEvent,
  type SecurityAuditSdk,
  type SecurityAuditSdkConfiguration,
} from "../dist/index.js";
import { BoundedFifoSet } from "../dist/bounded-fifo.js";
import { inspectSdkRetentionForTesting } from "../dist/testing.js";

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");
const acceptedSink: AuditEventSink = Object.freeze({ emit: async () => ({ status: "accepted" } as const) });

async function positives(): Promise<SecurityAuditEvent[]> {
  return JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
}

test("F-08 bounded FIFO uses insertion age and duplicate reads/inserts do not refresh order", () => {
  const history = new BoundedFifoSet<string>(3);
  assert.equal(history.add("a"), true);
  assert.equal(history.add("b"), true);
  assert.equal(history.add("c"), true);
  assert.equal(history.has("a"), true);
  assert.equal(history.has("a"), true);
  assert.equal(history.add("c"), false);
  assert.equal(history.size, 3);
  assert.equal(history.add("d"), true);
  assert.equal(history.has("a"), false);
  assert.equal(history.has("b"), true);
  assert.equal(history.add("e"), true);
  assert.equal(history.has("b"), false);
  assert.equal(history.has("c"), true);
  assert.equal(history.size, 3);
});

test("F-08 generated identifier history is bounded FIFO with documented post-eviction behavior", async () => {
  const ids = [uuid(1), uuid(2), uuid(3), uuid(4), uuid(1), uuid(4)];
  const sdk = createSdk(identifiers({ eventIds: ids }), { recentGeneratedEventIds: 3, recentIssuedOperationIds: 3 });
  const input = namedInput(requiredFixture(await positives(), "bloodtrail.audit.authentication.failed"));
  for (let index = 0; index < 5; index += 1) {
    const result = await sdk.authenticationFailed(input as never);
    assert.equal(result.ok, true, `generated ID at index ${index} should be outside retained duplicate knowledge`);
    const state = inspectSdkRetentionForTesting(sdk);
    assert.ok(state);
    assert.ok(state.generatedEventIds.size <= 3);
    assert.equal(state.generatedEventIds.capacity, 3);
  }
  const retainedDuplicate = await sdk.authenticationFailed(input as never);
  assert.deepEqual(retainedDuplicate, {
    ok: false,
    error: { code: "SDK_INVALID_IDENTIFIER", category: "validation", path: "/event/id" },
  });
  assert.equal(JSON.stringify(retainedDuplicate).includes(ids[5] ?? "missing"), false);
});

test("F-08 recent issued-operation IDs are collision history, not operation authority", () => {
  const sdk = createSdk(identifiers({ operationIds: ["op-a", "op-b", "op-c", "op-a", "op-a"] }), {
    recentGeneratedEventIds: 2,
    recentIssuedOperationIds: 2,
  });
  const live = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
  assert.ok(live.ok);
  assert.ok(sdk.beginOperation().ok);
  assert.ok(sdk.beginOperation().ok);
  const afterEviction = sdk.beginOperation();
  assert.ok(afterEviction.ok, "evicted operation ID may re-enter collision history without becoming authority");
  const retainedDuplicate = sdk.beginOperation();
  assert.equal(retainedDuplicate.ok, false);
  if (!retainedDuplicate.ok) assert.equal(retainedDuplicate.error.code, "SDK_INVALID_IDENTIFIER");
  assert.equal(live.value.markCommitted().ok, true, "unrelated collision-history churn must not expire a live handle");
  const state = inspectSdkRetentionForTesting(sdk);
  assert.deepEqual(state?.issuedOperationIds, { size: 2, capacity: 2 });
});

test("F-08 live exact-handle authority and terminal completion survive unrelated retention churn", async () => {
  const created = namedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  const deleted = namedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.deleted"));
  const sdk = createSdk(identifiers({ start: 10_000 }), { recentGeneratedEventIds: 3, recentIssuedOperationIds: 3 });
  const foreignSdk = createSdk(identifiers({ start: 40_000 }), { recentGeneratedEventIds: 3, recentIssuedOperationIds: 3 });
  const operation = sdk.beginOperation({
    operationId: "live-operation",
    transactionId: "live-transaction",
    correlationId: "live-correlation",
    boundEvent: "sensitiveResourceCreated",
  });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);

  for (let index = 0; index < 20; index += 1) assert.ok(sdk.beginOperation().ok);
  for (let index = 0; index < 20; index += 1) {
    const unrelated = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
    assert.ok(unrelated.ok);
    assert.equal(unrelated.value.markCommitted().ok, true);
    assert.equal((await sdk.sensitiveResourceCreated({ ...created, operation: unrelated.value } as never)).ok, true);
  }

  assert.equal(operation.value.state, "committed");
  const first = await sdk.sensitiveResourceCreated({ ...created, operation: operation.value } as never);
  assert.equal(first.ok, true);
  const duplicate = await sdk.sensitiveResourceCreated({ ...created, operation: operation.value } as never);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "SDK_DUPLICATE_SUCCESS");

  const copied = await sdk.sensitiveResourceCreated({ ...created, operation: { ...operation.value } } as never);
  assert.equal(copied.ok, false);
  if (!copied.ok) assert.equal(copied.error.code, "SDK_INVALID_OPERATION_TRANSITION");
  const cloned = await sdk.sensitiveResourceCreated({ ...created, operation: structuredClone(operation.value) } as never);
  assert.equal(cloned.ok, false);
  const foreign = await foreignSdk.sensitiveResourceCreated({ ...created, operation: operation.value } as never);
  assert.equal(foreign.ok, false);
  const mismatch = await sdk.sensitiveResourceDeleted({ ...deleted, operation: operation.value } as never);
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.error.code, "SDK_OPERATION_EVENT_MISMATCH");
});

test("F-08 active reservations are independent of bounded histories at capacity boundaries", async () => {
  const targetEntered = Promise.withResolvers<void>();
  const secondTargetEntered = Promise.withResolvers<void>();
  const releaseTarget = Promise.withResolvers<void>();
  let sinkInvocations = 0;
  let targetInvocations = 0;
  const sink: AuditEventSink = {
    async emit(event) {
      sinkInvocations += 1;
      if (event.correlation.operation_id === "reserved-live-operation") {
        targetInvocations += 1;
        if (targetInvocations === 1) targetEntered.resolve();
        if (targetInvocations === 2) secondTargetEntered.resolve();
        await releaseTarget.promise;
      }
      return { status: "accepted" };
    },
  };
  const sdk = createSdk(identifiers({ start: 60_000 }), { recentGeneratedEventIds: 2, recentIssuedOperationIds: 2 }, sink);
  const created = namedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  const target = sdk.beginOperation({
    operationId: "reserved-live-operation",
    transactionId: "reserved-live-transaction",
    correlationId: "reserved-live-correlation",
    boundEvent: "sensitiveResourceCreated",
  });
  assert.ok(target.ok);
  assert.equal(target.value.markCommitted().ok, true);
  const targetInput = { ...created, operation: target.value } as never;
  const pending = sdk.sensitiveResourceCreated(targetInput);
  await targetEntered.promise;

  for (let index = 0; index < 8; index += 1) {
    const unrelated = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
    assert.ok(unrelated.ok);
    assert.equal(unrelated.value.markCommitted().ok, true);
    assert.equal((await sdk.sensitiveResourceCreated({ ...created, operation: unrelated.value } as never)).ok, true);
  }
  const duplicatePromise = sdk.sensitiveResourceCreated(targetInput);
  await Promise.race([
    secondTargetEntered.promise,
    new Promise<void>((resolve) => setImmediate(resolve)),
  ]);
  assert.equal(targetInvocations, 1, "a reserved completion must not hand off to the sink twice");
  releaseTarget.resolve();
  const duplicate = await duplicatePromise;
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "SDK_DUPLICATE_SUCCESS");
  assert.equal((await pending).ok, true);
  assert.equal(sinkInvocations, 9);
  const completedDuplicate = await sdk.sensitiveResourceCreated(targetInput);
  assert.equal(completedDuplicate.ok, false);
});

test("F-08 failed, rejected-promise, and synchronous-throw attempts release weak reservations", async (context) => {
  const scenarios: readonly {
    readonly name: string;
    readonly first: "rejected" | "reject-promise" | "throw";
    readonly expected: string;
  }[] = [
    { name: "rejected result", first: "rejected", expected: "SDK_SINK_REJECTED" },
    { name: "rejected promise", first: "reject-promise", expected: "SDK_SINK_FAILURE" },
    { name: "synchronous throw", first: "throw", expected: "SDK_SINK_FAILURE" },
  ];
  for (const [index, scenario] of scenarios.entries()) {
    await context.test(scenario.name, async () => {
      let calls = 0;
      const sink: AuditEventSink = {
        emit() {
          calls += 1;
          if (calls === 1) {
            if (scenario.first === "throw") throw new Error("F08_SECRET");
            if (scenario.first === "reject-promise") return Promise.reject(new Error("F08_SECRET"));
            return Promise.resolve({ status: "rejected", code: "f08_synthetic_rejection" });
          }
          return Promise.resolve({ status: "accepted" });
        },
      };
      const sdk = createSdk(identifiers({ start: 80_000 + index * 100 }), { recentGeneratedEventIds: 2, recentIssuedOperationIds: 2 }, sink);
      const created = namedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
      const operation = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
      assert.ok(operation.ok);
      assert.equal(operation.value.markCommitted().ok, true);
      const input = { ...created, operation: operation.value } as never;
      const failed = await sdk.sensitiveResourceCreated(input);
      assert.equal(failed.ok, false);
      if (!failed.ok) assert.equal(failed.error.code, scenario.expected);
      assert.equal(JSON.stringify(failed).includes("F08_SECRET"), false);
      assert.equal((await sdk.sensitiveResourceCreated(input)).ok, true);
      assert.equal(calls, 2);
    });
  }
});

test("F-08 retention configuration is finite, bounded, immutable, and rejects unsafe values", () => {
  const defaults = createSdk(identifiers(), undefined);
  assert.deepEqual(inspectSdkRetentionForTesting(defaults), {
    generatedEventIds: { size: 0, capacity: 4096 },
    issuedOperationIds: { size: 0, capacity: 4096 },
  });
  const maximum = createSdk(identifiers(), { recentGeneratedEventIds: 100_000, recentIssuedOperationIds: 100_000 });
  assert.equal(inspectSdkRetentionForTesting(maximum)?.generatedEventIds.capacity, 100_000);

  const invalidValues: readonly unknown[] = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100_001, Number.MAX_SAFE_INTEGER, "10", 10n];
  for (const value of invalidValues) {
    assert.throws(
      () => createSdk(identifiers(), { recentGeneratedEventIds: value as never, recentIssuedOperationIds: 2 }),
      (error: unknown) => configurationError(error, "/retention/recentGeneratedEventIds"),
      String(value),
    );
  }
  assert.throws(() => createSdk(identifiers(), [] as never), (error: unknown) => configurationError(error, "/retention"));
  assert.throws(() => createSdk(identifiers(), new Date() as never), (error: unknown) => configurationError(error, "/retention"));
  assert.throws(() => createSdk(identifiers(), { unknown: 2 } as never), (error: unknown) => configurationError(error, "/retention"));

  let getterCalls = 0;
  const retention = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(retention, "recentGeneratedEventIds", {
    enumerable: true,
    get() { getterCalls += 1; return 2; },
  });
  assert.throws(() => createSdk(identifiers(), retention as never), (error: unknown) => configurationError(error, "/retention/recentGeneratedEventIds"));
  assert.equal(getterCalls, 0);
});

test("F-08 soak plateaus structural histories after 10k events, 5k released operations, and 5k completions", async () => {
  const sdk = createSdk(identifiers({ start: 100_000 }), { recentGeneratedEventIds: 32, recentIssuedOperationIds: 32 });
  const authentication = namedInput(requiredFixture(await positives(), "bloodtrail.audit.authentication.failed"));
  const created = namedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  for (let index = 0; index < 10_000; index += 1) {
    assert.equal((await sdk.authenticationFailed(authentication as never)).ok, true);
  }
  for (let index = 0; index < 5_000; index += 1) assert.ok(sdk.beginOperation().ok);
  for (let index = 0; index < 5_000; index += 1) {
    const operation = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
    assert.ok(operation.ok);
    assert.equal(operation.value.markCommitted().ok, true);
    assert.equal((await sdk.sensitiveResourceCreated({ ...created, operation: operation.value } as never)).ok, true);
  }
  assert.deepEqual(inspectSdkRetentionForTesting(sdk), {
    generatedEventIds: { size: 32, capacity: 32 },
    issuedOperationIds: { size: 32, capacity: 32 },
  });
});

test("F-08 operation authority remains weak and retention adds no timer, interval, signal, or strong handle registry", async () => {
  const operationsSource = await readFile(resolve(process.cwd(), "src/operations.ts"), "utf8");
  const sdkSource = await readFile(resolve(process.cwd(), "src/sdk.ts"), "utf8");
  const fifoSource = await readFile(resolve(process.cwd(), "src/bounded-fifo.ts"), "utf8");
  assert.match(operationsSource, /new WeakMap<object, AuditOperationEvidence>\(\)/);
  assert.doesNotMatch(operationsSource, /new Map<object, AuditOperationEvidence>\(\)/);
  assert.doesNotMatch(sdkSource, /Set<AuditOperationHandle>|Map<AuditOperationHandle/);
  assert.doesNotMatch(`${sdkSource}\n${fifoSource}`, /setInterval\(|FinalizationRegistry|WeakRef|process\.on\(|process\.once\(/);
  assert.equal((sdkSource.match(/setTimeout\(/g) ?? []).length, 1, "only the unchanged F-07 shutdown timeout may remain");
});

function createSdk(
  identifiersProvider: AuditIdentifierProvider,
  retention?: SecurityAuditSdkConfiguration["retention"],
  sink: AuditEventSink = acceptedSink,
): SecurityAuditSdk {
  return createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "f08-test", version: "1.0.0" },
    service: { name: "f08-test", version: "1.0.0" },
    environment: { name: "test" },
    sink,
    clock: { now: () => new Date("2026-08-03T00:00:00.000Z") },
    identifiers: identifiersProvider,
    shutdownTimeoutMs: 100,
    ...(retention === undefined ? {} : { retention }),
  });
}

function identifiers(options: {
  readonly start?: number;
  readonly eventIds?: readonly string[];
  readonly operationIds?: readonly string[];
} = {}): AuditIdentifierProvider {
  let counter = options.start ?? 1;
  let eventIndex = 0;
  let operationIndex = 0;
  const next = () => uuid(counter++);
  return Object.freeze({
    eventId: () => options.eventIds?.[eventIndex++] ?? next(),
    operationId: () => options.operationIds?.[operationIndex++] ?? next(),
    correlationId: next,
    causationId: next,
    requestId: next,
    messageId: next,
    transactionId: next,
  });
}

function uuid(value: number): string {
  return `22222222-2222-4222-8222-${String(value).padStart(12, "0")}`;
}

function requiredFixture(fixtures: readonly SecurityAuditEvent[], name: SecurityAuditEvent["event"]["name"]): SecurityAuditEvent {
  const fixture = fixtures.find((candidate) => candidate.event.name === name);
  assert.ok(fixture);
  return fixture;
}

function brandActor(actor: SecurityAuditEvent["actor"] | undefined) {
  if (!actor) return undefined;
  if (actor.type === "anonymous") return anonymousActor(actor.provenance?.source);
  if (actor.provenance?.trust_level === "client_claim") return claimedActor(actor);
  return authoritativeActor(actor);
}

function namedInput(event: SecurityAuditEvent): Record<string, unknown> {
  const tenant = event.tenant ? { ...event.tenant } : undefined;
  const claimedTenantId = tenant?.claimed_tenant_id;
  if (tenant) delete tenant.claimed_tenant_id;
  const input: Record<string, unknown> = {
    event: {
      lifecycle_phase: event.event.lifecycle_phase,
      outcome: event.event.outcome,
      outcome_reason: event.event.outcome_reason,
      commit_state: event.event.commit_state,
      timestamp: event.event.timestamp,
      observed_at: event.event.observed_at,
    },
    actor: brandActor(event.actor),
    tenant: tenant ? authoritativeTenant(tenant) : undefined,
    claimedTenant: claimedTenantId ? claimedTenant(claimedTenantId) : undefined,
    subject: event.subject ? authoritativeSubject(event.subject) : undefined,
    authenticated_principal: event.authenticated_principal ? authenticatedPrincipal(event.authenticated_principal) : undefined,
    delegation: event.delegation ? delegationContext(event.delegation) : undefined,
    credential: event.credential ? credentialReference(event.credential) : undefined,
    initiator: event.initiator ? serviceWorkload(event.initiator) : undefined,
    session: event.session ? sessionEvidence(event.session) : undefined,
    authentication: event.authentication ? authenticationEvidence(event.authentication) : undefined,
    authorization: event.authorization ? authorizationEvidence(event.authorization) : undefined,
    source: event.source ? observedSource(event.source) : undefined,
    destination: event.destination ? destinationContext(event.destination) : undefined,
    resource: event.resource ? authoritativeResource(event.resource) : undefined,
    request: event.request,
    correlation: event.correlation,
    risk: event.risk ? riskContext(event.risk) : undefined,
    data: event.data ? dataPolicyContext(event.data) : undefined,
    integrity: event.integrity ? integrityContext(event.integrity) : undefined,
    extensions: event.extensions ? registeredEnrichmentExtension(event.extensions) : undefined,
  };
  for (const [key, value] of Object.entries(input)) if (value === undefined) delete input[key];
  return input;
}

function configurationError(error: unknown, path: string): boolean {
  const candidate = error as { readonly code?: string; readonly category?: string; readonly path?: string };
  return candidate.code === "SDK_INVALID_CONFIGURATION" && candidate.category === "configuration" && candidate.path === path;
}
