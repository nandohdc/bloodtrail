// The HTTP audit sink (#589): the SDK's sink interface over the governed fetch
// adapter. These arms run through a real SDK and a loopback peer, so they show
// exactly what reaches the wire and what the SDK returns for it.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { after, describe, it } from "node:test";
import { setTimeout } from "node:timers";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT_VERSION,
  type AuditDeliveryResult,
  type AuditEventSink,
  type AuditResult,
  type SecurityAuditEvent,
} from "@bloodtrail/security-audit-sdk-core";
import {
  createFetchHttpExchange,
  createHttpAuditSink,
  createHttpDeliveryHandoff,
  createNodeSecurityAuditSdk,
  type HttpAuditSinkOptions,
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

interface ReceivedRequest {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
}

type Handler = (request: IncomingMessage, body: string, response: ServerResponse) => void;

const servers: Server[] = [];
after(() => Promise.all(servers.map((server) => new Promise<void>((done) => server.close(() => done())))));

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
      received.push({ method: request.method, url: request.url, headers: request.headers, body });
      handler(request, body.toString("utf8"), response);
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { origin: `http://127.0.0.1:${address.port}`, received, server };
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

function sinkFor(origin: string, options: Partial<HttpAuditSinkOptions> = {}): AuditEventSink {
  return createHttpAuditSink({ origin, path: PATH, timeoutMs: 2_000, ...options });
}

async function emitThroughSdk(sink: AuditEventSink): Promise<AuditResult<AuditDeliveryResult>> {
  const sdk = createNodeSecurityAuditSdk({
    contractVersion: CONTRACT_VERSION,
    producer: retriedEvent.producer,
    service: retriedEvent.service,
    environment: retriedEvent.environment,
    sink,
  });
  return sdk.emit(retriedEvent);
}

function sdkOutcome(result: AuditResult<AuditDeliveryResult>): string {
  return result.ok ? result.value.status : result.error.code;
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
    const result = await emitThroughSdk(sinkFor(origin));

    assert.equal(sdkOutcome(result), "accepted");
    assert.equal(received.length, 1);
    const [request] = received;
    assert.ok(request);
    assert.equal(request.method, "POST");
    assert.equal(request.url, PATH);
    assert.equal(request.headers["content-type"], "application/json");
    assert.ok(request.body.equals(await validatedBody()), "the body must be the validated event's exact bytes");
    assert.equal((JSON.parse(request.body.toString("utf8")) as SecurityAuditEvent).correlation.retry_attempt, 3);
  });

  it("sends exactly one request per emit, and never a second one for a failed send", async () => {
    const { origin, received } = await peer(reply(503, { acknowledgments: [] }));
    const sink = sinkFor(origin);

    assert.equal(sdkOutcome(await emitThroughSdk(sink)), "SDK_SINK_FAILURE");
    assert.equal(received.length, 1);
    assert.equal(sdkOutcome(await emitThroughSdk(sink)), "SDK_SINK_FAILURE");
    assert.equal(received.length, 2);
  });

  it("never follows a redirect, and the SDK reports the send as failed", async () => {
    const elsewhere = await peer(acknowledge());
    for (const status of [301, 302, 303, 307, 308]) {
      const { origin, received } = await peer((_request, _body, response) => {
        response.writeHead(status, { location: `${elsewhere.origin}${PATH}` });
        response.end();
      });
      assert.equal(sdkOutcome(await emitThroughSdk(sinkFor(origin))), "SDK_SINK_FAILURE", `status ${status}`);
      assert.equal(received.length, 1, `status ${status}`);
    }
    assert.equal(elsewhere.received.length, 0);
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
      assert.equal(sdkOutcome(await emitThroughSdk(sinkFor(origin))), "SDK_SINK_FAILURE", JSON.stringify(body));
    }
  });

  it("takes every classification from the shared classifier, exactly as the delivery handoff does", async () => {
    const replies: ReadonlyArray<readonly [string, Handler]> = [
      ["202 exact acknowledgment", acknowledge()],
      ["202 malformed acknowledgment", reply(202, { acknowledgments: [] })],
      ["202 exact plus a rejected acknowledgment", (request, body, response) => {
        const id = (JSON.parse(body) as SecurityAuditEvent).event.id;
        reply(202, { acknowledgments: [{ event_id: id, outcome: "accepted" }, { event_id: id, outcome: "rejected" }] })(request, body, response);
      }],
      ["204 without a body", reply(204, "")],
      ["302 redirect", reply(302, "")],
      ...[400, 404, 408, 409, 422, 425, 429, 500, 503].map((status) => [`${status}`, reply(status, { acknowledgments: [] })] as const),
    ];
    for (const [label, handler] of replies) {
      const { origin } = await peer(handler);
      const exchange = createFetchHttpExchange({ origin, timeoutMs: 2_000 });
      const handoff = await createHttpDeliveryHandoff({ path: PATH, exchange }).handoff(retriedEvent);
      const expected = handoff.code === "acknowledged" ? { status: "accepted" } : { status: "unknown", code: handoff.code };
      assert.deepEqual(await sinkFor(origin).emit(retriedEvent), expected, label);
    }
  });

  it("reports a peer slower than the deadline as a timeout, and a refused connection as a transport failure", async () => {
    const slow = await peer((request, body, response) => setTimeout(() => acknowledge()(request, body, response), 400));
    assert.deepEqual(await sinkFor(slow.origin, { timeoutMs: 50 }).emit(retriedEvent), { status: "unknown", code: "timeout" });

    const { origin, server } = await peer(acknowledge());
    await new Promise<void>((done) => server.close(() => done()));
    assert.deepEqual(await sinkFor(origin).emit(retriedEvent), { status: "unknown", code: "transport_failure" });
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

  it("rejects an invalid origin, path or timeout at construction", () => {
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
