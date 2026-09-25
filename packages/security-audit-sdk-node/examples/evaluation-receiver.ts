import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";
import assert from "node:assert/strict";
import {
  CollectorIngress,
  SyntheticFixtureAuthenticator,
} from "@bloodtrail/security-audit-collector";
import { validateSecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";

export interface EvaluationReceiverOptions {
  readonly port?: number;
  readonly host?: string;
  readonly token?: string;
}

interface ReceiverState {
  readonly ingress: CollectorIngress;
  readonly acceptedEvents: string[];
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractToken(req: IncomingMessage): string {
  const authHeader = req.headers["authorization"] ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
}

function assertValidEventPayload(body: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("invalid_json");
  }
  const validated = validateSecurityAuditEvent(parsed);
  if (!validated.ok) {
    throw new Error(`SDK validation failed: ${JSON.stringify(validated.error)}`);
  }
  const serialized = JSON.stringify(validated.value);
  assert.equal(body, serialized, "Received body must be byte-identical to what SDK validated");
}

async function handleAuditSubmission(
  req: IncomingMessage,
  res: ServerResponse,
  state: ReceiverState,
): Promise<void> {
  const body = await readBody(req);
  const token = extractToken(req);

  const admission = state.ingress.submit({
    credentials: { credential: token },
    body,
  });

  if (admission.kind === "rejected") {
    sendJson(res, 401, { error: admission.diagnostic });
    return;
  }

  if (admission.kind !== "admitted" && admission.kind !== "persisted") {
    sendJson(res, 400, { error: "unhandled_admission_kind" });
    return;
  }

  try {
    assertValidEventPayload(body);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const statusCode = error === "invalid_json" ? 400 : 422;
    sendJson(res, statusCode, { error });
    throw err;
  }

  state.acceptedEvents.push(body);
  console.log(`receiver:accepted ${admission.eventId}`);

  sendJson(res, 200, {
    acknowledgments: [
      {
        event_id: admission.eventId,
        outcome: "accepted",
      },
    ],
  });
}

function createDispatchHandler(state: ReceiverState) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        status: "healthy",
        acceptedCount: state.acceptedEvents.length,
        events: state.acceptedEvents.map((e) => JSON.parse(e)),
      });
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    await handleAuditSubmission(req, res, state);
  };
}

export function startEvaluationReceiver(options: EvaluationReceiverOptions = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const validToken = options.token ?? "fixture-token-a";

  const authenticator = new SyntheticFixtureAuthenticator([validToken]);
  const ingress = new CollectorIngress({ authenticator });
  const state: ReceiverState = { ingress, acceptedEvents: [] };

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
