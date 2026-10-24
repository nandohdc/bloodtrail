// The ingress wraps an injected collector; here a fixture collector stands in for the kit's, so HTTP
// framing, fault actions, recording and read-back are tested without importing any kit code.
import assert from "node:assert/strict";
import { request } from "node:http";
import { test } from "node:test";
import { faultInjector } from "../lib/faults.mjs";
import { readBack, startIngress, statusFor, storageScopeOf } from "../lib/ingress.mjs";
import { sha256 } from "../lib/io.mjs";

const CODES = Object.freeze(Object.fromEntries([
  "AUTH_MISSING", "AUTH_MALFORMED", "AUTH_REJECTED", "SIZE_EXCEEDED", "PARSE_INVALID", "SCHEMA_INVALID", "VERSION_UNSUPPORTED",
  "DUPLICATE_CONFLICT", "DEDUPLICATION_CAPACITY", "RETENTION_CLASS_DECLINED", "STORAGE_SCOPE_UNRESOLVED", "STORAGE_CONFLICT",
  "STORAGE_WRITE_FAILED", "STORAGE_WRITE_INDETERMINATE",
].map((code) => [code, code.toLowerCase()])));

const rejected = (code) => ({ kind: "rejected", diagnostic: { code } });

test("collector results map to the pilot's statuses", () => {
  const rows = [
    [{ kind: "persisted" }, 202], [{ kind: "duplicate", acknowledgment: "persisted" }, 202], [{ kind: "duplicate", acknowledgment: "admitted" }, 503],
    [rejected(CODES.AUTH_MISSING), 401], [rejected(CODES.AUTH_REJECTED), 401], [rejected(CODES.SIZE_EXCEEDED), 413],
    [rejected(CODES.STORAGE_WRITE_FAILED), 503], [rejected(CODES.STORAGE_WRITE_INDETERMINATE), 503], [rejected(CODES.DEDUPLICATION_CAPACITY), 503],
    [rejected(CODES.DUPLICATE_CONFLICT), 409], [rejected(CODES.STORAGE_CONFLICT), 409], [rejected(CODES.SCHEMA_INVALID), 422],
  ];
  for (const [result, status] of rows) assert.equal(statusFor({ result, codes: CODES }), status, JSON.stringify(result));
  assert.throws(() => statusFor({ result: { kind: "admitted" }, codes: CODES }), /storage-less admission has no frozen status mapping/);
});

test("storage scopes mirror the collector's derivation", () => {
  assert.deepEqual(storageScopeOf({ scope: "tenant", effective_tenant_id: "t" }), { kind: "tenant", tenantId: "t" });
  assert.deepEqual(storageScopeOf({ scope: "cross_tenant", effective_tenant_id: "t" }), { kind: "cross_tenant", tenantId: "t" });
  assert.deepEqual(storageScopeOf({ scope: "platform" }), { kind: "platform" });
  assert.deepEqual(storageScopeOf({ scope: "tenantless" }), { kind: "tenantless" });
});

function fixtureCollector() {
  const stored = new Map();
  const submissions = [];
  const ingress = {
    submit({ credentials, body }) {
      submissions.push({ credentials, body });
      if (credentials?.credential !== "token") return rejected(CODES.AUTH_REJECTED);
      const id = JSON.parse(body).event.id;
      if (stored.has(id)) return { kind: "duplicate", acknowledgment: "persisted" };
      stored.set(id, body);
      return { kind: "persisted" };
    },
  };
  const storage = { get: (scope, id) => (stored.has(id) ? { kind: "found", record: { body: stored.get(id) } } : { kind: "not_found" }) };
  return { collector: { DIAGNOSTIC_CODES: CODES }, ingress, storage, submissions };
}

test("final quiescence waits for fault tasks after the connection closes", async () => {
  const fixture = fixtureCollector();
  let fire;
  let scheduled;
  const ready = new Promise((resolveReady) => { scheduled = resolveReady; });
  const timers = { setTimeout(callback) { fire = callback; scheduled(); } };
  const server = await startIngress({ collector: fixture.collector, ingress: fixture.ingress, timers,
    faults: faultInjector({ default: "acknowledge", rules: [{ occurrence: 1, attempt: 0, action: "delay", delay_ms: 300 }] }) });
  let outgoing;
  let finished = false;
  try {
    assert.equal(typeof server.quiesce, "function");
    outgoing = request({ host: "127.0.0.1", port: server.port, method: "POST", path: "/v1/security-audit", headers: { authorization: "Bearer token" } });
    outgoing.on("error", () => {});
    outgoing.end(event("quiescent"));
    await ready;
    outgoing.destroy();
    const closing = server.quiesce().then(() => { finished = true; });
    await new Promise((resolveTurn) => setImmediate(resolveTurn));
    assert.equal(finished, false, "a closed connection is not proof the fault task finished");
    fire();
    fire = undefined;
    await closing;
    assert.equal(finished, true);
  } finally {
    outgoing?.destroy();
    fire?.();
    if (!finished) await server.close();
  }
});

function post({ port, body, token = "token" }) {
  return new Promise((resolvePost) => {
    const outgoing = request({ host: "127.0.0.1", port, method: "POST", path: "/v1/security-audit", headers: { authorization: `Bearer ${token}` } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolvePost({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    outgoing.on("error", (error) => resolvePost({ status: null, error: error.code }));
    outgoing.end(body);
  });
}

const event = (id) => JSON.stringify({ event: { id }, tenant: { scope: "tenant", effective_tenant_id: "syn-tenant-00000001" } });

test("fault actions record each attempt and answer, withhold, or ingest as planned", async () => {
  const fixture = fixtureCollector();
  const plan = { default: "acknowledge", rules: [
    { occurrence: 1, attempt: 0, action: "status", status: 503 },
    { occurrence: 1, attempt: 1, action: "destroy_after_ingest" },
    { occurrence: 2, attempt: 0, action: "destroy_before_ingest" },
  ] };
  const server = await startIngress({ collector: fixture.collector, ingress: fixture.ingress, faults: faultInjector(plan) });
  try {
    const first = event("e-1");
    const second = event("e-2");
    assert.deepEqual(await post({ port: server.port, body: first }), { status: 503, body: JSON.stringify({ acknowledgments: [] }) });
    assert.equal((await post({ port: server.port, body: first })).status, null, "destroyed after ingest: no response");
    assert.equal((await post({ port: server.port, body: second })).status, null, "destroyed before ingest: no response");
    const acknowledged = await post({ port: server.port, body: first });
    assert.deepEqual(acknowledged, { status: 202, body: JSON.stringify({ acknowledgments: [{ event_id: "e-1", outcome: "accepted" }] }) });
    assert.equal((await post({ port: server.port, body: second, token: "wrong" })).status, 401);
    const records = server.state.records.map(({ event_id, occurrence, attempt, action, status, outcome }) => [event_id, occurrence, attempt, action, status, outcome.kind]);
    assert.deepEqual(records, [
      ["e-1", 1, 0, "status", 503, "not_ingested"], ["e-1", 1, 1, "destroy_after_ingest", null, "persisted"],
      ["e-2", 2, 0, "destroy_before_ingest", null, "not_ingested"], ["e-1", 1, 2, "acknowledge", 202, "duplicate"],
      ["e-2", 2, 1, "acknowledge", 401, "rejected"],
    ]);
    for (const record of server.state.records) assert.match(record.body_sha256, /^[0-9a-f]{64}$/);
    assert.equal(fixture.submissions.length, 3, "only ingesting actions reach the collector");
    const scope = { kind: "tenant", tenantId: "syn-tenant-00000001" };
    assert.deepEqual(readBack({ state: server.state, storage: fixture.storage }), [
      { event_id: "e-1", scope, persisted: true, stored_body_sha256: sha256(first) },
      { event_id: "e-2", scope, persisted: false, storage_result: "not_found" },
    ]);
  } finally {
    await server.close();
  }
});

test("planted defect: a conflicting copy under another tenant scope does not hide the persisted copy", async () => {
  const stored = new Map();
  const key = (scope, id) => JSON.stringify([scope, id]);
  const ingress = {
    submit({ body }) {
      const value = JSON.parse(body);
      const scope = storageScopeOf(value.tenant);
      if ([...stored.keys()].some((entry) => JSON.parse(entry)[1] === value.event.id)) return rejected(CODES.STORAGE_CONFLICT);
      stored.set(key(scope, value.event.id), body);
      return { kind: "persisted" };
    },
  };
  const storage = { get: (scope, id) => (stored.has(key(scope, id)) ? { kind: "found", record: { body: stored.get(key(scope, id)) } } : { kind: "not_found" }) };
  const server = await startIngress({ collector: { DIAGNOSTIC_CODES: CODES }, ingress, faults: faultInjector({ default: "acknowledge", rules: [] }) });
  try {
    const tenant = (tenantId) => JSON.stringify({ event: { id: "e-9" }, tenant: { scope: "tenant", effective_tenant_id: tenantId } });
    assert.equal((await post({ port: server.port, body: tenant("syn-tenant-0000000a") })).status, 202);
    assert.equal((await post({ port: server.port, body: tenant("syn-tenant-0000000b") })).status, 409);
    assert.deepEqual(readBack({ state: server.state, storage }), [
      { event_id: "e-9", scope: { kind: "tenant", tenantId: "syn-tenant-0000000a" }, persisted: true, stored_body_sha256: sha256(tenant("syn-tenant-0000000a")) },
      { event_id: "e-9", scope: { kind: "tenant", tenantId: "syn-tenant-0000000b" }, persisted: false, storage_result: "not_found" },
    ]);
  } finally {
    await server.close();
  }
});

test("planted defect: the ingress hashes the bytes that arrived, so two invalid sequences that decode alike differ", async () => {
  const fixture = fixtureCollector();
  const server = await startIngress({ collector: fixture.collector, ingress: fixture.ingress, faults: faultInjector({ default: "acknowledge", rules: [
    { occurrence: 1, attempt: 0, action: "status", status: 503 }, { occurrence: 1, attempt: 1, action: "status", status: 503 },
  ] }) });
  try {
    const first = Buffer.from([0x7b, 0xff, 0x7d]);
    const second = Buffer.from([0x7b, 0xfe, 0x7d]);
    assert.equal(first.toString("utf8"), second.toString("utf8"), "both decode to the same replacement text");
    await post({ port: server.port, body: first });
    await post({ port: server.port, body: second });
    assert.deepEqual(server.state.records.map((record) => record.body_sha256), [sha256(first), sha256(second)]);
  } finally {
    await server.close();
  }
});

test("a malformed acknowledgment follows the collector's decision: a 202 that acknowledges nothing", async () => {
  const fixture = fixtureCollector();
  const server = await startIngress({ collector: fixture.collector, ingress: fixture.ingress, faults: faultInjector({ default: "acknowledge", rules: [
    { occurrence: 1, attempt: 0, action: "malformed_after_ingest" },
  ] }) });
  try {
    const body = event("e-3");
    assert.deepEqual(await post({ port: server.port, body }), { status: 202, body: JSON.stringify({ acknowledgments: [] }) });
    assert.equal((await post({ port: server.port, body })).status, 202);
    assert.deepEqual(server.state.records.map(({ action, status, outcome }) => [action, status, outcome.kind]), [
      ["malformed_after_ingest", 202, "persisted"], ["acknowledge", 202, "duplicate"],
    ]);
    assert.equal(readBack({ state: server.state, storage: fixture.storage })[0].stored_body_sha256, sha256(body));
  } finally {
    await server.close();
  }
});

// The outages probe's timeout: the ingress ingests, then answers only after the client's deadline. The
// aborted request must not keep the server from closing, and the late answer must not throw. Only the
// first request has a short deadline; the margins are wide so a slow runner cannot fail an honest run.
test("a delayed answer past the client's deadline is a timeout after ingest, and the ingress still closes", async () => {
  const LATE_MS = 2000;
  const fixture = fixtureCollector();
  const server = await startIngress({ collector: fixture.collector, ingress: fixture.ingress, faults: faultInjector({ default: "acknowledge", rules: [
    { occurrence: 1, attempt: 0, action: "delay", delay_ms: LATE_MS },
  ] }) });
  const body = event("e-4");
  const send = (timeoutMs) => fetch(`http://127.0.0.1:${server.port}/v1/security-audit`, {
    method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body, signal: AbortSignal.timeout(timeoutMs),
  });
  const sentAt = Date.now();
  let closed = false;
  try {
    await assert.rejects(send(100), { name: "TimeoutError" });
    const redelivered = await send(10_000);
    assert.equal(redelivered.status, 202);
    assert.deepEqual(await redelivered.json(), { acknowledgments: [{ event_id: "e-4", outcome: "accepted" }] });
    await server.close();
    closed = true;
    assert(Date.now() < sentAt + LATE_MS, "the aborted request held the server open until its late answer");
    await new Promise((resolveWait) => { setTimeout(resolveWait, sentAt + LATE_MS + 300 - Date.now()); });
    assert.deepEqual(server.state.records.map(({ action, status, outcome, delayed_ms: delayed }) => [action, status, outcome.kind, delayed]), [
      ["delay", 202, "persisted", LATE_MS], ["acknowledge", 202, "duplicate", undefined],
    ]);
  } finally {
    if (!closed) await server.close();
  }
});
