import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateSecurityAuditEvent,
  type AuditTimerHandle,
  type AuditTimerProvider,
  type SecurityAuditEvent,
} from "@bloodtrail/security-audit-sdk-core";
import {
  createBoundedDeliveryRetry,
  createHttpDeliveryHandoff,
  type DeliveryRetryOptions,
  type HttpDeliveryHandoff,
  type HttpDeliveryHandoffResult,
  type HttpExchange,
  type HttpExchangeRequest,
} from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../../../contracts/security-audit/examples/positive/all-events.json");
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as SecurityAuditEvent[];
// A first execution: retry attempt 0 and no original_event_id.
const fixtureEvent = fixtures[0]!;
// A completed event carries original_event_id, so it stays valid as a re-execution.
const foundRegistration = fixtures.find((event) => event.event.name === "bloodtrail.audit.account.registration.completed");
assert.ok(foundRegistration, "registration completed fixture must be present");
const registrationCompleted = foundRegistration;

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

/** Answers the first `retryableCount` requests with a 503, then acknowledges, recording every request. */
function recordingExchange(retryableCount: number): { exchange: HttpExchange; requests: HttpExchangeRequest[] } {
  const requests: HttpExchangeRequest[] = [];
  const exchange: HttpExchange = async (request) => {
    requests.push(request);
    if (requests.length <= retryableCount) return { kind: "response", status: 503, acknowledgments: [] };
    return { kind: "response", status: 202, acknowledgments: [{ event_id: request.event_id, outcome: "accepted" }] };
  };
  return { exchange, requests };
}

function retryOverHandoff(exchange: HttpExchange, overrides: Partial<DeliveryRetryOptions> = {}) {
  const handoff = createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange });
  return createBoundedDeliveryRetry(baseOptions({ handoff, maxAttempts: 3, ...overrides }));
}

function sentEvents(requests: readonly HttpExchangeRequest[]): SecurityAuditEvent[] {
  return requests.map((request) => JSON.parse(request.body) as SecurityAuditEvent);
}

describe("Bounded delivery retry over the delivery handoff", () => {
  it("redelivers the identical occurrence on every delivery attempt", async () => {
    const { exchange, requests } = recordingExchange(2);
    const event = eventFixture();

    const result = await retryOverHandoff(exchange).deliver(event);

    assert.equal(result.status, "acknowledged");
    const bodies = requests.map((request) => request.body);
    assert.equal(bodies.length, 3);
    const expectedBody = JSON.stringify(event);
    assert.deepEqual(bodies, [expectedBody, expectedBody, expectedBody], "every attempt must send the exact canonical serialization");
    assert.deepEqual(JSON.parse(bodies[0]!), event);
  });

  it("keeps a re-execution's retry attempt on every delivery attempt", async () => {
    const { exchange, requests } = recordingExchange(1);
    const reExecution: SecurityAuditEvent = {
      ...registrationCompleted,
      correlation: { ...registrationCompleted.correlation, retry_attempt: 2 },
    };

    await retryOverHandoff(exchange).deliver(reExecution);

    assert.deepEqual(sentEvents(requests).map((sent) => sent.correlation.retry_attempt), [2, 2]);
  });

  it("sends every copy of a first execution's delivery retry in a form the SDK still validates", async () => {
    const { exchange, requests } = recordingExchange(2);
    const firstExecution = eventFixture();
    assert.equal(validateSecurityAuditEvent(firstExecution).ok, true);

    await retryOverHandoff(exchange).deliver(firstExecution);

    const verdicts = sentEvents(requests).map((sent) => {
      const validated = validateSecurityAuditEvent(sent);
      return validated.ok ? "valid" : validated.error.code;
    });
    assert.deepEqual(verdicts, ["valid", "valid", "valid"]);
  });

  it("reports each delivery attempt's ordinal through the request, the scheduling callback and the result", async () => {
    const { exchange, requests } = recordingExchange(2);
    const scheduled: number[] = [];

    const result = await retryOverHandoff(exchange, {
      observability: { onAttemptScheduled: (nextAttempt) => scheduled.push(nextAttempt) },
    }).deliver(eventFixture());

    assert.deepEqual(requests.map((request) => request.attempt), [0, 1, 2]);
    assert.deepEqual(scheduled, [1, 2]);
    assert.equal(result.attempts, 3);
  });
});
