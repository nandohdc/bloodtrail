import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  assertOutsideRepository,
  buildEvaluationKit,
  packTarball,
  verifyKitIdentity,
} from "./build-evaluation-kit.mjs";
import { extractDocBlocksFromDir } from "./evaluation-kit-doc-blocks.mjs";
import { assert, packageRoot, runChecked } from "./verification-helpers.mjs";

async function checkDeterminism(identity) {
  const dCheck = await mkdtemp(resolve(tmpdir(), "bloodtrail-determinism-check-"));
  try {
    const coreRepack = await packTarball("core", dCheck);
    const nodeRepack = await packTarball("node", dCheck);
    const expectedCore = identity.artifacts.find((a) => a.name === "core");
    const expectedNode = identity.artifacts.find((a) => a.name === "node");
    assert(coreRepack.sha256 === expectedCore.sha256, "core tarball digest must be deterministic");
    assert(nodeRepack.sha256 === expectedNode.sha256, "node tarball digest must be deterministic");
  } finally {
    await rm(dCheck, { recursive: true, force: true });
  }
}

async function typecheckExamples(tempInstall) {
  const docsDir = resolve(tempInstall, "docs");
  const docBlocksDir = resolve(tempInstall, "doc-blocks");
  if (existsSync(docsDir)) {
    await extractDocBlocksFromDir(docsDir, docBlocksDir);
  }

  const tsconfigPath = resolve(tempInstall, "tsconfig.json");
  const tsconfig = {
    compilerOptions: {
      target: "ES2024",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      useUnknownInCatchVariables: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noImplicitReturns: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      noEmit: true,
      rootDir: ".",
      skipLibCheck: true,
      typeRoots: [resolve(packageRoot, "node_modules/@types")],
      types: ["node"],
    },
    include: ["examples/**/*.ts", "doc-blocks/**/*.ts"],
  };
  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");

  const tsMatrix = [
    {
      version: "5.9.2",
      command: process.execPath,
      args: [resolve(packageRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfigPath],
    },
    {
      version: "6.0.3",
      command: "npx",
      args: ["--yes", "-p", "typescript@6.0.3", "tsc", "-p", tsconfigPath],
    },
    {
      version: "7.0.2",
      command: "npx",
      args: ["--yes", "-p", "typescript@7.0.2", "tsc", "-p", tsconfigPath],
    },
  ];

  for (const leg of tsMatrix) {
    runChecked(leg.command, leg.args, { cwd: tempInstall, capture: true });
  }
}

function findRequiredAcceptedEvent(events, eventName) {
  const match = events.find((entry) => entry.event?.name === eventName);
  assert(match, `${eventName} must be accepted at receiver`);
  return match;
}

async function assertReceiverHealth(origin) {
  const healthRes = await fetch(`${origin}/health`);
  const healthJson = await healthRes.json();
  assert(healthJson.status === "healthy", `receiver unhealthy: ${JSON.stringify(healthJson)}`);
  assert(healthJson.acceptedCount === 5, `Expected receiver to accept 5 events, got ${healthJson.acceptedCount}`);
  assert(Array.isArray(healthJson.events), "receiver /health must include events array");

  const events = healthJson.events;
  const authz = findRequiredAcceptedEvent(events, "bloodtrail.audit.authorization.denied");
  assert(authz.actor?.id === "actor-eval-scoped-user", "authorization.denied must carry scoped actor");
  assert(authz.tenant?.effective_tenant_id === "tenant-eval-scoped", "authorization.denied must carry scoped tenant");

  findRequiredAcceptedEvent(events, "bloodtrail.audit.authentication.failed");
  findRequiredAcceptedEvent(events, "bloodtrail.audit.authentication.succeeded");
  findRequiredAcceptedEvent(events, "bloodtrail.audit.data.sensitive_resource.viewed");

  const modified = findRequiredAcceptedEvent(events, "bloodtrail.audit.data.sensitive_resource.modified");
  assert(modified.event?.commit_state === "committed", "modification commit state must be committed from operation handle");
  assert(modified.correlation?.operation_id === "22222222-2222-4222-8222-000000000301", "modification must carry operation ID");
}

async function verifyHttpExchange(tempInstall) {
  const receiverScript = resolve(tempInstall, "examples/evaluation-receiver.ts");
  const serviceScript = resolve(tempInstall, "examples/evaluation-service.ts");
  if (!existsSync(receiverScript) || !existsSync(serviceScript)) {
    return;
  }

  const receiverProc = spawn(process.execPath, ["--no-warnings", receiverScript, "0"], {
    cwd: tempInstall,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let receiverOrigin = null;
  const receiverOutput = [];
  const readyPromise = new Promise((resolveReady, rejectReady) => {
    receiverProc.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      receiverOutput.push(text);
      const match = /receiver:ready\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(text);
      if (match) {
        receiverOrigin = match[1];
        resolveReady(receiverOrigin);
      }
    });
    receiverProc.stderr.on("data", (chunk) => {
      receiverOutput.push(chunk.toString("utf8"));
    });
    receiverProc.on("error", rejectReady);
    receiverProc.on("exit", (code) => {
      if (!receiverOrigin) {
        rejectReady(
          new Error(`receiver exited early with code ${code}:\n${receiverOutput.join("")}`),
        );
      }
    });
  });

  try {
    const origin = await Promise.race([
      readyPromise,
      new Promise((_, rejectTimeout) =>
        setTimeout(
          () => rejectTimeout(new Error("timed out waiting for evaluation-receiver to be ready")),
          10000,
        ),
      ),
    ]);

    const serviceRun = runChecked(process.execPath, ["--no-warnings", serviceScript, origin], {
      cwd: tempInstall,
      capture: true,
    });
    assert(
      serviceRun.includes("service:emitted:authentication.succeeded"),
      `evaluation-service did not emit authentication.succeeded:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:authentication.failed"),
      `evaluation-service did not emit authentication.failed:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:authorization.denied"),
      `evaluation-service did not emit authorization.denied:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:context-survives-await:pass"),
      `context did not survive await in evaluation-service:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:data.sensitive_resource.viewed"),
      `evaluation-service did not emit data.sensitive_resource.viewed:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:direct-commit-prevented:pass"),
      `evaluation-service did not verify direct commit prevention:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:operation-commit:pass"),
      `evaluation-service did not verify operation commit:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:data.sensitive_resource.modified"),
      `evaluation-service did not emit data.sensitive_resource.modified:\n${serviceRun}`,
    );

    await assertReceiverHealth(origin);
  } finally {
    receiverProc.kill("SIGTERM");
  }
}

async function verifyFailurePaths(tempInstall) {
  const failureScriptContent = `import assert from "node:assert/strict";
import {
  createHttpAuditSink,
  createNodeSecurityAuditSdk,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  authoritativeTenant,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";

const peerOrigin = process.argv[2];
assert(peerOrigin, "peer origin required");

function emitTestEvent(sdk, id = "1") {
  return sdk.accountRegistrationAttempted({
    actor: authenticatedHumanActor({ id: "actor-fail-" + id, displayName: "User " + id }),
    tenant: authoritativeTenant({
      scope: "tenant",
      actor_tenant_id: "tenant-eval-fail",
      effective_tenant_id: "tenant-eval-fail",
      resource_tenant_id: "tenant-eval-fail",
    }),
    source: observedSource({
      observed: {
        address: "203.0.113.10",
        port: 443,
      },
    }),
    request: {
      id: "req-fail-" + id,
      method: "POST",
      route: "/api/v1/accounts/register",
    },
  });
}

function createTestSdk(sink, shutdownTimeoutMs = 5000) {
  return createNodeSecurityAuditSdk({
    contractVersion: CONTRACT_VERSION,
    producer: {
      name: "eval-service",
      version: "1.0.0",
    },
    service: {
      name: "eval-service",
      version: "1.0.0",
    },
    environment: {
      name: "development",
    },
    sink,
    shutdownTimeoutMs,
  });
}

function assertOutcomeReport(reports, expectedOutcome, expectedStatus) {
  assert.equal(reports.length, 1, "must produce 1 outcome report");
  assert.equal(reports[0].outcome, expectedOutcome, "must report outcome " + expectedOutcome);
  assert.equal(reports[0].status, expectedStatus, "report must carry status " + expectedStatus);
  assert.ok(typeof reports[0].eventId === "string" && reports[0].eventId.length > 0, "report must carry eventId");
}

// 1. Permanent 4xx status codes map to SDK_SINK_REJECTED and outcome http_permanent
for (const status of [400, 401, 403, 404, 422]) {
  const reports = [];
  const sink = createHttpAuditSink({
    origin: peerOrigin,
    path: "/v1/security-audit",
    timeoutMs: 2000,
    headers: { "x-peer-behavior": String(status) },
    onOutcome: (outcome) => { reports.push(outcome); },
  });
  const sdk = createTestSdk(sink);
  const result = await emitTestEvent(sdk, String(status));

  assert.equal(result.ok, false, "status " + status + " must result in error");
  assert.equal(result.error.code, "SDK_SINK_REJECTED", "status " + status + " must map to SDK_SINK_REJECTED");
  assert.equal(result.error.eventId, undefined, "result error must carry no eventId");
  assert.equal(result.error.event_id, undefined, "result error must carry no event_id");
  assertOutcomeReport(reports, "http_permanent", status);
}
console.log("failure-paths:permanent-rejection:pass");

// 2. Retryable status codes (5xx, 408, 425, 429) map to SDK_SINK_FAILURE and outcome http_retryable
for (const status of [408, 425, 429, 500, 503]) {
  const reports = [];
  const sink = createHttpAuditSink({
    origin: peerOrigin,
    path: "/v1/security-audit",
    timeoutMs: 2000,
    headers: { "x-peer-behavior": String(status) },
    onOutcome: (outcome) => { reports.push(outcome); },
  });
  const sdk = createTestSdk(sink);
  const result = await emitTestEvent(sdk, String(status));

  assert.equal(result.ok, false, "status " + status + " must result in error");
  assert.equal(result.error.code, "SDK_SINK_FAILURE", "status " + status + " must map to SDK_SINK_FAILURE");
  assert.equal(result.error.eventId, undefined, "result error must carry no eventId");
  assertOutcomeReport(reports, "http_retryable", status);
}
console.log("failure-paths:retryable-failure:pass");

// 3. Timeout maps to SDK_SINK_FAILURE and outcome timeout
{
  const reports = [];
  const sink = createHttpAuditSink({
    origin: peerOrigin,
    path: "/v1/security-audit",
    timeoutMs: 50,
    headers: { "x-peer-behavior": "timeout" },
    onOutcome: (outcome) => { reports.push(outcome); },
  });
  const sdk = createTestSdk(sink);
  const result = await emitTestEvent(sdk, "timeout-1");

  assert.equal(result.ok, false, "timeout must result in error");
  assert.equal(result.error.code, "SDK_SINK_FAILURE", "timeout must map to SDK_SINK_FAILURE");
  assertOutcomeReport(reports, "timeout", undefined);
}
console.log("failure-paths:timeout:pass");

// 4. Refused connection maps to SDK_SINK_FAILURE and outcome transport_failure
{
  const reports = [];
  const sink = createHttpAuditSink({
    origin: "http://127.0.0.1:1",
    path: "/v1/security-audit",
    timeoutMs: 1000,
    onOutcome: (outcome) => { reports.push(outcome); },
  });
  const sdk = createTestSdk(sink);
  const result = await emitTestEvent(sdk, "transport-1");

  assert.equal(result.ok, false, "refused connection must result in error");
  assert.equal(result.error.code, "SDK_SINK_FAILURE", "refused connection must map to SDK_SINK_FAILURE");
  assertOutcomeReport(reports, "transport_failure", undefined);
}
console.log("failure-paths:transport-failure:pass");

// 5. Malformed acknowledgments map to SDK_SINK_FAILURE and outcome malformed_acknowledgment
for (const malformedCase of [
  "malformed-empty",
  "malformed-no-array",
  "malformed-wrong-id",
  "malformed-rejected",
  "malformed-not-json",
]) {
  const reports = [];
  const sink = createHttpAuditSink({
    origin: peerOrigin,
    path: "/v1/security-audit",
    timeoutMs: 2000,
    headers: { "x-peer-behavior": malformedCase },
    onOutcome: (outcome) => { reports.push(outcome); },
  });
  const sdk = createTestSdk(sink);
  const result = await emitTestEvent(sdk, "malformed-" + malformedCase);

  assert.equal(result.ok, false, "malformed case " + malformedCase + " must result in error");
  assert.equal(result.error.code, "SDK_SINK_FAILURE", "malformed case " + malformedCase + " must map to SDK_SINK_FAILURE");
  assertOutcomeReport(reports, "malformed_acknowledgment", 200);
}
console.log("failure-paths:malformed-acknowledgment:pass");

// 6. Redirection maps to SDK_SINK_FAILURE and outcome unexpected_response (never followed)
for (const redirectStatus of [301, 302, 307, 308]) {
  const reports = [];
  const sink = createHttpAuditSink({
    origin: peerOrigin,
    path: "/v1/security-audit",
    timeoutMs: 2000,
    headers: { "x-peer-behavior": "redirect-" + redirectStatus },
    onOutcome: (outcome) => { reports.push(outcome); },
  });
  const sdk = createTestSdk(sink);
  const result = await emitTestEvent(sdk, "redirect-" + redirectStatus);

  assert.equal(result.ok, false, "redirect " + redirectStatus + " must result in error");
  assert.equal(result.error.code, "SDK_SINK_FAILURE", "redirect " + redirectStatus + " must map to SDK_SINK_FAILURE");
  assertOutcomeReport(reports, "unexpected_response", redirectStatus);
}
console.log("failure-paths:redirect:pass");

// 7. Flush waits for in-flight requests
{
  const sink = createHttpAuditSink({
    origin: peerOrigin,
    path: "/v1/security-audit",
    timeoutMs: 5000,
    headers: { "x-peer-behavior": "hold" },
  });
  const sdk = createTestSdk(sink);

  let inFlightSettled = false;
  const inFlightPromise = emitTestEvent(sdk, "hold-flush").then((res) => {
    inFlightSettled = true;
    return res;
  });

  await new Promise((r) => setTimeout(r, 50));

  let flushSettled = false;
  const flushPromise = sdk.flush().then((res) => {
    flushSettled = true;
    return res;
  });

  await new Promise((r) => setTimeout(r, 50));
  assert.equal(flushSettled, false, "flush must wait for in-flight request to settle");
  assert.equal(inFlightSettled, false, "in-flight request must remain unsettled");

  const releaseRes = await fetch(peerOrigin + "/release", { method: "POST" });
  assert.equal(releaseRes.status, 200, "release endpoint must return 200");

  const [inFlightResult, flushResult] = await Promise.all([inFlightPromise, flushPromise]);
  assert.equal(inFlightResult.ok, true, "in-flight request must succeed once released");
  assert.equal(flushResult.ok, true, "flush must succeed once earlier requests settle");
}
console.log("failure-paths:flush:pass");

// 8. Shutdown drains in-flight requests, and calls after shutdown return SDK_SHUT_DOWN
{
  const sink = createHttpAuditSink({
    origin: peerOrigin,
    path: "/v1/security-audit",
    timeoutMs: 5000,
    headers: { "x-peer-behavior": "hold" },
  });
  const sdk = createTestSdk(sink, 5000);

  let inFlightSettled = false;
  const inFlightPromise = emitTestEvent(sdk, "hold-shutdown").then((res) => {
    inFlightSettled = true;
    return res;
  });

  await new Promise((r) => setTimeout(r, 50));

  let shutdownSettled = false;
  const shutdownPromise = sdk.shutdown().then((res) => {
    shutdownSettled = true;
    return res;
  });

  // Call during shutdown draining returns SDK_SHUTTING_DOWN
  const lateEmitResult = await emitTestEvent(sdk, "late");
  assert.equal(lateEmitResult.ok, false, "emit during shutdown draining must fail");
  assert.equal(lateEmitResult.error.code, "SDK_SHUTTING_DOWN", "emit during shutdown draining must return SDK_SHUTTING_DOWN");

  await new Promise((r) => setTimeout(r, 50));
  assert.equal(shutdownSettled, false, "shutdown must wait for in-flight request to drain");
  assert.equal(inFlightSettled, false, "in-flight request must still be held");

  await fetch(peerOrigin + "/release", { method: "POST" });

  const [inFlightResult, shutdownResult] = await Promise.all([inFlightPromise, shutdownPromise]);
  assert.equal(inFlightResult.ok, true, "in-flight request must succeed once released");
  assert.equal(shutdownResult.ok, true, "shutdown must succeed once drained");
  assert.equal(sdk.state, "shut_down", "SDK state must be shut_down");

  // Call after shutdown completes returns SDK_SHUT_DOWN
  const postShutdownResult = await emitTestEvent(sdk, "post");
  assert.equal(postShutdownResult.ok, false, "emit after shutdown completes must fail");
  assert.equal(postShutdownResult.error.code, "SDK_SHUT_DOWN", "emit after shutdown completes must return SDK_SHUT_DOWN");
}
console.log("failure-paths:shutdown:pass");
console.log("failure-paths:all:pass");
`;

  const failureScriptPath = resolve(tempInstall, "check-failure-paths.mjs");
  await writeFile(failureScriptPath, failureScriptContent, "utf8");

  const peerScript = resolve(packageRoot, "scripts/evaluation-kit-peer.mjs");
  const peerProc = spawn(process.execPath, ["--no-warnings", peerScript, "0"], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let peerOrigin = null;
  const peerOutput = [];
  const peerReadyPromise = new Promise((resolveReady, rejectReady) => {
    peerProc.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      peerOutput.push(text);
      const match = /peer:ready\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(text);
      if (match) {
        peerOrigin = match[1];
        resolveReady(peerOrigin);
      }
    });
    peerProc.stderr.on("data", (chunk) => {
      peerOutput.push(chunk.toString("utf8"));
    });
    peerProc.on("error", rejectReady);
    peerProc.on("exit", (code) => {
      if (!peerOrigin) {
        rejectReady(new Error(`peer exited early with code ${code}:\n${peerOutput.join("")}`));
      }
    });
  });

  try {
    const origin = await Promise.race([
      peerReadyPromise,
      new Promise((_, rejectTimeout) =>
        setTimeout(() => rejectTimeout(new Error("timed out waiting for evaluation-kit-peer to be ready")), 10000),
      ),
    ]);

    const failureRun = runChecked(process.execPath, ["--no-warnings", "check-failure-paths.mjs", origin], {
      cwd: tempInstall,
      capture: true,
    });
    assert(
      failureRun.includes("failure-paths:all:pass"),
      `installed kit failure path check did not pass:\n${failureRun}`,
    );
  } finally {
    peerProc.kill("SIGTERM");
  }
}

const PROBE_SCRIPT_CONTENT = `import assert from "node:assert/strict";
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
} from "@bloodtrail/security-audit-sdk-core";

const COPY_PROBE_KEY = Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1");
const probes = globalThis[COPY_PROBE_KEY];
assert(Array.isArray(probes), "copy probe channel must be an array");

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-probe", version: "1.0.0" },
  service: { name: "eval-probe", version: "1.0.0" },
  environment: { name: "development" },
  sink: { emit: async () => ({ status: "accepted", event_id: "probe-1" }) },
});

const actor = authenticatedHumanActor({ id: "actor-probe", displayName: "Probe User" });
sdk.runWithContext({ actor }, () => {});
assert.equal(probes.length, 1, "expected exactly 1 core copy");
console.log("duplicate-copy-probe:pass");
`;

async function verifyDuplicateCoreProbe(tempInstall, plantDuplicateCore) {
  if (plantDuplicateCore) {
    const nestedCore = resolve(
      tempInstall,
      "node_modules/@bloodtrail/security-audit-sdk-node/node_modules/@bloodtrail/security-audit-sdk-core",
    );
    await cp(resolve(tempInstall, "node_modules/@bloodtrail/security-audit-sdk-core"), nestedCore, {
      recursive: true,
    });
  }

  const probeScriptPath = resolve(tempInstall, "check-duplicate-core.mjs");
  await writeFile(probeScriptPath, PROBE_SCRIPT_CONTENT, "utf8");

  const probeProc = spawnSync(process.execPath, ["--no-warnings", "check-duplicate-core.mjs"], {
    cwd: tempInstall,
    encoding: "utf8",
  });
  if (probeProc.status !== 0) {
    const errOutput = (probeProc.stderr ?? "") + (probeProc.stdout ?? "");
    if (errOutput.includes("DUPLICATE_AUTHORITY")) {
      throw new Error(`duplicate-copy probe reported DUPLICATE_AUTHORITY:\n${errOutput}`);
    }
    throw new Error(`duplicate-copy probe failed with exit status ${probeProc.status}:\n${errOutput}`);
  }
  assert(probeProc.stdout.includes("duplicate-copy-probe:pass"), "duplicate-copy probe did not pass");
}

async function verifyPnpmInstall(kitDir) {
  const tempPnpmInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-eval-pnpm-"));
  try {
    await cp(kitDir, tempPnpmInstall, { recursive: true });
    runChecked("npx", ["--yes", "pnpm@10.17.0", "install", "--prod", "--ignore-scripts"], {
      cwd: tempPnpmInstall,
      capture: true,
    });

    const pnpmFirstEvent = runChecked(process.execPath, ["--no-warnings", "examples/first-event.ts"], {
      cwd: tempPnpmInstall,
      capture: true,
    });
    assert(
      pnpmFirstEvent.includes("first-event:pass"),
      `examples/first-event.ts did not succeed under pnpm:\n${pnpmFirstEvent}`,
    );

    const pnpmProbePath = resolve(tempPnpmInstall, "check-duplicate-core.mjs");
    await writeFile(pnpmProbePath, PROBE_SCRIPT_CONTENT, "utf8");
    const pnpmProbeProc = spawnSync(process.execPath, ["--no-warnings", "check-duplicate-core.mjs"], {
      cwd: tempPnpmInstall,
      encoding: "utf8",
    });
    if (pnpmProbeProc.status !== 0) {
      const errOutput = (pnpmProbeProc.stderr ?? "") + (pnpmProbeProc.stdout ?? "");
      if (errOutput.includes("DUPLICATE_AUTHORITY")) {
        throw new Error(`duplicate-copy probe under pnpm reported DUPLICATE_AUTHORITY:\n${errOutput}`);
      }
      throw new Error(`duplicate-copy probe under pnpm failed with exit status ${pnpmProbeProc.status}:\n${errOutput}`);
    }
    assert(pnpmProbeProc.stdout.includes("duplicate-copy-probe:pass"), "duplicate-copy probe did not pass under pnpm");
  } finally {
    await rm(tempPnpmInstall, { recursive: true, force: true });
  }
}

export async function checkEvaluationKit({ kitDir: existingKitDir, plantDuplicateCore = false } = {}) {
  await assertOutsideRepository(tmpdir());

  let kitDir = existingKitDir;
  let cleanupKit = false;

  if (!kitDir) {
    const built = await buildEvaluationKit({ mode: "verification" });
    kitDir = built.kitDir;
    cleanupKit = true;
  }

  const tempInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-eval-install-"));
  try {
    // 1. Verify identity
    const { identity } = await verifyKitIdentity(kitDir);

    // 2. Determinism check: packing same packages produces identical digests
    if (!existingKitDir) {
      await checkDeterminism(identity);
    }

    // 3. Install kit with npm outside any workspace root
    await cp(kitDir, tempInstall, { recursive: true });

    runChecked(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"],
      { cwd: tempInstall, capture: true },
    );

    // 4. Verify single core copy in npm install (and fail closed if planted duplicate)
    await verifyDuplicateCoreProbe(tempInstall, plantDuplicateCore);

    // 5. Type-check examples and doc blocks in the installed kit with TypeScript matrix (5.9.2, 6.0.x, 7.0.x) under strict settings
    await typecheckExamples(tempInstall);

    // 6. Run examples/first-event.ts
    const firstEventScript = resolve(tempInstall, "examples/first-event.ts");
    assert(existsSync(firstEventScript), "examples/first-event.ts missing from installed kit");

    const output = runChecked(process.execPath, ["--no-warnings", "examples/first-event.ts"], {
      cwd: tempInstall,
      capture: true,
    });
    assert(output.includes("first-event:pass"), `examples/first-event.ts did not succeed:\n${output}`);

    // 7. Run example-receiver and example-service end to end over loopback HTTP
    await verifyHttpExchange(tempInstall);

    // 8. Drive HTTP sink failure paths and lifecycle transitions from installed kit against controllable loopback peer
    await verifyFailurePaths(tempInstall);

    // 9. Install kit with pinned pnpm version outside workspace root, run one-event script and duplicate-copy probe
    await verifyPnpmInstall(kitDir);

    process.stdout.write(
      "evaluation kit verification passed: kit built, identity verified, installed outside workspace with npm and pnpm, doc blocks and examples type-checked across TypeScript matrix (5.9.2, 6.0.3, 7.0.2), single core copy verified, events emitted and verified over HTTP, failure paths verified\n",
    );
    return { success: true };
  } finally {
    await rm(tempInstall, { recursive: true, force: true });
    if (cleanupKit && kitDir) {
      await rm(kitDir, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let kitDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--kit-dir" && args[i + 1]) kitDir = args[++i];
  }
  await checkEvaluationKit({ kitDir });
}
