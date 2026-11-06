// Evaluator fixtures come from the real role producer and JSON session plumbing.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { jsonFile } from "../lib/io.mjs";
import { evaluateCases } from "../outbox/evaluate.mjs";
import { runOutboxRehearsal } from "./outbox-fakes.mjs";

const FROZEN_V1 = jsonFile(new URL("../expectations/outbox.v1.json", import.meta.url));
let honest;
before(async () => { honest = await runOutboxRehearsal(); });

function makeHonestFixture() {
  return structuredClone(honest);
}

test("producer-built fixture matches all eleven cases", () => {
  const result = evaluateCases({ observations: makeHonestFixture(), expectations: FROZEN_V1 });
  assert.equal(result.verdict.matched, FROZEN_V1.cases.length);
});

const PLANTED_MISMATCHES = [
  {
    caseId: "H-01",
    mutate(obs) { obs.phases.commit_relay.sender.host.business_count = 5; },
  },
  {
    caseId: "H-02",
    mutate(obs) { obs.phases.rollback.sender.host.outbox_count = 1; },
  },
  {
    caseId: "H-03",
    mutate(obs) { obs.phases.commit_relay.sender.relayed_count = 5; },
  },
  {
    caseId: "H-04",
    mutate(obs) { obs.phases.crash_restart.ingress.persisted_bodies.pop(); },
  },
  {
    caseId: "H-05",
    mutate(obs) {
      obs.phases.crash_restart.ingress.records = obs.phases.crash_restart.ingress.records.filter((r) => r.outcome?.kind !== "duplicate");
    },
  },
  {
    caseId: "H-06",
    mutate(obs) {
      obs.phases.crash_restart.ingress.persisted_bodies[0].correlation.transaction_id = "corrupted-tx";
    },
  },
  {
    caseId: "H-07",
    mutate(obs) { obs.phases.outage_defer.sender.initial_outage_failures = 0; },
  },
  {
    caseId: "H-08",
    mutate(obs) { obs.phases.crash_restart.sender.controls.outbox_checks.mark_before_ack_defect_detected = false; },
  },
  {
    caseId: "H-09",
    mutate(obs) { obs.phases.commit_relay.sender.controls.host_db_isolation.planted_write_refused = false; },
  },
  {
    caseId: "H-10",
    mutate(obs) { obs.phases.commit_relay.sender.controls.loopback_guard.holds = false; },
  },
  {
    caseId: "H-11",
    mutate(obs) { obs.phases.commit_relay.ingress.read_back.pop(); },
  },
];


for (const { caseId, mutate } of PLANTED_MISMATCHES) {
  test(`planted mismatch for ${caseId} fails ${caseId}`, () => {
    const observations = makeHonestFixture();
    mutate(observations);
    const verdict = evaluateCases({ observations, expectations: FROZEN_V1 });
    const target = verdict.evaluations.find((e) => e.case_id === caseId);
    assert.equal(target.matched, false, `Expected ${caseId} to fail`);
  });
}

test("total observers: empty observations produce 0 matched without throwing", () => {
  const verdict = evaluateCases({ observations: {}, expectations: FROZEN_V1 });
  assert.equal(verdict.verdict.matched, 0);
  assert.equal(verdict.verdict.mismatched, 11);
  for (const evaluation of verdict.evaluations) {
    assert.equal(typeof evaluation.observed, "object");
    assert.notEqual(evaluation.observed, null);
  }
});

const MISSING = [
  ["H-01", (o) => { delete o.phases.commit_relay.sender.transaction_order; }],
  ["H-01", (o) => {
    o.phases.commit_relay.sender.transaction_order.find((entry) => entry.op === "business_insert").is_transaction = false;
  }],
  ["H-01", (o) => {
    const order = o.phases.commit_relay.sender.transaction_order;
    const index = order.findIndex((entry) => entry.op === "business_insert");
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
  }],
  ["H-02", (o) => { delete o.phases.rollback.ingress; }],
  ["H-02", (o) => { delete o.phases.rollback.ingress.persisted_bodies; }],
  ["H-02", (o) => { delete o.phases.rollback.sender.relayed_count; }],
  ["H-02", (o) => { o.phases.rollback.sender.host.sink_records = []; }],
  ["H-04", (o) => { o.phases.crash_restart.sender.crash_fired = false; }],
  ["H-04", (o) => { delete o.phases.crash_restart.sender.pending_after_resume; }],
  ["H-04", (o) => { delete o.phases.crash_restart.ingress.read_back; }],
  ["H-04", (o) => {
    const back = o.phases.crash_restart.ingress.read_back;
    back.push(structuredClone(back.find((entry) => entry.persisted === true)));
  }],
  ["H-04", (o) => {
    const back = o.phases.crash_restart.ingress.read_back;
    back[1] = structuredClone(back[0]);
  }],
  ["H-06", (o) => { o.phases.crash_restart.sender.host.business_rows[0].transaction_id = "wrong"; }],
  ["H-06", (o) => {
    const duplicate = o.phases.crash_restart.ingress.records.find((r) => r.outcome?.kind === "duplicate");
    duplicate.body_sha256 = "wrong";
  }],
  ["H-07", (o) => { delete o.phases.outage_defer.sender.pending_outbox; }],
  ["H-07", (o) => { o.phases.outage_defer.sender.pending_after_recovery = 1; }],
  ["H-07", (o) => { o.phases.outage_defer.sender.relayed_count = 5; }],
  ["H-07", (o) => { o.phases.outage_defer.sender.recovery_delivered_event_ids[0] = "unrelated"; }],
  ["H-07", (o) => { delete o.phases.outage_defer.sender.recovery_read_event_ids; }],
  ["H-07", (o) => { o.phases.outage_defer.sender.recovery_read_event_ids[0] = "unrelated"; }],
  ["H-11", (o) => { o.phases.rollback.sender.host.sink_records.pop(); }],
  ["H-11", (o) => { delete o.phases.rollback.ingress.read_back; }],
  ["H-07", (o) => { o.phases.outage_defer.ingress.records.find((r) => r.status === 503).event_id = "wrong"; }],
];
for (const [caseId, mutate] of MISSING) {
  test(`missing or false evidence mismatches ${caseId}: ${mutate}`, () => {
    const observations = makeHonestFixture();
    mutate(observations);
    const result = evaluateCases({ observations, expectations: FROZEN_V1 });
    assert.equal(result.evaluations.find((e) => e.case_id === caseId).matched, false);
  });
}

test("swapped persisted transaction ids mismatch H-06 while remaining unique", () => {
  const observations = makeHonestFixture();
  const [first, second] = observations.phases.crash_restart.ingress.persisted_bodies;
  [first.correlation.transaction_id, second.correlation.transaction_id] =
    [second.correlation.transaction_id, first.correlation.transaction_id];
  const result = evaluateCases({ observations, expectations: FROZEN_V1 });
  const h06 = result.evaluations.find((entry) => entry.case_id === "H-06");
  assert.equal(h06.observed.transaction_ids_unique, true);
  assert.equal(h06.observed.transaction_ids_match_host, false);
  assert.equal(h06.matched, false);
});

function traced(value, path, missing) {
  if (value === null) return value;
  if (typeof value !== "object") return value;
  return new Proxy(value, {
    get(target, key) {
      if (typeof key !== "string") return Reflect.get(target, key);
      if (!(key in target)) missing.add(`${path}.${key}`);
      return traced(Reflect.get(target, key), `${path}.${key}`, missing);
    },
  });
}

test("field-read parity: every evaluator observation read resolves on producer-built data", () => {
  const missing = new Set();
  const result = evaluateCases({
    observations: traced(makeHonestFixture(), "observations", missing), expectations: FROZEN_V1,
  });
  assert.equal(result.verdict.holds, true);
  assert.deepEqual([...missing], []);
});
