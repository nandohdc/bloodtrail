import { recordingExchange } from "../lib/observe.mjs";
import { callback } from "./runtime.mjs";

// Boundary 3: body hashes come ONLY from lib/observe's live injected exchange,
// never from serializing a sink capture. No network implementation is supplied.
export function exchangeBoundary(state, exchange) {
  const recorded = recordingExchange({ exchange });
  const observed = callback(state, { name: "exchange", invoke: (request) => {
    const metadata = { exchange_ordinal: recorded.attempts.length + 1,
      request_attempt: request.attempt, event_id: request.event_id,
      method: request.method, path: request.path, headers: structuredClone(request.headers) };
    const pending = recorded.exchange(request);
    Object.assign(recorded.attempts.at(-1), metadata);
    return pending;
  } });
  return { exchange: observed.invoke, attempts: recorded.attempts, counts: observed.counts };
}

export function delivery(state, { exchange, durabilityProbe, path = "/v1/security-audit" }) {
  const boundary = exchangeBoundary(state, exchange);
  const probe = callback(state, { name: "probe", invoke: durabilityProbe });
  const handoff = state.call("createHttpDeliveryHandoff", () => state.node.createHttpDeliveryHandoff({ path, exchange: boundary.exchange }));
  const binding = state.call("createTransactionCriticalDelivery", () => state.node.createTransactionCriticalDelivery({ handoff, durabilityProbe: probe.invoke }));
  return { binding, handoff, boundary, probe };
}

export function commitGate(state, invoke) {
  return callback(state, { name: "gate", invoke });
}
