import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import {
  EVENT_CATALOG, SecurityAuditSdkError, StackContextProvider,
  anonymousActor, authenticationEvidence, authoritativeTenant, observedSource,
  cjsSchemaRuntime, createSecurityAuditSdk, defaultTimerProvider,
  setSchemaRuntime, validateSecurityAuditEvent,
  type AuditEventSink, type AuditIdentifierProvider, type AuditResult,
  type AuditSchemaRuntime, type AuditTimerHandle, type AuditTimerProvider,
  type SafeAuditError, type SecurityAuditEvent, type SecurityAuditSdk,
  type SecurityAuditSdkConfiguration,
} from "../dist/index.js";
import { createDeterministicClock, createDeterministicProviders } from "./conformance-harness.js";

type NamedInput = Parameters<SecurityAuditSdk["authenticationFailed"]>[0];
type Entry = "begin" | "named" | "emit" | "redeliver" | "validate" | "shutdown";
type Site = "operationId" | "transactionId" | "correlationId" | "eventId" | "now" |
  "context" | "schema" | "globalSchema" | "setTimeout" | "unref" | "clearTimeout";
type Behavior = "throw" | "undefined" | "null" | "empty" | "incomplete" | "unknownCode" | "invalidCategory";
interface FaultCase {
  readonly entry: Entry;
  readonly site: Site;
  readonly behavior: Behavior;
  readonly expected: SafeAuditError;
}
interface SinkProbe {
  readonly sink: AuditEventSink;
  readonly calls: { emit: number; flush: number; shutdown: number };
}
interface FaultProbe {
  calls: number;
  readonly row: FaultCase;
  invoke(): unknown;
}
interface FaultHarness extends SinkProbe {
  readonly sdk: SecurityAuditSdk;
  readonly probe: FaultProbe;
}

const identifierError = (path: string): SafeAuditError => ({ code: "SDK_INVALID_IDENTIFIER", category: "validation", path });
const configurationError = (path: string): SafeAuditError => ({ code: "SDK_INVALID_CONFIGURATION", category: "configuration", path });
const schemaError = configurationError("/schemaRuntime");
const timerError = configurationError("/timers");
const sentinel = "provider-private-sentinel-811";
const faultCases: readonly FaultCase[] = [
  { entry: "begin", site: "operationId", behavior: "throw", expected: identifierError("/operation/operation_id") },
  { entry: "begin", site: "transactionId", behavior: "throw", expected: identifierError("/operation/transaction_id") },
  { entry: "begin", site: "correlationId", behavior: "throw", expected: identifierError("/operation/correlation_id") },
  { entry: "named", site: "eventId", behavior: "throw", expected: identifierError("/event/id") },
  { entry: "named", site: "operationId", behavior: "throw", expected: identifierError("/correlation/operation_id") },
  { entry: "named", site: "correlationId", behavior: "throw", expected: identifierError("/correlation/correlation_id") },
  { entry: "named", site: "now", behavior: "throw", expected: { code: "SDK_INVALID_CLOCK", category: "configuration", path: "/clock" } },
  { entry: "named", site: "context", behavior: "throw", expected: configurationError("/contextProvider") },
  { entry: "named", site: "schema", behavior: "throw", expected: schemaError },
  { entry: "named", site: "schema", behavior: "undefined", expected: schemaError },
  { entry: "named", site: "globalSchema", behavior: "throw", expected: schemaError },
  { entry: "named", site: "globalSchema", behavior: "undefined", expected: schemaError },
  { entry: "named", site: "globalSchema", behavior: "incomplete", expected: schemaError },
  { entry: "emit", site: "schema", behavior: "throw", expected: schemaError },
  { entry: "emit", site: "schema", behavior: "undefined", expected: schemaError },
  { entry: "emit", site: "schema", behavior: "empty", expected: schemaError },
  { entry: "emit", site: "schema", behavior: "incomplete", expected: schemaError },
  { entry: "emit", site: "schema", behavior: "unknownCode", expected: schemaError },
  { entry: "emit", site: "schema", behavior: "invalidCategory", expected: schemaError },
  { entry: "redeliver", site: "schema", behavior: "throw", expected: schemaError },
  { entry: "redeliver", site: "schema", behavior: "undefined", expected: schemaError },
  { entry: "redeliver", site: "schema", behavior: "incomplete", expected: schemaError },
  { entry: "validate", site: "schema", behavior: "throw", expected: schemaError },
  { entry: "validate", site: "schema", behavior: "undefined", expected: schemaError },
  { entry: "validate", site: "schema", behavior: "incomplete", expected: schemaError },
  { entry: "validate", site: "globalSchema", behavior: "throw", expected: schemaError },
  { entry: "validate", site: "globalSchema", behavior: "undefined", expected: schemaError },
  { entry: "validate", site: "globalSchema", behavior: "incomplete", expected: schemaError },
  { entry: "shutdown", site: "setTimeout", behavior: "throw", expected: timerError },
  { entry: "shutdown", site: "setTimeout", behavior: "undefined", expected: timerError },
  { entry: "shutdown", site: "setTimeout", behavior: "null", expected: timerError },
  { entry: "shutdown", site: "unref", behavior: "throw", expected: timerError },
  { entry: "shutdown", site: "clearTimeout", behavior: "throw", expected: timerError },
];
const behaviorResults: Record<Exclude<Behavior, "throw">, unknown> = {
  undefined: undefined, null: null, empty: {}, incomplete: { ok: false },
  unknownCode: { ok: false, error: { code: "ANYTHING", category: "validation", leaked: sentinel } },
  invalidCategory: { ok: false, error: { code: "SDK_INVALID_INPUT", category: "nonsense", leaked: sentinel } },
};
const fixtures: readonly SecurityAuditEvent[] = JSON.parse(await readFile(
  resolve(process.cwd(), "../../contracts/security-audit/examples/positive/all-events.json"), "utf8",
));
const fixture = fixtures.find((event) => event.event.name === "bloodtrail.audit.authentication.failed")!;
assert.ok(fixture);
assert.ok(EVENT_CATALOG.find((entry) => entry.name === fixture.event.name)?.commit.includes("not_applicable" as never));

/** Use the minimal catalog-required context, not a copy of a general fixture converter. */
function namedInput(): NamedInput {
  assert.ok(fixture.authentication);
  assert.ok(fixture.source);
  return {
    actor: anonymousActor("request_boundary"),
    tenant: authoritativeTenant(fixture.tenant as Parameters<typeof authoritativeTenant>[0]),
    authentication: authenticationEvidence(fixture.authentication),
    source: observedSource(fixture.source),
    request: fixture.request,
    correlation: {},
    event: { outcome: "failure", lifecycle_phase: "completed", outcome_reason: fixture.event.outcome_reason },
  } as NamedInput;
}

function sinkProbe(): SinkProbe {
  const calls = { emit: 0, flush: 0, shutdown: 0 };
  return {
    calls,
    sink: {
      async emit() { calls.emit++; return { status: "accepted" }; },
      async flush() { calls.flush++; },
      async shutdown() { calls.shutdown++; },
    },
  };
}

function sdkFor(probe: SinkProbe, overrides: Partial<SecurityAuditSdkConfiguration> = {}): SecurityAuditSdk {
  return createSecurityAuditSdk({
    contractVersion: "2.1.0", producer: fixture.producer, service: fixture.service,
    environment: fixture.environment, sink: probe.sink,
    identifiers: createDeterministicProviders(), clock: createDeterministicClock(),
    contextProvider: new StackContextProvider(), ...overrides,
  });
}

function faultProbe(row: FaultCase): FaultProbe {
  return {
    row, calls: 0,
    invoke() {
      this.calls++;
      if (row.behavior === "throw") throw new TypeError(sentinel);
      return behaviorResults[row.behavior];
    },
  };
}

function faultyRuntime(probe: FaultProbe): AuditSchemaRuntime {
  return { validate: () => probe.invoke() as AuditResult<void> };
}

function faultyTimers(probe: FaultProbe): AuditTimerProvider {
  return {
    setTimeout() {
      if (probe.row.site === "setTimeout") return probe.invoke() as AuditTimerHandle;
      if (probe.row.site === "unref") return { unref: () => { probe.invoke(); } };
      return {};
    },
    clearTimeout() { if (probe.row.site === "clearTimeout") probe.invoke(); },
  };
}

function faultyConfiguration(probe: FaultProbe): Partial<SecurityAuditSdkConfiguration> {
  const site = probe.row.site;
  switch (site) {
    case "now": return { clock: { now: () => probe.invoke() as Date } };
    case "context": return { contextProvider: { run: (_frame, fn) => fn(), get: () => probe.invoke() as undefined } };
    case "schema": return { schemaRuntime: faultyRuntime(probe) };
    case "globalSchema": return {};
    case "setTimeout": case "unref": case "clearTimeout": return { timers: faultyTimers(probe) };
    default: return { identifiers: { ...createDeterministicProviders(), [site]: () => probe.invoke() as string } };
  }
}

const entryCalls: Record<Entry, (harness: FaultHarness) => unknown> = {
  begin: ({ sdk }) => sdk.beginOperation(),
  named: ({ sdk }) => sdk.authenticationFailed(namedInput()),
  emit: ({ sdk }) => sdk.emit(fixture),
  redeliver: ({ sdk }) => sdk.redeliver(fixture),
  validate: ({ probe }) => validateSecurityAuditEvent(fixture, probe.row.site === "schema" ? faultyRuntime(probe) : undefined),
  shutdown: ({ sdk }) => sdk.shutdown(),
};

async function invokeResult(call: () => unknown): Promise<AuditResult<unknown>> {
  let pending: unknown;
  assert.doesNotThrow(() => { pending = call(); });
  let result: unknown;
  await assert.doesNotReject(async () => { result = await pending; });
  return result as AuditResult<unknown>;
}

function assertFailure(result: AuditResult<unknown>, expected: SafeAuditError): void {
  assert.deepEqual(result, { ok: false, error: expected });
  assert.equal(JSON.stringify(result).includes(sentinel), false);
}

async function assertShutdownFault(harness: FaultHarness): Promise<void> {
  assert.equal(harness.sdk.state, "shut_down");
  assertFailure(await harness.sdk.shutdown(), { code: "SDK_SHUT_DOWN", category: "lifecycle" });
  const lifecycleCalls = harness.probe.row.site === "setTimeout" ? 0 : 1;
  assert.equal(harness.calls.flush, lifecycleCalls);
  assert.equal(harness.calls.shutdown, lifecycleCalls);
}

test("provider-fault site matrix has exactly 33 explicit rows", () => {
  assert.equal(faultCases.length, 33);
  assert.equal(new Set(faultCases.map((row) => `${row.entry}/${row.site}/${row.behavior}`)).size, 33);
});

for (const row of faultCases) {
  test(`contained ${row.entry}/${row.site}/${row.behavior}`, async () => {
    const probe = faultProbe(row);
    const sink = sinkProbe();
    const harness: FaultHarness = { ...sink, probe, sdk: sdkFor(sink, faultyConfiguration(probe)) };
    const previous = setSchemaRuntime(cjsSchemaRuntime);
    try {
      if (row.site === "globalSchema") setSchemaRuntime(faultyRuntime(probe));
      const result = await invokeResult(() => entryCalls[row.entry](harness));
      assertFailure(result, row.expected);
      assert.ok(probe.calls > 0, "faulty provider actually invoked");
      assert.equal(sink.calls.emit, 0);
      if (row.entry === "shutdown") await assertShutdownFault(harness);
    } finally { setSchemaRuntime(previous); }
  });
}

interface RuntimeFailureCase { readonly returned: unknown; readonly expected: SafeAuditError }
const sanitizedFailures: readonly RuntimeFailureCase[] = [
  { returned: { ok: false, error: { code: "FIELD_LIMIT_EXCEEDED", category: "validation", path: "/" + "x".repeat(800), leaked: sentinel } },
    expected: { code: "FIELD_LIMIT_EXCEEDED", category: "validation", path: "/" + "x".repeat(159) } },
  { returned: { ok: false, error: { code: "PROHIBITED_DATA", category: "privacy", path: "/secret", leaked: sentinel } },
    expected: { code: "PROHIBITED_DATA", category: "privacy", path: "/secret" } },
  { returned: { ok: false, error: { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/event", leaked: sentinel } },
    expected: { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/event" } },
  { returned: { ok: false, error: { code: "SDK_SCHEMA_VALIDATION_FAILED", category: "validation", path: 42, leaked: sentinel } },
    expected: { code: "SDK_SCHEMA_VALIDATION_FAILED", category: "validation" } },
  { returned: { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle", path: "/", leaked: sentinel } }, expected: schemaError },
  { returned: { ok: false, error: { code: "SDK_INVALID_INPUT", category: "validation", path: "/", leaked: sentinel } }, expected: schemaError },
  { returned: { ok: false, error: { code: "SDK_INVALID_CONFIGURATION", category: "configuration", path: "/", leaked: sentinel } }, expected: schemaError },
  { returned: { ok: false, error: { code: "PROHIBITED_DATA", category: "authority", path: "/", leaked: sentinel } }, expected: schemaError },
];
test("schema sanitizer table has exactly eight explicit rows", () => {
  assert.equal(sanitizedFailures.length, 8);
});
for (const [index, row] of sanitizedFailures.entries()) {
  test(`schema failure row ${index + 1} sanitizes ${row.expected.code}/${row.expected.category}`, async () => {
    const sink = sinkProbe();
    const validate = mock.fn(() => row.returned as AuditResult<void>);
    const sdk = sdkFor(sink, { schemaRuntime: { validate } });
    assertFailure(await invokeResult(() => sdk.emit(fixture)), row.expected);
    assert.equal(validate.mock.callCount(), 1);
    assert.equal(sink.calls.emit, 0);
  });
}

test("default invalid-event diagnostic is unchanged from the base runtime", () => {
  // Base 6ee6f57: cjsSchemaRuntime maps the first required property to /event.
  assertFailure(validateSecurityAuditEvent({}, cjsSchemaRuntime), {
    code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/event",
  });
});

interface LegacyCase {
  readonly label: string;
  readonly overrides: Partial<SecurityAuditSdkConfiguration>;
  readonly expected: SafeAuditError;
}
const legacyCases: readonly LegacyCase[] = [
  { label: "malformed eventId", overrides: { identifiers: { ...createDeterministicProviders(), eventId: () => "bad" } }, expected: identifierError("/event/id") },
  { label: "invalid Date", overrides: { clock: { now: () => new Date(NaN) } }, expected: { code: "SDK_INVALID_CLOCK", category: "configuration", path: "/clock" } },
  { label: "throwing sink", overrides: { sink: { emit() { throw new Error(sentinel); } } },
    expected: { code: "SDK_SINK_FAILURE", category: "sink", path: "/sink", eventName: fixture.event.name } },
];
for (const row of legacyCases) {
  test(`legacy ${row.label}`, async () => {
    const sink = sinkProbe();
    assertFailure(await invokeResult(() => sdkFor(sink, row.overrides).authenticationFailed(namedInput())), row.expected);
    assert.equal(sink.calls.emit, 0);
  });
}

test("throwing caller getter remains caller input, not a provider fault", async () => {
  const sink = sinkProbe();
  const input = Object.defineProperty(namedInput(), "event", { enumerable: true, get() { throw new Error(sentinel); } });
  assertFailure(await invokeResult(() => sdkFor(sink).authenticationFailed(input)), {
    code: "SDK_INVALID_INPUT", category: "validation", path: "/",
  });
  assert.equal(sink.calls.emit, 0);
});

test("healthy providers emit exactly one catalog-derived event", async () => {
  const sink = sinkProbe();
  assert.deepEqual(await sdkFor(sink).authenticationFailed(namedInput()), { ok: true, value: { status: "accepted" } });
  assert.equal(sink.calls.emit, 1);
});

const numericTimerHandles: readonly AuditTimerHandle[] = [17 as unknown as AuditTimerHandle, {}, { unref: 42 } as unknown as AuditTimerHandle];
for (const handle of numericTimerHandles) {
  test(`valid non-nullish timer handle ${JSON.stringify(handle)}`, async () => {
    const sink = sinkProbe();
    const clearTimeout = mock.fn();
    const sdk = sdkFor(sink, { timers: { setTimeout: () => handle, clearTimeout } });
    const first = sdk.shutdown();
    assert.equal(sdk.shutdown(), first, "single-flight");
    assert.deepEqual(await first, { ok: true, value: undefined });
    assert.equal(sdk.state, "shut_down");
    assert.equal(sink.calls.flush, 1);
    assert.equal(sink.calls.shutdown, 1);
    assert.deepEqual(clearTimeout.mock.calls[0]?.arguments, [handle]);
    assertFailure(await sdk.shutdown(), { code: "SDK_SHUT_DOWN", category: "lifecycle" });
  });
}

interface PrecedenceCase {
  readonly site: "clearTimeout" | "unref";
  readonly earlier: "sink failure" | "stalled-emission timeout";
  readonly expected: SafeAuditError;
}
const precedenceCases: readonly PrecedenceCase[] = [
  { site: "clearTimeout", earlier: "sink failure", expected: { code: "SDK_SINK_FAILURE", category: "sink" } },
  { site: "clearTimeout", earlier: "stalled-emission timeout", expected: { code: "SDK_SHUTDOWN_TIMEOUT", category: "lifecycle" } },
  { site: "unref", earlier: "sink failure", expected: { code: "SDK_SINK_FAILURE", category: "sink" } },
  { site: "unref", earlier: "stalled-emission timeout", expected: { code: "SDK_SHUTDOWN_TIMEOUT", category: "lifecycle" } },
];
test("earlier-failure precedence table has exactly four explicit rows", () => {
  assert.equal(precedenceCases.length, 4);
  assert.equal(new Set(precedenceCases.map((row) => `${row.site}/${row.earlier}`)).size, 4);
});
for (const row of precedenceCases) {
  test(`${row.site} failure preserves ${row.earlier}`, async () => {
    const sink = sinkProbe();
    let expire = () => {};
    let release = () => {};
    const stalled = row.earlier === "stalled-emission timeout";
    const shutdown = mock.fn(async () => { throw new Error(sentinel); });
    const unref = mock.fn(() => { throw new Error(sentinel); });
    const clearTimeout = mock.fn(() => { if (row.site === "clearTimeout") throw new Error(sentinel); });
    const emit = mock.fn(() => new Promise<{ status: "accepted" }>((resolve) => { release = () => resolve({ status: "accepted" }); }));
    const sdk = sdkFor(sink, {
      sink: { ...sink.sink, emit, shutdown },
      timers: {
        setTimeout(callback) { expire = callback; return row.site === "unref" ? { unref } : {}; },
        clearTimeout,
      },
    });
    const emission = stalled ? sdk.emit(fixture) : undefined;
    assertFailure(await invokeResult(() => {
      const pending = sdk.shutdown();
      if (stalled) expire();
      return pending;
    }), row.expected);
    assert.equal(sdk.state, "shut_down");
    assert.equal(shutdown.mock.callCount(), stalled ? 0 : 1);
    assert.equal(emit.mock.callCount(), stalled ? 1 : 0);
    assert.equal(unref.mock.callCount(), row.site === "unref" ? 1 : 0);
    assert.equal(clearTimeout.mock.callCount(), 1);
    assert.equal(sink.calls.flush, stalled ? 0 : 1);
    assert.equal(sink.calls.shutdown, 0);
    assertFailure(await sdk.shutdown(), { code: "SDK_SHUT_DOWN", category: "lifecycle" });
    release();
    await emission;
  });
}

const suppliedIdentifiers = { operationId: "supplied-operation", transactionId: "supplied-transaction", correlationId: "supplied-correlation" };
function throwingIdentifiers(): { readonly identifiers: AuditIdentifierProvider; readonly spy: ReturnType<typeof mock.fn<() => string>> } {
  const spy = mock.fn((): string => { throw new Error(sentinel); });
  return { spy, identifiers: { eventId: spy, operationId: spy, correlationId: spy, transactionId: spy, causationId: spy, requestId: spy, messageId: spy } };
}

test("supplied operation IDs bypass providers; first unsupplied fault wins", () => {
  const sink = sinkProbe();
  const { identifiers, spy } = throwingIdentifiers();
  const sdk = sdkFor(sink, { identifiers });
  assert.equal(sdk.beginOperation(suppliedIdentifiers).ok, true);
  assert.equal(spy.mock.callCount(), 0);
  assertFailure(sdk.beginOperation(), identifierError("/operation/operation_id"));
  assert.equal(spy.mock.callCount(), 1);
  assertFailure(sdk.beginOperation({ operationId: "only-operation" }), identifierError("/operation/transaction_id"));
  assert.equal(spy.mock.callCount(), 2);
});

interface TimestampCase { readonly event: NamedInput["event"]; readonly calls: number }
const timestampCases: readonly TimestampCase[] = [
  { event: { timestamp: fixture.event.timestamp }, calls: 1 },
  { event: { observed_at: fixture.event.observed_at }, calls: 1 },
  { event: { timestamp: fixture.event.timestamp, observed_at: fixture.event.observed_at }, calls: 0 },
];
for (const row of timestampCases) {
  test(`clock fallback with ${Object.keys(row.event!).join("/")}`, async () => {
    const sink = sinkProbe();
    const now = mock.fn((): Date => { throw new Error(sentinel); });
    const sdk = sdkFor(sink, { clock: { now } });
    const input = { ...namedInput(), event: { ...namedInput().event, ...row.event } };
    const result = await invokeResult(() => sdk.authenticationFailed(input));
    if (row.calls === 0) assert.equal(result.ok, true);
    else assertFailure(result, { code: "SDK_INVALID_CLOCK", category: "configuration", path: "/clock" });
    assert.equal(now.mock.callCount(), row.calls);
    assert.equal(sink.calls.emit, row.calls === 0 ? 1 : 0);
  });
}

interface CorrelationCase {
  readonly label: string;
  readonly source: "supplied correlation" | "operation handle";
}
const correlationCases: readonly CorrelationCase[] = [
  { label: "named correlation fallbacks bypass unused provider methods", source: "supplied correlation" },
  { label: "operation handle correlation bypasses identifier fallback", source: "operation handle" },
];
function correlationInput(sdk: SecurityAuditSdk, row: CorrelationCase): NamedInput {
  if (row.source === "supplied correlation") return { ...namedInput(), correlation: fixture.correlation };
  const operation = sdk.beginOperation({ ...suppliedIdentifiers, transactional: false });
  assert.ok(operation.ok);
  return { ...namedInput(), operation: operation.value };
}
test("named correlation fallback table has exactly two explicit rows", () => {
  assert.equal(correlationCases.length, 2);
  assert.equal(new Set(correlationCases.map((row) => row.source)).size, 2);
});
for (const row of correlationCases) {
  test(row.label, async () => {
    const sink = sinkProbe();
    const identifiers = createDeterministicProviders();
    const unused = mock.fn((): string => { throw new Error(sentinel); });
    const sdk = sdkFor(sink, { identifiers: { ...identifiers, operationId: unused, correlationId: unused } });
    const input = correlationInput(sdk, row);
    assert.equal((await sdk.authenticationFailed(input)).ok, true);
    assert.equal(unused.mock.callCount(), 0);
    assert.equal(sink.calls.emit, 1);
  });
}

test("redelivery never allocates identifiers or reads clock", async () => {
  const sink = sinkProbe();
  const { identifiers, spy } = throwingIdentifiers();
  const now = mock.fn((): Date => { throw new Error(sentinel); });
  const sdk = sdkFor(sink, { identifiers, clock: { now } });
  assert.equal((await sdk.redeliver(fixture)).ok, true);
  assert.equal((await sdk.authenticationFailed({ redelivery: { event: fixture } } as NamedInput)).ok, true);
  assert.equal(sink.calls.emit, 2);
  assert.equal(spy.mock.callCount(), 0);
  assert.equal(now.mock.callCount(), 0);
});

test("named redelivery contains global runtime and restores it", async () => {
  const sink = sinkProbe();
  const validate = mock.fn((): AuditResult<void> => { throw new Error(sentinel); });
  const previous = setSchemaRuntime({ validate });
  try {
    assertFailure(await invokeResult(() => sdkFor(sink).authenticationFailed({ redelivery: { event: fixture } } as NamedInput)), schemaError);
    assert.equal(validate.mock.callCount(), 1);
    assert.equal(sink.calls.emit, 0);
  } finally { setSchemaRuntime(previous); }
});

test("lifecycle and operation authority refuse before context provider", async () => {
  const sink = sinkProbe();
  const get = mock.fn((): undefined => { throw new Error(sentinel); });
  const sdk = sdkFor(sink, { contextProvider: { run: (_context, fn) => fn(), get } });
  assertFailure(await sdk.authenticationFailed({ ...namedInput(), operation: {} } as NamedInput), {
    code: "SDK_INVALID_OPERATION_TRANSITION", category: "lifecycle", path: "/operation",
  });
  const shutdown = sdk.shutdown();
  assertFailure(await sdk.authenticationFailed(namedInput()), { code: "SDK_SHUTTING_DOWN", category: "lifecycle" });
  await shutdown;
  assertFailure(await sdk.authenticationFailed(namedInput()), { code: "SDK_SHUT_DOWN", category: "lifecycle" });
  assertFailure(sdk.beginOperation(), { code: "SDK_SHUT_DOWN", category: "lifecycle" });
  assert.equal(get.mock.callCount(), 0);
});

test("invalid construction still throws SecurityAuditSdkError", () => {
  assert.throws(() => sdkFor(sinkProbe(), { clock: {} as never }), SecurityAuditSdkError);
});

test("timer arming failure does not wait for an in-flight emission", async () => {
  const sink = sinkProbe();
  let release = () => {};
  const emit = mock.fn(() => new Promise<{ status: "accepted" }>((resolve) => { release = () => resolve({ status: "accepted" }); }));
  const setTimeout = mock.fn((): AuditTimerHandle => { throw new Error(sentinel); });
  const sdk = sdkFor(sink, { sink: { ...sink.sink, emit }, timers: { setTimeout, clearTimeout() {} } });
  const emission = sdk.emit(fixture);
  assertFailure(await invokeResult(() => sdk.shutdown()), timerError);
  assert.equal(sdk.state, "shut_down");
  assert.equal(setTimeout.mock.callCount(), 1);
  assert.equal(sink.calls.flush, 0);
  assert.equal(sink.calls.shutdown, 0);
  release();
  await emission;
});

test("schema result inspection contains throwing getters", async () => {
  const sink = sinkProbe();
  const getter = mock.fn(() => { throw new Error(sentinel); });
  const returned = Object.defineProperty({}, "ok", { get: getter });
  const sdk = sdkFor(sink, { schemaRuntime: { validate: () => returned as AuditResult<void> } });
  assertFailure(await invokeResult(() => sdk.emit(fixture)), schemaError);
  assert.equal(getter.mock.callCount(), 1);
  assert.equal(sink.calls.emit, 0);
});

test("real timer cancellation is still accepted", async () => {
  const sdk = sdkFor(sinkProbe(), { timers: defaultTimerProvider });
  assert.equal((await sdk.shutdown()).ok, true);
});
