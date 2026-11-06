// The reference composition every Stage 2 probe sends through, built from the kit's Node binding
// (injected as `sdkNode`):
//
//   createDeliveryShutdown ⊃ createBoundedDeliveryBackpressure ⊃ createBoundedDeliveryRetry
//     ⊃ createHttpDeliveryHandoff ⊃ createFetchHttpExchange (loopback origin only)
//
// Backpressure admits or rejects; it is not a queue. This module records observation boundary 2 (the
// primitives' callbacks and results) and boundary 3 (each delivery attempt's ordinal and body hash).
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { sha256 } from "./io.mjs";
import { isLoopbackUrl } from "./loopback-guard.mjs";

export const DELIVERY_PATH = "/v1/security-audit";

function occurrenceTrace() {
  const context = new AsyncLocalStorage();
  const trace = [];
  return {
    trace,
    run: (eventId, work) => context.run(eventId, work),
    record: (kind, fields = {}, eventId = context.getStore() ?? null) => trace.push({ sequence: trace.length + 1, event_id: eventId, kind, ...fields }),
  };
}

function callbackRecorder({ onAttemptScheduled, record }) {
  const callbacks = { scheduled: [], exhausted: [], admitted: [], rejected_overload: [], released: [] };
  const push = (name) => (...values) => {
    callbacks[name].push(values);
    record(name, { values });
  };
  return {
    callbacks,
    retry: {
      onAttemptScheduled: (next, delayMs) => {
        push("scheduled")(next, delayMs);
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
function recordingHandoff({ sdkNode, origin, token, timeoutMs, exchanges, record = () => {} }) {
  const transport = sdkNode.createFetchHttpExchange({ origin, timeoutMs, headers: { authorization: `Bearer ${token}` } });
  const exchange = async (request) => {
    exchanges.push({ event_id: request.event_id, attempt: request.attempt, body_sha256: sha256(request.body) });
    record("exchange", { attempt: request.attempt }, request.event_id);
    return transport(request);
  };
  return sdkNode.createHttpDeliveryHandoff({ path: DELIVERY_PATH, exchange });
}

function buildStack({ sdkNode, origin, token, parameters, timers, jitter, recorder, exchanges, record }) {
  const handoff = recordingHandoff({ sdkNode, origin, token, timeoutMs: parameters.exchange_timeout_ms, exchanges, record });
  const retry = sdkNode.createBoundedDeliveryRetry({
    handoff, maxAttempts: parameters.max_attempts, baseDelayMs: parameters.base_delay_ms, maxDelayMs: parameters.max_delay_ms,
    jitterSource: jitter, timers, observability: recorder.retry,
  });
  const backpressure = sdkNode.createBoundedDeliveryBackpressure({ capacity: parameters.capacity, observability: recorder.backpressure });
  const drainDeadlineMs = parameters.drain_budget_ms ?? (parameters.shutdown_deadline_ms - (parameters.report_reserve_ms ?? 0));
  const lifecycle = sdkNode.createDeliveryShutdown({ deadlineMs: drainDeadlineMs, timers: sdkNode.nodeTimers });
  return { retry, backpressure, lifecycle };
}

export function referenceComposition({ sdkNode, origin, token, parameters, timers, jitter, onAttemptScheduled = () => {} }) {
  assert(isLoopbackUrl(origin), `delivery origin must be loopback: ${origin}`);
  const exchanges = [];
  const { trace, record, run } = occurrenceTrace();
  const recorder = callbackRecorder({ onAttemptScheduled, record });
  const stack = buildStack({ sdkNode, origin, token, parameters, timers, jitter, recorder, exchanges, record });
  const shutdownTiming = {};
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
      return await stack.backpressure.submit(() => {
        record("operation_started", {}, event.event.id);
        return stack.retry.deliver(event);
      });
    } finally {
      lifecycle.finished.add(event.event.id);
    }
  };
  const settle = (eventId, delivery) => {
    record("result", { status: delivery.status, after_shutdown: shutdown.reported }, eventId);
    if (shutdown.reported && deliveries.get(eventId)?.status === "abandoned") {
      deliveryLog.push({ event_id: eventId, ...delivery, after_shutdown: true });
      return;
    }
    deliveries.set(eventId, delivery);
    deliveryLog.push({ event_id: eventId, ...delivery });
  };
  return {
    exchanges,
    trace,
    shutdownTiming,
    callbacks: recorder.callbacks,
    deliveries,
    deliveryLog,
    // A delivery that settles by throwing is recorded as "threw", which no terminal bucket explains, and
    // the throw still reaches the SDK. Left pending, shutdown would relabel it abandoned.
    deliver(event) {
      return run(event.event.id, async () => {
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
      });
    },
    // Shutdown drains within its deadline. An occurrence the lifecycle ran and that had not settled when the
    // drain returned was abandoned; one rejected while shutting down never ran and keeps its own status.
    async shutdown() {
      const started = performance.now();
      const report = await stack.lifecycle.shutdown();
      shutdownTiming.primitive_elapsed_ms = performance.now() - started;
      for (const eventId of lifecycle.started) if (!lifecycle.finished.has(eventId)) settle(eventId, { status: "abandoned", attempts: 0 });
      shutdown.reported = true;
      record("shutdown_report", { report }, null);
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
  const { trace, record, run } = occurrenceTrace();
  const callbacks = { dropped: [], loss_ceiling_reached: [] };
  const handoff = recordingHandoff({ sdkNode, origin, token, timeoutMs: parameters.exchange_timeout_ms, exchanges, record });
  const binding = sdkNode.createBestEffortDelivery({
    handoff, lossCeiling: parameters.loss_ceiling,
    observability: {
      onDropped: (eventId, lossCount) => { callbacks.dropped.push([eventId, lossCount]); record("dropped", { loss_count: lossCount }, eventId); },
      onLossCeilingReached: (lossCount) => { callbacks.loss_ceiling_reached.push([lossCount]); record("loss_ceiling_reached", { loss_count: lossCount }); },
    },
  });
  const deliveries = new Map();
  const deliveryLog = [];
  return {
    exchanges, callbacks, deliveries, deliveryLog, trace, guarantees: binding.guarantees,
    // As in the reference composition, a delivery that settles by throwing is recorded as "threw" and the
    // throw still reaches the SDK.
    deliver(event) {
      return run(event.event.id, async () => {
        const settle = (settled) => {
          record("result", { status: settled.status }, event.event.id);
          deliveries.set(event.event.id, settled);
          deliveryLog.push({ event_id: event.event.id, ...settled });
          return settled;
        };
        deliveries.set(event.event.id, { status: "pending", attempts: 0 });
        let result;
        try {
          result = await binding.deliver(event);
        } catch (error) {
          settle({ status: "threw", attempts: 0, error: error.message });
          throw error;
        }
        return settle({ status: result.status, attempts: result.attempts ?? 0, ...outcomeDetail(result) });
      });
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
