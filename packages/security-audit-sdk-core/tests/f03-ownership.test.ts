import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  authenticatedHumanActor,
  authenticationEvidence,
  authoritativeTenant,
  createSecurityAuditSdk,
  observedSource,
  type AuditClock,
  type AuditDeliveryResult,
  type AuditEventSink,
  type AuditFieldTransformationHook,
  type AuditIdentifierProvider,
  type AuditTransformationInput,
  type SecurityAuditEvent,
  type SecurityAuditSdkConfiguration,
} from "../dist/index.js";
import { normalizeConfiguration } from "../dist/config.js";
import { createCapturingAuditSink } from "../dist/testing.js";

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");
const collaboratorSymbol = Symbol("f03-caller-owned-state");
const fixedInstant = Date.parse("2026-08-02T12:00:00.000Z");

interface ShapeSnapshot {
  readonly keys: readonly PropertyKey[];
  readonly prototype: object | null;
  readonly descriptors: ReadonlyMap<PropertyKey, PropertyDescriptor>;
}

class MutableClassSink implements AuditEventSink {
  readonly events: Readonly<SecurityAuditEvent>[] = [];
  readonly counters = new Map<string, number>();
  readonly eventIds = new Set<string>();
  readonly nested = { queue: [] as string[] };
  readonly lifecycle: string[] = [];
  readonly [collaboratorSymbol] = { values: [] as string[] };
  #attempts = 0;
  #accessorReads = 0;
  #lastReceiver: unknown;

  constructor() {
    Object.defineProperty(this, "hiddenState", {
      configurable: true,
      enumerable: false,
      value: { calls: [] as string[] },
      writable: true,
    });
    Object.defineProperty(this, "inspectionOnly", {
      configurable: true,
      enumerable: true,
      get: () => {
        this.#accessorReads += 1;
        return this.nested;
      },
    });
  }

  get attempts(): number { return this.#attempts; }
  get accessorReads(): number { return this.#accessorReads; }
  get lastReceiver(): unknown { return this.#lastReceiver; }

  async emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult> {
    this.#lastReceiver = this;
    this.#attempts += 1;
    this.events.push(event);
    this.eventIds.add(event.event.id);
    this.nested.queue.push(event.event.name);
    this.counters.set("accepted", (this.counters.get("accepted") ?? 0) + 1);
    this[collaboratorSymbol].values.push(event.event.id);
    this.getHiddenState().calls.push("emit");
    return { status: "accepted" };
  }

  async flush(): Promise<void> {
    this.#lastReceiver = this;
    this.lifecycle.push("flush");
    this.getHiddenState().calls.push("flush");
  }

  getHiddenState(): { calls: string[] } {
    return (this as unknown as { hiddenState: { calls: string[] } }).hiddenState;
  }
}

class StatefulClassClock implements AuditClock {
  readonly state = { calls: [] as number[], instants: new Map<number, Date>() };
  #tick = 0;
  #lastReceiver: unknown;

  get tick(): number { return this.#tick; }
  get lastReceiver(): unknown { return this.#lastReceiver; }

  now(): Date {
    this.#lastReceiver = this;
    this.#tick += 1;
    const instant = new Date(fixedInstant + this.#tick * 1_000);
    this.state.calls.push(this.#tick);
    this.state.instants.set(this.#tick, instant);
    return instant;
  }
}

class StatefulClassIdentifiers implements AuditIdentifierProvider {
  readonly state = {
    calls: [] as string[],
    byKind: new Map<string, number>(),
    issued: new Set<string>(),
  };
  #counter: number;
  #lastReceiver: unknown;

  constructor(start = 1) {
    this.#counter = start;
  }

  get counter(): number { return this.#counter; }
  get lastReceiver(): unknown { return this.#lastReceiver; }

  eventId(): string { return this.next("eventId"); }
  operationId(): string { return this.next("operationId"); }
  correlationId(): string { return this.next("correlationId"); }
  causationId(): string { return this.next("causationId"); }
  requestId(): string { return this.next("requestId"); }
  messageId(): string { return this.next("messageId"); }
  transactionId(): string { return this.next("transactionId"); }

  private next(kind: string): string {
    this.#lastReceiver = this;
    const value = uuid(this.#counter++);
    this.state.calls.push(kind);
    this.state.byKind.set(kind, (this.state.byKind.get(kind) ?? 0) + 1);
    this.state.issued.add(value);
    return value;
  }
}

class StatefulClassHook implements AuditFieldTransformationHook {
  path: string = "actor.id";
  readonly state = {
    values: [] as string[],
    paths: [] as string[],
    counts: new Map<string, number>(),
  };
  #calls = 0;
  #lastReceiver: unknown;

  get calls(): number { return this.#calls; }
  get lastReceiver(): unknown { return this.#lastReceiver; }

  transform(input: AuditTransformationInput): string {
    this.#lastReceiver = this;
    this.#calls += 1;
    this.state.values.push(input.value);
    this.state.paths.push(input.path);
    this.state.counts.set(input.path, (this.state.counts.get(input.path) ?? 0) + 1);
    return `pseudonym_${input.value}`;
  }
}

class FrozenCapableSink implements AuditEventSink {
  #events: Readonly<SecurityAuditEvent>[] = [];

  get events(): readonly Readonly<SecurityAuditEvent>[] { return this.#events; }

  async emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult> {
    this.#events.push(event);
    return { status: "accepted" };
  }
}

class NonExtensibleIdentifiers implements AuditIdentifierProvider {
  readonly calls = new Map<string, number>();
  #counter = 20_000;
  #lastReceiver: unknown;

  get lastReceiver(): unknown { return this.#lastReceiver; }

  eventId(): string { return this.next("eventId"); }
  operationId(): string { return this.next("operationId"); }
  correlationId(): string { return this.next("correlationId"); }
  causationId(): string { return this.next("causationId"); }
  requestId(): string { return this.next("requestId"); }
  messageId(): string { return this.next("messageId"); }
  transactionId(): string { return this.next("transactionId"); }

  private next(kind: string): string {
    this.#lastReceiver = this;
    this.calls.set(kind, (this.calls.get(kind) ?? 0) + 1);
    return uuid(this.#counter++);
  }
}

test("F-03 field-aware normalization freezes only SDK-owned values and preserves collaborator shape and identity", () => {
  const sink = new MutableClassSink();
  const clock = new StatefulClassClock();
  const identifiers = new StatefulClassIdentifiers(1_000);
  const hook = new StatefulClassHook();
  const transformations: AuditFieldTransformationHook[] = [hook];
  const producer = { name: "owned-producer", version: "0.1.0" };
  const service = { name: "owned-service", version: "0.1.0" };
  const environment = { name: "test" };
  const deployment = { id: "deployment-one", region: "local", zone: "local-a" };
  const baseRequest = { id: "request-one", method: "POST", route: "/login" };
  const configuration: SecurityAuditSdkConfiguration = {
    contractVersion: "1.1.0",
    producer,
    service,
    environment,
    deployment,
    authoritativeContext: { request: baseRequest },
    transformations,
    sink,
    clock,
    identifiers,
    shutdownTimeoutMs: 123,
  };
  const methodIdentity = {
    emit: sink.emit,
    flush: sink.flush,
    now: clock.now,
    eventId: identifiers.eventId,
    transform: hook.transform,
  };
  const before = new Map<object, ShapeSnapshot>([
    [configuration, snapshotShape(configuration)],
    [producer, snapshotShape(producer)],
    [service, snapshotShape(service)],
    [environment, snapshotShape(environment)],
    [deployment, snapshotShape(deployment)],
    [baseRequest, snapshotShape(baseRequest)],
    [transformations, snapshotShape(transformations)],
    [sink, snapshotShape(sink)],
    [clock, snapshotShape(clock)],
    [identifiers, snapshotShape(identifiers)],
    [hook, snapshotShape(hook)],
  ]);

  const normalized = normalizeConfiguration(configuration);

  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.producer), true);
  assert.equal(Object.isFrozen(normalized.service), true);
  assert.equal(Object.isFrozen(normalized.environment), true);
  assert.equal(Object.isFrozen(normalized.deployment), true);
  assert.equal(Object.isFrozen(normalized.authoritativeContext), true);
  assert.equal(Object.isFrozen(normalized.transformations), true);
  assert.equal(Object.isFrozen(normalized.transformations[0]), true);
  assert.equal(normalized.sink, sink);
  assert.equal(normalized.clock, clock);
  assert.equal(normalized.identifiers, identifiers);
  assert.equal(normalized.transformations[0]?.hook, hook);
  assert.equal(normalized.transformations[0]?.path, "actor.id");
  assert.equal(sink.emit, methodIdentity.emit);
  assert.equal(sink.flush, methodIdentity.flush);
  assert.equal(clock.now, methodIdentity.now);
  assert.equal(identifiers.eventId, methodIdentity.eventId);
  assert.equal(hook.transform, methodIdentity.transform);
  assert.equal(Object.isFrozen(configuration), false);
  assert.equal(Object.isFrozen(producer), false);
  assert.equal(Object.isFrozen(service), false);
  assert.equal(Object.isFrozen(environment), false);
  assert.equal(Object.isFrozen(deployment), false);
  assert.equal(Object.isFrozen(baseRequest), false);
  assert.equal(Object.isFrozen(transformations), false);
  assertCallerOwnedGraphIsMutable(sink, clock, identifiers, hook);
  for (const [collaborator, shape] of before) assertShapeUnchanged(collaborator, shape);
  assert.equal(sink.accessorReads, 0, "normalization must not traverse the sink's enumerable accessor");

  producer.name = "mutated-producer";
  service.name = "mutated-service";
  environment.name = "mutated-environment";
  deployment.id = "mutated-deployment";
  baseRequest.id = "mutated-request";
  hook.path = "subject.id";
  transformations.length = 0;
  Object.assign(configuration as unknown as Record<string, unknown>, {
    sink: createCapturingAuditSink(),
    clock: { now: () => new Date(0) },
    identifiers: new StatefulClassIdentifiers(9_000),
    shutdownTimeoutMs: 0,
  });

  assert.equal(normalized.producer.name, "owned-producer");
  assert.equal(normalized.service.name, "owned-service");
  assert.equal(normalized.environment.name, "test");
  assert.equal(normalized.deployment?.id, "deployment-one");
  assert.equal(normalized.authoritativeContext.request?.id, "request-one");
  assert.equal(normalized.shutdownTimeoutMs, 123);
  assert.equal(normalized.sink, sink);
  assert.equal(normalized.clock, clock);
  assert.equal(normalized.identifiers, identifiers);
  assert.equal(normalized.transformations.length, 1);
  assert.equal(normalized.transformations[0]?.path, "actor.id");
  assert.equal(normalized.transformations[0]?.hook, hook);
  assert.throws(
    () => Object.assign(normalized as unknown as Record<string, unknown>, { sink: createCapturingAuditSink() }),
    TypeError,
  );
});

test("F-03 mutable class collaborators preserve receivers and accept sequential named delivery", async () => {
  const sink = new MutableClassSink();
  const clock = new StatefulClassClock();
  const identifiers = new StatefulClassIdentifiers(2_000);
  const hook = new StatefulClassHook();
  const transformations: AuditFieldTransformationHook[] = [hook];
  const producer = { name: "behavior-producer", version: "0.1.0" };
  const configuration: SecurityAuditSdkConfiguration = {
    contractVersion: "1.1.0",
    producer,
    service: { name: "behavior-service", version: "0.1.0" },
    environment: { name: "test" },
    transformations,
    sink,
    clock,
    identifiers,
    shutdownTimeoutMs: 100,
  };
  const shapes = new Map<object, ShapeSnapshot>([
    [sink, snapshotShape(sink)],
    [clock, snapshotShape(clock)],
    [identifiers, snapshotShape(identifiers)],
    [hook, snapshotShape(hook)],
  ]);
  const replacementSink = createCapturingAuditSink();

  const sdk = createSecurityAuditSdk(configuration);

  assertCallerOwnedGraphIsMutable(sink, clock, identifiers, hook);
  for (const [collaborator, shape] of shapes) assertShapeUnchanged(collaborator, shape);
  assert.equal(sink.accessorReads, 0);

  producer.name = "mutated-after-construction";
  hook.path = "subject.id";
  transformations.length = 0;
  Object.assign(configuration as unknown as Record<string, unknown>, {
    sink: replacementSink,
    clock: { now: () => new Date(0) },
    identifiers: new StatefulClassIdentifiers(30_000),
  });

  const first = await sdk.authenticationFailed(namedInput("actor-one", "request-one") as never);
  const second = await sdk.authenticationFailed(namedInput("actor-two", "request-two") as never);
  const flushed = await sdk.flush();

  assert.deepEqual(first, { ok: true, value: { status: "accepted" } });
  assert.deepEqual(second, { ok: true, value: { status: "accepted" } });
  assert.deepEqual(flushed, { ok: true, value: undefined });
  assert.equal(sink.events.length, 2);
  assert.deepEqual(sink.events.map((event) => event.actor.id), ["pseudonym_actor-one", "pseudonym_actor-two"]);
  assert.deepEqual(sink.events.map((event) => event.producer.name), ["behavior-producer", "behavior-producer"]);
  assert.equal(sink.counters.get("accepted"), 2);
  assert.equal(sink.eventIds.size, 2);
  assert.equal(sink.nested.queue.length, 2);
  assert.equal(sink.lifecycle.length, 1);
  assert.equal(sink.getHiddenState().calls.join(","), "emit,emit,flush");
  assert.equal(sink[collaboratorSymbol].values.length, 2);
  assert.equal(sink.attempts, 2);
  assert.equal(sink.lastReceiver, sink);
  assert.equal(replacementSink.events.length, 0);

  assert.equal(clock.tick, 4);
  assert.equal(clock.state.calls.length, 4);
  assert.equal(clock.state.instants.size, 4);
  assert.equal(clock.lastReceiver, clock);
  assert.equal(identifiers.state.byKind.get("eventId"), 2);
  assert.equal(identifiers.state.byKind.get("operationId"), 2);
  assert.equal(identifiers.state.byKind.get("correlationId"), 2);
  assert.equal(identifiers.state.issued.size, 6);
  assert.equal(identifiers.counter, 2_006);
  assert.equal(identifiers.lastReceiver, identifiers);
  assert.equal(hook.calls, 2);
  assert.deepEqual(hook.state.values, ["actor-one", "actor-two"]);
  assert.deepEqual(hook.state.paths, ["actor.id", "actor.id"]);
  assert.equal(hook.state.counts.get("actor.id"), 2);
  assert.equal(hook.lastReceiver, hook);
  assert.equal(sink.accessorReads, 0, "SDK operations must not inspect unrelated collaborator accessors");

  assertCallerOwnedGraphIsMutable(sink, clock, identifiers, hook);
  assert.equal(Object.getPrototypeOf(sink), MutableClassSink.prototype);
  assert.equal(Object.getPrototypeOf(clock), StatefulClassClock.prototype);
  assert.equal(Object.getPrototypeOf(identifiers), StatefulClassIdentifiers.prototype);
  assert.equal(Object.getPrototypeOf(hook), StatefulClassHook.prototype);
  assert.deepEqual(Reflect.ownKeys(sink), shapes.get(sink)?.keys);
  assert.deepEqual(Reflect.ownKeys(clock), shapes.get(clock)?.keys);
  assert.deepEqual(Reflect.ownKeys(identifiers), shapes.get(identifiers)?.keys);
  assert.deepEqual(Reflect.ownKeys(hook), shapes.get(hook)?.keys);
});

test("F-03 a pre-frozen sink and non-extensible provider remain usable when their implementations support it", async () => {
  const sink = Object.freeze(new FrozenCapableSink());
  const identifiers = Object.preventExtensions(new NonExtensibleIdentifiers());
  const sinkPrototype = Object.getPrototypeOf(sink);
  const identifierPrototype = Object.getPrototypeOf(identifiers);
  const sinkKeys = Reflect.ownKeys(sink);
  const identifierKeys = Reflect.ownKeys(identifiers);

  const sdk = createSecurityAuditSdk({
    contractVersion: "1.1.0",
    producer: { name: "frozen-capability-producer", version: "0.1.0" },
    service: { name: "frozen-capability-service", version: "0.1.0" },
    environment: { name: "test" },
    sink,
    clock: Object.freeze({ now: () => new Date(fixedInstant) }),
    identifiers,
  });
  const first = await sdk.authenticationFailed(namedInput("frozen-one", "frozen-request-one") as never);
  const second = await sdk.authenticationFailed(namedInput("frozen-two", "frozen-request-two") as never);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(Object.isFrozen(sink), true);
  assert.equal(Object.isFrozen(sink.events), false);
  assert.equal(sink.events.length, 2);
  assert.equal(Object.isExtensible(identifiers), false);
  assert.equal(Object.isFrozen(identifiers), false);
  assert.equal(Object.isFrozen(identifiers.calls), false);
  assert.equal(identifiers.calls.get("eventId"), 2);
  assert.equal(identifiers.lastReceiver, identifiers);
  assert.equal(Object.getPrototypeOf(sink), sinkPrototype);
  assert.equal(Object.getPrototypeOf(identifiers), identifierPrototype);
  assert.deepEqual(Reflect.ownKeys(sink), sinkKeys);
  assert.deepEqual(Reflect.ownKeys(identifiers), identifierKeys);
});

test("F-03 generic emit and current redelivery behavior do not freeze the caller-owned sink", async () => {
  const fixtures = JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
  const event = fixtures.find((candidate) => candidate.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(event);
  const sink = new MutableClassSink();
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.1.0",
    producer: { name: "generic-boundary-producer", version: "0.1.0" },
    service: { name: "generic-boundary-service", version: "0.1.0" },
    environment: { name: "test" },
    sink,
  });

  const emitted = await sdk.emit(event);
  const redelivered = await sdk.redeliver(event);

  assert.equal(emitted.ok, true);
  assert.equal(redelivered.ok, true);
  assert.equal(sink.events.length, 2);
  assert.equal(Object.isFrozen(sink), false);
  assert.equal(Object.isFrozen(sink.events), false);
  assert.equal(Object.isFrozen(sink.counters), false);
  assert.equal(Object.isFrozen(sink.eventIds), false);
  assert.equal(Object.isFrozen(sink.nested), false);
  assert.equal(Object.isFrozen(sink.nested.queue), false);
});

function namedInput(actorId: string, requestId: string): Record<string, unknown> {
  return {
    actor: authenticatedHumanActor({ id: actorId, tenantId: "tenant-alpha" }),
    tenant: authoritativeTenant({
      scope: "tenant",
      actor_tenant_id: "tenant-alpha",
      effective_tenant_id: "tenant-alpha",
      resource_tenant_id: "tenant-alpha",
    }),
    authentication: authenticationEvidence({
      method: "password_mfa",
      assurance_level: "aal2",
      mfa_state: "failed",
      credential_type: "session",
      failure_reason: "credential_invalid",
    }),
    source: observedSource({ observed: { address: "203.0.113.10", port: 443 } }),
    request: { id: requestId, method: "POST", route: "/login", message_id: `${requestId}-message` },
  };
}

function uuid(value: number): string {
  return `44444444-4444-4444-8444-${String(value).padStart(12, "0")}`;
}

function snapshotShape(value: object): ShapeSnapshot {
  return {
    keys: Reflect.ownKeys(value),
    prototype: Object.getPrototypeOf(value),
    descriptors: new Map(Reflect.ownKeys(value).map((key) => [key, Object.getOwnPropertyDescriptor(value, key)!])),
  };
}

function assertShapeUnchanged(value: object, before: ShapeSnapshot): void {
  assert.deepEqual(Reflect.ownKeys(value), before.keys);
  assert.equal(Object.getPrototypeOf(value), before.prototype);
  for (const key of before.keys) {
    const prior = before.descriptors.get(key);
    const current = Object.getOwnPropertyDescriptor(value, key);
    assert.ok(prior);
    assert.ok(current);
    assert.equal(current.configurable, prior.configurable, `${String(key)} configurable changed`);
    assert.equal(current.enumerable, prior.enumerable, `${String(key)} enumerable changed`);
    assert.equal(current.writable, prior.writable, `${String(key)} writable changed`);
    assert.equal(current.get, prior.get, `${String(key)} getter changed`);
    assert.equal(current.set, prior.set, `${String(key)} setter changed`);
    assert.equal(current.value, prior.value, `${String(key)} value identity changed`);
  }
}

function assertCallerOwnedGraphIsMutable(
  sink: MutableClassSink,
  clock: StatefulClassClock,
  identifiers: StatefulClassIdentifiers,
  hook: StatefulClassHook,
): void {
  for (const value of [
    sink,
    sink.events,
    sink.counters,
    sink.eventIds,
    sink.nested,
    sink.nested.queue,
    sink.lifecycle,
    sink[collaboratorSymbol],
    sink[collaboratorSymbol].values,
    sink.getHiddenState(),
    sink.getHiddenState().calls,
    clock,
    clock.state,
    clock.state.calls,
    clock.state.instants,
    identifiers,
    identifiers.state,
    identifiers.state.calls,
    identifiers.state.byKind,
    identifiers.state.issued,
    hook,
    hook.state,
    hook.state.values,
    hook.state.paths,
    hook.state.counts,
  ]) {
    assert.equal(Object.isFrozen(value), false);
  }
}
