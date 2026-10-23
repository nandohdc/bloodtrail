// The reference composition every Stage 2 probe sends through, built from the kit's Node binding
// (injected as `sdkNode`):
//
//   createDeliveryShutdown ⊃ createBoundedDeliveryBackpressure ⊃ createBoundedDeliveryRetry
//     ⊃ createHttpDeliveryHandoff ⊃ createFetchHttpExchange (loopback origin only)
//
// Backpressure admits or rejects; it is not a queue. This module records observation boundary 2 (the
// primitives' callbacks and results) and boundary 3 (each delivery attempt's ordinal and body hash).
import assert from "node:assert/strict";
import { sha256 } from "./io.mjs";
import { isLoopbackUrl } from "./loopback-guard.mjs";

export const DELIVERY_PATH = "/v1/security-audit";

function callbackRecorder({ onAttemptScheduled }) {
  const callbacks = { scheduled: [], exhausted: [], admitted: [], rejected_overload: [], released: [] };
  const push = (name) => (...values) => callbacks[name].push(values);
  return {
    callbacks,
    retry: {
      onAttemptScheduled: (next, delayMs) => {
        callbacks.scheduled.push([next, delayMs]);
        onAttemptScheduled(next, delayMs);
      },
      onExhausted: push("exhausted"),
    },
    backpressure: { onAdmitted: push("admitted"), onRejectedOverload: push("rejected_overload"), onReleased: push("released") },
  };
}

// The status the composition reports for one occurrence, whichever layer settled it.
export function flatten(outcome) {
  if (outcome.status !== "admitted") return { status: outcome.status, attempts: 0 };
  const gated = outcome.result;
  if (gated.status !== "admitted") return { status: gated.status, attempts: 0 };
  return { status: gated.result.status, attempts: gated.result.attempts };
}

function buildStack({ sdkNode, origin, token, parameters, timers, jitter, recorder, exchanges }) {
  const transport = sdkNode.createFetchHttpExchange({ origin, timeoutMs: parameters.exchange_timeout_ms, headers: { authorization: `Bearer ${token}` } });
  const exchange = async (request) => {
    exchanges.push({ event_id: request.event_id, attempt: request.attempt, body_sha256: sha256(request.body) });
    return transport(request);
  };
  const handoff = sdkNode.createHttpDeliveryHandoff({ path: DELIVERY_PATH, exchange });
  const retry = sdkNode.createBoundedDeliveryRetry({
    handoff, maxAttempts: parameters.max_attempts, baseDelayMs: parameters.base_delay_ms, maxDelayMs: parameters.max_delay_ms,
    jitterSource: jitter, timers, observability: recorder.retry,
  });
  const backpressure = sdkNode.createBoundedDeliveryBackpressure({ capacity: parameters.capacity, observability: recorder.backpressure });
  const lifecycle = sdkNode.createDeliveryShutdown({ deadlineMs: parameters.shutdown_deadline_ms, timers: sdkNode.nodeTimers });
  return { retry, backpressure, lifecycle };
}

export function referenceComposition({ sdkNode, origin, token, parameters, timers, jitter, onAttemptScheduled = () => {} }) {
  assert(isLoopbackUrl(origin), `delivery origin must be loopback: ${origin}`);
  const exchanges = [];
  const recorder = callbackRecorder({ onAttemptScheduled });
  const stack = buildStack({ sdkNode, origin, token, parameters, timers, jitter, recorder, exchanges });
  // An occurrence is an event id: `deliveries` holds each id's latest settled status, and `deliveryLog`
  // keeps every delivery in order, so a repeat delivery of one id (a duplicate) loses nothing. Once
  // shutdown has reported an occurrence abandoned, a delivery that settles later is only logged, marked
  // after_shutdown: the status the shutdown report counted stays what the accounting reads.
  const deliveries = new Map();
  const deliveryLog = [];
  const shutdown = { reported: false };
  const settle = (eventId, delivery) => {
    if (shutdown.reported && deliveries.get(eventId)?.status === "abandoned") {
      deliveryLog.push({ event_id: eventId, ...delivery, after_shutdown: true });
      return;
    }
    deliveries.set(eventId, delivery);
    deliveryLog.push({ event_id: eventId, ...delivery });
  };
  return {
    exchanges,
    callbacks: recorder.callbacks,
    deliveries,
    deliveryLog,
    // A delivery that settles by throwing is recorded as "threw", which no terminal bucket explains, and
    // the throw still reaches the SDK. Left pending, shutdown would relabel it abandoned.
    async deliver(event) {
      deliveries.set(event.event.id, { status: "pending", attempts: 0 });
      let outcome;
      try {
        outcome = await stack.lifecycle.submit(() => stack.backpressure.submit(() => stack.retry.deliver(event)));
      } catch (error) {
        settle(event.event.id, { status: "threw", attempts: 0, error: error.message });
        throw error;
      }
      const settled = flatten(outcome);
      settle(event.event.id, settled);
      return settled;
    },
    // Shutdown drains within its deadline. Anything still pending when it returns was abandoned.
    async shutdown() {
      const report = await stack.lifecycle.shutdown();
      for (const [eventId, delivery] of deliveries) if (delivery.status === "pending") settle(eventId, { status: "abandoned", attempts: 0 });
      shutdown.reported = true;
      return report;
    },
  };
}

// Only a permanent refusal (a 4xx the binding will not retry) is a known rejection, as in the binding's own
// HTTP sink (http-audit-sink.ts SINK_STATUS_BY_CODE). Every other non-acknowledgment leaves the outcome
// unknown to the SDK: a protocol error (a malformed or unexpected answer) may follow a persisted write, and
// exhaustion, overload and shutdown say nothing about the peer.
const REFUSED = new Set(["non_retryable"]);

// The core sink the SDK emits into: each occurrence goes through the composition.
export function compositionSink({ composition }) {
  return {
    async emit(event) {
      const settled = await composition.deliver(event);
      if (settled.status === "acknowledged") return { status: "accepted" };
      return { status: REFUSED.has(settled.status) ? "rejected" : "unknown", code: settled.status };
    },
  };
}
