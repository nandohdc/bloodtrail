// Drives the HTTP audit sink's failure and lifecycle paths against the loopback
// peer (evaluation-kit-peer.mjs). check-evaluation-kit.mjs copies this file
// into the installed kit, type-checks it with the kit's other sources, and runs
// it there with the peer's origin as its only argument. It is never a kit item.
import assert from "node:assert/strict";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import {
  createHttpAuditSink,
  createNodeSecurityAuditSdk,
  type HttpAuditSinkOptions,
  type HttpAuditSinkOutcome,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  authoritativeTenant,
  observedSource,
  type AuditEventSink,
  type SecurityAuditSdk,
} from "@bloodtrail/security-audit-sdk-core";

const SINK_PATH = "/v1/security-audit";
const PERMANENT_STATUSES = Object.freeze([400, 401, 403, 404, 405, 409, 410, 413, 415, 422]);
const RETRYABLE_STATUSES = Object.freeze([408, 425, 429, 500, 502, 503, 504]);
const REDIRECT_STATUSES = Object.freeze([301, 302, 303, 307, 308]);
const BODY_READ_FAILURES = Object.freeze([
  { behavior: "body-reset", label: "body reset" },
  { behavior: "short-body", label: "short body" },
  { behavior: "malformed-chunk", label: "malformed chunked encoding" },
]);

interface FailureExpectation {
  readonly label: string;
  readonly code: "SDK_SINK_REJECTED" | "SDK_SINK_FAILURE";
  readonly outcome: HttpAuditSinkOutcome["outcome"];
  readonly status: number | undefined;
  /** Fields the returned error must not carry. */
  readonly absentErrorFields: ReadonlyArray<string>;
}

interface TrackedPromise<T> {
  readonly promise: Promise<T>;
  readonly settled: () => boolean;
}

const peerOrigin = readPeerOrigin();
const drivenHttpStatuses = new Set<number>();

function readPeerOrigin(): string {
  const origin = process.argv[2];
  assert(origin, "peer origin required");
  return origin;
}

function emitTestEvent(sdk: SecurityAuditSdk, id: string) {
  return sdk.accountRegistrationAttempted({
    actor: authenticatedHumanActor({ id: "actor-fail-" + id, displayName: "User " + id }),
    tenant: authoritativeTenant({
      scope: "tenant",
      actor_tenant_id: "tenant-eval-fail",
      effective_tenant_id: "tenant-eval-fail",
      resource_tenant_id: "tenant-eval-fail",
    }),
    source: observedSource({
      observed: {
        address: "203.0.113.10",
        port: 443,
      },
    }),
    request: {
      id: "req-fail-" + id,
      method: "POST",
      route: "/api/v1/accounts/register",
    },
    // The input type requires correlation for this event although the SDK
    // generates its identifiers; an empty object generates the same ones.
    correlation: {},
  });
}

function createTestSdk(sink: AuditEventSink, shutdownTimeoutMs = 5000): SecurityAuditSdk {
  return createNodeSecurityAuditSdk({
    contractVersion: CONTRACT_VERSION,
    producer: {
      name: "eval-service",
      version: "1.0.0",
    },
    service: {
      name: "eval-service",
      version: "1.0.0",
    },
    environment: {
      name: "development",
    },
    sink,
    shutdownTimeoutMs,
  });
}

function peerSinkOptions(behavior: string, timeoutMs: number): HttpAuditSinkOptions {
  return {
    origin: peerOrigin,
    path: SINK_PATH,
    timeoutMs,
    headers: { "x-peer-behavior": behavior },
  };
}

function assertOutcomeReport(
  reports: ReadonlyArray<HttpAuditSinkOutcome>,
  expectedOutcome: HttpAuditSinkOutcome["outcome"],
  expectedStatus: number | undefined,
  label: string,
): void {
  assert.equal(reports.length, 1, label + " must produce 1 outcome report");
  const report = reports[0]!;
  assert.equal(report.outcome, expectedOutcome, label + " must report outcome " + expectedOutcome);
  assert.equal(report.status, expectedStatus, label + " report must carry status " + expectedStatus);
  assert.ok(typeof report.eventId === "string" && report.eventId.length > 0, label + " report must carry eventId");
}

async function expectFailureCase(
  sinkOptions: HttpAuditSinkOptions,
  id: string,
  expected: FailureExpectation,
): Promise<void> {
  const reports: HttpAuditSinkOutcome[] = [];
  const sink = createHttpAuditSink({
    ...sinkOptions,
    onOutcome: (outcome) => {
      reports.push(outcome);
    },
  });
  const sdk = createTestSdk(sink);
  const result = await emitTestEvent(sdk, id);

  assert.equal(result.ok, false, expected.label + " must result in error");
  assert.equal(result.error.code, expected.code, expected.label + " must map to " + expected.code);
  for (const field of expected.absentErrorFields) {
    assert.equal(Reflect.get(result.error, field), undefined, "result error must carry no " + field);
  }
  assertOutcomeReport(reports, expected.outcome, expected.status, expected.label);
}

function track<T>(promise: Promise<T>): TrackedPromise<T> {
  let settled = false;
  return {
    promise: promise.then((value) => {
      settled = true;
      return value;
    }),
    settled: () => settled,
  };
}

async function expectStatusFailures(
  statuses: ReadonlyArray<number>,
  expected: Omit<FailureExpectation, "label" | "status">,
): Promise<void> {
  for (const status of statuses) {
    await expectFailureCase(peerSinkOptions(String(status), 2000), String(status), {
      ...expected,
      label: "status " + status,
      status,
    });
    drivenHttpStatuses.add(status);
  }
}

/** 1. Permanent 4xx status codes map to SDK_SINK_REJECTED and outcome http_permanent. */
function checkPermanentRejection(): Promise<void> {
  return expectStatusFailures(PERMANENT_STATUSES, {
    code: "SDK_SINK_REJECTED",
    outcome: "http_permanent",
    absentErrorFields: ["eventId", "event_id"],
  });
}

/** 2. Retryable status codes map to SDK_SINK_FAILURE and outcome http_retryable. */
function checkRetryableFailure(): Promise<void> {
  return expectStatusFailures(RETRYABLE_STATUSES, {
    code: "SDK_SINK_FAILURE",
    outcome: "http_retryable",
    absentErrorFields: ["eventId"],
  });
}

/** 3. A timeout maps to SDK_SINK_FAILURE and outcome timeout. */
async function checkTimeout(): Promise<void> {
  await expectFailureCase(peerSinkOptions("timeout", 50), "timeout-1", {
    label: "timeout",
    code: "SDK_SINK_FAILURE",
    outcome: "timeout",
    status: undefined,
    absentErrorFields: [],
  });
  await expectFailureCase(peerSinkOptions("stall-body", 50), "timeout-mid-body", {
    label: "mid-body timeout",
    code: "SDK_SINK_FAILURE",
    outcome: "timeout",
    status: undefined,
    absentErrorFields: [],
  });
}

/** 4. A refused connection maps to SDK_SINK_FAILURE and outcome transport_failure. */
async function checkTransportFailure(): Promise<void> {
  await expectFailureCase({ origin: "http://127.0.0.1:1", path: SINK_PATH, timeoutMs: 1000 }, "transport-1", {
    label: "refused connection",
    code: "SDK_SINK_FAILURE",
    outcome: "transport_failure",
    status: undefined,
    absentErrorFields: [],
  });
}

/** 5. Every non-deadline response-body read error maps to transport_failure. */
async function checkBodyReadFailure(): Promise<void> {
  for (const failure of BODY_READ_FAILURES) {
    await expectFailureCase(peerSinkOptions(failure.behavior, 2000), failure.behavior, {
      label: failure.label,
      code: "SDK_SINK_FAILURE",
      outcome: "transport_failure",
      status: undefined,
      absentErrorFields: [],
    });
  }
}

/** 6. Malformed acknowledgments map to SDK_SINK_FAILURE and outcome malformed_acknowledgment. */
async function checkMalformedAcknowledgment(): Promise<void> {
  for (const malformedCase of [
    "malformed-empty",
    "malformed-no-array",
    "malformed-wrong-id",
    "malformed-rejected",
    "malformed-not-json",
  ]) {
    await expectFailureCase(peerSinkOptions(malformedCase, 2000), "malformed-" + malformedCase, {
      label: "malformed case " + malformedCase,
      code: "SDK_SINK_FAILURE",
      outcome: "malformed_acknowledgment",
      status: 200,
      absentErrorFields: [],
    });
  }
}

/** 7. A redirection maps to SDK_SINK_FAILURE and outcome unexpected_response, and is never followed. */
async function checkRedirect(): Promise<void> {
  for (const redirectStatus of REDIRECT_STATUSES) {
    await expectFailureCase(peerSinkOptions("redirect-" + redirectStatus, 2000), "redirect-" + redirectStatus, {
      label: "redirect " + redirectStatus,
      code: "SDK_SINK_FAILURE",
      outcome: "unexpected_response",
      status: redirectStatus,
      absentErrorFields: [],
    });
    drivenHttpStatuses.add(redirectStatus);
  }
}

/** 8. Flush waits for in-flight requests. */
async function checkFlush(): Promise<void> {
  const sdk = createTestSdk(createHttpAuditSink(peerSinkOptions("hold", 5000)));

  const inFlight = track(emitTestEvent(sdk, "hold-flush"));
  await delay(50);
  const flush = track(sdk.flush());
  await delay(50);
  assert.equal(flush.settled(), false, "flush must wait for in-flight request to settle");
  assert.equal(inFlight.settled(), false, "in-flight request must remain unsettled");

  const releaseRes = await fetch(peerOrigin + "/release", { method: "POST" });
  assert.equal(releaseRes.status, 200, "release endpoint must return 200");

  const [inFlightResult, flushResult] = await Promise.all([inFlight.promise, flush.promise]);
  assert.equal(inFlightResult.ok, true, "in-flight request must succeed once released");
  assert.equal(flushResult.ok, true, "flush must succeed once earlier requests settle");
}

/** 9. Shutdown drains in-flight requests, and calls after shutdown return SDK_SHUT_DOWN. */
async function checkShutdown(): Promise<void> {
  const sdk = createTestSdk(createHttpAuditSink(peerSinkOptions("hold", 5000)), 5000);

  const inFlight = track(emitTestEvent(sdk, "hold-shutdown"));
  await delay(50);
  const shutdown = track(sdk.shutdown());

  // A call while shutdown is draining returns SDK_SHUTTING_DOWN.
  const lateEmitResult = await emitTestEvent(sdk, "late");
  assert.equal(lateEmitResult.ok, false, "emit during shutdown draining must fail");
  assert.equal(lateEmitResult.error.code, "SDK_SHUTTING_DOWN", "emit during shutdown draining must return SDK_SHUTTING_DOWN");

  await delay(50);
  assert.equal(shutdown.settled(), false, "shutdown must wait for in-flight request to drain");
  assert.equal(inFlight.settled(), false, "in-flight request must still be held");

  await fetch(peerOrigin + "/release", { method: "POST" });

  const [inFlightResult, shutdownResult] = await Promise.all([inFlight.promise, shutdown.promise]);
  assert.equal(inFlightResult.ok, true, "in-flight request must succeed once released");
  assert.equal(shutdownResult.ok, true, "shutdown must succeed once drained");
  assert.equal(sdk.state, "shut_down", "SDK state must be shut_down");

  // A call after shutdown completes returns SDK_SHUT_DOWN.
  const postShutdownResult = await emitTestEvent(sdk, "post");
  assert.equal(postShutdownResult.ok, false, "emit after shutdown completes must fail");
  assert.equal(postShutdownResult.error.code, "SDK_SHUT_DOWN", "emit after shutdown completes must return SDK_SHUT_DOWN");
}

await checkPermanentRejection();
console.log("failure-paths:permanent-rejection:pass");
await checkRetryableFailure();
console.log("failure-paths:retryable-failure:pass");
await checkTimeout();
console.log("failure-paths:timeout:pass");
await checkTransportFailure();
console.log("failure-paths:transport-failure:pass");
await checkBodyReadFailure();
console.log("failure-paths:body-read-failure:pass");
await checkMalformedAcknowledgment();
console.log("failure-paths:malformed-acknowledgment:pass");
await checkRedirect();
console.log("failure-paths:redirect:pass");
console.log("failure-paths:statuses:" + Array.from(drivenHttpStatuses).sort((first, second) => first - second).join(","));
await checkFlush();
console.log("failure-paths:flush:pass");
await checkShutdown();
console.log("failure-paths:shutdown:pass");
console.log("failure-paths:all:pass");
