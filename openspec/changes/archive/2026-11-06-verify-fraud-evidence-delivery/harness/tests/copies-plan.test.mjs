import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scheduledFaultPlan } from "../lib/faults.mjs";
import { command, jsonFile, sha256 } from "../lib/io.mjs";
import { roleChannel } from "../lib/launcher.mjs";
import { importEdges, validateProbeInventory } from "../lib/import-closure.mjs";
import { ROLE_SCRIPTS } from "../lib/plan.mjs";
import { CHANGE } from "../lib/results.mjs";
import { validateExpectations } from "../copies/expectations.mjs";
import { PROBE_FILES } from "../copies/files.mjs";
import { phaseCallPlan } from "../copies/call-plan.mjs";
import { authenticationInput } from "../copies/workload.mjs";
import { bindIngressProcess, createIngressHandlers } from "../copies/ingress-role.mjs";
import { senderRun } from "../copies/sender-phases.mjs";
import { copiesSession, senderInput } from "../copies/session.mjs";
import {
  createBoundedDeliveryRetry,
  createDeliveryShutdown,
  createHttpDeliveryHandoff,
  nodeTimers,
} from "./copies-fake-binding.mjs";
import { serializeIpcMessage } from "./copies-fake-roles.mjs";
import { recordedCall, testSenderSdk } from "./copies-fake-sdk.mjs";
import { createRehearsalEnv, fakeCore, fakeSdkNode, SecurityAuditSdkError } from "./copies-fakes.mjs";

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = command({ program: "git", args: ["rev-parse", "--show-toplevel"], cwd: HARNESS }).trim();
const FROZEN_V1 = jsonFile(new URL("../expectations/copies.v1.json", import.meta.url));
const FROZEN_V2 = jsonFile(new URL("../expectations/copies.v2.json", import.meta.url));
const source = (path) => readFileSync(join(HARNESS, path), "utf8");

test("the frozen copies.v1.json is byte-identical and retains its hash", () => {
  const bytes = readFileSync(new URL("../expectations/copies.v1.json", import.meta.url));
  assert.equal(sha256(bytes), "60e701ca2b8d473592cd2b695b425889d3d66980e18891edc85675b795a9ec60");
});

test("the frozen copies.v1.json is refused by runner selection, validateExpectations accepts version 2 only", () => {
  assert.throws(() => validateExpectations(structuredClone(FROZEN_V1)), /version/);
});

test("copies.v2.json validates, and mutating it is refused", () => {
  assert.equal(validateExpectations(structuredClone(FROZEN_V2)).version, 2);
  const mutations = [
    (value) => { value.version = 3; },
    (value) => { value.version = "latest"; },
    (value) => { value.contract_version = "2.0.0"; },
    (value) => { value.ticket = 999; },
    (value) => { value.cases.pop(); },
    (value) => { value.cases[0].basis = []; },
    (value) => { value.cases[2].case_id = "C-09"; },
    (value) => { value.workload.seed = 0; },
    (value) => { value.clock.step_ms = 0; },
    (value) => { value.phases[0].composition.max_attempts = 0; },
    (value) => { delete value.phases[0].cycles; },
    (value) => { value.phases[0].cycles = "1"; },
    (value) => { value.phases[0].cycles = 0; },
    (value) => { value.phases[0].unknown_key = true; },
    (value) => { value.planned_call_budget.total = 148; },
    (value) => { value.planned_call_budget.processes.identities = 4; },
    (value) => { value.phases[0].occurrences = 0; },
    (value) => { value.phases[0].distinct_occurrences = 0; },
    (value) => { value.scenarios.unknown_scenario = []; },
    (value) => { value.phases[0].schedule[0] = "unknown_scenario"; },
    (value) => { value.phases[0].cycles = 2; },
    (value) => { value.phases[0].collector_restart = true; },
    (value) => { value.phases[0].without_storage = true; },
    (value) => { value.phases[0].gate_timers = true; },
    (value) => { value.phases[2].gate_timers = undefined; },
    (value) => {
      value.phases[0].occurrences = 5;
      value.phases[0].schedule = ["clean", "clean", "clean", "clean", "retry_once"];
      value.planned_call_budget.processes.identities = 7;
      value.planned_call_budget.total = 151;
    },
    (value) => { value.composition.capacity = 100_001; },
    (value) => { value.composition.max_attempts = 1001; },
    (value) => { value.composition.exchange_timeout_ms = 60_001; },
    (value) => { value.composition.max_delay_ms = value.composition.base_delay_ms - 1; },
    (value) => { value.composition.max_attempts = 0; },
    (value) => { value.planned_call_budget = { malformed: true }; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(FROZEN_V2);
    mutate(value);
    assert.throws(() => validateExpectations(value), undefined, mutate.toString());
  }
});

const CITATION_SUBSTRINGS = {
  "C-01": [
    "The body is the occurrence exactly as supplied",
    "putWithoutThrowing(port, prepared.scope, prepared.record)",
  ],
  "C-02": [
    "retry_attempt: retry?.retry_attempt ?? frame.correlation?.retry_attempt ?? 0",
    "correlation.retry_attempt counts",
  ],
  "C-03": [
    "existing.occurrence_key === record.occurrenceKey",
    'acknowledgment: "persisted"',
  ],
  "C-04": [
    'return { kind: "failed", reason: "conflict" };',
    "DIAGNOSTIC_CODES.STORAGE_CONFLICT",
  ],
  "C-05": [
    "retry && retry.retry_attempt > 0 && !retry.original_event_id",
    "retry_attempt: retry?.retry_attempt ?? frame.correlation?.retry_attempt ?? 0",
    "original_event_id: retry?.original_event_id ?? frame.correlation?.original_event_id",
    "ON CONFLICT (scope_kind, scope_tenant, event_id) DO NOTHING",
  ],
  "C-06": [
    "ON CONFLICT (scope_kind, scope_tenant, event_id) DO NOTHING",
    "existing.occurrence_key === record.occurrenceKey",
  ],
  "C-07": [
    "onAttemptScheduled?(nextAttempt: number, delayMs: number): void;",
    "DeliveryShutdownReport",
    "const redelivery = input.redelivery?.event;",
  ],
  "C-08": [
    "DEDUPLICATION_MAX_RECORDS = 32",
    "DIAGNOSTIC_CODES.DEDUPLICATION_CAPACITY",
    'kind: "admitted"',
  ],
  "C-09": [
    'return { kind: "failed", reason: "conflict" };',
  ],
  "C-10": [
    "const response = await fetch(`${origin}${request.path}`, {",
  ],
  "C-11": [
    "ON CONFLICT (scope_kind, scope_tenant, event_id) DO NOTHING",
    "existing.occurrence_key === record.occurrenceKey",
  ],
};

test("every basis citation in copies.v2.json names an existing line containing the cited rule substring", () => {
  assert.equal(FROZEN_V2.base, "a2cdbc120eabaf95479bc83e8afbd3aff50ed9f2");
  const fileCache = new Map();
  const getFile = (path) => {
    if (!fileCache.has(path)) {
      fileCache.set(path, command({ program: "git", args: ["show", `${FROZEN_V2.base}:${path}`], cwd: REPO }));
    }
    return fileCache.get(path);
  };
  for (const entry of FROZEN_V2.cases) {
    const requiredSubstrings = CITATION_SUBSTRINGS[entry.case_id];
    assert(requiredSubstrings, `missing citation substrings definition for ${entry.case_id}`);
    assert.equal(entry.basis.length, requiredSubstrings.length, `${entry.case_id} basis length mismatch`);

    for (let i = 0; i < entry.basis.length; i += 1) {
      const citation = entry.basis[i];
      const substring = requiredSubstrings[i];
      const [path, line] = citation.split(":");
      const text = getFile(path);
      const lines = text.split("\n");
      const lineNum = Number(line);
      assert(lineNum >= 1 && lineNum <= lines.length, `${entry.case_id}: ${citation} is past end of file`);
      const lineText = lines[lineNum - 1];
      assert(lineText.includes(substring), `${entry.case_id}: line ${line} in ${path} ("${lineText.trim()}") must contain "${substring}"`);
    }
  }
});

function derivesPlanValues(phase) {
  const steps = phaseCallPlan(phase);
  const distinctEventIds = steps.filter((s) => s.step === "new" || s.step === "re_execution" || s.step === "retry_target").length;
  const budgetUpper = steps.filter((s) => s.step !== "ingress_restart").length;
  return { distinctEventIds, budgetUpper };
}

test("distinct_occurrences and planned_call_budget match derived workload generators without SDK", () => {
  let totalBudget = 0;
  for (const phase of FROZEN_V2.phases) {
    const derived = derivesPlanValues(phase);
    assert.equal(phase.distinct_occurrences, derived.distinctEventIds, `${phase.name} distinct_occurrences mismatch`);
    const budget = FROZEN_V2.planned_call_budget.processes[phase.name];
    assert(budget >= derived.budgetUpper, `${phase.name} budget ${budget} must be >= derived calls ${derived.budgetUpper}`);
    assert.equal(budget, derived.budgetUpper, `${phase.name} budget upper bound mismatch`);
    totalBudget += budget;
  }
  assert.equal(FROZEN_V2.planned_call_budget.total, totalBudget);
  assert.equal(totalBudget, 149);
});

test("planned_call_budget in copies.v2.json matches the sender plan", () => {
  const budget = FROZEN_V2.planned_call_budget;
  const consumerPhase = FROZEN_V2.phases.find((p) => p.name === "consumer_restart");
  const derivedConsumerBudget = consumerPhase.occurrences * 2;
  assert.equal(derivedConsumerBudget, 8);
  assert.deepEqual(budget.processes, {
    identities: 5,
    collector_restart: 3,
    consumer_restart: derivedConsumerBudget,
    storage_less: 33,
    duplicates_volume: 100,
  });
  assert.equal(budget.total, 149);
});

test("each role's import closure is inside the declared inventory, and a missing module is caught", () => {
  const roleScripts = Object.values(ROLE_SCRIPTS);
  const closure = validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "copies", files: PROBE_FILES, roleScripts });
  assert.deepEqual(closure, [...PROBE_FILES].sort(), "the inventory declares exactly the closure");
  const withoutIo = PROBE_FILES.filter((path) => path !== "lib/io.mjs");
  assert.throws(() => validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "copies", files: withoutIo, roleScripts }), /missing from approved inventory: .*lib\/io\.mjs/);
});

test("kit packages are imported only by the role processes, each only its own", () => {
  const kitImports = (path) => [...source(path).matchAll(/from "(@bloodtrail\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(kitImports("copies/sender-process.mjs"), ["@bloodtrail/security-audit-sdk-core", "@bloodtrail/security-audit-sdk-node"]);
  assert.deepEqual(kitImports("copies/ingress-process.mjs"), ["@bloodtrail/security-audit-collector"]);
  const orchestration = [
    "copies/run-copies.mjs",
    "copies/session.mjs",
    "copies/evaluate.mjs",
    "copies/expectations.mjs",
    "copies/workload.mjs",
    "copies/controls.mjs",
    "copies/call-plan.mjs",
    "copies/consumer-restart.mjs",
    "copies/sender-phases.mjs",
    "copies/ingress-role.mjs",
    "copies/observations.mjs",
  ];
  for (const path of orchestration) assert.deepEqual(kitImports(path), [], `${path} must not import kit code`);
});

test("each role imports the role guard first, so it is installed before any kit module evaluates", () => {
  for (const script of Object.values(ROLE_SCRIPTS)) {
    const [first] = source(`copies/${script}`).match(/^import .*$/m);
    assert.match(first, /from "\.\.\/lib\/role-guard\.mjs";$/, script);
  }
});

test("the approval-gated entry only delegates to the shared runner", () => {
  const entry = source("copies/run-copies.mjs");
  assert(entry.includes('import { runProbe } from "../lib/probe-runner.mjs";'));
  assert(entry.includes("const session = await runProbe({"));
  assert(entry.includes("process.exitCode = session.exitCode;"));
  assert(entry.includes("expectationsVersion: 2"));
  assert(entry.includes("supportedVersions: [2]"));
  assert(!entry.includes('"latest"'));
  assert(!entry.includes("runApprovedSession"));
});

function collectTransitiveImports(root) {
  const visited = new Set();
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    const text = readFileSync(join(HARNESS, current), "utf8");
    const dir = posix.dirname(current);
    const edges = importEdges(text);
    for (const edge of edges) {
      queue.push(posix.normalize(posix.join(dir, edge)));
    }
  }
  return visited;
}

test("copies test modules do not import role-guard.mjs or sender-role.mjs directly or transitively", () => {
  const testRoots = [
    "tests/copies-consumer-restart.test.mjs",
    "tests/copies-evaluate.test.mjs",
    "tests/copies-fakes.mjs",
    "tests/copies-plan.test.mjs",
    "tests/copies-session-rehearsal.test.mjs",
    "tests/collector-fixture.mjs",
  ];
  for (const root of testRoots) {
    const visited = collectTransitiveImports(root);
    assert(!visited.has("lib/role-guard.mjs"), `${root} imports lib/role-guard.mjs transitively`);
    assert(!visited.has("lib/sender-role.mjs"), `${root} imports lib/sender-role.mjs transitively`);
  }
});

const BRACE_DELTA = { "{": 1, "}": -1 };

function balancedSpanAfter({ text, marker, startAfter }) {
  const markerIdx = text.indexOf(marker);
  assert(markerIdx !== -1, `could not find ${marker}`);
  let searchStart = markerIdx;
  if (startAfter) {
    searchStart = text.indexOf(startAfter, markerIdx);
    assert(searchStart !== -1, `could not find ${startAfter} after ${marker}`);
  }
  const braceStart = text.indexOf("{", searchStart);
  assert(braceStart !== -1, `could not find opening brace after ${marker}`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    depth += BRACE_DELTA[text[i]] ?? 0;
    if (depth === 0) {
      return text.slice(braceStart, i + 1);
    }
  }
  assert.fail(`could not find balanced closing brace after ${marker}`);
}

test("Q166: testSenderSdk configuration object literal matches lib/sender-role.mjs byte-for-byte", () => {
  const senderRoleText = readFileSync(join(HARNESS, "lib/sender-role.mjs"), "utf8");
  const fakesText = readFileSync(join(HARNESS, "tests/copies-fake-sdk.mjs"), "utf8");

  const senderRoleConfig = balancedSpanAfter({ text: senderRoleText, marker: "sdkNode.createNodeSecurityAuditSdk" });
  const testSenderConfig = balancedSpanAfter({ text: fakesText, marker: "sdkNode.createNodeSecurityAuditSdk" });
  assert.equal(testSenderConfig, senderRoleConfig);
});

test("Q191: fake recordedCall body matches lib/sender-role.mjs byte-for-byte", () => {
  const senderRoleText = readFileSync(join(HARNESS, "lib/sender-role.mjs"), "utf8");
  const fakesText = readFileSync(join(HARNESS, "tests/copies-fake-sdk.mjs"), "utf8");

  const senderRoleBody = balancedSpanAfter({ text: senderRoleText, marker: "export async function recordedCall", startAfter: ")" });
  const testSenderBody = balancedSpanAfter({ text: fakesText, marker: "export async function recordedCall", startAfter: ")" });
  assert.equal(testSenderBody, senderRoleBody);
});

test("Q191: fake sender child start and stop handling matches serveSender message types and reply shapes", () => {
  const senderRoleText = readFileSync(join(HARNESS, "lib/sender-role.mjs"), "utf8");
  const fakeRolesText = readFileSync(join(HARNESS, "tests/copies-fake-roles.mjs"), "utf8");

  assert(senderRoleText.includes('message.type === "start"'));
  assert(senderRoleText.includes('message.type === "stop"'));
  assert(fakeRolesText.includes('message.type === "start"'));
  assert(fakeRolesText.includes('message.type === "stop"'));

  assert(senderRoleText.includes("process.send(report)"));
  assert(fakeRolesText.includes("proc.send(report)"));

  assert(senderRoleText.includes('process.send({ type: "error", message: error.message })'));
  assert(fakeRolesText.includes('proc.send({ type: "error", message: error.message })'));

  assert(senderRoleText.includes('process.send({ type: "stopped" }, () => process.exit(0))'));
  assert(fakeRolesText.includes('proc.send({ type: "stopped" }, () => proc.exit(0))'));
});

test("Q166: fakeSdkNode primitives fail closed without default values and throw matching error classes", () => {
  const fakeNode = fakeSdkNode();

  assert.throws(() => fakeNode.createFetchHttpExchange(), TypeError);
  assert.throws(() => fakeNode.createFetchHttpExchange({ origin: "invalid-url", timeoutMs: 2000 }), TypeError);
  assert.throws(() => fakeNode.createFetchHttpExchange({ origin: "http://127.0.0.1", timeoutMs: 0 }), TypeError);
  assert.throws(() => fakeNode.createFetchHttpExchange({ origin: "http://127.0.0.1" }), TypeError);

  assert.throws(() => fakeNode.createHttpDeliveryHandoff(), TypeError);
  assert.throws(() => fakeNode.createHttpDeliveryHandoff({ path: "not-absolute", exchange: () => {} }), TypeError);
  assert.throws(() => fakeNode.createHttpDeliveryHandoff({ path: "/v1/events", exchange: "not-a-fn" }), TypeError);

  assert.throws(() => fakeNode.createBoundedDeliveryRetry(), TypeError);
  assert.throws(() => fakeNode.createBoundedDeliveryRetry({ handoff: null, maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 }), TypeError);
  assert.throws(() => fakeNode.createBoundedDeliveryRetry({ handoff: { handoff: () => {} }, maxAttempts: 0, baseDelayMs: 10, maxDelayMs: 100 }), TypeError);
  assert.throws(() => fakeNode.createBoundedDeliveryRetry({ handoff: { handoff: () => {} }, maxAttempts: 3, baseDelayMs: -1, maxDelayMs: 100 }), TypeError);
  assert.throws(() => fakeNode.createBoundedDeliveryRetry({ handoff: { handoff: () => {} }, maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 100 }), TypeError);

  assert.throws(() => fakeNode.createBoundedDeliveryBackpressure(), TypeError);
  assert.throws(() => fakeNode.createBoundedDeliveryBackpressure({ capacity: 0 }), TypeError);
  assert.throws(() => fakeNode.createBoundedDeliveryBackpressure({ capacity: 100001 }), TypeError);

  assert.throws(() => fakeNode.createDeliveryShutdown(), TypeError);
  assert.throws(() => fakeNode.createDeliveryShutdown({ deadlineMs: -1 }), TypeError);

  assert.throws(() => fakeNode.createNodeSecurityAuditSdk(), SecurityAuditSdkError);
  assert.throws(
    () => fakeNode.createNodeSecurityAuditSdk({
      contractVersion: "0.0.0",
      producer: { name: "p", version: "1.0.0" },
      service: { name: "s", version: "1.0.0" },
      environment: { name: "e" },
      sink: { emit: async () => ({ status: "accepted" }) },
      clock: { now: () => new Date() },
    }),
    (err) => err instanceof SecurityAuditSdkError && err.code === "SDK_UNSUPPORTED_CONTRACT_VERSION",
  );
  assert.throws(
    () => fakeNode.createNodeSecurityAuditSdk({
      contractVersion: "2.1.0",
      producer: null,
      service: { name: "s", version: "1.0.0" },
      environment: { name: "e" },
      sink: { emit: async () => ({ status: "accepted" }) },
      clock: { now: () => new Date() },
    }),
    SecurityAuditSdkError,
  );
});

test("Q166: createNodeSecurityAuditSdk event methods return real result shapes", async () => {
  const fakeNode = fakeSdkNode();
  const validConfig = {
    contractVersion: "2.1.0",
    producer: { name: "prod", version: "1.0.0" },
    service: { name: "srv", version: "1.0.0" },
    environment: { name: "env" },
    sink: { emit: async () => ({ status: "accepted" }) },
    clock: { now: () => new Date() },
  };

  const sdkSuccess = fakeNode.createNodeSecurityAuditSdk(validConfig);
  const core = fakeCore();
  const authInput = (override = {}) => authenticationInput({
    core,
    identities: { ids: { tenant: "t", account: "a", credential: "c", session_handle: "s" }, address: "192.0.2.1" },
    at: "2026-10-23T00:00:00.000Z",
    sessionKey: Buffer.alloc(32),
    override,
  });

  const successResult = await sdkSuccess.authenticationSucceeded(authInput());
  assert.equal(successResult.ok, true);
  assert.equal(successResult.value.status, "accepted");

  const sdkReject = fakeNode.createNodeSecurityAuditSdk({
    ...validConfig,
    sink: { emit: async () => ({ status: "rejected" }) },
  });
  const rejectResult = await sdkReject.authenticationSucceeded(authInput());
  assert.equal(rejectResult.ok, false);
  assert.equal(rejectResult.error.code, "SDK_SINK_REJECTED");
  assert.equal(rejectResult.error.category, "sink");

  const sdkThrow = fakeNode.createNodeSecurityAuditSdk({
    ...validConfig,
    sink: { emit: async () => { throw new Error("sink boom"); } },
  });
  const throwResult = await sdkThrow.authenticationSucceeded(authInput());
  assert.equal(throwResult.ok, false);
  assert.equal(throwResult.error.code, "SDK_SINK_FAILURE");
  assert.equal(throwResult.error.category, "sink");

  const invalidResult = await sdkSuccess.authenticationSucceeded(authInput({ actor: null }));
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.error.code, "SDK_SCHEMA_VALIDATION_FAILED");
  assert.equal(invalidResult.error.category, "validation");
});

function countByEventId(entries) {
  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry.event_id, (counts.get(entry.event_id) ?? 0) + 1);
  }
  return counts;
}

function assertIdentitiesDeliveryIntegrity(identitiesSender) {
  const calls = identitiesSender.calls;
  const duplicateCall = calls.find((call) => call.label === "duplicate_submission");
  assert(duplicateCall, "duplicate call must be recorded");
  assert.equal(duplicateCall.ok, false);
  assert.equal(duplicateCall.error, "original_not_delivered");

  const conflictCall = calls.find((call) => call.label === "conflict_submission");
  assert(conflictCall, "conflict call must be recorded");
  assert.equal(conflictCall.ok, false);
  assert.equal(conflictCall.error, "original_not_delivered");

  const expectedLabels = [
    "clean_submission",
    "duplicate_submission",
    "conflict_submission",
    "re_execution_submission",
    "retry_redelivery_submission",
  ];
  assert.deepEqual(identitiesSender.ledger.calls.map((call) => call.label), expectedLabels);
  assert.equal(identitiesSender.ledger.occurrence_count, expectedLabels.length);

  const rejectedEventId = identitiesSender.delivery_log[0].event_id;
  const rejectedDeliveries = identitiesSender.delivery_log.filter((e) => e.event_id === rejectedEventId);
  assert.equal(rejectedDeliveries.length, 1, "no duplicate or conflict delivery for rejected event");

  const rejectedExchanges = identitiesSender.exchanges.filter((e) => e.event_id === rejectedEventId);
  assert.equal(rejectedExchanges.length, 0, "no duplicate or conflict exchange for rejected event");

  const deliveryCounts = countByEventId(identitiesSender.delivery_log);
  const exchangeCounts = countByEventId(identitiesSender.exchanges);
  assert.equal(deliveryCounts.get(rejectedEventId), 1);
  assert.equal(exchangeCounts.get(rejectedEventId) ?? 0, 0);

  assert.equal(identitiesSender.delivery_log.length, 3);
  assert.equal(identitiesSender.exchanges.length, 2);
}

function isSenderRole(opts) {
  return opts.role === "sender" || opts.script.endsWith("sender-process.mjs");
}

async function runPlantedSender({ message, service }) {
  const coreUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-core/index.js")).href;
  const nodeUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-node/index.js")).href;
  const fakeNode = fakeSdkNode();
  let rejected = false;
  const effectiveNode = {
    ...fakeNode,
    createHttpDeliveryHandoff(handoffOptions) {
      const realHandoff = fakeNode.createHttpDeliveryHandoff(handoffOptions);
      return {
        async handoff(event, attempt = 0) {
          if (!rejected) {
            rejected = true;
            return { status: "non_retryable", code: "http_permanent", event_id: event.event.id, attempt };
          }
          return realHandoff.handoff(event, attempt);
        },
      };
    },
  };

  let capturedSink = null;
  let firstDeliveredEvent = null;
  const senderSdk = ({ sdkNode, input, sink }) => {
    capturedSink = sink;
    return testSenderSdk({
      sdkNode,
      input,
      sink: {
        async emit(ev) {
          if (!firstDeliveredEvent) firstDeliveredEvent = ev;
          return sink.emit(ev);
        },
      },
    });
  };

  const plantedRecordedCall = async ({ ledger, label, invoke }) => {
    const isDuplicate = label === "duplicate_submission";
    const canDeliver = isDuplicate && firstDeliveredEvent !== null && capturedSink !== null;
    if (canDeliver) {
      await capturedSink.emit(firstDeliveredEvent);
    }
    return recordedCall({ ledger, label, invoke });
  };

  const proc = new EventEmitter();
  const report = await senderRun({
    message,
    deps: {
      core: fakeCore(),
      sdkNode: effectiveNode,
      senderSdk,
      senderControls: async () => ({
        loopback_guard: { holds: true },
        write_outside_grant: { holds: true },
        synthetic_data: { holds: true },
      }),
      guardViolations: () => [{ host: "192.0.2.1", stage: "before_connect" }],
      resolved: () => ({ core: coreUrl, node: nodeUrl }),
      send: (msg) => proc.emit("message", msg),
      awaitMessage: async () => ({}),
      randomBytes: () => Buffer.alloc(32),
      recordedCall: plantedRecordedCall,
      onBeforeRun: () => {},
    },
  });
  return serializeIpcMessage(report);
}

function makePlantedSenderChild({ service, onReport }) {
  const child = new EventEmitter();
  let closed = false;
  const proc = new EventEmitter();

  proc.send = (message, callback) => {
    if (closed) return;
    child.emit("message", serializeIpcMessage(message));
    if (typeof callback === "function") callback();
  };

  proc.exit = (code = 0) => {
    if (closed) return;
    closed = true;
    setImmediate(() => {
      child.emit("exit", code, null);
      child.emit("close", code, null);
    });
  };

  proc.on("message", (message) => {
    if (message.type === "start") {
      runPlantedSender({ message, service }).then(
        (report) => {
          onReport(report);
          proc.send(report);
        },
        (error) => proc.send({ type: "error", message: error.message }),
      );
    } else if (message.type === "stop") {
      proc.send({ type: "stopped" }, () => proc.exit(0));
    }
  });

  child.send = (message) => {
    if (closed) return;
    setImmediate(() => proc.emit("message", serializeIpcMessage(message)));
  };

  child.kill = (signal) => {
    if (closed) return;
    closed = true;
    setImmediate(() => {
      child.emit("exit", null, signal ?? "SIGKILL");
      child.emit("close", null, signal ?? "SIGKILL");
    });
  };

  return { ...roleChannel(child), stderr: () => "" };
}

test("Q178: duplicate step after rejected new call is recorded as failed without throwing", async () => {
  const { service, storage, spawn, cleanup } = createRehearsalEnv({ rejectNewCall: true });
  try {
    const sessionResult = await copiesSession({
      service,
      storage,
      flags: { ingress: [], sender: [] },
      expectations: FROZEN_V2,
      spawn,
    });
    assert(sessionResult, "the session completes");
    assertIdentitiesDeliveryIntegrity(sessionResult.phases.identities.sender);
  } finally {
    await cleanup();
  }
});

test("Q196: planted defect: duplicate delivering anyway is caught by event_id check", async () => {
  const { service, storage, spawn, cleanup } = createRehearsalEnv({ rejectNewCall: true });
  try {
    let capturedReport = null;
    const plantedSpawn = (opts) => {
      if (!isSenderRole(opts)) return spawn(opts);
      return makePlantedSenderChild({
        service,
        onReport: (report) => {
          capturedReport = report;
        },
      });
    };

    await copiesSession({
      service,
      storage,
      flags: { ingress: [], sender: [] },
      expectations: { ...FROZEN_V2, phases: [FROZEN_V2.phases[0]] },
      spawn: plantedSpawn,
    });

    assert(capturedReport, "identities sender report must be captured");
    assert.throws(
      () => assertIdentitiesDeliveryIntegrity(capturedReport),
      /no duplicate or conflict delivery for rejected event/,
    );
  } finally {
    await cleanup();
  }
});

test("senderRun refuses to run traffic without onBeforeRun", async () => {
  const phaseInput = senderInput({ expectations: FROZEN_V2, phase: FROZEN_V2.phases[0] });
  const message = {
    expectations: phaseInput,
    origin: "http://127.0.0.1:8080",
    token: "probe-token",
    port: 8080,
  };

  const deps = {
    core: fakeCore(),
    sdkNode: fakeSdkNode(),
    senderSdk: testSenderSdk,
    senderControls: async () => ({
      loopback_guard: { holds: true },
      write_outside_grant: { holds: true },
      synthetic_data: { holds: true },
    }),
    guardViolations: () => [],
    resolved: () => ({ core: "core", node: "node" }),
    send: () => {},
    awaitMessage: async () => ({}),
    randomBytes: () => Buffer.alloc(32),
    recordedCall,
  };

  await assert.rejects(
    () => senderRun({ deps, message }),
    /onBeforeRun/,
  );
});

test("copies/sender-process.mjs passes onBeforeRun setting mode.halt to senderRun", () => {
  const text = source("copies/sender-process.mjs");
  assert.match(text, /onBeforeRun:\s*\(\)\s*=>\s*\{\s*mode\.halt\s*=\s*true;\s*\}/);
});

test("Q188: rehearsal fake IPC matches fork default serialisation", () => {
  const rawDate = new Date("2026-10-28T12:00:00.000Z");
  const outbound = {
    map: new Map([["key", "value"]]),
    date: rawDate,
    undef: undefined,
  };
  const inbound = serializeIpcMessage(outbound);
  assert.deepEqual(inbound.map, {});
  assert.equal(inbound.date, rawDate.toISOString());
  assert.equal("undef" in inbound, false);
});

test("fake binding: omitting required options throws naming the option", () => {
  const cases = [
    {
      builder: createBoundedDeliveryRetry,
      valid: {
        handoff: { handoff: () => {} },
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitterSource: () => 0.5,
        timers: nodeTimers,
      },
      omissions: ["jitterSource", "timers"],
    },
    {
      builder: createDeliveryShutdown,
      valid: {
        deadlineMs: 100,
        timers: nodeTimers,
      },
      omissions: ["timers"],
    },
  ];

  for (const { builder, valid, omissions } of cases) {
    assert.doesNotThrow(() => builder(valid));
    for (const omitted of omissions) {
      const options = { ...valid };
      delete options[omitted];
      assert.throws(
        () => builder(options),
        new RegExp(omitted),
      );
    }
  }
});

test("fake binding: a jitter of 1 throws", async () => {
  const retry = createBoundedDeliveryRetry({
    handoff: { handoff: async () => ({ status: "retryable" }) },
    maxAttempts: 3,
    baseDelayMs: 10,
    maxDelayMs: 100,
    jitterSource: () => 1,
    timers: nodeTimers,
  });
  await assert.rejects(
    () => retry.deliver({ event: { id: "evt_jitter_1" } }),
    /jitterSource must return a finite value in \[0, 1\)/,
  );
});

test("fake binding: shutdown() called twice returns the same report object", async () => {
  const shutdown = createDeliveryShutdown({ deadlineMs: 100, timers: nodeTimers });
  const firstReportPromise = shutdown.shutdown();
  const secondReportPromise = shutdown.shutdown();
  assert.equal(firstReportPromise, secondReportPromise);
  const [firstReport, secondReport] = await Promise.all([firstReportPromise, secondReportPromise]);
  assert.equal(firstReport, secondReport);
});

test("fake binding: completed counts an operation that threw", async () => {
  const shutdown = createDeliveryShutdown({ deadlineMs: 100, timers: nodeTimers });
  await shutdown.submit(async () => {
    throw new Error("deliberate operation failure");
  }).catch(() => {});
  const report = await shutdown.shutdown();
  assert.equal(report.accepted, 1);
  assert.equal(report.completed, 1);
  assert.equal(report.abandoned, 0);
});

test("fake binding: the deadline timer is cleared once drained, so the test process exits without waiting for it", async () => {
  let deadlineTimerCleared = false;
  const mockTimers = {
    setTimeout() {
      return { id: "timer_123" };
    },
    clearTimeout(handle) {
      if (handle && handle.id === "timer_123") {
        deadlineTimerCleared = true;
      }
    },
  };
  const shutdown = createDeliveryShutdown({ deadlineMs: 60_000, timers: mockTimers });
  await shutdown.shutdown();
  assert.equal(deadlineTimerCleared, true);
});

test("fake binding: an exchange that throws becomes the real http-handoff.ts transport-failure result", async () => {
  const handoff = createHttpDeliveryHandoff({
    path: "/v1/events",
    exchange: async () => {
      throw new Error("simulated network connection reset");
    },
  });
  const handoffResult = await handoff.handoff({ event: { id: "evt_transport_fail" } }, 0);
  assert.deepEqual(handoffResult, {
    status: "retryable",
    code: "transport_failure",
    event_id: "evt_transport_fail",
    attempt: 0,
  });
});

function serverPortOf(candidate) {
  if (!candidate) return null;
  if (typeof candidate.address !== "function") return null;
  const addr = candidate.address();
  return addr ? addr.port : null;
}

function findServerByPort(port) {
  for (const handle of process._getActiveHandles()) {
    if (serverPortOf(handle) === port) return handle;
    const owner = handle ? handle.owner : null;
    if (serverPortOf(owner) === port) return owner;
  }
  return null;
}

test("Q182: createIngressHandlers throws TypeError without controlsFor", () => {
  assert.throws(
    () => createIngressHandlers({ collector: {}, resolved: {} }),
    TypeError,
  );
  assert.throws(
    () => createIngressHandlers({ collector: {}, resolved: {}, controlsFor: "not_a_fn" }),
    TypeError,
  );
});

test("Q182: stop() closes storage when server close throws, and replies with the error", async () => {
  let storageClosed = false;
  const fakeStorage = {
    close: async () => { storageClosed = true; },
  };
  const fakeCollector = {
    DIAGNOSTIC_CODES: {},
    SqliteStorage: class { constructor() { return fakeStorage; } },
    SyntheticFixtureAuthenticator: class { constructor() {} },
    CollectorIngress: class { constructor() {} },
  };

  const proc = new EventEmitter();
  let replyResolver = null;
  const replyPromise = new Promise((resolve) => {
    replyResolver = resolve;
  });
  proc.send = (reply) => {
    if (replyResolver) replyResolver(reply);
  };
  proc.exit = () => {};

  const handlers = bindIngressProcess({
    collector: fakeCollector,
    resolved: { collector: "fake" },
    controlsFor: () => ({ write_outside_grant: { holds: true } }),
    proc,
  });

  const tmpDir = mkdtempSync(join(tmpdir(), "stop-test-"));
  let serverInstance = null;
  let realClose = null;
  try {
    const ready = await handlers.start({
      token: "tok",
      fault_plan: scheduledFaultPlan({ scenarios: FROZEN_V2.scenarios, schedule: ["clean"], cycles: 1 }),
      storage_directory: tmpDir,
      owners: ["owner"],
    });

    serverInstance = findServerByPort(ready.port);
    assert(serverInstance, "server instance must be located");
    realClose = serverInstance.close;
    serverInstance.close = function (cb) {
      const err = new Error("forced server close error");
      if (cb) cb(err);
      else throw err;
      return this;
    };

    proc.emit("message", { type: "stop" });
    const reply = await replyPromise;

    assert.equal(storageClosed, true, "storage must be closed when server close throws");
    assert.deepEqual(reply, { type: "error", message: "forced server close error" });
  } finally {
    if (serverInstance && realClose) {
      await new Promise((resolve) => realClose.call(serverInstance, resolve));
    }
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Q168: sender-process.mjs and ingress-process.mjs contain no if, ?, ??, for or while", () => {
  const shells = ["copies/sender-process.mjs", "copies/ingress-process.mjs"];
  for (const shellPath of shells) {
    const text = source(shellPath);
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "");

    assert.doesNotMatch(stripped, /\bif\b/, `${shellPath} must not contain 'if'`);
    assert.doesNotMatch(stripped, /\?/, `${shellPath} must not contain '?' or '??'`);
    assert.doesNotMatch(stripped, /\bfor\b/, `${shellPath} must not contain 'for'`);
    assert.doesNotMatch(stripped, /\bwhile\b/, `${shellPath} must not contain 'while'`);
  }
});
