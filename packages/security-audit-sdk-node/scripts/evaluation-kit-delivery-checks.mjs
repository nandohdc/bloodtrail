import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
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
export function startLoopbackServer({ script, cwd, label }) {
  const child = spawn(process.execPath, ["--no-warnings", script, "0"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
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

// For each demonstrated event, the bytes the receiver printed as received must equal, exactly, the bytes
// the service printed as validated by the SDK. Returns each received event, parsed, by name.
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
      `${name}: the bytes the receiver received differ from the bytes the SDK validated:\nvalidated ${sent.raw}\nreceived  ${arrived.raw}`,
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
}

async function assertReceiverHealthCounts(origin) {
  const health = await (await fetch(`${origin}/health`)).json();
  assert(health.status === "healthy", `receiver unhealthy: ${JSON.stringify(health.status)}`);
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

/**
 * Runs the example service against the example receiver over loopback, in the installed kit. Every
 * demonstrated event must be accepted, and must arrive as exactly the bytes the SDK validated.
 */
export async function verifyHttpExchange(installDir) {
  const receiverScript = resolve(installDir, "examples/evaluation-receiver.ts");
  const serviceScript = resolve(installDir, "examples/evaluation-service.ts");
  assert(existsSync(receiverScript) && existsSync(serviceScript), "the installed kit must contain the example service and receiver");

  const receiver = startLoopbackServer({ script: receiverScript, cwd: installDir, label: "receiver" });
  try {
    const origin = await receiver.origin;
    const serviceOutput = runChecked(process.execPath, ["--no-warnings", serviceScript, origin], {
      cwd: installDir,
      capture: true,
    });
    for (const marker of SERVICE_MARKERS) {
      assert(serviceOutput.includes(marker), `evaluation-service did not report ${marker}:\n${serviceOutput}`);
    }
    await waitForReceivedEvents(receiver.readOutput);
    assertDemonstratedSemantics(assertDeliveredBytesIdentical(serviceOutput, receiver.readOutput()));
    await assertReceiverHealthCounts(origin);
  } finally {
    receiver.child.kill("SIGTERM");
  }
}
