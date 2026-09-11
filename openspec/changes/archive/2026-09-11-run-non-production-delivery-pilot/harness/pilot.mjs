// Non-production delivery pilot for issue #116.
//
// Runs the real producer delivery stack from @bloodtrail/security-audit-sdk-node
// (HTTP handoff, bounded retry, bounded backpressure, deadline-bounded shutdown)
// against the real @bloodtrail/security-audit-collector ingress with SQLite
// storage, over a real loopback HTTP socket, for one bounded interval on
// synthetic data only. Every stop criterion is proven to fire before the pilot
// runs, is evaluated throughout, and terminates and rolls back the pilot the
// moment it fires. Nothing outside a fresh temporary directory is written.
//
// Authorization: ../pilot-authorization.md. NON-PRODUCTION.
//
// Run from a clean clone, repository root, after building the three packages:
//   npm run build --prefix packages/security-audit-sdk-core
//   npm run build --prefix packages/security-audit-sdk-node
//   npm run build --prefix packages/security-audit-collector
//   node openspec/changes/run-non-production-delivery-pilot/harness/pilot.mjs

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packages = resolve(__dirname, "../../../../packages");
const sdkNode = await import(resolve(packages, "security-audit-sdk-node/dist/index.js"));
const collector = await import(resolve(packages, "security-audit-collector/dist/index.js"));

// ---------------------------------------------------------------- bounds
// Every limit below is stated in pilot-authorization.md; changing one here
// without changing it there makes the run unauthorized.
const LIMITS = Object.freeze({
  wallClockMs: 120_000,
  events: 600,
  tenants: ["tenant_pilot_a", "tenant_pilot_b", "tenant_pilot_c"],
  requestTimeoutMs: 1_000,
  maxAttempts: 3,
  retryBaseDelayMs: 5,
  retryMaxDelayMs: 50,
  backpressureCapacity: 16,
  saturationBurst: 64,
  shutdownDeadlineMs: 5_000,
  storageFileMaxBytes: 64 * 1024 * 1024,
  delayEveryNthRequest: 11,
});

const PILOT_TOKEN = "pilot-token-a";
const WRONG_TOKEN = "pilot-token-not-issued";
const SECRET_MARKER = "PILOT_SECRET_MARKER_4b7d";
const OWNERS = Object.freeze({
  dataOwner: "nandohdc (project owner), filled by Claude under the owner's 2026-09-10 instruction",
  retentionAuthority: "nandohdc (project owner), filled by Claude under the owner's 2026-09-10 instruction",
  keyOwner: "nandohdc (project owner), filled by Claude under the owner's 2026-09-10 instruction",
});
const CONTRACT_VERSION = collector.SUPPORTED_CONTRACT_VERSIONS[0];
const RETENTION_CLASSES = ["operational_short", "security_standard", "security_elevated"];

// ---------------------------------------------------------------- stop criteria
class StopCriterion extends Error {
  constructor(id, detail) {
    super(`stop criterion ${id} fired: ${detail}`);
    this.id = id;
  }
}

// Each check returns normally or throws StopCriterion. They are pure over the
// observations passed in, so the preflight can prove each one fires.
const STOP_CRITERIA = Object.freeze({
  "SC1-secret-disclosure": (observed) => {
    for (const text of observed.texts) {
      for (const secret of [PILOT_TOKEN, WRONG_TOKEN, SECRET_MARKER]) {
        if (text.includes(secret)) throw new StopCriterion("SC1-secret-disclosure", "a credential or payload marker reached a result, diagnostic, metric, or log line");
      }
    }
  },
  "SC2-false-durability": (observed) => {
    for (const { scope, eventId } of observed.acknowledged) {
      if (observed.read(scope, eventId).kind !== "found") throw new StopCriterion("SC2-false-durability", "an acknowledged event is not in storage");
    }
  },
  "SC3-cross-tenant-read": (observed) => {
    for (const { scope, eventId } of observed.acknowledged) {
      for (const other of LIMITS.tenants.filter((tenant) => tenant !== scope.tenantId)) {
        if (observed.read({ kind: "tenant", tenantId: other }, eventId).kind !== "absent") throw new StopCriterion("SC3-cross-tenant-read", "a read under another tenant returned a record");
      }
    }
  },
  "SC4-deadline": (observed) => {
    if (observed.elapsedMs > LIMITS.wallClockMs) throw new StopCriterion("SC4-deadline", "the authorized interval elapsed");
  },
  "SC5-storage-bound": (observed) => {
    if (observed.storageBytes > LIMITS.storageFileMaxBytes) throw new StopCriterion("SC5-storage-bound", "the storage file exceeded its bound");
  },
  "SC6-unexpected-outcome": (observed) => {
    for (const status of observed.deliveryStatuses) {
      if (!["acknowledged", "non_retryable", "exhausted", "rejected_overload", "rejected_shutting_down"].includes(status)) {
        throw new StopCriterion("SC6-unexpected-outcome", "a delivery reached a state outside the conformance vocabulary");
      }
    }
  },
});

function evaluateStopCriteria(observed) {
  for (const check of Object.values(STOP_CRITERIA)) check(observed);
}

// Proves, before any pilot traffic, that each stop criterion fires on its
// defect and stays silent on its null control, and that rollback removes the
// pilot's only artifact.
function preflight() {
  const clean = {
    texts: ["COLLECTOR_AUTH_REJECTED"],
    acknowledged: [{ scope: { kind: "tenant", tenantId: LIMITS.tenants[0] }, eventId: "e" }],
    read: (scope) => (scope.tenantId === LIMITS.tenants[0] ? { kind: "found" } : { kind: "absent" }),
    elapsedMs: 0,
    storageBytes: 0,
    deliveryStatuses: ["acknowledged"],
  };
  evaluateStopCriteria(clean);
  const defects = {
    "SC1-secret-disclosure": { texts: [`diagnostic ${SECRET_MARKER}`] },
    "SC2-false-durability": { read: () => ({ kind: "absent" }) },
    "SC3-cross-tenant-read": { read: () => ({ kind: "found" }) },
    "SC4-deadline": { elapsedMs: LIMITS.wallClockMs + 1 },
    "SC5-storage-bound": { storageBytes: LIMITS.storageFileMaxBytes + 1 },
    "SC6-unexpected-outcome": { deliveryStatuses: ["delivered_somewhere"] },
  };
  const fired = [];
  for (const [id, defect] of Object.entries(defects)) {
    assert.throws(() => STOP_CRITERIA[id]({ ...clean, ...defect }), (error) => error instanceof StopCriterion && error.id === id);
    fired.push(id);
  }
  const probe = mkdtempSync(resolve(tmpdir(), "bloodtrail-pilot-preflight-"));
  rollback(probe);
  assert.equal(existsSync(probe), false, "rollback must remove the pilot directory");
  return { stopCriteriaProven: fired, rollbackProven: true };
}

function rollback(directory) {
  rmSync(directory, { recursive: true, force: true });
}

// ---------------------------------------------------------------- collector over HTTP
function statusFor(result) {
  if (result.kind === "persisted") return 202;
  // A duplicate is acknowledged only when its occurrence is durably stored.
  if (result.kind === "duplicate") return result.acknowledgment === "persisted" ? 202 : 503;
  const code = result.diagnostic.code;
  const codes = collector.DIAGNOSTIC_CODES;
  if ([codes.AUTH_MISSING, codes.AUTH_MALFORMED, codes.AUTH_REJECTED].includes(code)) return 401;
  if (code === codes.SIZE_EXCEEDED) return 413;
  if ([codes.STORAGE_WRITE_FAILED, codes.STORAGE_WRITE_INDETERMINATE, codes.DEDUPLICATION_CAPACITY].includes(code)) return 503;
  if ([codes.DUPLICATE_CONFLICT, codes.STORAGE_CONFLICT].includes(code)) return 409;
  return 422;
}

function startCollector(ingress, log) {
  let requests = 0;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests += 1;
      const authorization = request.headers.authorization ?? "";
      const credentials = authorization.startsWith("Bearer ") ? { credential: authorization.slice(7) } : undefined;
      const result = ingress.submit({ credentials, body: Buffer.concat(chunks).toString("utf8") });
      const status = statusFor(result);
      log.push(`collector ${status} ${result.kind}${result.kind === "rejected" ? ` ${result.diagnostic.code}` : ""}`);
      const body = status === 202 ? { acknowledgments: [{ event_id: result.eventId, outcome: "accepted" }] } : { acknowledgments: [] };
      // Deterministic latency injection past the producer's request timeout.
      const delay = requests % LIMITS.delayEveryNthRequest === 0 ? LIMITS.requestTimeoutMs + 200 : 0;
      setTimeout(() => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(body));
      }, delay);
    });
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => resolveServer({ server, port: server.address().port, requests: () => requests }));
  });
}

// ---------------------------------------------------------------- producer
function fetchExchange(port, token) {
  return async (request) => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${request.path}`, {
        method: "POST",
        headers: { ...request.headers, authorization: `Bearer ${token}` },
        body: request.body,
        signal: AbortSignal.timeout(LIMITS.requestTimeoutMs),
      });
      const parsed = await response.json();
      return { kind: "response", status: response.status, acknowledgments: parsed.acknowledgments ?? [] };
    } catch (error) {
      return error?.name === "TimeoutError" ? { kind: "timeout" } : { kind: "transport_failure" };
    }
  };
}

function seededJitter(seed) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function producer(port, token, retryCounters) {
  const handoff = sdkNode.createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange: fetchExchange(port, token) });
  return sdkNode.createBoundedDeliveryRetry({
    handoff,
    maxAttempts: LIMITS.maxAttempts,
    baseDelayMs: LIMITS.retryBaseDelayMs,
    maxDelayMs: LIMITS.retryMaxDelayMs,
    jitterSource: seededJitter(116),
    timers: sdkNode.nodeTimers,
    observability: { onAttemptScheduled: () => { retryCounters.scheduled += 1; }, onExhausted: () => { retryCounters.exhausted += 1; } },
  });
}

// ---------------------------------------------------------------- workload
function syntheticEvent(index, overrides = {}) {
  const tenant = LIMITS.tenants[index % LIMITS.tenants.length];
  return {
    event: {
      id: randomUUID(),
      name: "bloodtrail.audit.authentication.succeeded",
      category: "authentication",
      action: "authenticate",
      lifecycle_phase: "completed",
      outcome: "success",
      timestamp: "2026-09-11T00:00:00.000Z",
      observed_at: "2026-09-11T00:00:00.000Z",
      delivery_class: "security_significant",
      outcome_reason: { message: SECRET_MARKER },
    },
    schema: { name: "security-audit-event", version: CONTRACT_VERSION },
    producer: { name: "pilot-producer", version: "1.0.0" },
    environment: { name: "synthetic-pilot" },
    service: { name: "pilot-service" },
    tenant: { scope: "tenant", effective_tenant_id: tenant },
    actor: { type: "service_account" },
    initiator: { type: "service", id: `pilot-initiator-${index}` },
    resource: { operation_type: "read" },
    correlation: { correlation_id: `pilot-${index}`, operation_id: `pilot-op-${index}` },
    data: {
      classification: "internal",
      retention_class: RETENTION_CLASSES[index % RETENTION_CLASSES.length],
      field_policy_version: CONTRACT_VERSION,
    },
    ...overrides,
  };
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

// ---------------------------------------------------------------- pilot
// Rollback runs whatever happens inside the pilot: success, a stop criterion,
// or any other error.
async function runPilot() {
  const directory = mkdtempSync(resolve(tmpdir(), "bloodtrail-pilot-"));
  const cleanup = { server: null, storage: null };
  try {
    return await pilotBody(directory, cleanup);
  } finally {
    if (cleanup.server) await new Promise((resolveClose) => cleanup.server.close(resolveClose));
    if (cleanup.storage) cleanup.storage.close();
    rollback(directory);
  }
}

async function pilotBody(directory, cleanup) {
  const started = Date.now();
  const databasePath = resolve(directory, "pilot.db");
  const log = [];
  const storage = new collector.SqliteStorage({ location: databasePath });
  cleanup.storage = storage;
  const ingress = new collector.CollectorIngress({
    authenticator: new collector.SyntheticFixtureAuthenticator([PILOT_TOKEN]),
    storage: { port: storage, owners: OWNERS },
  });
  const { server, port, requests } = await startCollector(ingress, log);
  cleanup.server = server;
  const retryCounters = { scheduled: 0, exhausted: 0 };
  const retry = producer(port, PILOT_TOKEN, retryCounters);
  const intruder = producer(port, WRONG_TOKEN, { scheduled: 0, exhausted: 0 });
  const backpressure = sdkNode.createBoundedDeliveryBackpressure({ capacity: LIMITS.backpressureCapacity });
  const shutdown = sdkNode.createDeliveryShutdown({ deadlineMs: LIMITS.shutdownDeadlineMs, timers: sdkNode.nodeTimers });

  const acknowledged = [];
  const statuses = [];
  const latencies = [];
  const outcomeCounts = {};
  const count = (key) => { outcomeCounts[key] = (outcomeCounts[key] ?? 0) + 1; };
  const observe = () => ({
    texts: [...log, JSON.stringify(ingress.metrics()), JSON.stringify(outcomeCounts)],
    acknowledged,
    read: (scope, eventId) => storage.get(scope, eventId),
    elapsedMs: Date.now() - started,
    storageBytes: existsSync(databasePath) ? statSync(databasePath).size : 0,
    deliveryStatuses: statuses,
  });

  async function deliver(event, via = retry, label = "valid") {
    const began = performance.now();
    const outcome = await shutdown.submit(() => backpressure.submit(() => via.deliver(event)));
    latencies.push(performance.now() - began);
    const status = outcome.status === "admitted" ? (outcome.result.status === "admitted" ? outcome.result.result.status : outcome.result.status) : outcome.status;
    statuses.push(status);
    count(`${label}:${status}`);
    if (status === "acknowledged") acknowledged.push({ scope: { kind: "tenant", tenantId: event.tenant.effective_tenant_id }, eventId: event.event.id });
    return status;
  }

  let stopped = null;
  try {
    // Phase 1 — steady valid traffic, sequential, with injected timeouts.
    for (let index = 0; index < LIMITS.events; index += 1) {
      await deliver(syntheticEvent(index));
      if (index % 50 === 49) evaluateStopCriteria(observe());
    }
    // Phase 2 — rejection classes the collector must refuse before storage.
    await deliver(syntheticEvent(LIMITS.events, { data: { classification: "internal", retention_class: "policy_governed", field_policy_version: CONTRACT_VERSION } }), retry, "policy_governed");
    await deliver(syntheticEvent(LIMITS.events + 1, { schema: { name: "security-audit-event", version: "9.9.9" } }), retry, "unsupported_version");
    await deliver(syntheticEvent(LIMITS.events + 2), intruder, "wrong_credential");
    await deliver(syntheticEvent(LIMITS.events + 3, { tenant: { scope: "tenant" } }), retry, "unresolvable_scope");
    // Phase 3 — saturation: a concurrent burst larger than the admission capacity.
    const burst = Array.from({ length: LIMITS.saturationBurst }, (_, offset) => deliver(syntheticEvent(LIMITS.events + 10 + offset), retry, "burst"));
    await Promise.all(burst);
    evaluateStopCriteria(observe());
  } catch (error) {
    if (!(error instanceof StopCriterion)) throw error;
    stopped = error.id;
  }

  const shutdownReport = await shutdown.shutdown();
  const after = await deliver(syntheticEvent(LIMITS.events + 200), retry, "after_shutdown");
  if (stopped === null) {
    try {
      evaluateStopCriteria(observe());
    } catch (error) {
      if (!(error instanceof StopCriterion)) throw error;
      stopped = error.id;
    }
  }

  // Storage evidence: read-back, and whole-record expiry with the clock
  // advanced past the longest candidate retention.
  const readBack = acknowledged.filter(({ scope, eventId }) => storage.get(scope, eventId).kind === "found").length;
  const expiredCounts = LIMITS.tenants.map((tenantId) => {
    const result = storage.deleteExpired({ kind: "tenant", tenantId }, Date.now() + collector.RETENTION_MILLISECONDS.security_elevated + 1);
    return result.kind === "deleted" ? result.count : -1;
  });
  const remainingAfterExpiry = acknowledged.filter(({ scope, eventId }) => storage.get(scope, eventId).kind === "found").length;
  const storageBytes = observe().storageBytes;

  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    stopped,
    contractVersion: CONTRACT_VERSION,
    elapsedMs: Date.now() - started,
    httpRequests: requests(),
    outcomes: Object.fromEntries(Object.entries(outcomeCounts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    retry: retryCounters,
    shutdown: shutdownReport,
    afterShutdown: after,
    collectorMetrics: ingress.metrics(),
    storage: {
      acknowledged: acknowledged.length,
      readBack,
      expiredPerTenant: expiredCounts,
      remainingAfterExpiry,
      fileBytesAtClose: storageBytes,
    },
    latencyMs: { p50: Math.round(percentile(sorted, 0.5)), p95: Math.round(percentile(sorted, 0.95)), max: Math.round(sorted.at(-1) ?? 0) },
    directory,
  };
}

const preflightResult = preflight();
const { directory: pilotDirectory, ...pilot } = await runPilot();
pilot.rolledBack = !existsSync(pilotDirectory);
const output = { preflight: preflightResult, pilot };
const serialized = JSON.stringify(output, null, 2);
for (const secret of [PILOT_TOKEN, WRONG_TOKEN, SECRET_MARKER]) {
  assert.equal(serialized.includes(secret), false, "the pilot report must carry no credential or payload marker");
}
console.log(serialized);
process.exitCode = pilot.stopped === null && pilot.rolledBack ? 0 : 1;
