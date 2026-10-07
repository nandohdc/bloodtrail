import { createServer } from "node:http";
import process from "node:process";
import { pathToFileURL } from "node:url";

function sendJson(response, status, data) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
}

function extractEventId(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed?.event?.id ?? "00000000-0000-4000-8000-000000000001";
  } catch {
    return "00000000-0000-4000-8000-000000000001";
  }
}

function handleControlEndpoint(ctx) {
  const { request, response, heldResolvers, received } = ctx;
  if (request.method === "POST" && request.url === "/release") {
    const count = heldResolvers.length;
    while (heldResolvers.length > 0) {
      heldResolvers.shift()?.();
    }
    sendJson(response, 200, { released: count });
    return true;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      status: "healthy",
      receivedCount: received.length,
      heldCount: heldResolvers.length,
    });
    return true;
  }

  return false;
}

const MALFORMED_PAYLOADS = new Map([
  ["malformed-empty", () => ({ status: 200, body: {} })],
  ["malformed-no-array", () => ({ status: 200, body: { acknowledgments: [] } })],
  [
    "malformed-wrong-id",
    () => ({
      status: 200,
      body: {
        acknowledgments: [
          { event_id: "00000000-0000-0000-0000-000000000000", outcome: "accepted" },
        ],
      },
    }),
  ],
  [
    "malformed-rejected",
    (body) => ({
      status: 200,
      body: {
        acknowledgments: [
          { event_id: extractEventId(body), outcome: "rejected" },
        ],
      },
    }),
  ],
]);

function handleMalformed(behavior, body, response) {
  if (behavior === "malformed-not-json") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("not json content");
    return true;
  }

  const factory = MALFORMED_PAYLOADS.get(behavior);
  if (!factory) {
    return false;
  }

  const { status, body: responseBody } = factory(body);
  sendJson(response, status, responseBody);
  return true;
}

function replyAck(body, response) {
  const eventId = extractEventId(body);
  sendJson(response, 202, {
    acknowledgments: [{ event_id: eventId, outcome: "accepted" }],
  });
}

function handleRedirect(behavior, response) {
  if (!behavior.startsWith("redirect-")) {
    return false;
  }
  const statusCode = Number.parseInt(behavior.slice(9), 10) || 302;
  response.writeHead(statusCode, { location: "/v1/elsewhere" });
  response.end();
  return true;
}

function trySendErrorStatus(behavior, response) {
  const status = Number(behavior);
  if (status >= 400 && status <= 599) {
    sendJson(response, status, { error: `simulated_${status}` });
    return true;
  }
  return false;
}

async function handleHold(heldResolvers, body, response) {
  await new Promise((resolveHeld) => {
    heldResolvers.push(resolveHeld);
  });
  replyAck(body, response);
}

async function handleTimeout(heldResolvers, body, response) {
  await new Promise((resolveHeld) => {
    heldResolvers.push(resolveHeld);
    setTimeout(resolveHeld, 30_000);
  });
  replyAck(body, response);
}

async function handleStallBody(heldResolvers, response) {
  response.writeHead(200, { "content-type": "application/json" });
  response.write('{"acknowledgments":[');
  await new Promise((resolveHeld) => {
    heldResolvers.push(resolveHeld);
    setTimeout(resolveHeld, 30_000);
  });
  try {
    if (!response.writableEnded && !response.destroyed) {
      response.end("]}");
    }
  } catch {
    // client abort may have already closed the socket
  }
}

function resetResponseBody(response) {
  const socket = response.socket;
  response.writeHead(202, { "content-type": "application/json", "content-length": "64" });
  response.write('{"acknowledgments":[', () => socket.destroy());
}

function sendShortResponseBody(response) {
  const body = '{"acknowledgments":[]}';
  response.writeHead(202, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body) + 1),
    connection: "close",
  });
  response.end(body);
}

function sendMalformedChunkedResponse(response) {
  response.socket.write(
    "HTTP/1.1 202 Accepted\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\ninvalid-chunk\r\n{}\r\n0\r\n\r\n",
  );
  response.socket.end();
}

const BODY_READ_FAILURE_HANDLERS = new Map([
  ["body-reset", resetResponseBody],
  ["short-body", sendShortResponseBody],
  ["malformed-chunk", sendMalformedChunkedResponse],
]);

function handleBodyReadFailure(behavior, response) {
  const handler = BODY_READ_FAILURE_HANDLERS.get(behavior);
  if (!handler) return false;
  handler(response);
  return true;
}

async function handlePeerBehavior(behavior, ctx) {
  const { request, response, body, heldResolvers } = ctx;

  if (behavior === "hold") {
    await handleHold(heldResolvers, body, response);
    return;
  }

  if (behavior === "drop") {
    request.socket.destroy();
    return;
  }

  if (behavior === "timeout") {
    await handleTimeout(heldResolvers, body, response);
    return;
  }

  if (behavior === "stall-body") {
    await handleStallBody(heldResolvers, response);
    return;
  }

  if (handleBodyReadFailure(behavior, response)) {
    return;
  }

  if (handleRedirect(behavior, response) || handleMalformed(behavior, body, response)) {
    return;
  }

  if (trySendErrorStatus(behavior, response)) {
    return;
  }

  replyAck(body, response);
}

/**
 * Creates and starts a controllable HTTP loopback peer for verifying
 * SDK sink failure paths and delivery handoff semantics.
 *
 * @param {number} [port=0] Port to listen on (0 for ephemeral)
 * @returns {Promise<{
 *   origin: string,
 *   port: number,
 *   server: import("node:http").Server,
 *   received: Array<{ method: string, url: string, headers: import("node:http").IncomingHttpHeaders, body: string }>,
 *   heldCount: () => number,
 *   releaseHeld: () => void,
 *   close: () => Promise<void>
 * }>}
 */
export async function startControllablePeer(port = 0) {
  const received = [];
  const heldResolvers = [];

  const server = createServer(async (request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", async () => {
      const body = Buffer.concat(chunks).toString("utf8");
      received.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body,
      });

      const ctx = { request, response, body, heldResolvers, received };

      if (handleControlEndpoint(ctx)) {
        return;
      }

      const behavior = request.headers["x-peer-behavior"] || request.headers["x-peer-response"] || "ack";
      await handlePeerBehavior(behavior, ctx);
    });
  });

  await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
  const address = server.address();
  const assignedPort = typeof address === "object" && address ? address.port : port;
  const origin = `http://127.0.0.1:${assignedPort}`;

  return {
    origin,
    port: assignedPort,
    server,
    received,
    heldCount: () => heldResolvers.length,
    releaseHeld: () => {
      while (heldResolvers.length > 0) {
        heldResolvers.shift()?.();
      }
    },
    close: async () => {
      while (heldResolvers.length > 0) {
        heldResolvers.shift()?.();
      }
      server.closeAllConnections?.();
      await new Promise((resolveClose) => server.close(resolveClose));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const portArg = process.argv[2] ? Number.parseInt(process.argv[2], 10) : 0;
  const peer = await startControllablePeer(portArg);
  process.stdout.write(`peer:ready ${peer.origin}\n`);

  const onExit = async () => {
    await peer.close();
    process.exit(0);
  };
  process.on("SIGTERM", onExit);
  process.on("SIGINT", onExit);
}
