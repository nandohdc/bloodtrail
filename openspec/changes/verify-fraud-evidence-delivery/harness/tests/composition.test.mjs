// The composition is wired from an injected Node binding. A fixture binding records how each primitive
// was built and nests, so the wiring is tested without importing any kit code.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketFor } from "../lib/accounting.mjs";
import { DELIVERY_PATH, compositionSink, flatten, referenceComposition } from "../lib/composition.mjs";
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

test("a non-loopback origin is refused before anything is built", () => {
  assert.throws(() => compose({ statuses: [], origin: "http://192.0.2.1:80" }), /delivery origin must be loopback/);
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
  assert.deepEqual(flatten({ status: "admitted", result: { status: "rejected_overload", depth: 4, capacity: 4 } }), { status: "rejected_overload", attempts: 0 });
  assert.deepEqual(flatten({ status: "admitted", result: { status: "admitted", result: { status: "non_retryable", attempts: 1 } } }), { status: "non_retryable", attempts: 1 });
});

test("shutdown marks still-pending deliveries abandoned, in the log too, and a later settle cannot undo it", async () => {
  const { sdkNode } = fixtureBinding({ statuses: [] });
  let release;
  sdkNode.createDeliveryShutdown = () => ({
    submit: (operation) => new Promise((resolveSubmit) => { release = () => resolveSubmit({ status: "admitted", result: { status: "admitted", result: { status: "acknowledged", attempts: 1 } } }); }),
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
