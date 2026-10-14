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
  const response = await fetch(`${origin}/health`);
  assert(response.status === 200, `receiver health: expected 200, got ${response.status}`);
  const health = await response.json();
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
// A path the receiver must refuse: a POST to it is not a submission, however valid the event.
const WRONG_PATH = "/v1/not-the-submission-path";
const FIXTURE_TOKEN = "fixture-token-a";
// Declared far past the receiver's bound. The probe sends the body only one chunk past the bound before the
// answer, so a receiver that waits for the whole declared body never answers.
const OVERSIZED_BODY_BYTES = 64 * 1024 * 1024;
const PROBE_CHUNK_BYTES = 64 * 1024;
const ANSWER_TIMEOUT_MS = 10000;
const POST_ANSWER_CLOSE_LIMIT_MS = 2000;
const POST_ANSWER_WRITE_WINDOW_MS = 3000;
// This covers loopback socket buffers with room to spare, against the gigabytes a draining receiver takes.
const POST_ANSWER_ACCEPT_LIMIT_BYTES = 16 * 1024 * 1024;

// A string is the bearer token; an options object can instead send an arbitrary authorization value, path,
// or method. The default is an authenticated POST to the submission path.
function submissionOptions(tokenOrOptions) {
  if (typeof tokenOrOptions === "string") {
    return { path: SUBMISSION_PATH, method: "POST", authorization: `Bearer ${tokenOrOptions}` };
  }
  return { path: SUBMISSION_PATH, method: "POST", authorization: `Bearer ${FIXTURE_TOKEN}`, ...tokenOrOptions };
}

// A receiver that has stopped answering fails here, whichever request it stopped on.
async function submit(origin, body, tokenOrOptions = FIXTURE_TOKEN) {
  const options = submissionOptions(tokenOrOptions);
  try {
    const response = await fetch(`${origin}${options.path}`, {
      method: options.method,
      headers: { authorization: options.authorization, "content-type": "application/json" },
      body,
    });
    return { status: response.status, text: await response.text(), headers: response.headers };
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

// Starts a submission with a declared 1000-byte body, writes ten bytes of it, and destroys the socket: a
// client abort mid-body, from the receiver's side of the connection.
async function abortSubmission(origin) {
  const endpoint = new URL(origin);
  const socket = await connectToReceiver(origin);
  socket.write(
    [
      `POST ${SUBMISSION_PATH} HTTP/1.1`,
      `Host: ${endpoint.host}`,
      `authorization: Bearer ${FIXTURE_TOKEN}`,
      "content-type: application/json",
      "Content-Length: 1000",
      "",
      "",
    ].join("\r\n"),
  );
  socket.write('{"event":{', () => socket.destroy());
}

// The receiver logs an abort after the connection reset, which is asynchronous to the driver.
async function waitForAbortLog(readOutput, outputStart) {
  const deadline = Date.now() + 2000;
  while (!readOutput().slice(outputStart).includes("receiver:aborted")) {
    assert(
      Date.now() < deadline,
      `a client abort: the receiver did not log receiver:aborted within 2 s:\n${readOutput().slice(outputStart)}`,
    );
    await delay(10);
  }
}

function oversizedSubmissionHeaders(origin, token, path) {
  const endpoint = new URL(origin);
  return [
    `POST ${path} HTTP/1.1`,
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

// Writes until the body is one chunk past the bound, then stops. A receiver that answers then closes with the
// rest of the body unread resets the connection, and a write issued after that reset fails with EPIPE, which
// makes Node discard the answer before the probe has read it.
async function writePastBound(socket, chunk, bound) {
  for (let written = 0; written <= bound; written += chunk.byteLength) {
    if (!(await writeProbeChunk(socket, chunk))) return;
  }
}

async function awaitAnswer(probe) {
  const deadline = Date.now() + ANSWER_TIMEOUT_MS;
  while (probe.status === null && probe.closedAt === null) {
    if (Date.now() >= deadline) return;
    await delay(1);
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

function unansweredCause(probe) {
  if (probe.socketError) return probe.socketError.message;
  return probe.closedAt === null ? `no answer within ${ANSWER_TIMEOUT_MS} ms` : "closed with no status line";
}

function assertProbeResponded(probe) {
  assert(probe.status !== null, `the receiver did not answer an oversized body: ${unansweredCause(probe)}`);
}

function answerToCloseMilliseconds(probe) {
  return probe.closedAt === null ? Infinity : probe.closedAt - probe.answeredAt;
}

// Probes a receiver with a raw body stream, including writes it accepts after its response has arrived.
// `bound` is the body size the receiver enforces, and `path` the POST's target.
async function probeOversizedBody(origin, token, bound, path) {
  const socket = await connectToReceiver(origin);
  try {
    const chunk = Buffer.alloc(PROBE_CHUNK_BYTES, 0x20);
    const probe = observeProbeSocket(socket);
    socket.write(oversizedSubmissionHeaders(origin, token, path));
    await writePastBound(socket, chunk, bound);
    await awaitAnswer(probe);
    assertProbeResponded(probe);
    const bytesAcceptedAfterAnswer = await writeAfterResponse(socket, chunk, probe);
    const answerToCloseMs = answerToCloseMilliseconds(probe);
    return { status: probe.status, bytesAcceptedAfterAnswer, answerToCloseMs };
  } finally {
    socket.destroy();
  }
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
 * `events` are the demonstrated events the receiver has already accepted, parsed, by name. The SDK-invalid
 * probe passes the ingress's structural check and fails SDK validation, so the 422 pins the rejection to the
 * receiver's SDK validation, and `receiverReadOutput` records the receiver's own log of that rejection.
 * verifyStrictRouting then proves only the Bearer scheme authenticates, only a POST to the submission path
 * is a submission, any other method is refused with Allow: POST, and the read rule holds for refused routes
 * too; verifyAbortIsNotARejection proves a client abort is counted as neither a 500 nor a rejection.
 */
async function verifyCarefulIngress(installDir, origin, events, receiverReadOutput) {
  const template = events.get("bloodtrail.audit.authentication.succeeded");
  const assertStillServing = async (after) => {
    const next = withEventId(template, randomUUID());
    assertAcknowledged(await submit(origin, JSON.stringify(next)), next.event.id, `the next valid event after ${after}`);
  };

  const unauthenticated = await submit(origin, JSON.stringify(withEventId(template, randomUUID())), "not-a-fixture-token");
  assertRejected(unauthenticated, 401, "an unauthenticated submission");
  assert(unauthenticated.text === JSON.stringify({ error: "unauthenticated" }), `a 401 must reveal nothing about the body, got ${unauthenticated.text}`);
  await assertStillServing("a 401");

  const { EVENT_MAX_BYTES } = await importInstalled(installDir, "@bloodtrail/security-audit-collector");
  assert(Number.isSafeInteger(EVENT_MAX_BYTES) && EVENT_MAX_BYTES > 0, "the installed collector must export its EVENT_MAX_BYTES bound");
  const unauthenticatedOversized = await probeOversizedBody(origin, "not-a-fixture-token", EVENT_MAX_BYTES, SUBMISSION_PATH);
  assertBoundedPostAnswer(unauthenticatedOversized, 401);
  await assertStillServing("an oversized unauthenticated submission");

  const oversized = await probeOversizedBody(origin, FIXTURE_TOKEN, EVENT_MAX_BYTES, SUBMISSION_PATH);
  assertBoundedPostAnswer(oversized, 413);
  await assertStillServing("a 413");

  assertRejected(await submit(origin, '{"event":'), 400, "a malformed body");
  await assertStillServing("a 400");

  const denied = events.get("bloodtrail.audit.authorization.denied");
  const reusedId = randomUUID();
  const invalid = withEventId(denied, reusedId);
  invalid.authorization.decision = "allow";
  // Prove the probe mechanically before submitting it: the installed collector admits it structurally, and
  // the installed core rejects it with the authorization-outcome conflict.
  const { validateStructural } = await importInstalled(installDir, "@bloodtrail/security-audit-collector");
  const { validateSecurityAuditEvent } = await importInstalled(installDir, "@bloodtrail/security-audit-sdk-core");
  const structural = validateStructural(invalid);
  assert(
    structural.valid === true,
    `the SDK-invalid probe must pass the ingress's structural check, got ${JSON.stringify(structural)}`,
  );
  const sdkValidation = validateSecurityAuditEvent(invalid);
  assert(
    sdkValidation.ok === false && sdkValidation.error.code === "AUTHORIZATION_OUTCOME_CONFLICT" && sdkValidation.error.path === "/authorization/decision",
    `the SDK-invalid probe must fail SDK validation with AUTHORIZATION_OUTCOME_CONFLICT at /authorization/decision, got ${JSON.stringify(sdkValidation)}`,
  );
  assertRejected(await submit(origin, JSON.stringify(invalid)), 422, "an SDK-invalid event");
  assert(
    receiverReadOutput().includes("receiver:invalid AUTHORIZATION_OUTCOME_CONFLICT /authorization/decision"),
    `the receiver must log the SDK validation that rejected the probe:\n${receiverReadOutput()}`,
  );
  assertAcknowledged(await submit(origin, JSON.stringify(withEventId(denied, reusedId))), reusedId, "the corrected event with the SDK-invalid event's identity");

  const admitted = events.get("bloodtrail.audit.authentication.failed");
  const conflicting = structuredClone(admitted);
  conflicting.service.name = "conflicting-service";
  assertRejected(await submit(origin, JSON.stringify(conflicting)), 409, "an event that conflicts with an admitted event");
  await assertStillServing("a 409");

  assertAcknowledged(await submit(origin, JSON.stringify(denied)), denied.event.id, "a byte-identical duplicate");
  await assertRedeliveryAcknowledged(installDir, origin, events.get("bloodtrail.audit.data.sensitive_resource.viewed"));
  await assertStillServing("the duplicates");

  await verifyStrictRouting(origin, template, EVENT_MAX_BYTES, assertStillServing);
  await verifyAbortIsNotARejection(origin, receiverReadOutput, assertStillServing);
}

// The strict-routing cases: only the Bearer scheme authenticates, only a POST to the submission path is a
// submission, any other method is refused with Allow: POST, and the read rule covers a refused route too.
async function verifyStrictRouting(origin, template, eventMaxBytes, assertStillServing) {
  // Strict authentication: only the Bearer scheme authenticates, and its letter case does not matter.
  const bareToken = await submit(origin, JSON.stringify(withEventId(template, randomUUID())), { authorization: FIXTURE_TOKEN });
  assertRejected(bareToken, 401, "a bare token");
  assert(
    bareToken.text === JSON.stringify({ error: "unauthenticated" }),
    `a bare token: expected {"error":"unauthenticated"}, got ${bareToken.text}`,
  );
  await assertStillServing("a bare token");

  const lowerCaseScheme = withEventId(template, randomUUID());
  assertAcknowledged(
    await submit(origin, JSON.stringify(lowerCaseScheme), { authorization: `bearer ${FIXTURE_TOKEN}` }),
    lowerCaseScheme.event.id,
    "a lowercase bearer scheme",
  );
  await assertStillServing("a lowercase bearer scheme");

  const upperCaseScheme = withEventId(template, randomUUID());
  assertAcknowledged(
    await submit(origin, JSON.stringify(upperCaseScheme), { authorization: `BEARER ${FIXTURE_TOKEN}` }),
    upperCaseScheme.event.id,
    "an uppercase bearer scheme",
  );
  await assertStillServing("an uppercase bearer scheme");

  // Strict routing: a POST to another path is refused and admits nothing, and the same event is then accepted.
  const healthBeforeWrongPath = await receiverHealth(origin);
  const wrongPath = withEventId(template, randomUUID());
  const wrongPathReply = await submit(origin, JSON.stringify(wrongPath), { path: WRONG_PATH });
  assert(
    wrongPathReply.status === 404,
    `a POST to another path admitted an event: expected 404, got ${wrongPathReply.status} ${wrongPathReply.text}`,
  );
  assert(
    wrongPathReply.text === JSON.stringify({ error: "not_found" }),
    `a POST to another path: expected {"error":"not_found"}, got ${wrongPathReply.text}`,
  );
  assertAcknowledged(await submit(origin, JSON.stringify(wrongPath)), wrongPath.event.id, "the event a POST to another path refused");
  const healthAfterWrongPath = await receiverHealth(origin);
  assert(
    healthAfterWrongPath.acceptedCount === healthBeforeWrongPath.acceptedCount + 1,
    `a POST to another path admitted an event: acceptedCount rose from ${healthBeforeWrongPath.acceptedCount} to ${healthAfterWrongPath.acceptedCount}, not by exactly one`,
  );
  await assertStillServing("a POST to another path");

  // Strict routing: any other method on the submission path is refused with an Allow: POST header.
  for (const method of ["PUT", "GET"]) {
    const body = method === "GET" ? undefined : JSON.stringify(withEventId(template, randomUUID()));
    const methodReply = await submit(origin, body, { method });
    assert(methodReply.status === 405, `${method} on the submission path: expected 405, got ${methodReply.status} ${methodReply.text}`);
    assert(
      methodReply.headers.get("allow") === "POST",
      `${method} on the submission path: expected Allow: POST, got ${JSON.stringify(methodReply.headers.get("allow"))}`,
    );
    assert(
      methodReply.text === JSON.stringify({ error: "method_not_allowed" }),
      `${method} on the submission path: expected {"error":"method_not_allowed"}, got ${methodReply.text}`,
    );
    await assertStillServing(`${method} on the submission path`);
  }

  // The read rule covers a refused route too: past the bound, a POST to another path answers 404 and closes.
  const oversizedWrongPath = await probeOversizedBody(origin, FIXTURE_TOKEN, eventMaxBytes, WRONG_PATH);
  assertBoundedPostAnswer(oversizedWrongPath, 404);
  await assertStillServing("an oversized body on another path");
}

// A client abort mid-body is an abort: logged, answered nothing, and counted as neither a 500 nor a rejection.
async function verifyAbortIsNotARejection(origin, receiverReadOutput, assertStillServing) {
  const healthBeforeAbort = await receiverHealth(origin);
  const outputBeforeAbort = receiverReadOutput().length;
  await abortSubmission(origin);
  await waitForAbortLog(receiverReadOutput, outputBeforeAbort);
  const healthAfterAbort = await receiverHealth(origin);
  assert(
    healthAfterAbort.rejectedCount === healthBeforeAbort.rejectedCount,
    `a client abort was counted as a rejection: rejectedCount rose from ${healthBeforeAbort.rejectedCount} to ${healthAfterAbort.rejectedCount}`,
  );
  assert(
    !receiverReadOutput().slice(outputBeforeAbort).includes("receiver:error 500"),
    "a client abort was logged as a 500",
  );
  await assertStillServing("a client abort");

  await receiverHealth(origin);
}

// This receiver's ledger is exclusively for the capacity probe: no other probe may consume its identities.
async function verifyDeduplicationCapacity(installDir, template) {
  const receiver = startLoopbackServer({
    script: resolve(installDir, "examples/evaluation-receiver.ts"), cwd: installDir, label: "receiver",
  });
  try {
    const origin = await receiver.origin;
    const admitted = withEventId(template, randomUUID());
    const admittedBody = JSON.stringify(admitted);
    for (let index = 0; index < 32; index += 1) {
      const event = index === 0 ? admitted : withEventId(template, randomUUID());
      const reply = await submit(origin, JSON.stringify(event));
      assertRejected(reply, 200, `capacity admission ${index + 1}`);
      assertAcknowledged(reply, event.event.id, `capacity admission ${index + 1}`);
    }
    for (let refused = 0; refused < 2; refused += 1) {
      const reply = await submit(origin, JSON.stringify(withEventId(template, randomUUID())));
      assertRejected(reply, 429, "deduplication capacity");
      assert(reply.text === '{"error":"deduplication_capacity"}', `deduplication capacity: unexpected body ${reply.text}`);
      assert(reply.headers.get("retry-after") === null, "deduplication capacity must not send Retry-After");
    }
    const health = await receiverHealth(origin);
    assert(health.acceptedCount === 32 && health.rejectedCount === 2 && health.duplicateCount === 0,
      `capacity health counts: ${JSON.stringify(health)}`);
    const duplicate = await submit(origin, admittedBody);
    assertRejected(duplicate, 200, "duplicate at capacity");
    assertAcknowledged(duplicate, admitted.event.id, "duplicate at capacity");
    const afterDuplicate = await receiverHealth(origin);
    assert(afterDuplicate.acceptedCount === 32 && afterDuplicate.duplicateCount === 1 && afterDuplicate.rejectedCount === 2,
      `duplicate at capacity must not admit again: ${JSON.stringify(afterDuplicate)}`);
  } finally {
    receiver.child.kill("SIGTERM");
  }
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
      await verifyCarefulIngress(installDir, receiverOrigin, events, receiver.readOutput);
      await verifyDeduplicationCapacity(installDir, events.get("bloodtrail.audit.authentication.succeeded"));
    } finally {
      service.child.kill("SIGTERM");
    }
  } finally {
    receiver.child.kill("SIGTERM");
  }
}
