import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditTimerHandle, AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core";
import { createDeliveryShutdown } from "../dist/index.js";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** A deadline timer that only fires when the test calls `fire()`; records whether it was cleared. */
function fakeDeadlineTimer(): { timers: AuditTimerProvider; fire: () => void; wasCleared: () => boolean } {
  let scheduled: (() => void) | undefined;
  let cleared = false;
  const timers: AuditTimerProvider = Object.freeze({
    setTimeout(callback: () => void): AuditTimerHandle {
      scheduled = callback;
      return { unref() {} };
    },
    clearTimeout(): void {
      cleared = true;
    },
  });
  return { timers, fire: () => scheduled?.(), wasCleared: () => cleared };
}

describe("Deadline-bounded delivery shutdown", () => {
  it("an empty set of operations completes before the deadline with zero abandoned", async () => {
    const { timers, wasCleared } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });

    const report = await gate.shutdown();

    assert.deepEqual(report, { accepted: 0, completed: 0, abandoned: 0 });
    assert.equal(wasCleared(), true);
  });

  it("drains admitted operations that settle before the deadline", async () => {
    const { timers, wasCleared } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
    const first = deferred<string>();
    const second = deferred<string>();

    const firstSubmit = gate.submit(() => first.promise);
    const secondSubmit = gate.submit(() => second.promise);

    const shutdownPromise = gate.shutdown();
    first.resolve("first-done");
    second.resolve("second-done");

    const report = await shutdownPromise;
    assert.deepEqual(report, { accepted: 2, completed: 2, abandoned: 0 });
    assert.equal(wasCleared(), true);
    assert.deepEqual(await firstSubmit, { status: "admitted", result: "first-done" });
    assert.deepEqual(await secondSubmit, { status: "admitted", result: "second-done" });
  });

  it("marks outstanding work abandoned with exact accounting when the deadline expires", async () => {
    const { timers, fire } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
    const first = deferred<string>();
    const second = deferred<string>();

    gate.submit(() => first.promise);
    gate.submit(() => second.promise);

    const shutdownPromise = gate.shutdown();
    fire();

    const report = await shutdownPromise;
    assert.deepEqual(report, { accepted: 2, completed: 0, abandoned: 2 });
  });

  it("never silently drops an abandoned operation — its own submit call still resolves once settled", async () => {
    const { timers, fire } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
    const first = deferred<string>();

    const firstSubmit = gate.submit(() => first.promise);
    const shutdownPromise = gate.shutdown();
    fire();
    await shutdownPromise;

    first.resolve("late-but-not-lost");
    assert.deepEqual(await firstSubmit, { status: "admitted", result: "late-but-not-lost" });
  });

  it("rejects new admission after shutdown, even a submission attempted synchronously right after", async () => {
    const { timers } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });

    gate.shutdown();
    const result = await gate.submit(async () => "should not run");

    assert.deepEqual(result, { status: "rejected_shutting_down" });
  });

  it("is idempotent across repeated and concurrent shutdown calls", async () => {
    const { timers } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });

    const first = gate.shutdown();
    const second = gate.shutdown();
    const [firstReport, secondReport] = await Promise.all([first, second]);

    assert.equal(firstReport, secondReport);
    assert.deepEqual(await gate.shutdown(), firstReport);
  });

  it("rejects invalid construction options before any submission", () => {
    const { timers } = fakeDeadlineTimer();
    for (const deadlineMs of [-1, 1.5, Number.NaN]) {
      assert.throws(() => createDeliveryShutdown({ deadlineMs, timers }), TypeError);
    }
  });
});
