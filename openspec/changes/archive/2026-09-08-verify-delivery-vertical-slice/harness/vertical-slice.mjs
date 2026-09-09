// Vertical-slice verification harness for issue #109.
//
// Wires a real security-audit-sdk-node producer (HTTP handoff, bounded retry,
// bounded backpressure, deadline-bounded shutdown) to a real
// security-audit-collector ingress through an in-process fake HTTP exchange,
// and runs nine injection arms (the happy path, seven required failure
// injections, and a null control) three times each.
//
// Read-only against production source: this script performs no mutation of
// packages/security-audit-sdk-node or packages/security-audit-collector. A
// mismatch between an arm's expected and observed result is a finding to
// record, never a defect to fix in this pass (see design.md).
//
// Run with: node openspec/changes/verify-delivery-vertical-slice/harness/vertical-slice.mjs
// (after building both packages: npm run build --prefix packages/security-audit-sdk-node
// && npm run build --prefix packages/security-audit-collector)

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_NODE_DIST = resolve(__dirname, "../../../../packages/security-audit-sdk-node/dist/index.js");
const COLLECTOR_DIST = resolve(__dirname, "../../../../packages/security-audit-collector/dist/index.js");

const {
  createHttpDeliveryHandoff,
  createBoundedDeliveryRetry,
  createBoundedDeliveryBackpressure,
  createDeliveryShutdown,
} = await import(SDK_NODE_DIST);

const {
  CollectorIngress,
  SyntheticFixtureAuthenticator,
  DIAGNOSTIC_CODES,
} = await import(COLLECTOR_DIST);

const FIXTURE_TOKEN = "fixture-token-a";

const BASE_EVENT = Object.freeze({
  event: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "bloodtrail.audit.authentication.succeeded",
    category: "authentication",
    action: "authenticate",
    lifecycle_phase: "completed",
    outcome: "success",
    timestamp: "2026-09-08T12:00:00.000Z",
    observed_at: "2026-09-08T12:00:00.000Z",
    delivery_class: "security_significant",
  },
  schema: { name: "security-audit-event", version: "1.0.0" },
  producer: { name: "vertical-slice-harness", version: "1.0.0" },
  environment: { name: "synthetic" },
  service: { name: "svc" },
  tenant: { scope: "tenant" },
  actor: { type: "service_account" },
  initiator: { type: "service", id: "init-1" },
  resource: { operation_type: "read" },
  correlation: { correlation_id: "c1", operation_id: "op1" },
  data: {
    classification: "internal",
    retention_class: "security_standard",
    field_policy_version: "1.0.0",
  },
});

function eventFixture(overrides = {}) {
  return structuredClone({ ...BASE_EVENT, ...overrides });
}

/**
 * Fires on the next real tick rather than waiting wall-clock time (matching
 * this repository's own test convention, e.g. delivery-retry.test.ts). The
 * fake's `unref` is deliberately a no-op: production code calls
 * `handle.unref()` on the retry-delay and shutdown-deadline timers so a real
 * process can exit without waiting on them, but this standalone
 * top-level-await script has nothing else keeping the event loop alive (the
 * repository's own `node --test` suites don't hit this, since the test
 * runner itself keeps the process alive). Honoring a real unref here would
 * let Node's own "unsettled top-level await" detector kill the process
 * before the timer ever fires.
 */
function fakeTimers() {
  const delays = [];
  return {
    timers: Object.freeze({
      setTimeout(callback, ms) {
        delays.push(ms);
        setTimeout(callback, 0);
        return { unref: () => {} };
      },
      clearTimeout() {
        // No pending timeout is ever cancelled by the code under test here;
        // nothing to release.
      },
    }),
    delays,
  };
}

function fixedJitter(value) {
  return () => value;
}

function makeIngress(tokens = [FIXTURE_TOKEN]) {
  return new CollectorIngress({ authenticator: new SyntheticFixtureAuthenticator(tokens) });
}

function statusForDiagnosticCode(code) {
  switch (code) {
    case DIAGNOSTIC_CODES.AUTH_MISSING:
    case DIAGNOSTIC_CODES.AUTH_MALFORMED:
    case DIAGNOSTIC_CODES.AUTH_REJECTED:
      return 401;
    case DIAGNOSTIC_CODES.VERSION_UNSUPPORTED:
      return 400;
    case DIAGNOSTIC_CODES.SCHEMA_INVALID:
      return 422;
    case DIAGNOSTIC_CODES.DUPLICATE_CONFLICT:
      return 409;
    case DIAGNOSTIC_CODES.DEDUPLICATION_CAPACITY:
      return 503;
    default:
      return 400;
  }
}

/**
 * Builds a fake HTTP exchange bound to one collector ingress instance,
 * translating its real IngressResult into the shape createHttpDeliveryHandoff
 * expects (the same pattern #391's own reproduction used to discover that
 * defect). `script` is an array of per-call directives, indexed by call count
 * (0-based):
 *   "timeout"                       -> {kind:"timeout"} without touching the collector
 *   "transport_failure_after_admit" -> submits to the collector for real (so admission or
 *                                       duplicate detection genuinely happens), but reports
 *                                       transport_failure to the producer (ack lost in transit)
 *   undefined (default)             -> submits to the collector and maps its result to an
 *                                       HTTP outcome
 */
function makeExchange(ingress, { credential = FIXTURE_TOKEN, script = [] } = {}) {
  let call = 0;
  const observedIngressResults = [];

  const exchange = async (request) => {
    const directive = script[call];
    call += 1;

    if (directive === "timeout") return { kind: "timeout" };

    const result = ingress.submit({ credentials: { credential }, body: request.body });
    observedIngressResults.push(result);

    if (directive === "transport_failure_after_admit") return { kind: "transport_failure" };

    if (result.kind === "admitted" || result.kind === "duplicate") {
      return {
        kind: "response",
        status: 202,
        acknowledgments: [{ event_id: request.event_id, outcome: "accepted" }],
      };
    }
    return { kind: "response", status: statusForDiagnosticCode(result.diagnostic.code), acknowledgments: [] };
  };

  return { exchange, observedIngressResults };
}

function makeRetryChain({ script = [], tokens = [FIXTURE_TOKEN], observability } = {}) {
  const ingress = makeIngress(tokens);
  const { exchange, observedIngressResults } = makeExchange(ingress, { script });
  const handoff = createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange });
  const { timers } = fakeTimers();
  const retry = createBoundedDeliveryRetry({
    handoff,
    maxAttempts: 3,
    baseDelayMs: 0,
    maxDelayMs: 0,
    jitterSource: fixedJitter(0),
    timers,
    observability,
  });
  return { ingress, retry, observedIngressResults };
}

// ---------------------------------------------------------------- arms
//
// Each arm returns { resultClass, detail }. resultClass is the delivery-
// conformance-contract state the arm is expected to reach; detail carries
// whatever additional evidence the evidence document quotes.

async function armHappyPath() {
  const { retry } = makeRetryChain();
  const backpressure = createBoundedDeliveryBackpressure({ capacity: 10 });
  const shutdown = createDeliveryShutdown({ deadlineMs: 1000, timers: fakeTimers().timers });
  const event = eventFixture();

  const submitResult = await shutdown.submit(() => backpressure.submit(() => retry.deliver(event)));
  const report = await shutdown.shutdown();

  assert.equal(submitResult.status, "admitted");
  const deliveryResult = submitResult.result.result;
  return { resultClass: deliveryResult.status, detail: { deliveryResult, shutdownReport: report } };
}

async function armNullControl() {
  // Deliberately identical to the happy path: proves a PASS here is not a
  // harness artifact of some other arm's script leaking state (this
  // repository's own recurring lesson — every injection arm needs its
  // non-injected twin).
  return armHappyPath();
}

async function armTimeout() {
  // First attempt times out (retryable); the retry schedules attempt 1,
  // which reaches the collector for the first time and is admitted —
  // demonstrating retryable -> eventually acknowledged.
  const { retry } = makeRetryChain({ script: ["timeout"] });
  const event = eventFixture();
  const result = await retry.deliver(event);
  return { resultClass: result.status, detail: result };
}

async function armRetryExhaustion() {
  // Every attempt times out; the bounded budget (maxAttempts: 3) is spent
  // and the retry-exhaustion alert fires before the occurrence terminates.
  let exhaustedAlerted = false;
  const { retry } = makeRetryChain({
    script: ["timeout", "timeout", "timeout"],
    observability: { onExhausted: () => { exhaustedAlerted = true; } },
  });
  const event = eventFixture();
  const result = await retry.deliver(event);
  return { resultClass: result.status, detail: { result, exhaustedAlerted } };
}

async function armOverload() {
  const backpressure = createBoundedDeliveryBackpressure({ capacity: 1 });
  let releaseFirst;
  const firstNeverSettles = new Promise((resolvePromise) => { releaseFirst = resolvePromise; });

  // submit()'s depth check and increment run synchronously before its
  // awaited operation, so starting (not awaiting) this first submission
  // occupies the only capacity slot before the second submission is admitted.
  const firstSubmitPromise = backpressure.submit(() => firstNeverSettles);
  const secondResult = await backpressure.submit(async () => "unreachable");

  releaseFirst("released-for-cleanup");
  await firstSubmitPromise;

  return { resultClass: secondResult.status, detail: secondResult };
}

async function armShutdownDeadline() {
  const { timers } = fakeTimers();
  const shutdown = createDeliveryShutdown({ deadlineMs: 5, timers });
  const neverResolves = new Promise(() => {});

  // Intentionally not awaited: this operation never settles.
  shutdown.submit(() => neverResolves);
  const report = await shutdown.shutdown();

  return { resultClass: report.abandoned === 1 ? "abandoned" : "unexpected", detail: report };
}

async function armInvalidAuthentication() {
  // The ingress only accepts a different token than the one submitted.
  const ingress = makeIngress(["a-different-token"]);
  const { exchange } = makeExchange(ingress, { credential: FIXTURE_TOKEN });
  const handoff = createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange });
  const { timers } = fakeTimers();
  const retry = createBoundedDeliveryRetry({
    handoff, maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitterSource: fixedJitter(0), timers,
  });
  const event = eventFixture();
  const result = await retry.deliver(event);
  return { resultClass: result.status, detail: result };
}

async function armUnsupportedVersion() {
  const ingress = makeIngress();
  const { exchange, observedIngressResults } = makeExchange(ingress);
  const handoff = createHttpDeliveryHandoff({ path: "/v1/security-audit", exchange });
  const { timers } = fakeTimers();
  const retry = createBoundedDeliveryRetry({
    handoff, maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitterSource: fixedJitter(0), timers,
  });
  const event = eventFixture({ schema: { name: "security-audit-event", version: "9.9.9" } });
  const result = await retry.deliver(event);
  const collectorDiagnosticCode = observedIngressResults[0]?.diagnostic?.code;
  return {
    resultClass: result.status,
    detail: {
      result,
      collectorDiagnosticCode,
      distinctFromSchemaInvalid: collectorDiagnosticCode === DIAGNOSTIC_CODES.VERSION_UNSUPPORTED,
    },
  };
}

async function armDuplicate() {
  // Attempt 0 is admitted at the collector, but the ack is reported lost in
  // transit, so the producer retries. Attempt 1 (correlation.retry_attempt
  // advances to 1) reaches the same, now-live identity and must decide
  // "duplicate", not "conflict" — the #391 regression, exercised through the
  // full vertical slice rather than the collector's own unit test.
  const { retry, observedIngressResults } = makeRetryChain({ script: ["transport_failure_after_admit"] });
  const event = eventFixture();
  const result = await retry.deliver(event);
  return {
    resultClass: result.status,
    detail: {
      result,
      firstIngressDecision: observedIngressResults[0]?.kind,
      secondIngressDecision: observedIngressResults[1]?.kind,
    },
  };
}

// ---------------------------------------------------------------- runner

const ARMS = [
  ["happy_path", armHappyPath],
  ["timeout", armTimeout],
  ["retry_exhaustion", armRetryExhaustion],
  ["overload", armOverload],
  ["shutdown_deadline", armShutdownDeadline],
  ["invalid_authentication", armInvalidAuthentication],
  ["unsupported_version", armUnsupportedVersion],
  ["duplicate", armDuplicate],
  ["null_control", armNullControl],
];

const RUNS_PER_ARM = 3;

async function main() {
  const results = {};
  for (const [name, fn] of ARMS) {
    const runs = [];
    for (let i = 0; i < RUNS_PER_ARM; i += 1) {
      runs.push(await fn());
    }
    const resultClasses = runs.map((r) => r.resultClass);
    const deterministic = resultClasses.every((c) => c === resultClasses[0]);
    results[name] = { resultClass: resultClasses[0], deterministic, runs };
    console.log(`${name}: resultClass=${resultClasses[0]} deterministic=${deterministic}`);
  }
  console.log("\n=== full detail (JSON) ===");
  console.log(JSON.stringify(results, null, 2));
}

await main();
