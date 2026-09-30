// Adapter-specific arms for the governed fetch delivery adapter (#113). The
// common per-class conformance suite in delivery-classes.test.ts runs through
// this adapter too; these arms cover what only a real socket can show:
// timeouts, refused connections, malformed and oversized bodies, redirects,
// and caller-owned headers.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { after, describe, it } from "node:test";
import { setTimeout } from "node:timers";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";
import { createFetchHttpExchange, createHttpDeliveryHandoff, type FetchHttpExchangeOptions } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureEvent = JSON.parse(
  readFileSync(resolve(__dirname, "../../../contracts/security-audit/examples/positive/all-events.json"), "utf8"),
)[0] as SecurityAuditEvent;

type Handler = (request: IncomingMessage, body: string, response: ServerResponse) => void;

const servers: Server[] = [];
after(() => Promise.all(servers.map((server) => new Promise<void>((done) => server.close(() => done())))));

async function peer(handler: Handler): Promise<{ readonly origin: string; readonly received: string[] }> {
  const received: string[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      received.push(body);
      handler(request, body, response);
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { origin: `http://127.0.0.1:${address.port}`, received };
}

function reply(status: number, body: unknown): Handler {
  return (_request, _body, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(typeof body === "string" ? body : JSON.stringify(body));
  };
}

function acknowledge(): Handler {
  return (_request, body, response) => {
    const event = JSON.parse(body) as SecurityAuditEvent;
    reply(202, { acknowledgments: [{ event_id: event.event.id, outcome: "accepted" }] })(_request, body, response);
  };
}

async function deliverThrough(options: FetchHttpExchangeOptions) {
  const handoff = createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange: createFetchHttpExchange(options) });
  return handoff.handoff(structuredClone(fixtureEvent));
}

describe("fetch delivery adapter", () => {
  it("maps a well-formed acknowledgment to acknowledged and posts the handoff's exact body", async () => {
    const { origin, received } = await peer(acknowledge());
    const result = await deliverThrough({ origin, timeoutMs: 2_000 });
    assert.equal(result.status, "acknowledged");
    assert.equal(received.length, 1);
    const firstReceived = received[0];
    assert.ok(firstReceived);
    assert.equal((JSON.parse(firstReceived) as SecurityAuditEvent).event.id, fixtureEvent.event.id);
  });

  it("maps a peer slower than the deadline to a retryable timeout, never to delivered", async () => {
    const { origin } = await peer((request, body, response) => setTimeout(() => acknowledge()(request, body, response), 400));
    const result = await deliverThrough({ origin, timeoutMs: 50 });
    assert.deepEqual([result.status, result.code], ["retryable", "timeout"]);
  });

  it("maps a peer that stalls mid-body past the deadline to a retryable timeout", async () => {
    const { origin } = await peer((_request, _body, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"acknowledgments":[');
    });
    const result = await deliverThrough({ origin, timeoutMs: 50 });
    assert.deepEqual([result.status, result.code], ["retryable", "timeout"]);
  });

  it("maps a refused connection to a retryable transport failure", async () => {
    const { origin } = await peer(acknowledge());
    const server = servers.pop();
    assert.ok(server);
    await new Promise<void>((done) => server.close(() => done()));
    const result = await deliverThrough({ origin, timeoutMs: 2_000 });
    assert.deepEqual([result.status, result.code], ["retryable", "transport_failure"]);
  });

  it("maps an unparseable, empty, or shapeless 2xx body to a protocol error, never to acknowledged", async () => {
    for (const body of ["{not json", "", JSON.stringify({ ok: true }), JSON.stringify({ acknowledgments: [{ event_id: "other", outcome: "accepted" }] })]) {
      const { origin } = await peer(reply(202, body));
      const result = await deliverThrough({ origin, timeoutMs: 2_000 });
      assert.deepEqual([result.status, result.code], ["protocol_error", "malformed_acknowledgment"], `body ${JSON.stringify(body)}`);
    }
  });

  it("stops reading an oversized response and treats it as malformed", async () => {
    const { origin } = await peer(reply(202, JSON.stringify({ acknowledgments: [], padding: "x".repeat(4_096) })));
    const result = await deliverThrough({ origin, timeoutMs: 2_000, maxResponseBytes: 1_024 });
    assert.deepEqual([result.status, result.code], ["protocol_error", "malformed_acknowledgment"]);
  });

  it("never follows a redirect, so the event never reaches a peer nobody configured", async () => {
    const elsewhere = await peer(acknowledge());
    const { origin } = await peer((_request, _body, response) => {
      response.writeHead(307, { location: `${elsewhere.origin}/v1/security-audit` });
      response.end();
    });
    const result = await deliverThrough({ origin, timeoutMs: 2_000 });
    assert.deepEqual([result.status, result.code], ["protocol_error", "unexpected_response"]);
    assert.equal(elsewhere.received.length, 0);
  });

  it("leaves status classification to the handoff: 5xx is retryable, 4xx is permanent", async () => {
    const unavailable = await peer(reply(503, { acknowledgments: [] }));
    assert.deepEqual((await deliverThrough({ origin: unavailable.origin, timeoutMs: 2_000 })).status, "retryable");
    const refused = await peer(reply(400, { acknowledgments: [] }));
    assert.deepEqual((await deliverThrough({ origin: refused.origin, timeoutMs: 2_000 })).status, "non_retryable");
  });

  it("forwards caller-owned headers to the configured origin", async () => {
    let authorization: string | undefined;
    const { origin } = await peer((request, body, response) => {
      authorization = request.headers.authorization;
      acknowledge()(request, body, response);
    });
    await deliverThrough({ origin, timeoutMs: 2_000, headers: { authorization: "Bearer synthetic-fixture" } });
    assert.equal(authorization, "Bearer synthetic-fixture");
  });

  it("rejects an origin with a path, query, fragment, credentials, or a non-http scheme at construction", () => {
    for (const origin of [
      "http://127.0.0.1:8080/path",
      "http://127.0.0.1:8080?q=1",
      "http://127.0.0.1:8080#frag",
      "http://user:secret@127.0.0.1:8080",
      "file:///etc/passwd",
      "ftp://127.0.0.1",
      "127.0.0.1:8080",
    ]) {
      assert.throws(() => createFetchHttpExchange({ origin, timeoutMs: 1_000 }), TypeError, origin);
    }
    assert.doesNotThrow(() => createFetchHttpExchange({ origin: "https://[::1]:8443", timeoutMs: 1_000 }));
  });

  it("rejects an unbounded or non-integer deadline and response bound at construction", () => {
    for (const timeoutMs of [0, -1, 1.5, 60_001, Number.NaN]) {
      assert.throws(() => createFetchHttpExchange({ origin: "http://127.0.0.1", timeoutMs }), TypeError, String(timeoutMs));
    }
    assert.throws(() => createFetchHttpExchange({ origin: "http://127.0.0.1", timeoutMs: 1_000, maxResponseBytes: 0 }), TypeError);
  });
});
