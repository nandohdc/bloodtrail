import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBoundedDeliveryBackpressure } from "../dist/index.js";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Bounded delivery backpressure", () => {
  it("admits work below capacity and reports the result", async () => {
    const gate = createBoundedDeliveryBackpressure({ capacity: 2 });

    const result = await gate.submit(async () => "ok");

    assert.deepEqual(result, { status: "admitted", result: "ok" });
    assert.equal(gate.depth, 0);
  });

  it("rejects admission at capacity with a counted overload, without invoking the operation", async () => {
    const gate = createBoundedDeliveryBackpressure({ capacity: 1 });
    const first = deferred<string>();
    let secondInvoked = false;

    const firstSubmit = gate.submit(() => first.promise);
    assert.equal(gate.depth, 1);

    const secondResult = await gate.submit(async () => {
      secondInvoked = true;
      return "should not run";
    });

    assert.deepEqual(secondResult, { status: "rejected_overload", depth: 1, capacity: 1 });
    assert.equal(secondInvoked, false);

    first.resolve("first-done");
    assert.deepEqual(await firstSubmit, { status: "admitted", result: "first-done" });
  });

  it("releases capacity after completion without drift, on both success and failure", async () => {
    const gate = createBoundedDeliveryBackpressure({ capacity: 1 });

    await gate.submit(async () => "ok");
    assert.equal(gate.depth, 0);

    await assert.rejects(() => gate.submit(async () => {
      throw new Error("boom");
    }));
    assert.equal(gate.depth, 0);

    const result = await gate.submit(async () => "ok-again");
    assert.deepEqual(result, { status: "admitted", result: "ok-again" });
  });

  it("never admits more than capacity concurrently, and admits again once one settles", async () => {
    const gate = createBoundedDeliveryBackpressure({ capacity: 2 });
    const first = deferred<string>();
    const second = deferred<string>();

    const firstSubmit = gate.submit(() => first.promise);
    const secondSubmit = gate.submit(() => second.promise);
    assert.equal(gate.depth, 2);

    const thirdResult = await gate.submit(async () => "third");
    assert.deepEqual(thirdResult, { status: "rejected_overload", depth: 2, capacity: 2 });

    first.resolve("first-done");
    await firstSubmit;
    assert.equal(gate.depth, 1);

    const fourthResult = await gate.submit(async () => "fourth");
    assert.deepEqual(fourthResult, { status: "admitted", result: "fourth" });

    second.resolve("second-done");
    await secondSubmit;
  });

  it("never silently drops admitted work — it always awaits and reports settlement", async () => {
    const gate = createBoundedDeliveryBackpressure({ capacity: 3 });
    const outcomes = await Promise.all([
      gate.submit(async () => "a"),
      gate.submit(async () => "b"),
      gate.submit(async () => "c"),
    ]);

    assert.deepEqual(outcomes, [
      { status: "admitted", result: "a" },
      { status: "admitted", result: "b" },
      { status: "admitted", result: "c" },
    ]);
  });

  it("exposes admission, rejection, and release counters without operation content", async () => {
    const events: Array<{ readonly kind: string; readonly depth: number; readonly capacity: number }> = [];
    const gate = createBoundedDeliveryBackpressure({
      capacity: 1,
      observability: {
        onAdmitted: (depth, capacity) => events.push({ kind: "admitted", depth, capacity }),
        onRejectedOverload: (depth, capacity) => events.push({ kind: "rejected", depth, capacity }),
        onReleased: (depth, capacity) => events.push({ kind: "released", depth, capacity }),
      },
    });
    const first = deferred<string>();

    const firstSubmit = gate.submit(() => first.promise);
    await gate.submit(async () => "secret-payload-should-not-appear");

    first.resolve("first-secret-payload");
    await firstSubmit;

    assert.deepEqual(events, [
      { kind: "admitted", depth: 1, capacity: 1 },
      { kind: "rejected", depth: 1, capacity: 1 },
      { kind: "released", depth: 0, capacity: 1 },
    ]);
    assert.doesNotMatch(JSON.stringify(events), /secret-payload/);
  });

  it("rejects invalid construction options before any submission", () => {
    for (const capacity of [0, -1, 1.5, 100_001, Number.NaN]) {
      assert.throws(() => createBoundedDeliveryBackpressure({ capacity }), TypeError);
    }
  });
});
