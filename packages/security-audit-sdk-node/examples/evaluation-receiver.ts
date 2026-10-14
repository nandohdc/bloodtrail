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

// Only the Bearer scheme, matched in any letter case and followed by the credential, authenticates. A bare
// token, a credential with no scheme, or any other scheme yields no credential and therefore a 401.
function credentialsOf(req: IncomingMessage): { credential: string } | undefined {
  const header = req.headers.authorization;
  if (header === undefined) return undefined;
  const separator = header.indexOf(" ");
  if (separator === -1) return undefined;
  if (header.slice(0, separator).toLowerCase() !== "bearer") return undefined;
  return { credential: header.slice(separator + 1) };
}

// A client abort mid-body is its own outcome, apart from a past-bound body and apart from an unexpected error.
class RequestAborted extends Error {
  constructor() {
    super("the client aborted the request body");
    this.name = "RequestAborted";
  }
}

// Reads the body up to EVENT_MAX_BYTES and stops the stream at once when it goes past the bound. A client
// abort mid-body — a close before end or a reset error — rejects with RequestAborted instead of resolving.
function readBoundedBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let length = 0;
    let ended = false;
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
    req.on("end", () => {
      ended = true;
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("aborted", () => rejectBody(new RequestAborted()));
    req.on("close", () => {
      if (!ended) rejectBody(new RequestAborted());
    });
    req.on("error", (error: NodeJS.ErrnoException) => {
      rejectBody(error.code === "ECONNRESET" ? new RequestAborted() : error);
    });
  });
}

// Separates the three bounded-read outcomes: an in-bound body, a body past the bound, and a client abort.
async function readBodyOrAbort(req: IncomingMessage): Promise<{ body: string | null; aborted: boolean }> {
  try {
    return { body: await readBoundedBody(req), aborted: false };
  } catch (error) {
    if (error instanceof RequestAborted) return { body: null, aborted: true };
    throw error;
  }
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
  if (result.diagnostic.code === DIAGNOSTIC_CODES.DEDUPLICATION_CAPACITY) {
    return reject(state, 429, "deduplication_capacity");
  }
  return reject(state, STATUS_BY_INGRESS_CATEGORY[result.diagnostic.category] ?? 500, "ingress_rejected");
}

interface SubmissionReply {
  readonly reply: Reply;
  readonly close: boolean;
}

// A client abort mid-body is not a submission reply: the handler logs it and answers nothing.
const SUBMISSION_ABORTED = Symbol("client aborted the submission");

// Bound the body before authenticating it, then parse, validate, and submit only a bounded authenticated event.
async function handleSubmission(
  req: IncomingMessage,
  state: ReceiverState,
): Promise<SubmissionReply | typeof SUBMISSION_ABORTED> {
  const read = await readBodyOrAbort(req);
  if (read.aborted) return SUBMISSION_ABORTED;
  const body = read.body;
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

// The submission path is the only POST the receiver treats as a submission.
const SUBMISSION_PATH = "/v1/security-audit";

// What the receiver answers a request that is neither the health check nor a submission: the status that
// names the refusal, and whether the 405 answer must carry an Allow header.
interface Refusal {
  readonly status: number;
  readonly reason: string;
  readonly allowPost: boolean;
}

function refusalOf(req: IncomingMessage): Refusal | undefined {
  if (req.method !== "POST") return { status: 405, reason: "method_not_allowed", allowPost: true };
  if (req.url !== SUBMISSION_PATH) return { status: 404, reason: "not_found", allowPost: false };
  return undefined;
}

// A refused route still honours the read rule: an in-bound body is read before the answer, and a body past
// the bound is answered with the connection closed and nothing more read. An abort answers nothing.
async function answerRefusedRoute(
  req: IncomingMessage,
  res: ServerResponse,
  state: ReceiverState,
  refusal: Refusal,
): Promise<boolean> {
  const read = await readBodyOrAbort(req);
  if (read.aborted) return true;
  const reply = reject(state, refusal.status, refusal.reason);
  if (read.body === null) {
    sendAndClose(req, res, reply);
  } else {
    send(res, reply);
  }
  return false;
}

// A refused route answers with its named status, and the 405 carries its Allow header. An abort mid-body is
// logged and answered nothing.
async function answerRoute(
  req: IncomingMessage,
  res: ServerResponse,
  state: ReceiverState,
  refusal: Refusal,
): Promise<void> {
  if (refusal.allowPost) res.setHeader("allow", "POST");
  if (await answerRefusedRoute(req, res, state, refusal)) {
    console.log("receiver:aborted");
  }
}

// A submission answers with its reply, closing the connection when the body went past the bound. An abort
// mid-body is logged and answered nothing.
async function answerSubmission(req: IncomingMessage, res: ServerResponse, state: ReceiverState): Promise<void> {
  const submission = await handleSubmission(req, state);
  if (submission === SUBMISSION_ABORTED) {
    console.log("receiver:aborted");
    return;
  }
  if (submission.close) {
    sendAndClose(req, res, submission.reply);
  } else {
    send(res, submission.reply);
  }
}

// The dispatcher only chooses health, refusal or submission. No request handler rethrows: an unexpected error
// is answered 500, and the receiver keeps serving.
function createDispatchHandler(state: ReceiverState) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        send(res, { status: 200, body: { status: "healthy", acceptedCount: state.counts.accepted, duplicateCount: state.counts.duplicates, rejectedCount: state.counts.rejected } });
        return;
      }
      const refusal = refusalOf(req);
      if (refusal !== undefined) {
        await answerRoute(req, res, state, refusal);
      } else {
        await answerSubmission(req, res, state);
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
