import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { assert, runChecked } from "./verification-helpers.mjs";

// The five events the example service demonstrates, each emitted once and delivered to the receiver.
const DEMONSTRATED_EVENTS = Object.freeze([
  "bloodtrail.audit.authentication.failed",
  "bloodtrail.audit.authentication.succeeded",
  "bloodtrail.audit.authorization.denied",
  "bloodtrail.audit.data.sensitive_resource.modified",
  "bloodtrail.audit.data.sensitive_resource.viewed",
]);

// What the service proves on its own besides emitting the events, which the byte comparison covers.
const SERVICE_MARKERS = Object.freeze([
  "service:context-survives-await:pass",
  "service:direct-commit-prevented:pass",
  "service:operation-commit:pass",
]);

const VALIDATED_LINE = /^service:validated (.+)$/gm;
const RECEIVED_LINE = /^receiver:accepted (\S+) (.+)$/gm;
const READY_TIMEOUT_MS = 10000;
const OUTPUT_TIMEOUT_MS = 10000;

/**
 * Starts a loopback server script with the current Node, and resolves with its origin once it prints
 * `<label>:ready <origin>`. Returns the child, its output so far, and the origin promise.
 */
export function startLoopbackServer({ script, cwd, label, args = [] }) {
  const child = spawn(process.execPath, ["--no-warnings", script, "0", ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const chunks = [];
  const readOutput = () => chunks.join("");
  const readyLine = new RegExp(String.raw`${label}:ready\s+(http://127\.0\.0\.1:\d+)`);
  const ready = new Promise((resolveReady, rejectReady) => {
    child.stdout.on("data", (chunk) => {
      chunks.push(chunk.toString("utf8"));
      const match = readyLine.exec(readOutput());
      if (match) resolveReady(match[1]);
    });
    child.stderr.on("data", (chunk) => chunks.push(chunk.toString("utf8")));
    child.on("error", rejectReady);
    child.on("exit", (code) => rejectReady(new Error(`${label} exited early with code ${code}:\n${readOutput()}`)));
  });
  const timeout = delay(READY_TIMEOUT_MS).then(() => {
    throw new Error(`timed out waiting for ${label} to be ready`);
  });
  return { child, readOutput, origin: Promise.race([ready, timeout]) };
}

// One record per event line: the exact text, which is the bytes of one event, and the event it parses to.
function eventRecords(lines, label) {
  const byName = new Map();
  for (const { raw, acknowledgedId } of lines) {
    const event = JSON.parse(raw);
    assert(!byName.has(event.event.name), `${label} printed ${event.event.name} more than once`);
    byName.set(event.event.name, { raw, event, acknowledgedId });
  }
  assert(
    byName.size === DEMONSTRATED_EVENTS.length,
    `${label} must print exactly the ${DEMONSTRATED_EVENTS.length} demonstrated events, got ${byName.size}`,
  );
  return byName;
}

// For each demonstrated event, the bytes the receiver received must equal the bytes the SDK handed to the
// HTTP audit sink. Returns each received event, parsed, by name.
function assertDeliveredBytesIdentical(serviceOutput, receiverOutput) {
  const validated = eventRecords([...serviceOutput.matchAll(VALIDATED_LINE)].map(([, raw]) => ({ raw })), "the service");
  const receivedLines = [...receiverOutput.matchAll(RECEIVED_LINE)].map(([, acknowledgedId, raw]) => ({ raw, acknowledgedId }));
  const received = eventRecords(receivedLines, "the receiver");
  const events = new Map();
  for (const name of DEMONSTRATED_EVENTS) {
    const sent = validated.get(name);
    const arrived = received.get(name);
    assert(sent && arrived, `${name} must be validated by the service and accepted by the receiver`);
    assert(
      arrived.raw === sent.raw,
      `${name}: the bytes the receiver received differ from the bytes the SDK handed to the HTTP audit sink:\nhanded   ${sent.raw}\nreceived ${arrived.raw}`,
    );
    assert(
      arrived.acknowledgedId === arrived.event.event.id,
      `${name}: the receiver acknowledged ${arrived.acknowledgedId}, not ${arrived.event.event.id}`,
    );
    events.set(name, arrived.event);
  }
  return events;
}

// The semantic assertions the end-to-end run makes, taken from the events as the receiver received them.
function assertDemonstratedSemantics(events) {
  const denied = events.get("bloodtrail.audit.authorization.denied");
  assert(denied.actor.id === "actor-eval-scoped-user", "authorization.denied must carry the scoped actor");
  assert(denied.tenant.effective_tenant_id === "tenant-eval-scoped", "authorization.denied must carry the scoped tenant");
  const modified = events.get("bloodtrail.audit.data.sensitive_resource.modified");
  assert(modified.event.commit_state === "committed", "the modification's commit state must come from the committed operation handle");
  assert(modified.correlation.operation_id === "22222222-2222-4222-8222-000000000301", "the modification must carry its operation identifier");
  const authFailed = events.get("bloodtrail.audit.authentication.failed");
  assert(authFailed.actor.type === "anonymous", "authentication.failed must use an anonymous actor");
  assert(!authFailed.actor.id, "authentication.failed must never use an authenticated actor");
}

const HEALTH_FIELDS = Object.freeze(["acceptedCount", "duplicateCount", "rejectedCount", "status"]);

// The health endpoint reports status and counts only, never an event body.
async function receiverHealth(origin) {
  const health = await (await fetch(`${origin}/health`)).json();
  assert(
    JSON.stringify(Object.keys(health).sort((a, b) => a.localeCompare(b))) === JSON.stringify(HEALTH_FIELDS),
    `the receiver's health endpoint must report ${HEALTH_FIELDS.join(", ")} only, got ${Object.keys(health).join(", ")}`,
  );
  assert(health.status === "healthy", `receiver unhealthy: ${JSON.stringify(health.status)}`);
  for (const field of HEALTH_FIELDS.filter((name) => name !== "status")) {
    assert(Number.isInteger(health[field]), `the receiver's ${field} must be a count`);
  }
  return health;
}

async function assertReceiverHealthCounts(origin) {
  const health = await receiverHealth(origin);
  assert(
    health.acceptedCount === DEMONSTRATED_EVENTS.length,
    `the receiver must count ${DEMONSTRATED_EVENTS.length} accepted events, got ${health.acceptedCount}`,
  );
}

// The receiver prints asynchronously, so its output can trail the service's last request.
async function waitForReceivedEvents(readOutput) {
  const deadline = Date.now() + OUTPUT_TIMEOUT_MS;
  while ([...readOutput().matchAll(RECEIVED_LINE)].length < DEMONSTRATED_EVENTS.length) {
    assert(Date.now() < deadline, `timed out waiting for the receiver to print ${DEMONSTRATED_EVENTS.length} accepted events:\n${readOutput()}`);
    await delay(50);
  }
}

function hasCompleteServiceOutput(output) {
  const validatedCount = [...output.matchAll(VALIDATED_LINE)].length;
  if (validatedCount < DEMONSTRATED_EVENTS.length) return false;
  if (!SERVICE_MARKERS.every((marker) => output.includes(marker))) return false;
  const outcomeCount = [...output.matchAll(/^service:outcome (\S+) (\S+) (\S+)$/gm)].length;
  return outcomeCount >= DEMONSTRATED_EVENTS.length;
}

// The service also prints asynchronously, so its output can trail the driver's completion.
async function waitForServiceOutput(readOutput) {
  const deadline = Date.now() + OUTPUT_TIMEOUT_MS;
  while (!hasCompleteServiceOutput(readOutput())) {
    assert(Date.now() < deadline, `timed out waiting for the service to print all validated events and markers:\n${readOutput()}`);
    await delay(50);
  }
}

const SUBMISSION_PATH = "/v1/security-audit";
const FIXTURE_TOKEN = "fixture-token-a";
// Far past the receiver's bound, so a receiver that buffered the whole body could not answer before the
// client had sent it all.
const OVERSIZED_BODY_BYTES = 64 * 1024 * 1024;
const PROBE_CHUNK_BYTES = 64 * 1024;
const POST_ANSWER_CLOSE_LIMIT_MS = 2000;
const POST_ANSWER_WRITE_WINDOW_MS = 3000;
// This covers loopback socket buffers with room to spare, against the gigabytes a draining receiver takes.
const POST_ANSWER_ACCEPT_LIMIT_BYTES = 16 * 1024 * 1024;

// A receiver that has stopped answering fails here, whichever request it stopped on.
async function submit(origin, body, token = FIXTURE_TOKEN) {
  try {
    const response = await fetch(`${origin}${SUBMISSION_PATH}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body,
    });
    return { status: response.status, text: await response.text() };
  } catch (err) {
    throw new Error(`the receiver must keep serving: ${err.message}`);
  }
}

function assertAcknowledged(reply, eventId, label) {
  assert(reply.status >= 200 && reply.status < 300, `${label}: expected 2xx, got ${reply.status} ${reply.text}`);
  const { acknowledgments } = JSON.parse(reply.text);
  assert(
    acknowledgments.length === 1 && acknowledgments[0].event_id === eventId && acknowledgments[0].outcome === "accepted",
    `${label}: expected exactly one accepted acknowledgment for ${eventId}, got ${reply.text}`,
  );
}

function assertRejected(reply, status, label) {
  assert(reply.status === status, `${label}: expected ${status}, got ${reply.status} ${reply.text}`);
}

function connectToReceiver(origin) {
  const endpoint = new URL(origin);
  return new Promise((resolveSocket, rejectSocket) => {
    const socket = connect({ host: endpoint.hostname, port: Number(endpoint.port) });
    const rejectConnection = (error) => rejectSocket(error);
    socket.once("error", rejectConnection);
    socket.once("connect", () => {
      socket.off("error", rejectConnection);
      resolveSocket(socket);
    });
  });
}

function oversizedSubmissionHeaders(origin, token) {
  const endpoint = new URL(origin);
  return [
    `POST ${SUBMISSION_PATH} HTTP/1.1`,
    `Host: ${endpoint.host}`,
    `authorization: Bearer ${token}`,
    "content-type: application/json",
    `Content-Length: ${OVERSIZED_BODY_BYTES}`,
    "",
    "",
  ].join("\r\n");
}

// Counts a chunk only after Node writes it to the socket, and waits for drain when the write applied backpressure.
function writeProbeChunk(socket, chunk) {
  if (socket.destroyed) return Promise.resolve(false);
  return new Promise((resolveWrite) => {
    let callbackFinished = false;
    let drained = true;
    let resolved = false;
    const resolveOnce = (result) => {
      if (resolved) return;
      resolved = true;
      socket.off("close", onClose);
      socket.off("drain", onDrain);
      resolveWrite(result);
    };
    const onClose = () => resolveOnce(false);
    const onDrain = () => {
      drained = true;
      if (callbackFinished) resolveOnce(true);
    };
    socket.once("close", onClose);
    const accepted = socket.write(chunk, () => {
      callbackFinished = true;
      if (drained) resolveOnce(true);
    });
    if (!accepted) {
      drained = false;
      socket.once("drain", onDrain);
    }
  });
}

function statusFromResponse(buffer) {
  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd === -1) return null;
  const match = /^HTTP\/1\.\d (\d{3})/.exec(buffer.slice(0, lineEnd));
  return match ? Number(match[1]) : null;
}

function recordProbeStatus(probe, data) {
  if (probe.status !== null) return;
  probe.responseBuffer += data.toString("utf8");
  const receivedStatus = statusFromResponse(probe.responseBuffer);
  if (receivedStatus === null) return;
  probe.status = receivedStatus;
  probe.answeredAt = Date.now();
}

function observeProbeSocket(socket) {
  const probe = { answeredAt: null, closedAt: null, responseBuffer: "", socketError: null, status: null };
  socket.on("data", (data) => recordProbeStatus(probe, data));
  socket.on("close", () => {
    probe.closedAt = Date.now();
  });
  socket.on("error", (error) => {
    probe.socketError = error;
  });
  return probe;
}

async function writeUntilResponse(socket, chunk, probe) {
  for (let written = 0; written < OVERSIZED_BODY_BYTES; written += chunk.byteLength) {
    if (!(await writeProbeChunk(socket, chunk))) return;
    await delay(1);
    if (probe.status !== null) return;
  }
}

async function writeAfterResponse(socket, chunk, probe) {
  let accepted = 0;
  const writeUntil = probe.answeredAt + POST_ANSWER_WRITE_WINDOW_MS;
  while (!socket.destroyed && Date.now() < writeUntil) {
    if (!(await writeProbeChunk(socket, chunk))) return accepted;
    accepted += chunk.byteLength;
  }
  return accepted;
}

function assertProbeResponded(probe) {
  const cause = probe.socketError ? probe.socketError.message : "no status line";
  assert(probe.status !== null, `the receiver closed before answering an oversized body: ${cause}`);
}

function answerToCloseMilliseconds(probe) {
  return probe.closedAt === null ? Infinity : probe.closedAt - probe.answeredAt;
}

// Probes a receiver with a raw body stream, including writes it accepts after its response has arrived.
async function probeOversizedBody(origin, token) {
  const socket = await connectToReceiver(origin);
  const chunk = Buffer.alloc(PROBE_CHUNK_BYTES, 0x20);
  const probe = observeProbeSocket(socket);
  socket.write(oversizedSubmissionHeaders(origin, token));
  await writeUntilResponse(socket, chunk, probe);
  assertProbeResponded(probe);
  const bytesAcceptedAfterAnswer = await writeAfterResponse(socket, chunk, probe);
  const answerToCloseMs = answerToCloseMilliseconds(probe);
  socket.destroy();
  return { status: probe.status, bytesAcceptedAfterAnswer, answerToCloseMs };
}

function assertBoundedPostAnswer(probe, expectedStatus) {
  assert(probe.status === expectedStatus, `an oversized submission: expected ${expectedStatus}, got ${probe.status}`);
  assert(
    probe.answerToCloseMs <= POST_ANSWER_CLOSE_LIMIT_MS,
    `the receiver kept the connection open after answering ${expectedStatus}`,
  );
  assert(
    probe.bytesAcceptedAfterAnswer <= POST_ANSWER_ACCEPT_LIMIT_BYTES,
    `the receiver accepted ${probe.bytesAcceptedAfterAnswer} bytes after answering ${expectedStatus}, more than ${POST_ANSWER_ACCEPT_LIMIT_BYTES}`,
  );
}

function withEventId(event, id) {
  const copy = structuredClone(event);
  copy.event.id = id;
  return copy;
}

async function importInstalled(installDir, packageName) {
  const packageDir = resolve(installDir, "node_modules", packageName);
  const manifest = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
  return import(pathToFileURL(resolve(packageDir, manifest.exports["."].import)).href);
}

// The installed SDK redelivers a byte-identical copy of an event the receiver has accepted: the receiver
// must acknowledge it, so the SDK returns an ok result.
async function assertRedeliveryAcknowledged(installDir, origin, event) {
  const { createHttpAuditSink, createNodeSecurityAuditSdk } = await importInstalled(installDir, "@bloodtrail/security-audit-sdk-node");
  const sdk = createNodeSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "evaluation-service", version: "0.1.0" },
    environment: { name: "synthetic" },
    service: { name: "evaluation-service" },
    sink: createHttpAuditSink({ origin, path: SUBMISSION_PATH, timeoutMs: 5000, headers: { authorization: `Bearer ${FIXTURE_TOKEN}` } }),
  });
  try {
    const result = await sdk.redeliver(event);
    assert(
      result.ok && result.value.status === "accepted",
      `sdk.redeliver of an accepted event must return an ok result, got ${JSON.stringify(result)}`,
    );
  } finally {
    await sdk.shutdown();
  }
}

/**
 * Proves the example receiver behaves as a careful ingress. Each rejection gets the status that names it,
 * and the next valid event is accepted after it. A duplicate is acknowledged, and a conflict is refused.
 * `events` are the demonstrated events the receiver has already accepted, parsed, by name.
 */
async function verifyCarefulIngress(installDir, origin, events) {
  const template = events.get("bloodtrail.audit.authentication.succeeded");
  const assertStillServing = async (after) => {
    const next = withEventId(template, randomUUID());
    assertAcknowledged(await submit(origin, JSON.stringify(next)), next.event.id, `the next valid event after ${after}`);
  };

  const unauthenticated = await submit(origin, JSON.stringify(withEventId(template, randomUUID())), "not-a-fixture-token");
  assertRejected(unauthenticated, 401, "an unauthenticated submission");
  assert(unauthenticated.text === JSON.stringify({ error: "unauthenticated" }), `a 401 must reveal nothing about the body, got ${unauthenticated.text}`);
  await assertStillServing("a 401");

  const unauthenticatedOversized = await probeOversizedBody(origin, "not-a-fixture-token");
  assertBoundedPostAnswer(unauthenticatedOversized, 401);
  await assertStillServing("an oversized unauthenticated submission");

  const oversized = await probeOversizedBody(origin, FIXTURE_TOKEN);
  assertBoundedPostAnswer(oversized, 413);
  await assertStillServing("a 413");

  assertRejected(await submit(origin, '{"event":'), 400, "a malformed body");
  await assertStillServing("a 400");

  const reusedId = randomUUID();
  const invalid = withEventId(template, reusedId);
  delete invalid.actor;
  assertRejected(await submit(origin, JSON.stringify(invalid)), 422, "an SDK-invalid event");
  assertAcknowledged(await submit(origin, JSON.stringify(withEventId(template, reusedId))), reusedId, "the corrected event with the SDK-invalid event's identity");

  const admitted = events.get("bloodtrail.audit.authentication.failed");
  const conflicting = structuredClone(admitted);
  conflicting.service.name = "conflicting-service";
  assertRejected(await submit(origin, JSON.stringify(conflicting)), 409, "an event that conflicts with an admitted event");
  await assertStillServing("a 409");

  const denied = events.get("bloodtrail.audit.authorization.denied");
  assertAcknowledged(await submit(origin, JSON.stringify(denied)), denied.event.id, "a byte-identical duplicate");
  await assertRedeliveryAcknowledged(installDir, origin, events.get("bloodtrail.audit.data.sensitive_resource.viewed"));
  await assertStillServing("the duplicates");

  await receiverHealth(origin);
}

/**
 * Runs the example service against the example receiver over loopback, in the installed kit. Every
 * demonstrated event must be accepted, and the bytes the receiver received must equal the bytes the SDK
 * handed to the HTTP audit sink. Then the
 * receiver must behave as a careful ingress.
 */
export async function verifyHttpExchange(installDir) {
  const receiverScript = resolve(installDir, "examples/evaluation-receiver.ts");
  const serviceScript = resolve(installDir, "examples/evaluation-service.ts");
  const driverScript = resolve(installDir, "examples/evaluation-driver.ts");
  assert(
    existsSync(receiverScript) && existsSync(serviceScript) && existsSync(driverScript),
    "the installed kit must contain the example service, receiver, and driver",
  );

  const receiver = startLoopbackServer({ script: receiverScript, cwd: installDir, label: "receiver" });
  try {
    const receiverOrigin = await receiver.origin;
    const service = startLoopbackServer({
      script: serviceScript,
      cwd: installDir,
      label: "service",
      args: [receiverOrigin],
    });
    try {
      const serviceOrigin = await service.origin;
      const driverOutput = runChecked(process.execPath, ["--no-warnings", driverScript, serviceOrigin], {
        cwd: installDir,
        capture: true,
      });
      assert(driverOutput.includes("driver:completed"), `driver did not complete:\n${driverOutput}`);
      await waitForReceivedEvents(receiver.readOutput);
      await waitForServiceOutput(service.readOutput);
      for (const marker of SERVICE_MARKERS) {
        assert(service.readOutput().includes(marker), `evaluation-service did not report ${marker}:\n${service.readOutput()}`);
      }
      const events = assertDeliveredBytesIdentical(service.readOutput(), receiver.readOutput());
      assertDemonstratedSemantics(events);

      // Verify onOutcome reports were logged with eventId, outcome, and status only
      const outcomes = [...service.readOutput().matchAll(/^service:outcome (\S+) (\S+) (\S+)$/gm)];
      assert(
        outcomes.length === DEMONSTRATED_EVENTS.length,
        `service must log onOutcome for all ${DEMONSTRATED_EVENTS.length} events, got ${outcomes.length}`,
      );

      await assertReceiverHealthCounts(receiverOrigin);
      await verifyCarefulIngress(installDir, receiverOrigin, events);
    } finally {
      service.child.kill("SIGTERM");
    }
  } finally {
    receiver.child.kill("SIGTERM");
  }
}
