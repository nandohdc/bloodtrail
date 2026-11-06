// The composition is wired from an injected Node binding. A fixture binding records how each primitive
// was built and nests, so the wiring is tested without importing any kit code.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketFor } from "../lib/accounting.mjs";
import { DELIVERY_PATH, bestEffortComposition, compositionSink, flatten, referenceComposition } from "../lib/composition.mjs";
import { sha256 } from "../lib/io.mjs";

const PARAMETERS = { exchange_timeout_ms: 2000, max_attempts: 3, base_delay_ms: 50, max_delay_ms: 500, capacity: 4, shutdown_deadline_ms: 5000 };

function fixtureBinding({ statuses }) {
  const built = {};
  const sdkNode = {
    nodeTimers: { fixture: "node-timers" },
    createFetchHttpExchange: (options) => {
      built.fetch = options;
      return async () => ({ kind: "response", status: 202, acknowledgments: [] });
    },
    createHttpDeliveryHandoff: (options) => {
      built.handoff = options;
      return { handoff: async (event, attempt) => {
        await options.exchange({ method: "POST", path: options.path, body: JSON.stringify(event), event_id: event.event.id, attempt });
        const status = statuses.shift();
        if (status === "throw") throw new TypeError("planted primitive fault");
        return { status, attempt };
      } };
    },
    createBoundedDeliveryRetry: (options) => {
      built.retry = options;
      return { deliver: async (event) => {
        for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
          const result = await options.handoff.handoff(event, attempt);
          if (result.status !== "retryable") return { status: result.status, attempts: attempt + 1 };
          if (attempt + 1 < options.maxAttempts) options.observability.onAttemptScheduled(attempt + 1, 10);
        }
        options.observability.onExhausted(options.maxAttempts);
        return { status: "exhausted", attempts: options.maxAttempts };
      } };
    },
    createBoundedDeliveryBackpressure: (options) => {
      built.backpressure = options;
      return { submit: async (operation) => {
        options.observability.onAdmitted(1, options.capacity);
        const result = await operation();
        options.observability.onReleased(0, options.capacity);
        return { status: "admitted", result };
      } };
    },
    createDeliveryShutdown: (options) => {
      built.shutdown = options;
      return { submit: async (operation) => ({ status: "admitted", result: await operation() }), shutdown: async () => ({ accepted: 1, completed: 1, abandoned: 0 }) };
    },
  };
  return { sdkNode, built };
}

const compose = ({ statuses, origin = "http://127.0.0.1:9999", scheduled = [] }) => {
  const { sdkNode, built } = fixtureBinding({ statuses });
  const timers = { fixture: "gated" };
  const jitter = () => 0.5;
  const composition = referenceComposition({ sdkNode, origin, token: "t", parameters: PARAMETERS, timers, jitter, onAttemptScheduled: (...values) => scheduled.push(values) });
  return { composition, built, timers, jitter };
};

test("the composition passes the frozen parameters to each primitive", () => {
  const { built, timers, jitter } = compose({ statuses: [] });
  assert.deepEqual(built.fetch, { origin: "http://127.0.0.1:9999", timeoutMs: 2000, headers: { authorization: "Bearer t" } });
  assert.equal(built.handoff.path, DELIVERY_PATH);
  assert.equal(built.retry.maxAttempts, 3);
  assert.equal(built.retry.baseDelayMs, 50);
  assert.equal(built.retry.maxDelayMs, 500);
  assert.equal(built.retry.timers, timers, "retry runs on the injected gated timers");
  assert.equal(built.retry.jitterSource, jitter);
  assert.equal(built.backpressure.capacity, 4);
  assert.deepEqual(built.shutdown, { deadlineMs: 5000, timers: { fixture: "node-timers" } });
});

test("the composition uses drain_budget_ms for the shutdown primitive deadline", () => {
  const { sdkNode, built } = fixtureBinding({ statuses: [] });
  const parameters = { ...PARAMETERS, shutdown_deadline_ms: 200, drain_budget_ms: 180, report_reserve_ms: 20 };
  referenceComposition({ sdkNode, origin: "http://127.0.0.1:9999", token: "t", parameters, timers: {}, jitter: () => 0.5 });
  assert.deepEqual(built.shutdown, { deadlineMs: 180, timers: { fixture: "node-timers" } });
});

test("a non-loopback origin is refused before anything is built", () => {
  assert.throws(() => compose({ statuses: [], origin: "http://192.0.2.1:80" }), /delivery origin must be loopback/);
});

test("an overload callback is attributed before its result and the rejected operation never starts", async () => {
  const { sdkNode } = fixtureBinding({ statuses: [] });
  sdkNode.createBoundedDeliveryBackpressure = ({ observability }) => ({ submit: async () => {
    observability.onRejectedOverload(4, 4);
    return { status: "rejected_overload", depth: 4, capacity: 4 };
  } });
  const composition = referenceComposition({ sdkNode, origin: "http://127.0.0.1:9999", token: "fixture", parameters: PARAMETERS, timers: {}, jitter: () => 0.5 });
  await composition.deliver({ event: { id: "rejected" } });
  const callback = composition.trace.find((entry) => entry.kind === "rejected_overload");
  const result = composition.trace.find((entry) => entry.kind === "result");
  assert.equal(callback.event_id, "rejected");
  assert(callback.sequence < result.sequence);
  assert.equal(composition.trace.some((entry) => entry.kind === "operation_started" || entry.kind === "exchange"), false);
});

test("each attempt's ordinal and body hash are recorded, and retry callbacks are observed", async () => {
  const scheduled = [];
  const { composition } = compose({ statuses: ["retryable", "acknowledged"], scheduled });
  const event = { event: { id: "e-1" } };
  assert.deepEqual(await composition.deliver(event), { status: "acknowledged", attempts: 2 });
  const hash = sha256(JSON.stringify(event));
  assert.deepEqual(composition.exchanges, [{ event_id: "e-1", attempt: 0, body_sha256: hash }, { event_id: "e-1", attempt: 1, body_sha256: hash }]);
  assert.deepEqual(composition.callbacks.scheduled, [[1, 10]]);
  assert.deepEqual(scheduled, [[1, 10]], "the orchestrator hook sees every scheduled retry");
  assert.deepEqual(composition.callbacks.admitted, [[1, 4]]);
  assert.deepEqual(composition.callbacks.released, [[0, 4]]);
  assert.deepEqual(composition.deliveries.get("e-1"), { status: "acknowledged", attempts: 2 });
});

test("a repeat delivery of one event id keeps both deliveries in the log", async () => {
  const { composition } = compose({ statuses: ["acknowledged", "non_retryable"] });
  const event = { event: { id: "e-5" } };
  await composition.deliver(event);
  await composition.deliver(event);
  assert.deepEqual(composition.deliveryLog, [
    { event_id: "e-5", status: "acknowledged", attempts: 1 }, { event_id: "e-5", status: "non_retryable", attempts: 1 },
  ]);
  assert.deepEqual(composition.deliveries.get("e-5"), { status: "non_retryable", attempts: 1 });
});

test("exhaustion is reported through onExhausted and as the delivery's status", async () => {
  const { composition } = compose({ statuses: ["retryable", "retryable", "retryable"] });
  assert.deepEqual(await composition.deliver({ event: { id: "e-2" } }), { status: "exhausted", attempts: 3 });
  assert.deepEqual(composition.callbacks.exhausted, [[3]]);
  assert.equal(composition.callbacks.scheduled.length, 2);
});

test("flatten reports whichever layer settled the occurrence", () => {
  assert.deepEqual(flatten({ status: "rejected_shutting_down" }), { status: "rejected_shutting_down", attempts: 0 });
  assert.deepEqual(flatten({ status: "admitted", result: { status: "rejected_overload", depth: 4, capacity: 4 } }), { status: "rejected_overload", attempts: 0, depth: 4, capacity: 4 });
  assert.deepEqual(flatten({ status: "admitted", result: { status: "admitted", result: { status: "non_retryable", attempts: 1 } } }), { status: "non_retryable", attempts: 1 });
});

test("shutdown marks still-pending deliveries abandoned, in the log too, and a later settle cannot undo it", async () => {
  const { sdkNode } = fixtureBinding({ statuses: [] });
  let release;
  // The lifecycle runs the operation it admits; the delivery inside it is still held at the deadline.
  sdkNode.createBoundedDeliveryBackpressure = () => ({
    submit: () => new Promise((resolveSubmit) => { release = () => resolveSubmit({ status: "admitted", result: { status: "acknowledged", attempts: 1 } }); }),
  });
  sdkNode.createDeliveryShutdown = () => ({
    submit: async (operation) => ({ status: "admitted", result: await operation() }),
    shutdown: async () => ({ accepted: 1, completed: 0, abandoned: 1 }),
  });
  const composition = referenceComposition({ sdkNode, origin: "http://127.0.0.1:9999", token: "t", parameters: PARAMETERS, timers: {}, jitter: () => 0.5 });
  const late = composition.deliver({ event: { id: "e-3" } });
  assert.deepEqual(await composition.shutdown(), { accepted: 1, completed: 0, abandoned: 1 });
  assert.deepEqual(composition.deliveries.get("e-3"), { status: "abandoned", attempts: 0 });
  release();
  await late;
  assert.deepEqual(composition.deliveries.get("e-3"), { status: "abandoned", attempts: 0 }, "the shutdown report's status stands");
  assert.deepEqual(composition.deliveryLog, [
    { event_id: "e-3", status: "abandoned", attempts: 0 }, { event_id: "e-3", status: "acknowledged", attempts: 1, after_shutdown: true },
  ]);
});

test("a submission rejected while shutting down never ran, so shutdown does not relabel it abandoned", async () => {
  const { sdkNode } = fixtureBinding({ statuses: [] });
  sdkNode.createDeliveryShutdown = () => ({
    submit: async () => ({ status: "rejected_shutting_down" }),
    shutdown: async () => ({ accepted: 0, completed: 0, abandoned: 0 }),
  });
  const composition = referenceComposition({ sdkNode, origin: "http://127.0.0.1:9999", token: "t", parameters: PARAMETERS, timers: {}, jitter: () => 0.5 });
  const rejected = composition.deliver({ event: { id: "e-5" } });
  await composition.shutdown();
  assert.deepEqual(await rejected, { status: "rejected_shutting_down", attempts: 0 });
  assert.deepEqual(composition.deliveries.get("e-5"), { status: "rejected_shutting_down", attempts: 0 });
  assert.deepEqual(composition.deliveryLog, [{ event_id: "e-5", status: "rejected_shutting_down", attempts: 0 }]);
});

test("planted defect: a delivery that throws is recorded as threw, stays unexplained, and is not relabelled abandoned", async () => {
  const { composition } = compose({ statuses: ["throw"] });
  await assert.rejects(composition.deliver({ event: { id: "e-4" } }), /planted primitive fault/);
  await composition.shutdown();
  const delivery = composition.deliveries.get("e-4");
  assert.deepEqual(delivery, { status: "threw", attempts: 0, error: "planted primitive fault" });
  assert.equal(bucketFor({ persisted: false, delivery: delivery.status }), "unexplained");
});

test("the core sink reports acknowledgment as accepted, a permanent refusal as rejected, and every other loss as unknown", async () => {
  const sinkFor = (status) => compositionSink({ composition: { deliver: async () => ({ status, attempts: 1 }) } });
  assert.deepEqual(await sinkFor("acknowledged").emit({}), { status: "accepted" });
  assert.deepEqual(await sinkFor("non_retryable").emit({}), { status: "rejected", code: "non_retryable" });
  for (const status of ["protocol_error", "exhausted", "rejected_overload", "rejected_shutting_down"]) assert.deepEqual(await sinkFor(status).emit({}), { status: "unknown", code: status });
});

// The best_effort composition over a fixture binding: what the binding returns is recorded as it is, a
// throwing delivery as "threw", and the callbacks the binding raises are kept in order.
test("the best_effort composition records each result, the binding's callbacks, and a throw", async () => {
  const { sdkNode } = fixtureBinding({ statuses: [] });
  const results = [{ status: "delivered", attempts: 1 }, { status: "dropped", attempts: 1, lossCount: 1 }, "throw", { status: "refused", code: "delivery_class_mismatch" }];
  sdkNode.createBestEffortDelivery = (options) => ({
    guarantees: { deliveryClass: "best_effort", semantic: "at_most_once" },
    deliver: async (event) => {
      await options.handoff.handoff(event, 0);
      const result = results.shift();
      if (result === "throw") throw new TypeError("planted binding fault");
      if (result.status === "dropped") {
        options.observability.onLossCeilingReached(1);
        options.observability.onDropped(event.event.id, 1);
      }
      return result;
    },
    shutdown: () => ({ deliveryClass: "best_effort", lossCount: 1, lossCeilingReached: true, claimsDelivered: false }),
  });
  const composition = bestEffortComposition({ sdkNode, origin: "http://127.0.0.1:9999", token: "t", parameters: { exchange_timeout_ms: 2000, loss_ceiling: 1 } });
  const sink = compositionSink({ composition });
  assert.deepEqual(await sink.emit({ event: { id: "b-1" } }), { status: "accepted" });
  assert.deepEqual(await sink.emit({ event: { id: "b-2" } }), { status: "unknown", code: "dropped" });
  await assert.rejects(sink.emit({ event: { id: "b-3" } }), /planted binding fault/);
  assert.deepEqual(await sink.emit({ event: { id: "b-4" } }), { status: "rejected", code: "refused" });
  assert.deepEqual(Object.fromEntries(composition.deliveries), {
    "b-1": { status: "delivered", attempts: 1 }, "b-2": { status: "dropped", attempts: 1, loss_count: 1 },
    "b-3": { status: "threw", attempts: 0, error: "planted binding fault" }, "b-4": { status: "refused", attempts: 0, code: "delivery_class_mismatch" },
  });
  assert.deepEqual(composition.callbacks, { dropped: [["b-2", 1]], loss_ceiling_reached: [[1]] });
  const signal = composition.trace.find((entry) => entry.kind === "loss_ceiling_reached");
  assert.equal(signal.event_id, "b-2");
  assert(signal.sequence < composition.trace.find((entry) => entry.event_id === "b-2" && entry.kind === "result").sequence);
  assert.equal(composition.exchanges.length, 4);
  assert.deepEqual(await composition.shutdown(), { deliveryClass: "best_effort", lossCount: 1, lossCeilingReached: true, claimsDelivered: false });
  assert.equal(bucketFor({ persisted: false, delivery: "refused" }), "unexplained", "a refusal is a misrouted occurrence, not an explained loss");
  assert.equal(bucketFor({ persisted: false, delivery: "dropped" }), "reported_undelivered");
});
