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

// The status the composition reports for one occurrence, whichever layer settled it. An overload rejection
// keeps the depth and capacity its admission result reported.
export function flatten(outcome) {
  if (outcome.status !== "admitted") return { status: outcome.status, attempts: 0 };
  const gated = outcome.result;
  if (gated.status !== "admitted") return { status: gated.status, attempts: 0, depth: gated.depth, capacity: gated.capacity };
  return { status: gated.result.status, attempts: gated.result.attempts };
}

// The single-attempt handoff over the governed fetch adapter, recording each attempt's ordinal and body hash
// (observation boundary 3) before the exchange runs.
function recordingHandoff({ sdkNode, origin, token, timeoutMs, exchanges }) {
  const transport = sdkNode.createFetchHttpExchange({ origin, timeoutMs, headers: { authorization: `Bearer ${token}` } });
  const exchange = async (request) => {
    exchanges.push({ event_id: request.event_id, attempt: request.attempt, body_sha256: sha256(request.body) });
    return transport(request);
  };
  return sdkNode.createHttpDeliveryHandoff({ path: DELIVERY_PATH, exchange });
}

function buildStack({ sdkNode, origin, token, parameters, timers, jitter, recorder, exchanges }) {
  const handoff = recordingHandoff({ sdkNode, origin, token, timeoutMs: parameters.exchange_timeout_ms, exchanges });
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
  // Which occurrences the lifecycle ran, and which of those settled, both recorded inside the operation the
  // lifecycle tracks: an occurrence settles before the lifecycle releases it, so at the drain's deadline
  // exactly the started and unfinished ones are in flight, and those are the ones shutdown labels abandoned.
  const lifecycle = { started: new Set(), finished: new Set() };
  const tracked = (event) => async () => {
    lifecycle.started.add(event.event.id);
    try {
      return await stack.backpressure.submit(() => stack.retry.deliver(event));
    } finally {
      lifecycle.finished.add(event.event.id);
    }
  };
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
        outcome = await stack.lifecycle.submit(tracked(event));
      } catch (error) {
        settle(event.event.id, { status: "threw", attempts: 0, error: error.message });
        throw error;
      }
      const settled = flatten(outcome);
      settle(event.event.id, settled);
      return settled;
    },
    // Shutdown drains within its deadline. An occurrence the lifecycle ran and that had not settled when the
    // drain returned was abandoned; one rejected while shutting down never ran and keeps its own status.
    async shutdown() {
      const report = await stack.lifecycle.shutdown();
      for (const eventId of lifecycle.started) if (!lifecycle.finished.has(eventId)) settle(eventId, { status: "abandoned", attempts: 0 });
      shutdown.reported = true;
      return report;
    },
  };
}

// What a best_effort result says beyond its status: a drop's saturating loss count, a refusal's code.
function outcomeDetail(result) {
  if (result.status === "dropped") return { loss_count: result.lossCount };
  if (result.status === "refused") return { code: result.code };
  return {};
}

// The binding's `best_effort` class over the same governed exchange: one attempt, no retry, a drop on any
// non-acknowledgment, and a saturating loss counter. Its drop and ceiling callbacks are recorded, and its
// shutdown returns the class health signal.
export function bestEffortComposition({ sdkNode, origin, token, parameters }) {
  assert(isLoopbackUrl(origin), `delivery origin must be loopback: ${origin}`);
  const exchanges = [];
  const callbacks = { dropped: [], loss_ceiling_reached: [] };
  const handoff = recordingHandoff({ sdkNode, origin, token, timeoutMs: parameters.exchange_timeout_ms, exchanges });
  const binding = sdkNode.createBestEffortDelivery({
    handoff, lossCeiling: parameters.loss_ceiling,
    observability: { onDropped: (eventId, lossCount) => callbacks.dropped.push([eventId, lossCount]), onLossCeilingReached: (lossCount) => callbacks.loss_ceiling_reached.push([lossCount]) },
  });
  const deliveries = new Map();
  const deliveryLog = [];
  return {
    exchanges, callbacks, deliveries, deliveryLog, guarantees: binding.guarantees,
    // As in the reference composition, a delivery that settles by throwing is recorded as "threw" and the
    // throw still reaches the SDK.
    async deliver(event) {
      const record = (settled) => {
        deliveries.set(event.event.id, settled);
        deliveryLog.push({ event_id: event.event.id, ...settled });
        return settled;
      };
      deliveries.set(event.event.id, { status: "pending", attempts: 0 });
      let result;
      try {
        result = await binding.deliver(event);
      } catch (error) {
        record({ status: "threw", attempts: 0, error: error.message });
        throw error;
      }
      return record({ status: result.status, attempts: result.attempts ?? 0, ...outcomeDetail(result) });
    },
    shutdown: async () => binding.shutdown(),
  };
}

// Only a permanent refusal (a 4xx the binding will not retry) is a known rejection, as in the binding's own
// HTTP sink (http-audit-sink.ts SINK_STATUS_BY_CODE). Every other non-acknowledgment leaves the outcome
// unknown to the SDK: a protocol error (a malformed or unexpected answer) may follow a persisted write, and
// exhaustion, overload and shutdown say nothing about the peer.
// The best_effort binding's own refusal (a delivery-class mismatch or an unknown event) is known too.
const REFUSED = new Set(["non_retryable", "refused"]);
// Acknowledged through the reference composition, or delivered by the `best_effort` binding.
export const DELIVERED = Object.freeze(new Set(["acknowledged", "delivered"]));

// The core sink the SDK emits into: each occurrence goes through the composition.
export function compositionSink({ composition }) {
  return {
    async emit(event) {
      const settled = await composition.deliver(event);
      if (DELIVERED.has(settled.status)) return { status: "accepted" };
      return { status: REFUSED.has(settled.status) ? "rejected" : "unknown", code: settled.status };
    },
  };
}
