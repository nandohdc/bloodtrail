import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";
import {
  CollectorIngress,
  DIAGNOSTIC_CODES,
  EVENT_MAX_BYTES,
  SyntheticFixtureAuthenticator,
  type IngressResult,
} from "@bloodtrail/security-audit-collector";
import { validateSecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

// NON-PRODUCTION: an in-memory example of a careful ingress for the evaluation. It stores nothing, and its
// synthetic fixture token authenticates nobody real.

export interface EvaluationReceiverOptions {
  readonly port?: number;
  readonly host?: string;
  readonly token?: string;
}

interface ReceiverState {
  readonly authenticator: SyntheticFixtureAuthenticator;
  readonly ingress: CollectorIngress;
  readonly counts: { accepted: number; duplicates: number; rejected: number };
}

// What the receiver answers. A rejection carries a fixed reason and never any part of the request.
interface Reply {
  readonly status: number;
  readonly body: unknown;
}

function reject(state: ReceiverState, status: number, reason: string): Reply {
  state.counts.rejected += 1;
  console.log(`receiver:rejected ${status} ${reason}`);
  return { status, body: { error: reason } };
}

// The ingress runs its own checks too. Its rejections get the statuses the receiver's own checks use.
const STATUS_BY_INGRESS_CATEGORY: Readonly<Record<string, number>> = {
  authentication: 401,
  size: 413,
  parse: 400,
  validation: 422,
  version: 422,
};

function acknowledge(eventId: string): Reply {
  return { status: 200, body: { acknowledgments: [{ event_id: eventId, outcome: "accepted" }] } };
}

function credentialsOf(req: IncomingMessage): { credential: string } | undefined {
  const header = req.headers.authorization;
  if (header === undefined) return undefined;
  return { credential: header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header };
}

// Reads the body up to EVENT_MAX_BYTES and stops the stream at once when it goes past the bound.
function readBoundedBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const onData = (chunk: Buffer): void => {
      length += chunk.byteLength;
      if (length > EVENT_MAX_BYTES) {
        req.off("data", onData);
        req.pause();
        resolveBody(null);
        return;
      }
      chunks.push(chunk);
    };
    req.on("data", onData);
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rejectBody);
  });
}

// Only an event that passed SDK validation reaches the ingress. A duplicate is acknowledged and never
// admitted twice; an event that reuses an admitted identifier with different content is a conflict.
function admit(state: ReceiverState, credentials: unknown, body: string): Reply {
  const result: IngressResult = state.ingress.submit({ credentials, body });
  if (result.kind === "admitted" || result.kind === "persisted") {
    state.counts.accepted += 1;
    // The event in full, exactly as it arrived.
    console.log(`receiver:accepted ${result.eventId} ${body}`);
    return acknowledge(result.eventId);
  }
  if (result.kind === "duplicate") {
    state.counts.duplicates += 1;
    console.log(`receiver:duplicate ${result.eventId}`);
    return acknowledge(result.eventId);
  }
  if (result.diagnostic.code === DIAGNOSTIC_CODES.DUPLICATE_CONFLICT) {
    return reject(state, 409, "conflict");
  }
  return reject(state, STATUS_BY_INGRESS_CATEGORY[result.diagnostic.category] ?? 500, "ingress_rejected");
}

interface SubmissionReply {
  readonly reply: Reply;
  readonly close: boolean;
}

// Bound the body before authenticating it, then parse, validate, and submit only a bounded authenticated event.
async function handleSubmission(req: IncomingMessage, state: ReceiverState): Promise<SubmissionReply> {
  const body = await readBoundedBody(req);
  const credentials = credentialsOf(req);
  const authenticated = state.authenticator.verify(credentials).kind === "verified";
  if (body === null) {
    return {
      reply: authenticated ? reject(state, 413, "body_too_large") : reject(state, 401, "unauthenticated"),
      close: true,
    };
  }
  if (!authenticated) return { reply: reject(state, 401, "unauthenticated"), close: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { reply: reject(state, 400, "malformed_body"), close: false };
  }
  const validated = validateSecurityAuditEvent(parsed);
  if (!validated.ok) {
    console.log(`receiver:invalid ${validated.error.code} ${validated.error.path}`);
    return { reply: reject(state, 422, "invalid_event"), close: false };
  }
  return { reply: admit(state, credentials, body), close: false };
}

function send(res: ServerResponse, reply: Reply): void {
  res.writeHead(reply.status, { "content-type": "application/json" });
  res.end(JSON.stringify(reply.body));
}

// A body that exceeded the bound must not make Node drain the remaining request to preserve this connection.
function sendAndClose(req: IncomingMessage, res: ServerResponse, reply: Reply): void {
  const socket = res.socket;
  req.pause();
  res.writeHead(reply.status, { connection: "close", "content-type": "application/json" });
  res.end(JSON.stringify(reply.body), () => {
    if (socket) socket.destroySoon();
  });
}

// No request handler rethrows: an unexpected error is answered 500, and the receiver keeps serving.
function createDispatchHandler(state: ReceiverState) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        send(res, { status: 200, body: { status: "healthy", acceptedCount: state.counts.accepted, duplicateCount: state.counts.duplicates, rejectedCount: state.counts.rejected } });
        return;
      }
      if (req.method !== "POST") {
        send(res, reject(state, 405, "method_not_allowed"));
        return;
      }
      const submission = await handleSubmission(req, state);
      if (submission.close) {
        sendAndClose(req, res, submission.reply);
      } else {
        send(res, submission.reply);
      }
    } catch {
      console.log("receiver:error 500");
      if (res.headersSent) {
        res.destroy();
      } else {
        send(res, reject(state, 500, "internal_error"));
      }
    }
  };
}

export function startEvaluationReceiver(options: EvaluationReceiverOptions = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const validToken = options.token ?? "fixture-token-a";

  const authenticator = new SyntheticFixtureAuthenticator([validToken]);
  const ingress = new CollectorIngress({ authenticator });
  const state: ReceiverState = { authenticator, ingress, counts: { accepted: 0, duplicates: 0, rejected: 0 } };

  const server = createServer(createDispatchHandler(state));

  return new Promise<{
    server: ReturnType<typeof createServer>;
    origin: string;
    port: number;
    close: () => Promise<void>;
  }>((resolvePromise) => {
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      const origin = `http://${host}:${actualPort}`;
      console.log(`receiver:ready ${origin}`);
      resolvePromise({
        server,
        origin,
        port: actualPort,
        close: () => new Promise<void>((closeResolve) => server.close(() => closeResolve())),
      });
    });
  });
}

const isMain =
  process.argv[1]?.endsWith("evaluation-receiver.ts") || process.argv[1]?.endsWith("evaluation-receiver.js");
if (isMain) {
  const portArg = process.argv[2] ? Number(process.argv[2]) : (process.env.PORT ? Number(process.env.PORT) : 3000);
  await startEvaluationReceiver({ port: portArg });
}
