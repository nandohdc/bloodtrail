import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, rmSync } from "node:fs";
import { test } from "node:test";
import { evaluateCases } from "../counts/evaluate.mjs";
import { validateExpectations } from "../counts/expectations.mjs";
import { exchangeCountsUnit } from "../counts/session.mjs";
import { reconcilePhase } from "../counts/reconcile.mjs";
import { sha256 } from "../lib/io.mjs";
import { producerFixture } from "./counts-fixture.mjs";
import { FROZEN, rehearsal } from "./counts-rehearsal.mjs";

function singlePhase(name) {
  return { ...FROZEN, phases: FROZEN.phases.filter((phase) => phase.name === name) };
}

function caseMatches({ observations, expectations = FROZEN, caseId }) {
  const result = evaluateCases({ observations, expectations });
  return result.evaluations.find((entry) => entry.case_id === caseId).matched;
}

test("the fake ingress worker exits after a completed session", async () => {
  const workers = [];
  await rehearsal({ expectations: singlePhase("outages_clean"), onIngressWorker: (worker) => {
    assert(worker.threadId > 0);
    workers.push(worker);
  } });
  assert.equal(workers.length, 1);
  assert.equal(workers[0].threadId, -1);
});

test("a failed fake ingress worker reports the error and exits before cleanup", async () => {
  const workers = [];
  await assert.rejects(rehearsal({
    expectations: singlePhase("outages_clean"), onIngressWorker: (worker) => workers.push(worker),
    transformIngressInput: (message) => message.type === "start" ? { ...message, fault_plan: null } : message,
  }), /ingress process error/);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].threadId, -1);
});

test("an ingress worker that exits before readiness stops the session", async () => {
  const workers = [];
  await assert.rejects(rehearsal({ expectations: singlePhase("outages_clean"), onIngressWorker: (worker) => {
    workers.push(worker);
    void worker.terminate();
  } }), /ingress process exited/);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].threadId, -1);
});

test("a rehearsal deadline terminates the ingress worker before cleanup", async () => {
  const workers = [];
  const expectations = { ...singlePhase("outages_clean"), deadline_ms: 1 };
  await assert.rejects(rehearsal({ expectations, onIngressWorker: (worker) => workers.push(worker) }), /S2 stop \(deadline\)/);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].threadId, -1);
});

test("a throwing worker observer still terminates the tracked worker", async () => {
  const workers = [];
  await assert.rejects(rehearsal({ expectations: singlePhase("outages_clean"), onIngressWorker: (worker) => {
    workers.push(worker);
    throw new Error("worker observer failed");
  } }), /worker observer failed/);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].threadId, -1);
});

test("unconfirmed ingress closure preserves rehearsal scratch", async () => {
  const worker = new EventEmitter();
  worker.postMessage = () => {};
  worker.terminate = () => Promise.resolve();
  const expectations = { ...singlePhase("outages_clean"), deadline_ms: 1 };
  let scratch;
  try {
    await assert.rejects(rehearsal({ expectations, ingressWorkerFactory: () => worker }), (error) => {
      scratch = error.rehearsal_scratch;
      assert.equal(error.role_closure_confirmed, false);
      assert.equal(typeof scratch, "string");
      assert(existsSync(scratch));
      return true;
    });
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
});

test("a producer-built 409 conflict never reports the acknowledged original as failed", async () => {
  const observations = await producerFixture();
  const observed = observations.phases.copies_identities;
  assert.equal(observed.sender.calls.length, 26);
  const conflict = observed.ingress.records.find((record) => record.status === 409);
  assert(conflict);
  const original = observed.sender.emissions.find((entry) => entry.event_id === conflict.event_id);
  assert.notEqual(conflict.body_sha256, original.body_sha256);
  assert.equal(observed.sender.deliveries[original.event_id].status, "non_retryable");
  assert(observed.sender.exchanges.some((exchange) => exchange.body_sha256 === original.body_sha256));
  const summary = reconcilePhase({ expectations: FROZEN, phase: FROZEN.phases.find((phase) => phase.name === "copies_identities"), observed });
  assert.deepEqual(summary.persisted_despite_failure_report, []);
  assert.deepEqual(summary.reported_undelivered, []);
});

test("copies re-execution repeats the original logical authentication with a new occurrence id", async () => {
  const observations = await producerFixture();
  const bodies = observations.phases.copies_identities.ingress.persisted_bodies;
  const repeated = bodies.find((body) => body.correlation.retry_attempt === 1);
  const original = bodies.find((body) => body.event.id === repeated.correlation.original_event_id);
  assert(original);
  assert.notEqual(repeated.event.id, original.event.id);
  for (const key of ["actor", "tenant", "authenticated_principal", "source", "session", "authentication", "credential"]) {
    assert.deepEqual(repeated[key], original[key], key);
  }
  assert.equal(repeated.event.timestamp, original.event.timestamp);
  assert.equal(repeated.event.name, original.event.name);
});

test("a halt after ingress readiness prevents the counts sender spawn", async () => {
  let active;
  const spawned = [];
  const exchange = (options) => { active = options.context; return exchangeCountsUnit(options); };
  await assert.rejects(rehearsal({
    expectations: singlePhase("outages_clean"), exchange, onSpawn: (role) => spawned.push(role),
    transformIngress: (report) => {
      if (report.type === "ready") active.halted = true;
      return report;
    },
  }), /halted before the sender started/);
  assert.deepEqual(spawned, ["ingress"]);
});

test("a reconciliation assert records a mismatch and retains the phase's raw reports", async () => {
  const expectations = singlePhase("outages_clean");
  const observations = await rehearsal({ expectations, transformSender: (report) => {
    if (report.type === "report") report.emissions.pop();
    return report;
  } });
  const phase = observations.phases.outages_clean;
  assert.equal(typeof phase.reconciliation.missing_or_invalid, "string");
  assert(phase.sender.ledger.calls.length > 0);
  assert(phase.ingress.raw_persisted_bodies.length > 0);
  assert.equal(evaluateCases({ observations, expectations }).verdict.mismatched, 10);
});

for (const defect of ["empty", "wrong"]) {
  test(`N-01 rejects an actually executed ${defect} ingress rule set`, async () => {
    const expectations = singlePhase("outages_permanent_400");
    const observations = await rehearsal({ expectations, transformIngressInput: (message) => {
      if (message.type !== "start") return message;
      const rules = defect === "empty" ? [] : message.fault_plan.rules.map((rule) => ({ ...rule, status: 503 }));
      return { ...message, fault_plan: { default: "acknowledge", rules } };
    } });
    assert.equal(observations.phases.outages_permanent_400.plan_reference.executed, false);
    assert.equal(caseMatches({ observations, expectations, caseId: "N-01" }), false);
  });
}

const limits = [
  (value) => { value.policy = { delivery_latency: { maximum_ms: 1 } }; },
  (value) => { value.phases[0].acceptance = { persisted_events_per_second: 2 }; },
  (value) => { value.observations.delivery_latency.maximum_ms = 3; },
  (value) => { value.workload.delivery_latency = 4; },
];
test("N-07 and validation refuse observation limits structurally, without a threshold keyword", async () => {
  const observations = await producerFixture();
  for (const addLimit of limits) {
    const expectations = structuredClone(FROZEN);
    addLimit(expectations);
    assert.throws(() => validateExpectations(expectations));
    assert.equal(caseMatches({ observations, expectations, caseId: "N-07" }), false);
  }
});

test("N-10 independently checks frozen call counts and distinct ingress occurrences", async () => {
  const defects = [
    (phase) => { phase.sender.ledger.calls[0].label = "redeliver"; },
    (phase) => {
      phase.sender.ledger.calls.pop();
      phase.sender.ledger.occurrence_count -= 1;
      phase.occurrence_count -= 1;
    },
    (phase) => { phase.ingress.records = []; },
  ];
  for (const plant of defects) {
    const observations = await producerFixture();
    plant(observations.phases.outages_clean);
    assert.equal(caseMatches({ observations, caseId: "N-10" }), false);
  }
});

test("each evaluation computes one honest and one planted reconciliation per phase", async () => {
  const observations = await producerFixture();
  const reads = {};
  for (const [name, phase] of Object.entries(observations.phases)) {
    const raw = phase.ingress.raw_persisted_bodies;
    Object.defineProperty(phase.ingress, "raw_persisted_bodies", { get() {
      reads[name] = (reads[name] ?? 0) + 1;
      return raw;
    } });
  }
  const result = evaluateCases({ observations, expectations: FROZEN });
  assert.equal(result.verdict.mismatched, 0);
  assert.deepEqual(Object.values(reads), FROZEN.phases.map(() => 2));
});

test("body-specific reports carry the exact exchange bytes for identical redeliveries", async () => {
  const observations = await producerFixture();
  const observed = observations.phases.copies_duplicates_volume;
  for (const body of observed.ingress.persisted_bodies) {
    const digest = sha256(JSON.stringify(body));
    const reports = observed.sender.delivery_reports.filter((report) => report.body_sha256 === digest);
    assert.equal(reports.length, 2);
    assert(reports.every((report) => report.status === "acknowledged"));
    assert(observed.sender.exchanges.some((exchange) => exchange.body_sha256 === digest));
  }
});
