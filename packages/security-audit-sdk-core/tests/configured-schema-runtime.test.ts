import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mock, test } from "node:test";
import {
  StackContextProvider, anonymousActor, authenticationEvidence, authoritativeTenant,
  cjsSchemaRuntime, createSecurityAuditSdk, getSchemaRuntime, observedSource,
  setSchemaRuntime, validateSecurityAuditEvent,
  type AuditResult, type AuditSchemaRuntime, type SecurityAuditEvent,
  type SecurityAuditSdk,
} from "../dist/index.js";
import { createDeterministicClock, createDeterministicProviders } from "./conformance-harness.js";

type NamedInput = Parameters<SecurityAuditSdk["authenticationFailed"]>[0];
interface RuntimeHarness {
  readonly sdk: SecurityAuditSdk;
  readonly configured: ReturnType<typeof countingRuntime>;
  readonly global: ReturnType<typeof countingRuntime>;
  readonly delivered: Readonly<SecurityAuditEvent>[];
}
interface EntryCase {
  readonly name: string;
  readonly globalCalls: number;
  readonly configuredCalls: number;
  readonly sinkCalls: number;
  readonly invoke: (harness: RuntimeHarness) => unknown;
}

const fixtures: readonly SecurityAuditEvent[] = JSON.parse(await readFile(
  resolve(process.cwd(), "../../contracts/security-audit/examples/positive/all-events.json"), "utf8",
));
const fixture = fixtures.find((event) => event.event.name === "bloodtrail.audit.authentication.failed")!;
assert.ok(fixture);
const accepted = { ok: true, value: { status: "accepted" } };
const refused: AuditResult<void> = {
  ok: false, error: { code: "SDK_SCHEMA_VALIDATION_FAILED", category: "validation", path: "/event" },
};
const entryCases: readonly EntryCase[] = [
  { name: "named execution", globalCalls: 0, configuredCalls: 1, sinkCalls: 1,
    invoke: ({ sdk }) => sdk.authenticationFailed(namedInput()) },
  { name: "named redelivery", globalCalls: 0, configuredCalls: 1, sinkCalls: 1,
    invoke: ({ sdk }) => sdk.authenticationFailed({ redelivery: { event: fixture } } as NamedInput) },
  { name: "emit", globalCalls: 0, configuredCalls: 1, sinkCalls: 1,
    invoke: ({ sdk }) => sdk.emit(fixture) },
  { name: "redeliver", globalCalls: 0, configuredCalls: 1, sinkCalls: 1,
    invoke: ({ sdk }) => sdk.redeliver(fixture) },
  { name: "free default", globalCalls: 1, configuredCalls: 0, sinkCalls: 0,
    invoke: () => validateSecurityAuditEvent(fixture) },
  { name: "free explicit", globalCalls: 0, configuredCalls: 1, sinkCalls: 0,
    invoke: ({ configured }) => validateSecurityAuditEvent(fixture, configured) },
];

function namedInput(): NamedInput {
  assert.ok(fixture.authentication);
  assert.ok(fixture.source);
  return {
    actor: anonymousActor("request_boundary"),
    tenant: authoritativeTenant(fixture.tenant as Parameters<typeof authoritativeTenant>[0]),
    authentication: authenticationEvidence(fixture.authentication),
    source: observedSource(fixture.source), request: fixture.request, correlation: {},
    event: { outcome: "failure", lifecycle_phase: "completed", outcome_reason: fixture.event.outcome_reason },
  } as NamedInput;
}

function countingRuntime(runtime: AuditSchemaRuntime = cjsSchemaRuntime) {
  return { validate: mock.fn((value: unknown) => runtime.validate(value)) };
}

function createHarness(schemaRuntime?: AuditSchemaRuntime) {
  const delivered: Readonly<SecurityAuditEvent>[] = [];
  const sdk = createSecurityAuditSdk({
    contractVersion: "2.1.0", producer: fixture.producer, service: fixture.service,
    environment: fixture.environment,
    sink: { async emit(event) { delivered.push(event); return { status: "accepted" }; } },
    identifiers: createDeterministicProviders(), clock: createDeterministicClock(),
    contextProvider: new StackContextProvider(),
    ...(schemaRuntime === undefined ? {} : { schemaRuntime }),
  });
  return { sdk, delivered };
}

test("runtime selection table has six independent entry points", () => {
  assert.equal(entryCases.length, 6);
  assert.equal(new Set(entryCases.map((row) => row.name)).size, 6);
});
for (const row of entryCases) {
  test(`${row.name}: global/configured ${row.globalCalls}/${row.configuredCalls}`, async () => {
    const configured = countingRuntime();
    const global = countingRuntime();
    const harness: RuntimeHarness = { ...createHarness(configured), configured, global };
    const previous = setSchemaRuntime(global);
    try {
      const result = await row.invoke(harness) as AuditResult<unknown>;
      assert.equal(result.ok, true);
      assert.equal(global.validate.mock.callCount(), row.globalCalls);
      assert.equal(configured.validate.mock.callCount(), row.configuredCalls);
      assert.equal(harness.delivered.length, row.sinkCalls);
      assert.equal(getSchemaRuntime(), global);
    } finally { setSchemaRuntime(previous); }
    assert.equal(getSchemaRuntime(), previous);
  });
}

test("refusing global affects only free default, not named and emit on the same instance", async () => {
  const configured = countingRuntime();
  const global = countingRuntime({ validate: () => refused });
  const { sdk, delivered } = createHarness(configured);
  const previous = setSchemaRuntime(global);
  try {
    assert.deepEqual(await sdk.authenticationFailed(namedInput()), accepted);
    assert.deepEqual(await sdk.emit(fixture), accepted);
    assert.equal(delivered.length, 2);
    assert.equal(global.validate.mock.callCount(), 0);
    assert.equal(configured.validate.mock.callCount(), 2);
    assert.deepEqual(validateSecurityAuditEvent(fixture), refused);
    assert.equal(global.validate.mock.callCount(), 1);
    assert.equal(validateSecurityAuditEvent(fixture, configured).ok, true);
    assert.equal(global.validate.mock.callCount(), 1);
    assert.equal(configured.validate.mock.callCount(), 3);
  } finally { setSchemaRuntime(previous); }
});

test("omitted runtime configuration defaults to cjs independently of the global override", async () => {
  const global = countingRuntime({ validate: () => refused });
  const previous = setSchemaRuntime(global);
  try {
    const { sdk, delivered } = createHarness();
    assert.deepEqual(await sdk.authenticationFailed(namedInput()), accepted);
    assert.deepEqual(await sdk.emit(fixture), accepted);
    assert.deepEqual(await sdk.authenticationFailed({ redelivery: { event: fixture } } as NamedInput), accepted);
    assert.deepEqual(await sdk.redeliver(fixture), accepted);
    assert.equal(delivered.length, 4);
    assert.equal(global.validate.mock.callCount(), 0);
    assert.deepEqual(validateSecurityAuditEvent(fixture), refused);
    assert.equal(validateSecurityAuditEvent(fixture, cjsSchemaRuntime).ok, true);
    assert.equal(global.validate.mock.callCount(), 1);
  } finally { setSchemaRuntime(previous); }
});
