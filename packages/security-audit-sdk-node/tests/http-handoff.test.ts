import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { after, describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFetchHttpExchange,
  createHttpDeliveryHandoff,
  type HttpExchangeOutcome,
  type HttpExchangeRequest,
} from "../dist/index.js";
import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../../../contracts/security-audit/examples/positive/all-events.json");
const fixtureEvent = JSON.parse(readFileSync(fixturePath, "utf8"))[0] as SecurityAuditEvent;

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const servers: Server[] = [];
after(() => Promise.all(servers.map((server) => new Promise<void>((done) => server.close(() => done())))));

async function peer(handler: Handler): Promise<string> {
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => handler(request, response));
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

function resetDuringResponseBody(): Handler {
  return (_request, response) => {
    const socket = response.socket;
    assert.ok(socket);
    response.writeHead(202, { "content-type": "application/json", "content-length": "64" });
    response.write('{"acknowledgments":[', () => socket.destroy());
  };
}

function shortResponseBody(): Handler {
  return (_request, response) => {
    const body = '{"acknowledgments":[]}';
    response.writeHead(202, {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body) + 1),
      connection: "close",
    });
    response.end(body);
  };
}

function malformedChunkedResponse(): Handler {
  return (_request, response) => {
    const socket = response.socket;
    assert.ok(socket);
    socket.write(
      "HTTP/1.1 202 Accepted\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\ninvalid-chunk\r\n{}\r\n0\r\n\r\n",
    );
    socket.end();
  };
}

async function handoffThrough(handler: Handler) {
  const origin = await peer(handler);
  const exchange = createFetchHttpExchange({ origin, timeoutMs: 2_000 });
  return createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange }).handoff(eventFixture());
}

function eventFixture(): SecurityAuditEvent {
  return JSON.parse(JSON.stringify(fixtureEvent)) as SecurityAuditEvent;
}

function response(
  status: number,
  acknowledgments: readonly { readonly event_id: string; readonly outcome: "accepted" }[] = [],
): HttpExchangeOutcome {
  return { kind: "response", status, acknowledgments };
}

function handoffWith(outcome: HttpExchangeOutcome) {
  const requests: HttpExchangeRequest[] = [];
  const handoff = createHttpDeliveryHandoff({
    path: "/v1/security-audit",
    exchange: async (request) => {
      requests.push(request);
      return outcome;
    },
  });
  return { handoff, requests };
}

describe("HTTP delivery handoff", () => {
  it("accepts one well-formed matching acknowledgment without mutating event identity", async () => {
    const event = eventFixture();
    const original = JSON.stringify(event);
    const { handoff, requests } = handoffWith(response(202, [{ event_id: event.event.id, outcome: "accepted" }]));

    const result = await handoff.handoff(event);

    assert.deepEqual(result, {
      status: "acknowledged",
      code: "acknowledged",
      event_id: event.event.id,
      attempt: 0,
    });
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0], {
      method: "POST",
      path: "/v1/security-audit",
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(requests[0]!.body, "utf8")),
      },
      body: original,
      event_id: event.event.id,
      attempt: 0,
    });
    assert.equal(JSON.stringify(event), original);
  });

  it("maps retryable responses, timeout, and transport failure without scheduling another attempt", async () => {
    const event = eventFixture();
    const outcomes: readonly [HttpExchangeOutcome, string][] = [
      [response(503), "http_retryable"],
      [{ kind: "timeout" }, "timeout"],
      [{ kind: "transport_failure" }, "transport_failure"],
    ];

    for (const [outcome, code] of outcomes) {
      const { handoff, requests } = handoffWith(outcome);
      const result = await handoff.handoff(event);
      assert.deepEqual(result, { status: "retryable", code, event_id: event.event.id, attempt: 0 });
      assert.equal(requests.length, 1);
    }
  });

  it("classifies every broken 2xx response body as a retryable transport failure", async () => {
    for (const [label, handler] of [
      ["reset mid-body", resetDuringResponseBody()],
      ["short declared-length body", shortResponseBody()],
      ["malformed chunked body", malformedChunkedResponse()],
    ] as const) {
      const result = await handoffThrough(handler);
      assert.deepEqual(
        [result.status, result.code],
        ["retryable", "transport_failure"],
        label,
      );
    }
  });

  it("maps permanent responses to non-retryable without treating them as accepted", async () => {
    const event = eventFixture();
    const { handoff, requests } = handoffWith(response(400));

    const result = await handoff.handoff(event);

    assert.deepEqual(result, { status: "non_retryable", code: "http_permanent", event_id: event.event.id, attempt: 0 });
    assert.equal(requests.length, 1);
  });

  it("rejects missing, duplicate, and mismatched acknowledgments as secret-free protocol errors", async () => {
    const event = eventFixture();
    const malformed: readonly HttpExchangeOutcome[] = [
      response(200),
      response(200, [
        { event_id: event.event.id, outcome: "accepted" },
        { event_id: event.event.id, outcome: "accepted" },
      ]),
      response(200, [{ event_id: "different-event", outcome: "accepted" }]),
      { kind: "response", status: 200, acknowledgments: [null] } as unknown as HttpExchangeOutcome,
    ];

    for (const outcome of malformed) {
      const { handoff, requests } = handoffWith(outcome);
      const result = await handoff.handoff(event);
      assert.deepEqual(result, {
        status: "protocol_error",
        code: "malformed_acknowledgment",
        event_id: event.event.id,
        attempt: 0,
      });
      assert.equal(requests.length, 1);
      assert.doesNotMatch(JSON.stringify(result), /different-event|peer-secret/i);
    }
  });

  it("rejects oversized projection before calling the injected exchange", async () => {
    const event = { ...eventFixture(), extension_padding: "x".repeat(65_537) } as SecurityAuditEvent;
    const { handoff, requests } = handoffWith({ kind: "timeout" });

    const result = await handoff.handoff(event);

    assert.deepEqual(result, {
      status: "non_retryable",
      code: "request_too_large",
      event_id: event.event.id,
      attempt: 0,
    });
    assert.equal(requests.length, 0);
  });

  it("keeps a caller-supplied attempt ordinal in the request and the result, outside the occurrence", async () => {
    const event = eventFixture();
    const original = JSON.stringify(event);
    const { handoff, requests } = handoffWith(response(202, [{ event_id: event.event.id, outcome: "accepted" }]));

    const result = await handoff.handoff(event, 3);

    assert.deepEqual(result, { status: "acknowledged", code: "acknowledged", event_id: event.event.id, attempt: 3 });
    assert.equal(requests[0]!.attempt, 3);
    assert.equal(requests[0]!.event_id, event.event.id);
    assert.equal(requests[0]!.body, original, "the body must be the occurrence as supplied, byte for byte");
    assert.equal(JSON.parse(requests[0]!.body).correlation.retry_attempt, 0);
    assert.equal(JSON.stringify(event), original);
  });

  it("rejects a negative, non-integer, or over-ceiling attempt ordinal before calling the injected exchange", async () => {
    const event = eventFixture();

    for (const invalid of [-1, 1.5, 1001, Number.NaN]) {
      const { handoff, requests } = handoffWith({ kind: "timeout" });
      await assert.rejects(() => handoff.handoff(event, invalid), TypeError);
      assert.equal(requests.length, 0);
    }
  });
});
