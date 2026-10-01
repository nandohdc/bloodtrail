// The HTTP audit sink (#589, #590, #591): the SDK's sink interface over the
// governed fetch adapter. These arms run through a real SDK and a loopback peer,
// so they show exactly what reaches the wire, what the SDK returns for it, what
// onOutcome reports, and how flush and shutdown wait for sends in flight.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { after, describe, it } from "node:test";
import { setImmediate, setTimeout } from "node:timers";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, inspect } from "node:util";
import {
  CONTRACT_VERSION,
  type AuditDeliveryResult,
  type AuditEventSink,
  type AuditResult,
  type SecurityAuditEvent,
  type SecurityAuditSdk,
} from "@bloodtrail/security-audit-sdk-core";
import {
  createFetchHttpExchange,
  createHttpAuditSink,
  createHttpDeliveryHandoff,
  createNodeSecurityAuditSdk,
  type HttpAuditSinkOptions,
  type HttpAuditSinkOutcome,
} from "../dist/index.js";

const PATH = "/v1/security-audit";
const VALID_OPTIONS = { origin: "http://127.0.0.1:8080", path: PATH, timeoutMs: 1_000 };
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(resolve(__dirname, "../../../contracts/security-audit/examples/positive/all-events.json"), "utf8"),
) as SecurityAuditEvent[];
const registrationCompleted = fixtures.find((event) => event.event.name === "bloodtrail.audit.account.registration.completed");
assert.ok(registrationCompleted);
// This event still validates with a non-zero retry_attempt, so the arms can
// prove the field reaches the wire exactly as the SDK validated it.
const retriedEvent: SecurityAuditEvent = {
  ...registrationCompleted,
  correlation: { ...registrationCompleted.correlation, retry_attempt: 3 },
};
const eventId = retriedEvent.event.id;

// Each status class, what the SDK returns for it, and the cause onOutcome reports.
const STATUS_CLASSES = [
  ...[400, 403, 404, 422].map((status) => ({ status, sdk: "SDK_SINK_REJECTED", outcome: "http_permanent" })),
  ...[408, 425, 429, 500, 503].map((status) => ({ status, sdk: "SDK_SINK_FAILURE", outcome: "http_retryable" })),
] as const;

// Callbacks that fail in each way a callback can, plus one that never settles.
const MISBEHAVING_CALLBACKS = {
  throws: () => {
    throw new Error("callback failure");
  },
  rejects: () => Promise.reject(new Error("callback failure")),
  "is async and throws": async () => {
    throw new Error("callback failure");
  },
  "never settles": () => new Promise<never>(() => undefined),
} satisfies Record<string, NonNullable<HttpAuditSinkOptions["onOutcome"]>>;

// The core's sink result for each handoff status, derived independently of the sink.
const SINK_STATUS_BY_HANDOFF_STATUS = {
  acknowledged: "accepted",
  non_retryable: "rejected",
  retryable: "unknown",
  protocol_error: "unknown",
} as const;

// Each way to flush. The core's interface declares the sink's own flush
// optional, so a missing one returns undefined.
const FLUSHES = {
  "the SDK's flush": async (sdk) => {
    assert.deepEqual(await sdk.flush(), { ok: true, value: undefined });
  },
  "the sink's flush": (_sdk, sink) => sink.flush?.(),
} satisfies Record<string, (sdk: SecurityAuditSdk, sink: AuditEventSink) => Promise<void> | undefined>;

const CONCURRENT_EMITS = 8;
const SHUT_DOWN = { status: "unknown", code: "shut_down" };

interface ReceivedRequest {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
  readonly bodyText: string;
}

type Handler = (request: IncomingMessage, body: string, response: ServerResponse) => void;

const servers: Server[] = [];
// A failed arm can leave a request held, so every connection is cut first.
after(() => Promise.all(servers.map((server) => new Promise<void>((done) => {
  server.closeAllConnections();
  server.close(() => done());
}))));

interface Peer {
  readonly origin: string;
  readonly received: ReceivedRequest[];
  readonly server: Server;
}

async function peer(handler: Handler): Promise<Peer> {
  const received: ReceivedRequest[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      const bodyText = body.toString("utf8");
      const url = request.url === PATH ? PATH : undefined;
      received.push({ method: request.method, url, headers: request.headers, body, bodyText });
      handler(request, bodyText, response);
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { origin: `http://127.0.0.1:${address.port}`, received, server };
}

interface HoldingPeer extends Peer {
  /** How many requests have arrived, each held until released. */
  held(): number;
  /** Answers the request that arrived at `index` with its exact acknowledgment. */
  release(index: number): void;
}

// Holds every request unanswered until the test releases it.
async function holdingPeer(): Promise<HoldingPeer> {
  const answers: Array<() => void> = [];
  const answer = acknowledge();
  const base = await peer((request, body, response) => {
    answers.push(() => answer(request, body, response));
  });
  return {
    ...base,
    held: () => answers.length,
    release(index) {
      const release = answers[index];
      assert.ok(release, `no request ${index} has arrived`);
      release();
    },
  };
}

function reply(status: number, body: unknown): Handler {
  return (_request, _body, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(typeof body === "string" ? body : JSON.stringify(body));
  };
}

function acknowledge(): Handler {
  return (request, body, response) => {
    const event = JSON.parse(body) as SecurityAuditEvent;
    reply(202, { acknowledgments: [{ event_id: event.event.id, outcome: "accepted" }] })(request, body, response);
  };
}

// Answers only after the given delay, which outlives a short sink deadline.
function slowly(handler: Handler, delayMs = 400): Handler {
  return (request, body, response) => setTimeout(() => handler(request, body, response), delayMs);
}

interface ElsewherePeer {
  readonly origin: string;
  readonly count: () => number;
}

async function elsewherePeer(): Promise<ElsewherePeer> {
  let count = 0;
  const server = createServer((_request, response) => {
    count += 1;
    response.writeHead(200);
    response.end();
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { origin: `http://127.0.0.1:${address.port}`, count: () => count };
}

function redirectTo(target: string, status = 302): Handler {
  const safeLocation = new URL(PATH, target).href;
  return (_request, _body, response) => {
    response.writeHead(status, { location: safeLocation });
    response.end();
  };
}

function sinkFor(origin: string, options: Partial<HttpAuditSinkOptions> = {}): AuditEventSink {
  return createHttpAuditSink({ origin, path: PATH, timeoutMs: 2_000, ...options });
}

// A sink whose onOutcome records every report it receives.
function recordingSinkFor(origin: string, options: Partial<HttpAuditSinkOptions> = {}) {
  const reports: HttpAuditSinkOutcome[] = [];
  const sink = sinkFor(origin, { ...options, onOutcome: (outcome) => { reports.push(outcome); } });
  return { sink, reports };
}

// Everything written through console or raised as a process warning while
// `run` is in progress.
async function captureLogs(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const originals = new Map((["log", "info", "warn", "error", "debug", "trace"] as const).map((name) => [name, console[name]]));
  const onWarning = (warning: Error): void => { lines.push(inspect(warning)); };
  for (const name of originals.keys()) console[name] = (...args: unknown[]) => { lines.push(format(...args)); };
  process.on("warning", onWarning);
  try {
    await run();
  } finally {
    for (const [name, original] of originals) console[name] = original;
    process.off("warning", onWarning);
  }
  return lines;
}

// Every unhandled rejection raised while `run` is in progress, or on the turn after it.
async function captureUnhandledRejections(run: () => Promise<void>): Promise<unknown[]> {
  const reasons: unknown[] = [];
  const record = (reason: unknown): void => { reasons.push(reason); };
  process.on("unhandledRejection", record);
  try {
    await run();
    await new Promise<void>((done) => setImmediate(done));
  } finally {
    process.off("unhandledRejection", record);
  }
  return reasons;
}

// Resolves once `ready` holds. It fails on its own deadline, because a test's
// deadline fails the test but cannot stop this loop, which would then keep
// the run alive.
async function until(ready: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!ready()) {
    assert.ok(Date.now() < deadline, "the awaited condition never held");
    await pause(5);
  }
}

function pause(ms: number): Promise<void> {
  return new Promise<void>((done) => setTimeout(done, ms));
}

// Reports whether `promise` has settled yet, without deciding its outcome for the caller.
function settlement(promise: Promise<unknown>): () => boolean {
  let settled = false;
  const mark = (): void => { settled = true; };
  promise.then(mark, mark);
  return () => settled;
}

// A copy of the fixture event under another identifier, so concurrent sends can be told apart.
function eventNumbered(index: number): SecurityAuditEvent {
  return { ...retriedEvent, event: { ...retriedEvent.event, id: `22222222-2222-4222-8222-${String(index).padStart(12, "0")}` } };
}

// Delegates to `sink`, recording each flush and shutdown the SDK asks of it.
function observed(sink: AuditEventSink, calls: string[]): AuditEventSink {
  return {
    emit: (event) => sink.emit(event),
    async flush() {
      calls.push("flush");
      await sink.flush?.();
    },
    async shutdown() {
      calls.push("shutdown");
      await sink.shutdown?.();
    },
  };
}

function sdkFor(sink: AuditEventSink, shutdownTimeoutMs = 5_000): SecurityAuditSdk {
  return createNodeSecurityAuditSdk({
    contractVersion: CONTRACT_VERSION,
    producer: retriedEvent.producer,
    service: retriedEvent.service,
    environment: retriedEvent.environment,
    sink,
    shutdownTimeoutMs,
  });
}

async function emitThroughSdk(sink: AuditEventSink): Promise<AuditResult<AuditDeliveryResult>> {
  return sdkFor(sink).emit(retriedEvent);
}

function sdkOutcome(result: AuditResult<AuditDeliveryResult>): string {
  return result.ok ? result.value.status : result.error.code;
}

function lifecycleOutcome(result: AuditResult<void>): string {
  return result.ok ? "ok" : result.error.code;
}

// The bytes the SDK hands its sink once validation has finished with the event.
async function validatedBody(): Promise<Buffer> {
  const seen: string[] = [];
  const result = await emitThroughSdk({
    async emit(validated) {
      seen.push(JSON.stringify(validated));
      return { status: "accepted" };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(seen.length, 1);
  return Buffer.from(seen[0] ?? "", "utf8");
}

describe("HTTP audit sink", () => {
  it("sends one POST whose body is byte-identical to the validated event, retry_attempt included", async () => {
    const { origin, received } = await peer(acknowledge());
    const { sink, reports } = recordingSinkFor(origin);
    const result = await emitThroughSdk(sink);

    assert.equal(sdkOutcome(result), "accepted");
    assert.deepEqual(reports, [{ eventId, outcome: "acknowledged", status: 202 }]);
    assert.equal(received.length, 1);
    const [request] = received;
    assert.ok(request);
    assert.equal(request.method, "POST");
    assert.equal(request.url, PATH);
    assert.equal(request.headers["content-type"], "application/json");
    assert.ok(request.body.equals(await validatedBody()), "the body must be the validated event's exact bytes");
    assert.equal((JSON.parse(request.bodyText) as SecurityAuditEvent).correlation.retry_attempt, 3);
  });

  it("sends exactly one request per emit, and never a second one for a failed send", async () => {
    const { origin, received } = await peer(reply(503, { acknowledgments: [] }));
    const sink = sinkFor(origin);

    assert.equal(sdkOutcome(await emitThroughSdk(sink)), "SDK_SINK_FAILURE");
    assert.equal(received.length, 1);
    assert.equal(sdkOutcome(await emitThroughSdk(sink)), "SDK_SINK_FAILURE");
    assert.equal(received.length, 2);
  });

  it("returns SDK_SINK_REJECTED for a permanent 4xx and SDK_SINK_FAILURE for a retryable status, reporting each cause once", async () => {
    for (const { status, sdk, outcome } of STATUS_CLASSES) {
      const { origin } = await peer(reply(status, { acknowledgments: [] }));
      const { sink, reports } = recordingSinkFor(origin);
      assert.equal(sdkOutcome(await emitThroughSdk(sink)), sdk, `status ${status}`);
      assert.deepEqual(reports, [{ eventId, outcome, status }], `status ${status}`);
    }
  });

  it("never follows a redirect, and the SDK reports the send as failed", async () => {
    const elsewhere = await elsewherePeer();
    for (const status of [301, 302, 303, 307, 308]) {
      const { origin, received } = await peer(redirectTo(elsewhere.origin, status));
      const { sink, reports } = recordingSinkFor(origin);
      assert.equal(sdkOutcome(await emitThroughSdk(sink)), "SDK_SINK_FAILURE", `status ${status}`);
      assert.deepEqual(reports, [{ eventId, outcome: "unexpected_response", status }], `status ${status}`);
      assert.equal(received.length, 1, `status ${status}`);
    }
    assert.equal(elsewhere.count(), 0);
  });

  it("accepts only the exact acknowledgment for this event", async () => {
    const id = retriedEvent.event.id;
    const exact = { event_id: id, outcome: "accepted" };
    for (const body of [
      {},
      { acknowledgments: [] },
      { acknowledgments: [exact, exact] },
      // The exact acknowledgment beside anything else is still more than one.
      { acknowledgments: [exact, { event_id: id, outcome: "rejected" }] },
      { acknowledgments: [exact, { event_id: 5, outcome: "accepted" }] },
      { acknowledgments: [exact, null] },
      { acknowledgments: [exact, "accepted"] },
      { acknowledgments: [{ event_id: "another-event", outcome: "accepted" }] },
      { acknowledgments: [{ event_id: id, outcome: "rejected" }] },
      "{not json",
    ]) {
      const { origin } = await peer(reply(200, body));
      const { sink, reports } = recordingSinkFor(origin);
      assert.equal(sdkOutcome(await emitThroughSdk(sink)), "SDK_SINK_FAILURE", JSON.stringify(body));
      assert.deepEqual(reports, [{ eventId, outcome: "malformed_acknowledgment", status: 200 }], JSON.stringify(body));
    }
  });

  it("takes every classification from the shared classifier, exactly as the delivery handoff does", async () => {
    const replies: ReadonlyArray<readonly [string, number, Handler]> = [
      ["202 exact acknowledgment", 202, acknowledge()],
      ["202 malformed acknowledgment", 202, reply(202, { acknowledgments: [] })],
      ["202 exact plus a rejected acknowledgment", 202, (request, body, response) => {
        const id = (JSON.parse(body) as SecurityAuditEvent).event.id;
        reply(202, { acknowledgments: [{ event_id: id, outcome: "accepted" }, { event_id: id, outcome: "rejected" }] })(request, body, response);
      }],
      ["204 without a body", 204, reply(204, "")],
      ["302 redirect", 302, reply(302, "")],
      ...[400, 404, 408, 409, 422, 425, 429, 500, 503].map((status) => [`${status}`, status, reply(status, { acknowledgments: [] })] as const),
    ];
    for (const [label, replied, handler] of replies) {
      const { origin } = await peer(handler);
      const exchange = createFetchHttpExchange({ origin, timeoutMs: 2_000 });
      const handoff = await createHttpDeliveryHandoff({ path: PATH, exchange }).handoff(retriedEvent);
      const status = SINK_STATUS_BY_HANDOFF_STATUS[handoff.status];
      const expected = status === "accepted" ? { status } : { status, code: handoff.code };
      const { sink, reports } = recordingSinkFor(origin);
      assert.deepEqual(await sink.emit(retriedEvent), expected, label);
      assert.deepEqual(reports, [{ eventId, outcome: handoff.code, status: replied }], label);
    }
  });

  it("reports a peer slower than the deadline as a timeout, and a refused connection as a transport failure", async () => {
    const slow = await peer(slowly(acknowledge()));
    const timedOut = recordingSinkFor(slow.origin, { timeoutMs: 50 });
    assert.deepEqual(await timedOut.sink.emit(retriedEvent), { status: "unknown", code: "timeout" });
    assert.equal(sdkOutcome(await emitThroughSdk(timedOut.sink)), "SDK_SINK_FAILURE");
    // No response arrived, so no report carries a status.
    assert.deepEqual(timedOut.reports, [{ eventId, outcome: "timeout" }, { eventId, outcome: "timeout" }]);

    const { origin, server } = await peer(acknowledge());
    await new Promise<void>((done) => server.close(() => done()));
    const refused = recordingSinkFor(origin);
    assert.deepEqual(await refused.sink.emit(retriedEvent), { status: "unknown", code: "transport_failure" });
    assert.equal(sdkOutcome(await emitThroughSdk(refused.sink)), "SDK_SINK_FAILURE");
    assert.deepEqual(refused.reports, [{ eventId, outcome: "transport_failure" }, { eventId, outcome: "transport_failure" }]);
  });

  it("keeps a sentinel credential on the wire to the configured origin, out of every outcome, result, error and log", async () => {
    const sentinel = "sentinel-credential-7d2e";
    const headers = { authorization: `Bearer ${sentinel}` };
    const elsewhere = await elsewherePeer();
    const seen: unknown[] = [];
    const logged = await captureLogs(async () => {
      for (const { handler, outcome, timeoutMs } of [
        { handler: acknowledge(), outcome: "acknowledged", timeoutMs: 2_000 },
        { handler: reply(400, { acknowledgments: [] }), outcome: "http_permanent", timeoutMs: 2_000 },
        { handler: reply(500, { acknowledgments: [] }), outcome: "http_retryable", timeoutMs: 2_000 },
        { handler: redirectTo(elsewhere.origin), outcome: "unexpected_response", timeoutMs: 2_000 },
        { handler: slowly(acknowledge()), outcome: "timeout", timeoutMs: 100 },
      ]) {
        const { origin, received } = await peer(handler);
        const { sink, reports } = recordingSinkFor(origin, { headers, timeoutMs });
        seen.push(await sink.emit(retriedEvent), await emitThroughSdk(sink));
        assert.deepEqual(reports.map((report) => report.outcome), [outcome, outcome], outcome);
        seen.push(...reports);
        assert.equal(received.length, 2, outcome);
        for (const request of received) assert.equal(request.headers.authorization, `Bearer ${sentinel}`);
      }
    });

    assert.equal(elsewhere.count(), 0, "a redirect must not carry the credential elsewhere");
    // Two results and two reports for each of the five peers.
    assert.equal(seen.length, 20);
    assert.ok(!inspect(seen, { depth: null, showHidden: true }).includes(sentinel), "no outcome, result or error may carry it");
    assert.ok(logged.every((line) => !line.includes(sentinel)), "no log may carry it");
  });

  // The deadline turns a sink that waits for a never-settling callback into a
  // failure rather than a hung run.
  it("leaves the result unchanged, and leaks no unhandled rejection, when onOutcome throws, rejects or never settles", { timeout: 10_000 }, async () => {
    let invoked = 0;
    const unhandled = await captureUnhandledRejections(async () => {
      for (const { handler, expected } of [
        { handler: acknowledge(), expected: "accepted" },
        { handler: reply(400, { acknowledgments: [] }), expected: "SDK_SINK_REJECTED" },
        { handler: reply(503, { acknowledgments: [] }), expected: "SDK_SINK_FAILURE" },
      ]) {
        const { origin } = await peer(handler);
        for (const [name, misbehave] of Object.entries(MISBEHAVING_CALLBACKS)) {
          const onOutcome = () => {
            invoked += 1;
            return misbehave();
          };
          assert.equal(sdkOutcome(await emitThroughSdk(sinkFor(origin, { onOutcome }))), expected, `${expected}, onOutcome ${name}`);
        }
      }
    });

    assert.equal(invoked, 12);
    assert.deepEqual(unhandled, []);
  });

  // The deadlines in these arms turn a drain that waits too long into a
  // failure rather than a hung run.
  it("waits in flush for every send started before the call, and for none started after it", { timeout: 10_000 }, async () => {
    for (const [name, flush] of Object.entries(FLUSHES)) {
      const { origin, held, release } = await holdingPeer();
      const { sink, reports } = recordingSinkFor(origin);
      const sdk = sdkFor(sink);
      const earlier = [sdk.emit(eventNumbered(1)), sdk.emit(eventNumbered(2))];
      await until(() => held() === 2);

      const draining = flush(sdk, sink);
      assert.ok(draining, `${name} must be implemented`);
      const drained = settlement(draining);
      // Sent straight to the sink, so it starts in the same turn as the drain.
      const later = sink.emit(eventNumbered(3));
      const laterSettled = settlement(later);
      await until(() => held() === 3);

      release(0);
      await until(() => reports.length === 1);
      await pause(20);
      assert.equal(drained(), false, `${name} must wait for every earlier send`);

      release(1);
      await draining;
      assert.deepEqual((await Promise.all(earlier)).map(sdkOutcome), ["accepted", "accepted"], name);
      assert.equal(laterSettled(), false, `${name} must not wait for a later send`);
      release(2);
      assert.deepEqual(await later, { status: "accepted" }, name);
      assert.equal(reports.length, 3, name);
    }
  });

  it("closes the sink on shutdown, refusing every later send at once and resolving when the earlier ones settle", { timeout: 10_000 }, async () => {
    const { origin, received, held, release } = await holdingPeer();
    const { sink, reports } = recordingSinkFor(origin);
    const { flush, shutdown } = sink;
    assert.ok(flush && shutdown, "the sink must implement flush and shutdown");
    const earlier = [sink.emit(eventNumbered(1)), sink.emit(eventNumbered(2))];
    await until(() => held() === 2);

    const closing = shutdown();
    const closed = settlement(closing);
    assert.deepEqual(await sink.emit(eventNumbered(3)), SHUT_DOWN, "a send after shutdown began must be refused");
    release(0);
    await until(() => reports.length === 1);
    await pause(20);
    assert.equal(closed(), false, "shutdown must wait for every earlier send");

    release(1);
    await closing;
    assert.deepEqual(await Promise.all(earlier), [{ status: "accepted" }, { status: "accepted" }]);
    assert.deepEqual(await sink.emit(eventNumbered(4)), SHUT_DOWN, "a closed sink must stay closed");
    await flush();
    assert.equal(received.length, 2, "a closed sink must make no request");
    // Only the two earlier sends were requests, so only they are reported.
    assert.equal(reports.length, 2);
  });

  it("waits in flush and shutdown for a held send beside one that rejects", { timeout: 10_000 }, async () => {
    const { origin, received, held, release } = await holdingPeer();
    const sink = sinkFor(origin);
    // A BigInt cannot be serialized, so the send rejects before any request.
    const unserializable = { ...retriedEvent, extension: 1n } as unknown as SecurityAuditEvent;
    // Shutdown comes last, because it closes the sink.
    for (const [index, name] of (["flush", "shutdown"] as const).entries()) {
      const drain = sink[name];
      assert.ok(drain, `the sink must implement ${name}`);
      const sending = sink.emit(eventNumbered(index));
      await until(() => held() === index + 1);
      const rejecting = sink.emit(unserializable);
      const draining = drain();
      const drained = settlement(draining);

      await assert.rejects(rejecting, TypeError, name);
      await pause(20);
      assert.equal(drained(), false, `${name} must still wait for the held send`);
      release(index);
      await draining;
      assert.deepEqual(await sending, { status: "accepted" }, name);
    }
    assert.equal(received.length, 2);
  });

  it("lets a held send settle within the SDK's shutdown bound, then flushes and closes the sink", { timeout: 10_000 }, async () => {
    const { origin, received, held, release } = await holdingPeer();
    const { sink, reports } = recordingSinkFor(origin);
    const calls: string[] = [];
    const sdk = sdkFor(observed(sink, calls));
    const sending = sdk.emit(retriedEvent);
    await until(() => held() === 1);

    const shuttingDown = sdk.shutdown();
    const shutDown = settlement(shuttingDown);
    assert.equal(sdkOutcome(await sdk.emit(retriedEvent)), "SDK_SHUTTING_DOWN");
    await pause(20);
    assert.equal(shutDown(), false, "shutdown must wait for the send in flight");
    assert.deepEqual(calls, [], "the sink must not be flushed or shut down while a send is in flight");

    release(0);
    assert.equal(sdkOutcome(await sending), "accepted");
    assert.equal(lifecycleOutcome(await shuttingDown), "ok");
    assert.deepEqual(calls, ["flush", "shutdown"]);
    assert.equal(sdkOutcome(await sdk.emit(retriedEvent)), "SDK_SHUT_DOWN");
    assert.deepEqual(await sink.emit(retriedEvent), SHUT_DOWN, "the SDK's shutdown must close the sink");
    assert.equal(received.length, 1, "no emit after shutdown began may reach the peer");
    assert.deepEqual(reports, [{ eventId, outcome: "acknowledged", status: 202 }]);
  });

  it("returns SDK_SHUTDOWN_TIMEOUT when a held send outlives the bound, then SDK_SHUT_DOWN for every later call", { timeout: 10_000 }, async () => {
    const { origin, received, held, release } = await holdingPeer();
    const { sink, reports } = recordingSinkFor(origin);
    const calls: string[] = [];
    // The bound is far shorter than the sink's own request deadline.
    const sdk = sdkFor(observed(sink, calls), 50);
    const sending = sdk.emit(retriedEvent);
    await until(() => held() === 1);

    assert.equal(lifecycleOutcome(await sdk.shutdown()), "SDK_SHUTDOWN_TIMEOUT");
    assert.deepEqual(calls, [], "the SDK must leave the sink alone once its bound has expired");
    assert.equal(sdkOutcome(await sdk.emit(retriedEvent)), "SDK_SHUT_DOWN");
    assert.equal(lifecycleOutcome(await sdk.flush()), "SDK_SHUT_DOWN");
    assert.equal(lifecycleOutcome(await sdk.shutdown()), "SDK_SHUT_DOWN");
    assert.equal(received.length, 1);

    // The send the bound gave up on still settles, and is reported once.
    release(0);
    assert.equal(sdkOutcome(await sending), "accepted");
    assert.deepEqual(reports, [{ eventId, outcome: "acknowledged", status: 202 }]);
  });

  it("sends N concurrent emits as N requests, each settled and reported exactly once, in any order", { timeout: 10_000 }, async () => {
    const { origin, received, held, release } = await holdingPeer();
    const { sink, reports } = recordingSinkFor(origin);
    const sdk = sdkFor(sink);
    const events = Array.from({ length: CONCURRENT_EMITS }, (_, index) => eventNumbered(index));
    const sending = events.map((event) => sdk.emit(event));
    // Every request is held at once, so nothing serialized them.
    await until(() => held() === CONCURRENT_EMITS);
    for (let index = CONCURRENT_EMITS - 1; index >= 0; index -= 1) release(index);

    assert.deepEqual((await Promise.all(sending)).map(sdkOutcome), events.map(() => "accepted"));
    const ids = events.map((event) => event.event.id);
    const sentIds = received.map((request) => (JSON.parse(request.bodyText) as SecurityAuditEvent).event.id);
    assert.equal(received.length, CONCURRENT_EMITS);
    assert.deepEqual(new Set(sentIds), new Set(ids));
    assert.equal(reports.length, CONCURRENT_EMITS);
    assert.deepEqual(new Set(reports), new Set(ids.map((id) => ({ eventId: id, outcome: "acknowledged", status: 202 }))));
  });

  it("sends caller headers to the configured origin beside its own content type", async () => {
    const { origin, received } = await peer(acknowledge());
    const headers = { authorization: "Bearer synthetic-fixture", "x-evaluation": "synthetic" };
    assert.equal(sdkOutcome(await emitThroughSdk(sinkFor(origin, { headers }))), "accepted");
    const [request] = received;
    assert.ok(request);
    assert.equal(request.headers.authorization, "Bearer synthetic-fixture");
    assert.equal(request.headers["x-evaluation"], "synthetic");
    assert.equal(request.headers["content-type"], "application/json");
  });

  it("rejects an invalid origin, path, timeout or onOutcome at construction", () => {
    for (const origin of [
      "http://127.0.0.1:8080/path",
      "http://127.0.0.1:8080?q=1",
      "http://127.0.0.1:8080#frag",
      "http://user:secret@127.0.0.1:8080",
      "file:///etc/passwd",
      "ftp://127.0.0.1",
      "127.0.0.1:8080",
    ]) {
      assert.throws(() => createHttpAuditSink({ ...VALID_OPTIONS, origin }), TypeError, origin);
    }
    // An array would pass the path pattern once coerced to a string.
    for (const path of ["relative", "", "/", "/a b", "/a?q=1", "/a#frag", `/${"a".repeat(2048)}`, [PATH] as unknown as string]) {
      assert.throws(() => createHttpAuditSink({ ...VALID_OPTIONS, path }), TypeError, String(path));
    }
    for (const timeoutMs of [0, -1, 1.5, 60_001, Number.NaN]) {
      assert.throws(() => createHttpAuditSink({ ...VALID_OPTIONS, timeoutMs }), TypeError, String(timeoutMs));
    }
    for (const onOutcome of [null, 42, "callback", {}]) {
      assert.throws(() => createHttpAuditSink({ ...VALID_OPTIONS, onOutcome: onOutcome as unknown as () => void }), TypeError, String(onOutcome));
    }
    assert.doesNotThrow(() => createHttpAuditSink({ ...VALID_OPTIONS, origin: "https://[::1]:8443", path: `/${"a".repeat(2047)}` }));
  });

  it("rejects an invalid header name or value at construction, without echoing it", () => {
    const sentinel = "sentinel-credential-5f1c";
    for (const headers of [
      { [`bad name ${sentinel}`]: "x" },
      { "": sentinel },
      { "x-credential": `${sentinel}\r\ninjected: header` },
      { "x-credential": `${sentinel}\n` },
      { "x-credential": `${sentinel}\0` },
      { "x-credential": `${sentinel}\u0100` },
      { "x-credential": 42 as unknown as string },
      { "Content-Type": `text/plain; ${sentinel}` },
      { "content-length": "1" },
      ...["host", "Connection", "keep-alive", "transfer-encoding", "upgrade", "expect"].map((name) => ({ [name]: sentinel })),
      [sentinel] as unknown as Record<string, string>,
      null as unknown as Record<string, string>,
    ]) {
      assert.throws(
        () => createHttpAuditSink({ ...VALID_OPTIONS, headers }),
        (error: unknown) => error instanceof TypeError && !error.message.includes(sentinel),
        JSON.stringify(headers),
      );
    }
    assert.doesNotThrow(() => createHttpAuditSink({ ...VALID_OPTIONS, headers: {} }));
    assert.doesNotThrow(() => createHttpAuditSink({ ...VALID_OPTIONS, headers: { authorization: "Bearer a\tb", "x-latin1": "caf\u00e9" } }));
  });
});
