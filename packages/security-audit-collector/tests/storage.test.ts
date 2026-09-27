import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  CollectorIngress,
  DIAGNOSTIC_CODES,
  RETENTION_MILLISECONDS,
  SUPPORTED_CONTRACT_VERSIONS,
  SqliteStorage,
  StorageConfigurationError,
  SyntheticFixtureAuthenticator,
  type IngressResult,
  type PutResult,
  type StorageOwners,
  type StoragePort,
  type StorageScope,
  type StoredRecord,
} from "../dist/index.js";

// Storage arms for #115. Each ratified collector-storage-semantics scenario
// (#114) is exercised through the public submit() surface or the port itself,
// against the selected SQLite backend unless the arm needs a failing port.

const TOKEN = "fixture-token-a";
const SENDER = `synthetic:${TOKEN}`;
const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const ADMITTED_AT = Date.UTC(2026, 8, 10, 12, 0, 0);
const OWNERS: StorageOwners = Object.freeze({
  dataOwner: "synthetic-data-owner",
  retentionAuthority: "synthetic-retention-authority",
  keyOwner: "synthetic-key-owner",
});
const TENANT_ALPHA: StorageScope = { kind: "tenant", tenantId: "tenant_alpha" };

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-collector-storage-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: {
      id: EVENT_ID,
      name: "bloodtrail.audit.authentication.succeeded",
      category: "authentication",
      action: "authenticate",
      lifecycle_phase: "completed",
      outcome: "success",
      timestamp: "2026-09-06T12:00:00.000Z",
      observed_at: "2026-09-06T12:00:00.000Z",
      delivery_class: "security_significant",
    },
    schema: { name: "security-audit-event", version: "2.1.0" },
    producer: { name: "producer-fixture", version: "1.0.0" },
    environment: { name: "synthetic" },
    service: { name: "svc" },
    tenant: { scope: "tenant", effective_tenant_id: "tenant_alpha" },
    actor: { type: "service_account" },
    initiator: { type: "service", id: "init-1" },
    resource: { operation_type: "read" },
    correlation: { correlation_id: "c1", operation_id: "op1" },
    data: { classification: "internal", retention_class: "security_standard", field_policy_version: "2.1.0" },
    ...overrides,
  };
}

function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(event(overrides));
}

function submit(ingress: CollectorIngress, text: string): IngressResult {
  return ingress.submit({ credentials: { credential: TOKEN }, body: text });
}

function persistingIngress(port: StoragePort, now: () => number = () => ADMITTED_AT): CollectorIngress {
  return new CollectorIngress({
    authenticator: new SyntheticFixtureAuthenticator([TOKEN]),
    now,
    storage: { port, owners: OWNERS },
  });
}

function memoryStorage(): SqliteStorage {
  return new SqliteStorage({ location: ":memory:" });
}

// A port that answers with a fixed result and records what reached it.
function scriptedPort(result: PutResult | (() => PutResult)): StoragePort & { readonly puts: StoredRecord[] } {
  const puts: StoredRecord[] = [];
  return {
    puts,
    put(_scope, record) {
      puts.push(record);
      return typeof result === "function" ? result() : result;
    },
    get: () => ({ kind: "absent" }),
    deleteExpired: () => ({ kind: "deleted", count: 0 }),
  };
}

function expectRejection(result: IngressResult, code: string): void {
  assert.equal(result.kind, "rejected", `expected a rejection, got ${JSON.stringify(result)}`);
  if (result.kind !== "rejected") return;
  assert.equal(result.diagnostic.code, code);
  assert.equal(result.diagnostic.category, "storage");
}

test("S1 — a canonical valid record is persisted and retrieved byte-identically", () => {
  const storage = memoryStorage();
  const ingress = persistingIngress(storage);
  const text = body();
  assert.deepEqual(submit(ingress, text), { kind: "persisted", eventId: EVENT_ID, senderIdentity: SENDER });
  const stored = storage.get(TENANT_ALPHA, EVENT_ID);
  assert.equal(stored.kind, "found");
  if (stored.kind !== "found") return;
  assert.equal(stored.record.body, text);
  assert.equal(stored.record.schemaVersion, "2.1.0");
  assert.equal(stored.record.retentionClass, "security_standard");
  assert.equal(ingress.metrics().persisted, 1);
  assert.equal(ingress.metrics().accepted, 0, "a persisted occurrence is not also reported as bare admission");
  storage.close();
});

test("S2 — without storage an admitted occurrence makes no durability claim", () => {
  const ingress = new CollectorIngress({ authenticator: new SyntheticFixtureAuthenticator([TOKEN]) });
  assert.equal(submit(ingress, body()).kind, "admitted");
  assert.equal(ingress.metrics().persisted, 0);
});

test("S3 — an outright write failure rejects without a persisted acknowledgment", () => {
  const ingress = persistingIngress(scriptedPort({ kind: "failed", reason: "backend" }));
  expectRejection(submit(ingress, body()), DIAGNOSTIC_CODES.STORAGE_WRITE_FAILED);
  assert.equal(ingress.metrics().persisted, 0);
  assert.equal(ingress.metrics().rejectedStorageWrite, 1);
});

test("S4 — an indeterminate write is rejected distinctly and treated as not persisted", () => {
  const indeterminate = persistingIngress(scriptedPort({ kind: "indeterminate" }));
  expectRejection(submit(indeterminate, body()), DIAGNOSTIC_CODES.STORAGE_WRITE_INDETERMINATE);
  const throwing = persistingIngress(
    scriptedPort(() => {
      throw new Error("connection severed after the request was issued");
    }),
  );
  expectRejection(submit(throwing, body()), DIAGNOSTIC_CODES.STORAGE_WRITE_INDETERMINATE);
  const unrecognised = persistingIngress(scriptedPort({ kind: "maybe" } as unknown as PutResult));
  expectRejection(submit(unrecognised, body()), DIAGNOSTIC_CODES.STORAGE_WRITE_INDETERMINATE);
  assert.notEqual(DIAGNOSTIC_CODES.STORAGE_WRITE_INDETERMINATE, DIAGNOSTIC_CODES.STORAGE_WRITE_FAILED);
});

test("S5 — a retry after an indeterminate write leaves one record and is then persisted", () => {
  const storage = memoryStorage();
  let reportIndeterminate = true;
  // The write lands, but the port cannot confirm it the first time.
  const lossy: StoragePort = {
    put(scope, record) {
      const outcome = storage.put(scope, record);
      if (!reportIndeterminate) return outcome;
      reportIndeterminate = false;
      return { kind: "indeterminate" };
    },
    get: (scope, eventId) => storage.get(scope, eventId),
    deleteExpired: (scope, now) => storage.deleteExpired(scope, now),
  };
  const ingress = persistingIngress(lossy);
  expectRejection(submit(ingress, body()), DIAGNOSTIC_CODES.STORAGE_WRITE_INDETERMINATE);
  // A redelivery sends the identical occurrence.
  const retry = submit(ingress, body());
  // The first write landed, so the retry finds it: the port's duplicate, acknowledged persisted.
  assert.deepEqual(retry, { kind: "duplicate", eventId: EVENT_ID, senderIdentity: SENDER, acknowledgment: "persisted" });
  assert.equal(storage.put(TENANT_ALPHA, recordFor(body())).kind, "duplicate", "exactly one record exists");
  storage.close();
});

test("S6 — a byte-identical retry is the port's duplicate outcome, acknowledged as persisted", () => {
  const storage = memoryStorage();
  const ingress = persistingIngress(storage);
  assert.equal(submit(ingress, body()).kind, "persisted");
  const expected = { kind: "duplicate", eventId: EVENT_ID, senderIdentity: SENDER, acknowledgment: "persisted" };
  assert.deepEqual(submit(ingress, body()), expected);
  assert.equal(ingress.metrics().persisted, 1);
  assert.equal(ingress.metrics().deduplicated, 1);
  storage.close();
});

test("S7 — repeated writes of one identity are idempotent at the port", () => {
  const storage = memoryStorage();
  const record = recordFor(body());
  assert.equal(storage.put(TENANT_ALPHA, record).kind, "written");
  assert.equal(storage.put(TENANT_ALPHA, record).kind, "duplicate");
  // A record that differs only in its retry attempt has another occurrence key.
  const differing = recordFor(body({ correlation: { correlation_id: "c1", operation_id: "op1", retry_attempt: 2 } }));
  assert.deepEqual(storage.put(TENANT_ALPHA, differing), { kind: "failed", reason: "conflict" });
  const found = storage.get(TENANT_ALPHA, EVENT_ID);
  assert.equal(found.kind === "found" && found.record.body, record.body, "the first record is left untouched");
  storage.close();
});

test("S8 — different content under a stored identity, a different retry attempt included, is a conflict and changes nothing", () => {
  const storage = memoryStorage();
  const first = persistingIngress(storage);
  assert.equal(submit(first, body()).kind, "persisted");
  // A second collector instance has no ledger entry, so the port decides.
  const second = persistingIngress(storage);
  const conflicting = body({ service: { name: "different-service" } });
  expectRejection(submit(second, conflicting), DIAGNOSTIC_CODES.STORAGE_CONFLICT);
  const differentRetryAttempt = body({ correlation: { correlation_id: "c1", operation_id: "op1", retry_attempt: 1 } });
  expectRejection(submit(second, differentRetryAttempt), DIAGNOSTIC_CODES.STORAGE_CONFLICT);
  const found = storage.get(TENANT_ALPHA, EVENT_ID);
  assert.equal(found.kind === "found" && found.record.body, body());
  storage.close();
});

test("S9 — retention derives from the record's class, identically in two deployments", () => {
  const first = memoryStorage();
  const second = memoryStorage();
  for (const storage of [first, second]) {
    assert.equal(submit(persistingIngress(storage), body()).kind, "persisted");
  }
  const expected = ADMITTED_AT + RETENTION_MILLISECONDS.security_standard;
  for (const storage of [first, second]) {
    const found = storage.get(TENANT_ALPHA, EVENT_ID);
    assert.equal(found.kind === "found" && found.record.expiresAt, expected);
    storage.close();
  }
});

test("S10 — a declined retention class is an explicit rejection, never a shorter retention", () => {
  const storage = memoryStorage();
  const ingress = persistingIngress(storage);
  const declined = body({ data: { classification: "internal", retention_class: "policy_governed", field_policy_version: "2.1.0" } });
  const result = submit(ingress, declined);
  expectRejection(result, DIAGNOSTIC_CODES.RETENTION_CLASS_DECLINED);
  assert.equal(result.kind === "rejected" && result.diagnostic.path, "/data/retention_class");
  assert.equal(storage.get(TENANT_ALPHA, EVENT_ID).kind, "absent");
  assert.equal(ingress.metrics().rejectedRetentionDeclined, 1);
  storage.close();
});

test("S11 — expiry deletes whole records, and nothing before expiry", () => {
  const storage = memoryStorage();
  const record = recordFor(body());
  assert.equal(storage.put(TENANT_ALPHA, record).kind, "written");
  assert.deepEqual(storage.deleteExpired(TENANT_ALPHA, record.expiresAt - 1), { kind: "deleted", count: 0 });
  const retained = storage.get(TENANT_ALPHA, EVENT_ID);
  assert.equal(retained.kind === "found" && retained.record.body, record.body, "no field is mutated in place");
  assert.deepEqual(storage.deleteExpired(TENANT_ALPHA, record.expiresAt), { kind: "deleted", count: 1 });
  assert.equal(storage.get(TENANT_ALPHA, EVENT_ID).kind, "absent");
  storage.close();
});

test("S12 — a deleted record leaves no readable copy in the database file", () => {
  const location = resolve(suiteRoot, "secure-delete.db");
  const marker = "RESIDUE_MARKER_5c1e9d";
  const storage = new SqliteStorage({ location });
  const record = recordFor(body({ service: { name: marker } }));
  assert.equal(storage.put(TENANT_ALPHA, record).kind, "written");
  assert.equal(storage.deleteExpired(TENANT_ALPHA, record.expiresAt).kind, "deleted");
  storage.close();
  assert.equal(readFileSync(location).includes(marker), false, "deleted content survives in the file");
  // Null control: the same marker is present while the record is retained.
  const controlLocation = resolve(suiteRoot, "secure-delete-control.db");
  const control = new SqliteStorage({ location: controlLocation });
  assert.equal(control.put(TENANT_ALPHA, record).kind, "written");
  control.close();
  assert.equal(readFileSync(controlLocation).includes(marker), true, "the residue probe cannot see stored content");
});

test("S13 — tenant scope is enforced on read, and a read without a scope returns nothing", () => {
  const storage = memoryStorage();
  assert.equal(submit(persistingIngress(storage), body()).kind, "persisted");
  assert.equal(storage.get({ kind: "tenant", tenantId: "tenant_beta" }, EVENT_ID).kind, "absent");
  assert.equal(storage.get({ kind: "cross_tenant", tenantId: "tenant_alpha" }, EVENT_ID).kind, "absent");
  assert.equal(storage.get(undefined as unknown as StorageScope, EVENT_ID).kind, "absent");
  assert.equal(storage.get({ kind: "tenant" } as unknown as StorageScope, EVENT_ID).kind, "absent");
  assert.deepEqual(storage.deleteExpired({ kind: "tenant", tenantId: "tenant_beta" }, Number.MAX_SAFE_INTEGER), {
    kind: "deleted",
    count: 0,
  });
  assert.equal(storage.get(TENANT_ALPHA, EVENT_ID).kind, "found", "another tenant's expiry cannot reach this record");
  storage.close();
});

test("S14 — the port offers exactly three operations, none spanning scopes or carrying keys", () => {
  const operations = Object.getOwnPropertyNames(SqliteStorage.prototype).filter((name) => name !== "constructor");
  assert.deepEqual(operations.sort(), ["close", "deleteExpired", "get", "put"]);
  const storage = memoryStorage();
  assert.equal(storage.put.length, 2);
  assert.equal(storage.get.length, 2);
  assert.equal(storage.deleteExpired.length, 2);
  storage.close();
});

test("S15 — an unnamed, blank, or missing owner role blocks storage", () => {
  const port = scriptedPort({ kind: "written" });
  const authenticator = new SyntheticFixtureAuthenticator([TOKEN]);
  const invalidOwners: unknown[] = [
    undefined,
    { dataOwner: "d", retentionAuthority: "r" },
    { ...OWNERS, keyOwner: "   " },
    { ...OWNERS, retentionAuthority: 7 },
    { ...OWNERS, dataOwner: "x".repeat(129) },
  ];
  for (const owners of invalidOwners) {
    assert.throws(
      () => new CollectorIngress({ authenticator, storage: { port, owners: owners as StorageOwners } }),
      StorageConfigurationError,
    );
  }
  assert.doesNotThrow(() => new CollectorIngress({ authenticator, storage: { port, owners: OWNERS } }));
});

test("S16 — a stored record outside the reader's supported set is distinguishable from absence", () => {
  const location = resolve(suiteRoot, "migration.db");
  const writer = new SqliteStorage({ location });
  assert.equal(writer.put(TENANT_ALPHA, recordFor(body())).kind, "written");
  writer.close();
  const reader = new SqliteStorage({ location, supportedVersions: ["9.9.9"] });
  assert.deepEqual(reader.get(TENANT_ALPHA, EVENT_ID), { kind: "unsupported_version", schemaVersion: "2.1.0" });
  assert.equal(reader.get(TENANT_ALPHA, "00000000-0000-4000-8000-000000000999").kind, "absent");
  reader.close();
});

test("S17 — a locked database is a definite backend failure, never a persisted acknowledgment", () => {
  const location = resolve(suiteRoot, "outage.db");
  const storage = new SqliteStorage({ location });
  const holder = new DatabaseSync(location);
  holder.exec("BEGIN EXCLUSIVE");
  try {
    assert.deepEqual(storage.put(TENANT_ALPHA, recordFor(body())), { kind: "failed", reason: "backend" });
    const ingress = persistingIngress(storage);
    expectRejection(submit(ingress, body()), DIAGNOSTIC_CODES.STORAGE_WRITE_FAILED);
  } finally {
    holder.exec("ROLLBACK");
    holder.close();
  }
  // Recovery: once the lock is gone the same submission persists.
  assert.equal(submit(persistingIngress(storage), body()).kind, "persisted");
  storage.close();
  const closed = new SqliteStorage({ location: ":memory:" });
  closed.close();
  assert.deepEqual(closed.put(TENANT_ALPHA, recordFor(body())), { kind: "failed", reason: "backend" });
  assert.deepEqual(closed.get(TENANT_ALPHA, EVENT_ID), { kind: "failed" });
  assert.deepEqual(closed.deleteExpired(TENANT_ALPHA, ADMITTED_AT), { kind: "failed" });
});

test("S18 — an unresolvable tenant scope is declined before any write", () => {
  const port = scriptedPort({ kind: "written" });
  const ingress = persistingIngress(port);
  expectRejection(submit(ingress, body({ tenant: { scope: "tenant" } })), DIAGNOSTIC_CODES.STORAGE_SCOPE_UNRESOLVED);
  assert.equal(port.puts.length, 0);
  const platform = persistingIngress(memoryStorage());
  assert.equal(submit(platform, body({ tenant: { scope: "platform" } })).kind, "persisted");
});

test("S19 — storage failures carry no secret, payload, or tenant material", () => {
  const marker = "SECRET_MARKER_91b0";
  const failures: PutResult[] = [
    { kind: "failed", reason: "backend" },
    { kind: "failed", reason: "conflict" },
    { kind: "indeterminate" },
  ];
  for (const failure of failures) {
    const ingress = persistingIngress(scriptedPort(failure));
    const result = submit(ingress, body({ service: { name: marker } }));
    assert.equal(result.kind, "rejected");
    const serialized = `${JSON.stringify(result)}${JSON.stringify(ingress.metrics())}`;
    for (const secret of [marker, TOKEN, "tenant_alpha"]) {
      assert.equal(serialized.includes(secret), false, `storage failure leaked ${secret}: ${serialized}`);
    }
  }
});

test("S20 — a failed write releases its reservation, so the retry is written rather than deduplicated", () => {
  let failNext = true;
  const storage = memoryStorage();
  const flaky: StoragePort = {
    put(scope, record) {
      if (!failNext) return storage.put(scope, record);
      failNext = false;
      return { kind: "failed", reason: "backend" };
    },
    get: (scope, eventId) => storage.get(scope, eventId),
    deleteExpired: (scope, now) => storage.deleteExpired(scope, now),
  };
  const ingress = persistingIngress(flaky);
  expectRejection(submit(ingress, body()), DIAGNOSTIC_CODES.STORAGE_WRITE_FAILED);
  assert.equal(submit(ingress, body()).kind, "persisted");
  assert.equal(ingress.metrics().deduplicated, 0);
  storage.close();
});

function recordFor(text: string): StoredRecord {
  return {
    eventId: EVENT_ID,
    schemaVersion: "2.1.0",
    retentionClass: "security_standard",
    admittedAt: ADMITTED_AT,
    expiresAt: ADMITTED_AT + RETENTION_MILLISECONDS.security_standard,
    occurrenceKey: canonical(JSON.parse(text)),
    body: text,
  };
}

// Mirrors the ingress's canonical deduplication key: key-sorted, code-point order.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

test("S21 — the compatibility manifest states the shipped version set and stage order", () => {
  const manifestPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "compatibility.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    readonly collector: { readonly supportedContractVersions: string[]; readonly ingressOrder: string[] };
  };
  // Hand-maintained and previously stale (it read ["1.0.0"] after the 1.1.0 move).
  assert.deepEqual(manifest.collector.supportedContractVersions, [...SUPPORTED_CONTRACT_VERSIONS]);
  assert.deepEqual(manifest.collector.ingressOrder, [
    "authenticate",
    "size",
    "parse",
    "schema",
    "version",
    "deduplicate",
    "persist",
    "accept",
  ]);
});

test("S22 — storage-backed deduplication is not bounded by the in-memory ledger's capacity (#478)", () => {
  const storage = memoryStorage();
  const ingress = persistingIngress(storage);
  const distinct = 200;
  for (let index = 0; index < distinct; index += 1) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const result = submit(ingress, body({ event: { ...(event().event as Record<string, unknown>), id } }));
    assert.equal(result.kind, "persisted", `identity ${index} was not persisted: ${JSON.stringify(result)}`);
  }
  assert.equal(ingress.metrics().persisted, distinct);
  assert.equal(ingress.metrics().rejectedDeduplicationCapacity, 0);
  // Null control: without storage the ledger's 32-identity capacity still rejects.
  const admissionOnly = new CollectorIngress({ authenticator: new SyntheticFixtureAuthenticator([TOKEN]), now: () => ADMITTED_AT });
  const kinds = new Set<string>();
  for (let index = 0; index < 33; index += 1) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    kinds.add(submit(admissionOnly, body({ event: { ...(event().event as Record<string, unknown>), id } })).kind);
  }
  assert.deepEqual([...kinds].sort(), ["admitted", "rejected"]);
  assert.equal(admissionOnly.metrics().rejectedDeduplicationCapacity, 1);
  storage.close();
});

test("S23 — with storage the identity is the record's scope and event id, whichever sender submits it", () => {
  const storage = memoryStorage();
  const ingress = new CollectorIngress({
    authenticator: new SyntheticFixtureAuthenticator([TOKEN, "fixture-token-b"]),
    now: () => ADMITTED_AT,
    storage: { port: storage, owners: OWNERS },
  });
  assert.equal(submit(ingress, body()).kind, "persisted");
  const sameOccurrence = ingress.submit({ credentials: { credential: "fixture-token-b" }, body: body() });
  assert.deepEqual(sameOccurrence, {
    kind: "duplicate",
    eventId: EVENT_ID,
    senderIdentity: "synthetic:fixture-token-b",
    acknowledgment: "persisted",
  });
  const differentContent = ingress.submit({
    credentials: { credential: "fixture-token-b" },
    body: body({ service: { name: "other-service" } }),
  });
  expectRejection(differentContent, DIAGNOSTIC_CODES.STORAGE_CONFLICT);
  storage.close();
});
