// Injected exchange and durability scripts for P-E case setups (boundary 3).
// These are harness-side behaviours, never SDK code: lib/delivery.mjs hands
// them to the packed binding through lib/observe's recording exchange. The
// ACK shape matches the #803 comment's exchange definition.
export function acknowledgingExchange() {
  return async (request) => ({ kind: "response", status: 202,
    acknowledgments: [{ event_id: request.event_id, outcome: "accepted" }] });
}

// A scripted callback answers from values in order, then repeats the fallback.
// P-E-4 uses it to resolve the durability probe [false, true] across two
// caller-driven delivers on one binding instance.
export function scripted(values, fallback) {
  const queue = [...values];
  return async () => (queue.length > 0 ? queue.shift() : fallback);
}

// Boundary-3 factories for scripted exchanges. Each returns one factory per
// exchange call: 503 retryable (http-response-classification.ts:57), 422
// permanent (59), a 2xx whose acknowledgment names another event (72-78), a
// timeout kind (39-40) and a synthetic throw the handoff converts to
// transport_failure (http-handoff.ts:108-113).
export const statusOutcome = (status) => () => ({ kind: "response", status, acknowledgments: [] });
export const mismatchedAckOutcome = () => () => ({ kind: "response", status: 202,
  acknowledgments: [{ event_id: "pe-not-the-event", outcome: "accepted" }] });
export const timeoutOutcome = () => () => ({ kind: "timeout" });
export const exchangeThrower = () => () => { throw new Error("synthetic exchange failure"); };

// One factory per exchange call, then the fallback. P-E-5 freezes k=3: three
// 503 responses, then the acknowledgment on call k+1.
export function exchangeScript(factories, fallback = acknowledgingExchange()) {
  const queue = [...factories];
  return async (request) => {
    const factory = queue.length > 0 ? queue.shift() : fallback;
    return factory(request);
  };
}
