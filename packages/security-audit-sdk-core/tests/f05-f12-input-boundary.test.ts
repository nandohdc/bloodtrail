import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  SecurityAuditSdkError,
  EVENT_METHODS,
  SDK_ERROR_CODES,
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
  credentialReference,
  dataPolicyContext,
  delegationContext,
  destinationContext,
  integrityContext,
  observedSource,
  registeredEnrichmentExtension,
  createAuditContextFrame,
  createSecurityAuditSdk,
  riskContext,
  serviceWorkload,
  sessionEvidence,
  validateSecurityAuditEvent,
  type AuditResult,
  type SecurityAuditEvent,
} from "../dist/index.js";

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");
const marker = "HOSTILE_F05_F12_MARKER_MUST_NOT_ESCAPE";

async function canonicalFixture(): Promise<SecurityAuditEvent> {
  const fixtures = JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
  const fixture = fixtures.find((candidate) => candidate.extensions?.["bloodtrail.audit.enrichment.v1"] !== undefined);
  assert.ok(fixture);
  return structuredClone(fixture);
}

function eventWithExtensionValue(base: SecurityAuditEvent, value: unknown): SecurityAuditEvent {
  const event = structuredClone(base);
  (event as unknown as { extensions: Record<string, unknown> }).extensions = { "bloodtrail.audit.enrichment.v1": value };
  return event;
}

function assertBoundedFailure(result: AuditResult<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, code);
  assert.equal(result.error.category, "validation");
  const diagnostic = JSON.stringify(result);
  assert.equal(diagnostic.includes(marker), false);
  assert.equal(diagnostic.includes("DataCloneError"), false);
  assert.equal(diagnostic.includes("DOMException"), false);
  assert.equal(diagnostic.includes("stack"), false);
  assert.ok(diagnostic.length < 256);
}

function assertStableThrow(invoke: () => unknown, code: string, path: string): void {
  assert.throws(invoke, (error: unknown) => {
    assert.ok(error instanceof SecurityAuditSdkError);
    assert.equal(error.constructor, SecurityAuditSdkError);
    assert.equal(error.code, code);
    assert.equal(error.category, code === "SDK_INVALID_CONFIGURATION" ? "configuration" : "validation");
    assert.equal(error.path, path);
    assert.equal(error.message, code);
    assert.equal(JSON.stringify(error).includes(marker), false);
    return true;
  });
}

test("F-05 authority constructors translate function, symbol, getter, proxy, clone, and cyclic failures", () => {
  assertStableThrow(
    () => authoritativeResource({ type: "document", nested: { value: function hostileFunction() { return marker; } } } as never),
    "SDK_INVALID_INPUT",
    "/resource",
  );
  assertStableThrow(
    () => authoritativeResource({ type: "document", nested: { value: Symbol(marker) } } as never),
    "SDK_INVALID_INPUT",
    "/resource",
  );

  let getterCalls = 0;
  const getter = Object.defineProperty({ type: "document" }, "nested", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error(marker);
    },
  });
  assertStableThrow(() => authoritativeResource(getter as never), "SDK_INVALID_INPUT", "/resource");
  assert.equal(getterCalls, 0, "accessor descriptors are rejected without invocation");

  const proxy = new Proxy({ type: "document" }, { ownKeys() { throw new Error(marker); } });
  assertStableThrow(() => authoritativeResource(proxy as never), "SDK_INVALID_INPUT", "/resource");

  const cycle: Record<string, unknown> = { type: "document" };
  cycle.self = cycle;
  assertStableThrow(() => authoritativeResource(cycle as never), "FIELD_SERIALIZATION_FAILED", "/resource");

  const valid = authoritativeResource({
    type: "document",
    id: "resource-1",
    samples: [null, true, 7, "ok"],
  } as unknown as Parameters<typeof authoritativeResource>[0]);
  assert.equal(valid.type, "document");
  assert.equal(Object.isFrozen(valid), true);
});

test("F-05 all exported raw-value authority factories share the bounded normalization boundary", async () => {
  const fixtures = JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
  const valueFor = (key: keyof SecurityAuditEvent): Record<string, unknown> => {
    const value = fixtures.find((candidate) => candidate[key] !== undefined)?.[key];
    assert.ok(value && typeof value === "object");
    return structuredClone(value) as Record<string, unknown>;
  };
  const tenant = valueFor("tenant");
  delete tenant.claimed_tenant_id;
  const cases: Array<readonly [string, (input: never) => unknown, Record<string, unknown>, string]> = [
    ["authoritativeActor", authoritativeActor, valueFor("actor"), "/actor"],
    ["claimedActor", claimedActor, valueFor("actor"), "/actor"],
    ["authenticatedPrincipal", authenticatedPrincipal, valueFor("authenticated_principal"), "/authenticated_principal"],
    ["authoritativeSubject", authoritativeSubject, valueFor("subject"), "/subject"],
    ["credentialReference", credentialReference, valueFor("credential"), "/credential"],
    ["delegationContext", delegationContext, valueFor("delegation"), "/delegation"],
    ["authoritativeTenant", authoritativeTenant, tenant, "/tenant"],
    ["authoritativeResource", authoritativeResource, valueFor("resource"), "/resource"],
    ["authenticationEvidence", authenticationEvidence, valueFor("authentication"), "/authentication"],
    ["authorizationEvidence", authorizationEvidence, valueFor("authorization"), "/authorization"],
    ["sessionEvidence", sessionEvidence, valueFor("session"), "/session"],
    ["serviceWorkload", serviceWorkload, valueFor("initiator"), "/initiator"],
    ["observedSource", observedSource, valueFor("source"), "/source"],
    ["destinationContext", destinationContext, valueFor("destination"), "/destination"],
    ["dataPolicyContext", dataPolicyContext, valueFor("data"), "/data"],
    ["riskContext", riskContext, valueFor("risk"), "/risk"],
    ["integrityContext", integrityContext, valueFor("integrity"), "/integrity"],
    ["registeredEnrichmentExtension", registeredEnrichmentExtension, valueFor("extensions"), "/extensions"],
  ];

  for (const [name, factory, valid, path] of cases) {
    assert.doesNotThrow(() => factory(structuredClone(valid) as never), name);
    assertStableThrow(() => factory({ ...valid, hostile: { nested: () => marker } } as never), "SDK_INVALID_INPUT", path);
    assertStableThrow(() => factory({ ...valid, hostile: 12345678901234567890n } as never), "FIELD_SERIALIZATION_FAILED", path);
    const getter = Object.defineProperty({ ...valid }, "hostile", { enumerable: true, get() { throw new Error(marker); } });
    assertStableThrow(() => factory(getter as never), "SDK_INVALID_INPUT", path);
    const cycle = { ...valid } as Record<string, unknown>;
    cycle.hostile = cycle;
    assertStableThrow(() => factory(cycle as never), "FIELD_SERIALIZATION_FAILED", path);
  }
});

test("F-05 configuration, context-frame, and operation factories do not leak caller exceptions", () => {
  const baseConfig = {
    contractVersion: "1.0.0" as const,
    producer: { name: "service", version: "1.0.0" },
    service: { name: "service", version: "1.0.0" },
    environment: { name: "test" },
    sink: { emit: async () => ({ status: "accepted" as const }) },
  };
  const hostileConfig = Object.defineProperty({ ...baseConfig }, "producer", {
    enumerable: true,
    get() { throw new Error(marker); },
  });
  assertStableThrow(() => createSecurityAuditSdk(hostileConfig), "SDK_INVALID_CONFIGURATION", "/configuration");

  const hostileFrame = Object.defineProperty({}, "request", {
    enumerable: true,
    get() { throw new Error(marker); },
  });
  assertStableThrow(() => createAuditContextFrame(hostileFrame), "SDK_INVALID_INPUT", "/context");

  const sdk = createSecurityAuditSdk(baseConfig);
  const operationInput = Object.defineProperty({}, "boundEvent", {
    enumerable: true,
    get() { throw new Error(marker); },
  });
  assertBoundedFailure(sdk.beginOperation(operationInput), "SDK_INVALID_INPUT");
});

test("F-05/F-12 generic emit normalizes hostile values, classifies serialization accurately, and never invokes the sink", async () => {
  const base = await canonicalFixture();
  let sinkCalls = 0;
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: base.producer,
    service: base.service,
    environment: base.environment,
    sink: { emit: async () => { sinkCalls += 1; return { status: "accepted" }; } },
  });

  const cases: Array<readonly [string, unknown, string]> = [
    ["function", { hostile: () => marker }, "SDK_INVALID_INPUT"],
    ["symbol", { hostile: Symbol(marker) }, "SDK_INVALID_INPUT"],
    ["BigInt", { hostile: 9876543210123456789n }, "FIELD_SERIALIZATION_FAILED"],
    ["Date", new Date("2026-08-02T00:00:00.000Z"), "SDK_INVALID_INPUT"],
    ["RegExp", /hostile/u, "SDK_INVALID_INPUT"],
    ["Map", new Map([["key", marker]]), "SDK_INVALID_INPUT"],
    ["Set", new Set([marker]), "SDK_INVALID_INPUT"],
    ["typed array", new Uint8Array([1, 2, 3]), "SDK_INVALID_INPUT"],
    ["ArrayBuffer", new ArrayBuffer(4), "SDK_INVALID_INPUT"],
    ["Error", new Error(marker), "SDK_INVALID_INPUT"],
    ["URL", new URL("https://example.invalid/"), "SDK_INVALID_INPUT"],
    ["sparse array", Array(2), "SDK_INVALID_INPUT"],
    ["custom prototype", Object.create({ inherited: true }), "SDK_INVALID_INPUT"],
  ];

  for (const [name, value, code] of cases) {
    const result = await sdk.emit(eventWithExtensionValue(base, value));
    assertBoundedFailure(result, code);
    assert.equal(sinkCalls, 0, name);
    if (name === "BigInt") assert.notEqual(result.ok ? undefined : result.error.code, "FIELD_LIMIT_EXCEEDED");
  }

  const cycle: Record<string, unknown> = { provenance: { trust_level: "downstream_enrichment", source: "test" } };
  cycle.self = cycle;
  assertBoundedFailure(await sdk.emit(eventWithExtensionValue(base, cycle)), "FIELD_SERIALIZATION_FAILED");
  assert.equal(sinkCalls, 0);
});

test("F-05 getter, Proxy traps, and toJSON behavior are bounded and non-disclosing", async () => {
  const base = await canonicalFixture();
  let sinkCalls = 0;
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: base.producer,
    service: base.service,
    environment: base.environment,
    sink: { emit: async () => { sinkCalls += 1; return { status: "accepted" }; } },
  });

  let getterCalls = 0;
  const getter = Object.defineProperty({}, "hostile", {
    enumerable: true,
    get() { getterCalls += 1; throw new Error(marker); },
  });
  assertBoundedFailure(await sdk.emit(eventWithExtensionValue(base, getter)), "SDK_INVALID_INPUT");
  assert.equal(getterCalls, 0);

  let getCalls = 0;
  const getProxy = new Proxy({ safe: "value" }, { get() { getCalls += 1; throw new Error(marker); } });
  assertBoundedFailure(await sdk.emit(eventWithExtensionValue(base, getProxy)), "SDK_INVALID_INPUT");
  assert.equal(getCalls, 0);

  const ownKeysProxy = new Proxy({ safe: "value" }, { ownKeys() { throw new Error(marker); } });
  assertBoundedFailure(await sdk.emit(eventWithExtensionValue(base, ownKeysProxy)), "SDK_INVALID_INPUT");

  const descriptorProxy = new Proxy({ safe: "value" }, { getOwnPropertyDescriptor() { throw new Error(marker); } });
  assertBoundedFailure(await sdk.emit(eventWithExtensionValue(base, descriptorProxy)), "SDK_INVALID_INPUT");

  let toJsonCalls = 0;
  const withToJSON = { safe: "value", toJSON() { toJsonCalls += 1; throw new Error(marker); } };
  assertBoundedFailure(await sdk.emit(eventWithExtensionValue(base, withToJSON)), "SDK_INVALID_INPUT");
  assert.equal(toJsonCalls, 0);
  assert.equal(sinkCalls, 0);
});

test("F-12 genuine size violations remain field-limit failures while valid canonical values still pass", async () => {
  const base = await canonicalFixture();
  let sinkCalls = 0;
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: base.producer,
    service: base.service,
    environment: base.environment,
    sink: { emit: async () => { sinkCalls += 1; return { status: "accepted" }; } },
  });

  assertBoundedFailure(
    await sdk.emit(eventWithExtensionValue(base, {
      provenance: { trust_level: "downstream_enrichment", source: "test" },
      risk: { level: "low", reason_codes: ["x".repeat(9_000)] },
    })),
    "FIELD_LIMIT_EXCEEDED",
  );
  assertBoundedFailure(
    await sdk.emit(eventWithExtensionValue(base, {
      provenance: { trust_level: "downstream_enrichment", source: "test" },
      risk: { level: "low", reason_codes: Array.from({ length: 33 }, (_, index) => `reason-${index}`) },
    })),
    "FIELD_LIMIT_EXCEEDED",
  );
  assert.equal(sinkCalls, 0);

  const accepted = await sdk.emit(base);
  assert.equal(accepted.ok, true);
  assert.equal(sinkCalls, 1);
  assert.equal(validateSecurityAuditEvent(base).ok, true);
});

test("F-05/F-12 named failure does not invoke the sink or consume terminal completion state", async () => {
  const fixtures = JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
  const fixture = fixtures.find((candidate) => candidate.correlation.transaction_id && candidate.event.commit_state === "committed");
  assert.ok(fixture);
  const method = EVENT_METHODS.find((candidate) => candidate.name === fixture.event.name)?.method;
  assert.ok(method);
  let sinkCalls = 0;
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: fixture.producer,
    service: fixture.service,
    environment: fixture.environment,
    sink: { emit: async () => { sinkCalls += 1; return { status: "accepted" }; } },
  });
  const operation = sdk.beginOperation({ boundEvent: method, transactional: true });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);
  const valid = trustedNamedInput(fixture, operation.value);
  const hostile = { ...valid, request: { ...(fixture.request ?? {}), hostile: 12345678901234567890n } };
  const call = sdk[method] as (input: unknown) => Promise<AuditResult<unknown>>;

  assertBoundedFailure(await call.call(sdk, hostile), "FIELD_SERIALIZATION_FAILED");
  assert.equal(sinkCalls, 0);
  const retried = await call.call(sdk, valid);
  assert.equal(retried.ok, true);
  assert.equal(sinkCalls, 1);
});

test("F-05/F-12 error registry exposes additive SDK-owned diagnostics", () => {
  assert.equal(SDK_ERROR_CODES.includes("SDK_INVALID_INPUT"), true);
  assert.equal(SDK_ERROR_CODES.includes("FIELD_SERIALIZATION_FAILED"), true);
});

function trustedNamedInput(event: SecurityAuditEvent, operation: unknown): Record<string, unknown> {
  const actor = event.actor.type === "anonymous"
    ? anonymousActor(event.actor.provenance?.source)
    : event.actor.provenance?.trust_level === "client_claim"
      ? claimedActor(event.actor)
      : authoritativeActor(event.actor);
  const tenant = event.tenant ? structuredClone(event.tenant) as Record<string, unknown> : undefined;
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
    operation,
    actor,
    tenant: tenant ? authoritativeTenant(tenant as never) : undefined,
    claimedTenant: typeof claimedTenantId === "string" ? claimedTenant(claimedTenantId) : undefined,
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
