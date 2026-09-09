import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { test } from "node:test";

const childPrelude = String.raw`
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSecurityAuditSdk } from "./dist/index.js";

const baseConfiguration = (sink, shutdownTimeoutMs) => ({
  contractVersion: "1.1.0",
  producer: { name: "f07-test-producer", version: "1.0.0" },
  service: { name: "f07-test-service", version: "1.0.0" },
  environment: { name: "test" },
  sink,
  shutdownTimeoutMs,
});
const fixturePath = resolve(process.cwd(), "../../contracts/security-audit/examples/positive/all-events.json");
const [fixture] = JSON.parse(await readFile(fixturePath, "utf8"));
`;

test("clean shutdown with an 8000 ms timeout unrefs the real handle and exits promptly", async () => {
  const script = `${childPrelude}
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let creations = 0;
let unrefs = 0;
let clears = 0;
let shutdownHandle;
globalThis.setTimeout = ((callback, delay, ...args) => {
  creations += 1;
  const handle = originalSetTimeout(callback, delay, ...args);
  shutdownHandle = handle;
  const originalUnref = handle.unref.bind(handle);
  handle.unref = () => {
    unrefs += 1;
    return originalUnref();
  };
  return handle;
});
globalThis.clearTimeout = ((handle) => {
  clears += 1;
  return originalClearTimeout(handle);
});
try {
  const sdk = createSecurityAuditSdk(baseConfiguration({
    async emit() { return { status: "accepted" }; },
    async flush() {},
    async shutdown() {},
  }, 8000));
  const started = performance.now();
  const result = await sdk.shutdown();
  console.log(JSON.stringify({ result, state: sdk.state, shutdownMs: performance.now() - started, creations, unrefs, clears, hasRef: shutdownHandle.hasRef() }));
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
`;
  const started = performance.now();
  const child = await runChild(script, 3_000);
  const exitMs = performance.now() - started;
  assert.equal(child.code, 0, child.stderr);
  assert.ok(exitMs < 3_000, `clean child retained the process for ${exitMs} ms`);
  const record = onlyRecord(child.stdout);
  assert.deepEqual(record.result, { ok: true });
  assert.equal(record.state, "shut_down");
  assert.equal(record.creations, 1);
  assert.equal(record.unrefs, 1);
  assert.equal(record.clears, 1);
  assert.equal(record.hasRef, false);
});

test("real Node unref guard exits promptly even when cancellation is observably delayed", async () => {
  const script = `${childPrelude}
const originalClearTimeout = globalThis.clearTimeout;
let clearCalls = 0;
globalThis.clearTimeout = (() => { clearCalls += 1; });
try {
  const sdk = createSecurityAuditSdk(baseConfiguration({ async emit() { return { status: "accepted" }; } }, 8000));
  const result = await sdk.shutdown();
  console.log(JSON.stringify({ result, state: sdk.state, clearCalls }));
} finally {
  globalThis.clearTimeout = originalClearTimeout;
}
`;
  const started = performance.now();
  const child = await runChild(script, 3_000);
  const exitMs = performance.now() - started;
  assert.equal(child.code, 0, child.stderr);
  assert.ok(exitMs < 3_000, `unref guard child retained the process for ${exitMs} ms`);
  const record = onlyRecord(child.stdout);
  assert.deepEqual(record.result, { ok: true });
  assert.equal(record.state, "shut_down");
  assert.equal(record.clearCalls, 1);
});

test("controlled timer instrumentation proves cancellation, structured cleanup, and idempotency", async () => {
  const script = `${childPrelude}
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalSetInterval = globalThis.setInterval;
let timers = [];
let creations = 0;
let unrefs = 0;
let clears = 0;
let intervals = 0;
const snapshots = [];
const reset = () => { timers = []; creations = 0; unrefs = 0; clears = 0; intervals = 0; };
const snapshot = (name, extra) => snapshots.push({ name, creations, unrefs, clears, intervals, ...extra });
globalThis.setTimeout = ((callback, delay, ...args) => {
  creations += 1;
  const timer = {
    callback: () => callback(...args),
    delay,
    cleared: false,
    unref() { unrefs += 1; return this; },
  };
  timers.push(timer);
  return timer;
});
globalThis.clearTimeout = ((timer) => { clears += 1; timer.cleared = true; });
globalThis.setInterval = ((...args) => { intervals += 1; return originalSetInterval(...args); });
const signalNames = ["SIGINT", "SIGTERM", "SIGHUP"];
const signalCounts = () => Object.fromEntries(signalNames.map((name) => [name, process.listenerCount(name)]));
const beforeSignals = signalCounts();
try {
  reset();
  {
    let flushes = 0;
    let shutdowns = 0;
    const sdk = createSecurityAuditSdk(baseConfiguration({ async emit() { return { status: "accepted" }; }, async flush() { flushes += 1; }, async shutdown() { shutdowns += 1; } }, 8000));
    const result = await sdk.shutdown();
    snapshot("clean", { result, state: sdk.state, flushes, shutdowns, timerCleared: timers[0].cleared });
  }

  reset();
  {
    let release;
    let emits = 0;
    let flushes = 0;
    let shutdowns = 0;
    const sdk = createSecurityAuditSdk(baseConfiguration({
      async emit() { emits += 1; await new Promise((resolve) => { release = resolve; }); return { status: "accepted" }; },
      async flush() { flushes += 1; },
      async shutdown() { shutdowns += 1; },
    }, 8000));
    const pending = sdk.emit(fixture);
    await new Promise((resolve) => setImmediate(resolve));
    const first = sdk.shutdown();
    const concurrent = sdk.shutdown();
    const during = await sdk.emit(fixture);
    release();
    const accepted = await pending;
    const result = await first;
    const after = await sdk.emit(fixture);
    const repeated = await sdk.shutdown();
    snapshot("in-flight-first", { samePromise: first === concurrent, during, accepted, result, after, repeated, state: sdk.state, emits, flushes, shutdowns, timerCleared: timers[0].cleared });
  }

  reset();
  {
    let release;
    let emits = 0;
    let flushes = 0;
    let shutdowns = 0;
    const sdk = createSecurityAuditSdk(baseConfiguration({
      async emit() { emits += 1; await new Promise((resolve) => { release = resolve; }); return { status: "accepted" }; },
      async flush() { flushes += 1; },
      async shutdown() { shutdowns += 1; },
    }, 8000));
    const pending = sdk.emit(fixture);
    await new Promise((resolve) => setImmediate(resolve));
    const shutdown = sdk.shutdown();
    timers[0].callback();
    const result = await shutdown;
    release();
    await pending;
    snapshot("timeout-first", { result, state: sdk.state, emits, flushes, shutdowns, timerCleared: timers[0].cleared });
  }

  reset();
  {
    const sdk = createSecurityAuditSdk(baseConfiguration({ async emit() { return { status: "accepted" }; }, async flush() { throw new Error("synthetic"); } }, 8000));
    const result = await sdk.shutdown();
    snapshot("throwing-shutdown-branch", { result, state: sdk.state, timerCleared: timers[0].cleared });
  }

  reset();
  {
    const sdk = createSecurityAuditSdk(baseConfiguration({ async emit() { return { status: "accepted" }; } }, 8000));
    const first = sdk.shutdown();
    const concurrent = sdk.shutdown();
    const result = await first;
    const repeated = await sdk.shutdown();
    snapshot("repeated-concurrent", { samePromise: first === concurrent, result, repeated, state: sdk.state, timerCleared: timers[0].cleared });
  }

  console.log(JSON.stringify({ snapshots, beforeSignals, afterSignals: signalCounts() }));
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  globalThis.setInterval = originalSetInterval;
}
`;
  const child = await runChild(script, 3_000);
  assert.equal(child.code, 0, child.stderr);
  const record = onlyRecord(child.stdout);
  assert.deepEqual(record.beforeSignals, record.afterSignals);
  const snapshots = new Map<string, Record<string, any>>(
    record.snapshots.map((entry: Record<string, any>): [string, Record<string, any>] => [String(entry.name), entry]),
  );
  const getSnapshot = (name: string): Record<string, any> => {
    const snapshot = snapshots.get(name);
    assert.ok(snapshot, `missing ${name} instrumentation record`);
    return snapshot;
  };
  for (const name of ["clean", "in-flight-first", "timeout-first", "throwing-shutdown-branch", "repeated-concurrent"]) {
    const snapshot = getSnapshot(name);
    assert.equal(snapshot.creations, 1, name);
    assert.equal(snapshot.unrefs, 1, name);
    assert.equal(snapshot.clears, 1, name);
    assert.equal(snapshot.intervals, 0, name);
    assert.equal(snapshot.timerCleared, true, name);
  }
  const inFlight = getSnapshot("in-flight-first");
  assert.equal(inFlight.samePromise, true);
  assert.deepEqual(inFlight.during, { ok: false, error: { code: "SDK_SHUTTING_DOWN", category: "lifecycle" } });
  assert.deepEqual(inFlight.accepted, { ok: true, value: { status: "accepted" } });
  assert.deepEqual(inFlight.result, { ok: true });
  assert.deepEqual(inFlight.after, { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle" } });
  assert.deepEqual(inFlight.repeated, { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle" } });
  assert.equal(inFlight.state, "shut_down");
  assert.equal(inFlight.emits, 1);
  assert.equal(inFlight.flushes, 1);
  assert.equal(inFlight.shutdowns, 1);
  const timedOut = getSnapshot("timeout-first");
  assert.deepEqual(timedOut.result, { ok: false, error: { code: "SDK_SHUTDOWN_TIMEOUT", category: "lifecycle" } });
  assert.equal(timedOut.state, "shut_down");
  assert.equal(timedOut.emits, 1);
  assert.equal(timedOut.flushes, 0);
  assert.equal(timedOut.shutdowns, 0);
  const throwing = getSnapshot("throwing-shutdown-branch");
  assert.deepEqual(throwing.result, { ok: false, error: { code: "SDK_SINK_FAILURE", category: "sink" } });
  const repeated = getSnapshot("repeated-concurrent");
  assert.equal(repeated.samePromise, true);
  assert.deepEqual(repeated.result, { ok: true });
  assert.deepEqual(repeated.repeated, { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle" } });
});

test("a referenced process still observes the configured logical shutdown timeout", async () => {
  const script = `${childPrelude}
let release;
let emits = 0;
let flushes = 0;
let shutdowns = 0;
const sdk = createSecurityAuditSdk(baseConfiguration({
  async emit() { emits += 1; await new Promise((resolve) => { release = resolve; }); return { status: "accepted" }; },
  async flush() { flushes += 1; },
  async shutdown() { shutdowns += 1; },
}, 75));
const pending = sdk.emit(fixture);
await new Promise((resolve) => setImmediate(resolve));
const referencedGuard = setInterval(() => {}, 1000);
const started = performance.now();
const result = await sdk.shutdown();
const elapsedMs = performance.now() - started;
clearInterval(referencedGuard);
release();
await pending;
console.log(JSON.stringify({ result, elapsedMs, state: sdk.state, emits, flushes, shutdowns }));
`;
  const child = await runChild(script, 2_000);
  assert.equal(child.code, 0, child.stderr);
  const record = onlyRecord(child.stdout);
  assert.deepEqual(record.result, { ok: false, error: { code: "SDK_SHUTDOWN_TIMEOUT", category: "lifecycle" } });
  assert.ok(record.elapsedMs >= 25, `timeout settled implausibly early at ${record.elapsedMs} ms`);
  assert.ok(record.elapsedMs < 1_000, `timeout was not bounded: ${record.elapsedMs} ms`);
  assert.equal(record.state, "shut_down");
  assert.equal(record.emits, 1);
  assert.equal(record.flushes, 0);
  assert.equal(record.shutdowns, 0);
});

interface ChildResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runChild(script: string, safetyMs: number): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    const safety = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`child exceeded ${safetyMs} ms and was killed; stdout=${stdout}; stderr=${stderr}`));
    }, safetyMs);
    child.once("error", (error) => {
      clearTimeout(safety);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(safety);
      resolve({ code, stdout, stderr });
    });
  });
}

function onlyRecord(stdout: string): Record<string, any> {
  const lines = stdout.split("\n").filter(Boolean);
  assert.equal(lines.length, 1, `expected one child record, received: ${stdout}`);
  const line = lines[0];
  assert.ok(line);
  return JSON.parse(line) as Record<string, any>;
}
