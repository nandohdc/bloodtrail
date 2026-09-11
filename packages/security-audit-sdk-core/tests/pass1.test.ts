import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  CONTRACT_VERSION,
  EVENT_CATALOG,
  EXTENSION_NAMESPACES,
  FIELD_POLICY,
  REGISTRIES,
  createSecurityAuditSdk,
  validateSecurityAuditEvent,
  type AuditEventSink,
  type SecurityAuditEvent,
} from "../dist/index.js";
import { createInMemoryAuditSink } from "../dist/testing.js";


const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");

async function positives(): Promise<SecurityAuditEvent[]> {
  return JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
}

test("generated catalog binds exactly 24 contract 2.0.0 events", () => {
  assert.equal(CONTRACT_VERSION, "2.0.0");
  assert.equal(EVENT_CATALOG.length, 24);
  assert.equal(new Set(EVENT_CATALOG.map((entry) => entry.name)).size, 24);
  assert.equal(FIELD_POLICY.length, 135);
  assert.ok(EXTENSION_NAMESPACES.length > 0);
  assert.ok(Object.keys(REGISTRIES).length > 10);
});

test("all approved positive fixtures pass base schema and catalog validation", async () => {
  const events = await positives();
  assert.equal(events.length, 24);
  for (const event of events) assert.deepEqual(validateSecurityAuditEvent(event), { ok: true, value: event });
});

test("schema diagnostics are bounded and do not echo rejected values", async () => {
  const [event] = await positives();
  assert.ok(event);
  const marker = "SECRET_MARKER_DO_NOT_ECHO";
  const candidate = structuredClone(event) as unknown as Record<string, unknown>;
  candidate.schema = { name: marker, version: marker };
  const result = validateSecurityAuditEvent(candidate);
  assert.equal(result.ok, false);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(marker), false);
  assert.ok(serialized.length < 512);
});

test("schema-valid catalog inconsistency fails semantic validation safely", async () => {
  const [event] = await positives();
  assert.ok(event);
  const candidate = {
    ...structuredClone(event),
    event: { ...structuredClone(event.event), action: "authenticate" },
  } as SecurityAuditEvent;
  const result = validateSecurityAuditEvent(candidate);
  assert.deepEqual(result, {
    ok: false,
    error: { code: "UNKNOWN_CATALOG_VALUE", category: "validation", path: "/event/action" },
  });
  assert.ok(JSON.stringify(result).length < 256);
});

test("configuration snapshot is immutable and lifecycle is bounded", async () => {
  const captured: SecurityAuditEvent[] = [];
  let flushes = 0;
  let shutdowns = 0;
  const sink: AuditEventSink = {
    async emit(event) { captured.push(event); return { status: "accepted" }; },
    async flush() { flushes += 1; },
    async shutdown() { shutdowns += 1; },
  };
  const producer = { name: "test-producer", version: "1.0.0" };
  const sdk = createSecurityAuditSdk({
    contractVersion: "2.0.0",
    producer,
    service: { name: "test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink,
    shutdownTimeoutMs: 100,
  });
  producer.name = "mutated";
  const [event] = await positives();
  assert.ok(event);
  const emitted = await sdk.emit(event);
  assert.equal(emitted.ok, true);
  assert.equal(captured.length, 1);
  assert.equal(Object.isFrozen(captured[0]), true);
  const first = await sdk.shutdown();
  const second = await sdk.shutdown();
  assert.equal(first.ok, true);
  assert.deepEqual(second, { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle" } });
  assert.equal(flushes, 1);
  assert.equal(shutdowns, 1);
  assert.deepEqual(await sdk.flush(), { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle" } });
  assert.deepEqual(await sdk.emit(event), { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle" } });
});

test("invalid initialization returns a bounded safe structured error without input echo", () => {
  const marker = "SECRET_CONFIGURATION_MARKER";
  const sink: AuditEventSink = { async emit() { return { status: "accepted" }; } };
  assert.throws(
    () => createSecurityAuditSdk({
      contractVersion: "2.0.0",
      producer: { name: marker, version: "1.0.0" },
      service: { name: "service" },
      environment: { name: "test" },
      sink: {} as AuditEventSink,
    }),
    (error: unknown) => {
      const serialized = JSON.stringify(error);
      assert.equal(serialized.includes(marker), false);
      assert.ok(serialized.length < 256);
      assert.match(serialized, /SDK_INVALID_CONFIGURATION/);
      return true;
    },
  );
});

test("in-memory test sink validates capacity bounds strictly", () => {
  assert.throws(() => createInMemoryAuditSink({ capacity: 0 }), /SDK_INVALID_CONFIGURATION/);
  assert.throws(() => createInMemoryAuditSink({ capacity: -1 }), /SDK_INVALID_CONFIGURATION/);
  assert.throws(() => createInMemoryAuditSink({ capacity: 10_001 }), /SDK_INVALID_CONFIGURATION/);
  assert.throws(() => createInMemoryAuditSink({ capacity: 1.5 }), /SDK_INVALID_CONFIGURATION/);
  assert.throws(() => createInMemoryAuditSink({ capacity: Number.NaN }), /SDK_INVALID_CONFIGURATION/);

  const sink = createInMemoryAuditSink({ capacity: 10 });
  assert.equal(sink.capacity, 10);
  assert.equal(sink.events.length, 0);
});
