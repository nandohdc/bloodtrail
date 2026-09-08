import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AuditTimerHandle, AuditTimerProvider, SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";
import {
  createBoundedDeliveryRetry,
  type DeliveryRetryOptions,
  type HttpDeliveryHandoff,
  type HttpDeliveryHandoffResult,
} from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../../../contracts/security-audit/examples/positive/all-events.json");
const fixtureEvent = JSON.parse(readFileSync(fixturePath, "utf8"))[0] as SecurityAuditEvent;

function eventFixture(): SecurityAuditEvent {
  return JSON.parse(JSON.stringify(fixtureEvent)) as SecurityAuditEvent;
}

/** Fires on the next tick instead of waiting real wall-clock time, but records the requested delay. */
function fakeTimers(): { timers: AuditTimerProvider; delays: number[] } {
  const delays: number[] = [];
  const timers: AuditTimerProvider = Object.freeze({
    setTimeout(callback: () => void, ms: number): AuditTimerHandle {
      delays.push(ms);
      const raw = setTimeout(callback, 0);
      return { unref: () => raw.unref() };
    },
    clearTimeout(): void {
      // No pending timeout is ever cancelled by this module; nothing to release.
    },
  });
  return { timers, delays };
}

function fixedJitter(value: number) {
  return () => value;
}

type ScriptedStatus = HttpDeliveryHandoffResult["status"];

function scriptedHandoff(statuses: readonly ScriptedStatus[]): { handoff: HttpDeliveryHandoff; attempts: number[] } {
  const attempts: number[] = [];
  const handoff: HttpDeliveryHandoff = {
    async handoff(event, attempt = 0): Promise<HttpDeliveryHandoffResult> {
      attempts.push(attempt);
      const status = statuses[attempts.length - 1] ?? statuses[statuses.length - 1]!;
      const code: HttpDeliveryHandoffResult["code"] = status === "acknowledged"
        ? "acknowledged"
        : status === "retryable"
          ? "http_retryable"
          : status === "non_retryable"
            ? "http_permanent"
            : "malformed_acknowledgment";
      return { status, code, event_id: event.event.id, attempt };
    },
  };
  return { handoff, attempts };
}

function baseOptions(overrides: Partial<DeliveryRetryOptions> = {}): DeliveryRetryOptions {
  const { timers } = fakeTimers();
  return {
    handoff: scriptedHandoff(["retryable"]).handoff,
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    jitterSource: fixedJitter(0.5),
    timers,
    ...overrides,
  };
}

describe("Bounded delivery retry", () => {
  it("only retries a retryable outcome and stops immediately on any other terminal status", async () => {
    const { handoff, attempts } = scriptedHandoff(["non_retryable"]);
    const retry = createBoundedDeliveryRetry(baseOptions({ handoff, maxAttempts: 5 }));
    const event = eventFixture();

    const result = await retry.deliver(event);

    assert.deepEqual(result, { status: "non_retryable", code: "http_permanent", event_id: event.event.id, attempts: 1 });
    assert.deepEqual(attempts, [0]);
  });

  it("never exceeds the configured maximum attempts and terminates exhausted", async () => {
    const { handoff, attempts } = scriptedHandoff(["retryable", "retryable", "retryable"]);
    let exhaustedWith: number | undefined;
    const retry = createBoundedDeliveryRetry(
      baseOptions({ handoff, maxAttempts: 3, observability: { onExhausted: (n) => { exhaustedWith = n; } } }),
    );
    const event = eventFixture();

    const result = await retry.deliver(event);

    assert.deepEqual(result, { status: "exhausted", code: "retry_exhausted", event_id: event.event.id, attempts: 3 });
    assert.deepEqual(attempts, [0, 1, 2]);
    assert.equal(exhaustedWith, 3);
  });

  it("mutating a retryable outcome to permanent prevents the next attempt", async () => {
    const { handoff, attempts } = scriptedHandoff(["retryable", "non_retryable", "retryable"]);
    const retry = createBoundedDeliveryRetry(baseOptions({ handoff, maxAttempts: 5 }));
    const event = eventFixture();

    const result = await retry.deliver(event);

    assert.equal(result.status, "non_retryable");
    assert.equal(result.attempts, 2);
    assert.deepEqual(attempts, [0, 1]);
  });

  it("computes deterministic capped-exponential jittered delays and never schedules a delay after the final attempt", async () => {
    const { handoff } = scriptedHandoff(["retryable", "retryable", "retryable"]);
    const scheduled: Array<[number, number]> = [];
    const retry = createBoundedDeliveryRetry(
      baseOptions({
        handoff,
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterSource: fixedJitter(0.5),
        observability: { onAttemptScheduled: (next, delayMs) => scheduled.push([next, delayMs]) },
      }),
    );

    await retry.deliver(eventFixture());

    // attempt 0 retryable -> delay before attempt 1: min(100*2^0,1000)*0.5 = 50
    // attempt 1 retryable -> delay before attempt 2: min(100*2^1,1000)*0.5 = 100
    // attempt 2 retryable -> exhausted, no further delay scheduled
    assert.deepEqual(scheduled, [[1, 50], [2, 100]]);
  });

  it("caps the exponential delay at maxDelayMs", async () => {
    const { handoff } = scriptedHandoff(["retryable", "retryable"]);
    const scheduled: number[] = [];
    const retry = createBoundedDeliveryRetry(
      baseOptions({
        handoff,
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 1500,
        jitterSource: fixedJitter(1 - Number.EPSILON),
        observability: { onAttemptScheduled: (_next, delayMs) => scheduled.push(delayMs) },
      }),
    );

    await retry.deliver(eventFixture());

    // Uncapped second delay would be 1000*2^1=2000, capped to maxDelayMs=1500.
    assert.ok(scheduled[1]! <= 1500, `expected capped delay <= 1500, got ${scheduled[1]}`);
  });

  it("single-attempt budget makes exactly one attempt and schedules no delay", async () => {
    const { handoff, attempts } = scriptedHandoff(["retryable"]);
    const scheduled: number[] = [];
    const retry = createBoundedDeliveryRetry(
      baseOptions({ handoff, maxAttempts: 1, observability: { onAttemptScheduled: (_n, d) => scheduled.push(d) } }),
    );

    const result = await retry.deliver(eventFixture());

    assert.equal(result.status, "exhausted");
    assert.equal(result.attempts, 1);
    assert.deepEqual(attempts, [0]);
    assert.deepEqual(scheduled, []);
  });

  it("an immediate acknowledgment makes exactly one attempt and schedules no delay", async () => {
    const { handoff, attempts } = scriptedHandoff(["acknowledged"]);
    const retry = createBoundedDeliveryRetry(baseOptions({ handoff, maxAttempts: 5 }));
    const event = eventFixture();

    const result = await retry.deliver(event);

    assert.deepEqual(result, { status: "acknowledged", code: "acknowledged", event_id: event.event.id, attempts: 1 });
    assert.deepEqual(attempts, [0]);
  });

  it("rejects a jitter source that returns a value outside [0, 1)", async () => {
    const { handoff } = scriptedHandoff(["retryable", "retryable"]);
    const retry = createBoundedDeliveryRetry(baseOptions({ handoff, maxAttempts: 3, jitterSource: fixedJitter(1) }));

    await assert.rejects(() => retry.deliver(eventFixture()), TypeError);
  });

  it("rejects invalid construction options before any attempt is made", () => {
    for (const overrides of [
      { maxAttempts: 0 },
      { maxAttempts: 1.5 },
      { maxAttempts: 1001 },
      { baseDelayMs: -1 },
      { maxDelayMs: -1 },
      { baseDelayMs: 200, maxDelayMs: 100 },
    ] as const) {
      assert.throws(() => createBoundedDeliveryRetry(baseOptions(overrides)), TypeError);
    }
  });
});
