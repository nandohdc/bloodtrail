// The harness-local loopback ingress (observation boundary 4).
//
// It wraps the kit's own collector, injected as `collector`, so the collector decides admission,
// duplicates, conflicts and persistence; this module owns only HTTP framing, deterministic fault
// injection and recording. Status mapping follows the archived non-production delivery pilot.
import { createServer } from "node:http";
import { sha256 } from "./io.mjs";

// The HTTP status for each rejection diagnostic the pilot mapping names; any other rejection is 422.
function rejectionStatuses(codes) {
  return new Map([
    [codes.AUTH_MISSING, 401], [codes.AUTH_MALFORMED, 401], [codes.AUTH_REJECTED, 401],
    [codes.SIZE_EXCEEDED, 413],
    [codes.STORAGE_WRITE_FAILED, 503], [codes.STORAGE_WRITE_INDETERMINATE, 503], [codes.DEDUPLICATION_CAPACITY, 503],
    [codes.DUPLICATE_CONFLICT, 409], [codes.STORAGE_CONFLICT, 409],
  ]);
}

export function statusFor({ result, codes }) {
  if (result.kind === "persisted") return 202;
  // A collector without storage admits without persisting. Its answer is frozen by the storage-less phase
  // (#839), not guessed here.
  if (result.kind === "admitted") throw new Error("storage-less admission has no frozen status mapping");
  // A duplicate is acknowledged only when its first occurrence is durably stored.
  if (result.kind === "duplicate") return result.acknowledgment === "persisted" ? 202 : 503;
  return rejectionStatuses(codes).get(result.diagnostic.code) ?? 422;
}

// Mirrors the collector's own scope derivation (collector ingress.ts storageScopeOf), so the read-back
// looks a record up under the scope the collector stored it in.
export function storageScopeOf(tenant) {
  const kind = tenant?.scope;
  return kind === "platform" || kind === "tenantless" ? { kind } : { kind, tenantId: tenant?.effective_tenant_id };
}

function parsedEvent(body) {
  try {
    const value = JSON.parse(body);
    return { eventId: value?.event?.id, tenant: value?.tenant };
  } catch {
    return { eventId: undefined, tenant: undefined };
  }
}

function credentialsOf(request) {
  const authorization = request.headers.authorization ?? "";
  return authorization.startsWith("Bearer ") ? { credential: authorization.slice(7) } : undefined;
}

// A 202 acknowledges the event unless `acknowledged` is false: a 2xx that acknowledges nothing is what the
// binding's classifier reads as a malformed acknowledgment (http-response-classification.ts).
function respond({ response, status, eventId, acknowledged = status === 202 }) {
  const acknowledgments = acknowledged ? [{ event_id: eventId, outcome: "accepted" }] : [];
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ acknowledgments }));
}

function ingest({ state, request, body }) {
  const result = state.ingress.submit({ credentials: credentialsOf(request), body });
  const outcome = result.kind === "rejected" ? { kind: "rejected", code: result.diagnostic.code } : { kind: result.kind };
  return { status: statusFor({ result, codes: state.codes }), outcome };
}

// Each fault action, given the request context, records and answers (or withholds) the response.
const ACTIONS = {
  acknowledge: (context) => {
    const { status, outcome } = ingest(context);
    context.finish({ status, outcome });
    respond({ response: context.response, status, eventId: context.eventId });
  },
  status: (context) => {
    context.finish({ status: context.rule.status, outcome: { kind: "not_ingested" } });
    respond({ response: context.response, status: context.rule.status, eventId: context.eventId });
  },
  delay: (context) => {
    const { status, outcome } = ingest(context);
    context.finish({ status, outcome, delayed_ms: context.rule.delay_ms });
    let finished;
    const pending = new Promise((resolveTask) => { finished = resolveTask; });
    context.state.pending.add(pending);
    context.state.timers.setTimeout(() => {
      try {
        respond({ response: context.response, status, eventId: context.eventId });
      } finally {
        context.state.pending.delete(pending);
        finished();
      }
    }, context.rule.delay_ms);
  },
  destroy_before_ingest: (context) => {
    context.finish({ status: null, outcome: { kind: "not_ingested" } });
    context.request.socket.destroy();
  },
  destroy_after_ingest: (context) => {
    const { outcome } = ingest(context);
    context.finish({ status: null, outcome });
    context.request.socket.destroy();
  },
  // The collector decides the body as usual; the answer is a 202 that acknowledges nothing, so a protocol
  // error can follow a durable write. The recorded status is the answer on the wire; the outcome is the
  // collector's decision.
  malformed_after_ingest: (context) => {
    const { outcome } = ingest(context);
    context.finish({ status: 202, outcome });
    respond({ response: context.response, status: 202, eventId: context.eventId, acknowledged: false });
  },
};

// Every (scope, event id) pair the ingress saw. Two bodies may share an event id under different tenant
// scopes (a conflict), so the read-back looks each pair up rather than one scope per id.
function remember({ state, eventId, tenant }) {
  const scope = storageScopeOf(tenant);
  state.lookups.set(JSON.stringify([eventId, scope]), { eventId, scope });
}

// The record hashes the bytes that arrived, before decoding: two different invalid byte sequences decode
// to the same text, and byte identity must not see them as one.
function handle({ state, request, response, raw }) {
  const body = raw.toString("utf8");
  const { eventId, tenant } = parsedEvent(body);
  if (eventId !== undefined) remember({ state, eventId, tenant });
  const decision = state.faults.decide(eventId ?? "unparsed");
  const record = { event_id: eventId ?? null, occurrence: decision.occurrence, attempt: decision.attempt, body_sha256: sha256(raw), action: decision.rule.action };
  const finish = (fields) => state.records.push({ ...record, ...fields });
  ACTIONS[decision.rule.action]({ state, request, response, body, eventId, rule: decision.rule, finish });
}

export function startIngress({ collector, ingress, faults, timers = globalThis }) {
  const state = { ingress, faults, timers, pending: new Set(), codes: collector.DIAGNOSTIC_CODES, records: [], lookups: new Map() };
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => handle({ state, request, response, raw: Buffer.concat(chunks) }));
  });
  return new Promise((resolveServer) => {
    const close = () => new Promise((resolveClose) => server.close(resolveClose));
    const quiesce = async () => {
      await close();
      await Promise.all(state.pending);
    };
    server.listen(0, "127.0.0.1", () => resolveServer({ port: server.address().port, state, close, quiesce }));
  });
}

// Observation boundary 4's read-back: every (scope, event id) pair the ingress saw, looked up through the
// collector's public storage port. A found record carries the sha256 of the body it stored, so byte
// identity can be checked from the exchange through the ingress to storage.
export function readBack({ state, storage }) {
  return [...state.lookups.values()].map(({ eventId, scope }) => {
    const found = storage.get(scope, eventId);
    if (found.kind !== "found") return { event_id: eventId, scope, persisted: false, storage_result: found.kind };
    return { event_id: eventId, scope, persisted: true, stored_body_sha256: sha256(found.record.body) };
  });
}
