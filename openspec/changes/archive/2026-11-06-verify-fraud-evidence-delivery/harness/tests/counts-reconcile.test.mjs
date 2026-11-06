import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCases, plantedControls } from "../counts/evaluate.mjs";
import { reconcilePhase } from "../counts/reconcile.mjs";
import { producerFixture } from "./counts-fixture.mjs";
import { FROZEN } from "./counts-rehearsal.mjs";

function firstPhase(observations) {
  return observations.phases.outages_clean;
}

function forgetOccurrence(observations, method) {
  const phase = firstPhase(observations);
  const emission = phase.sender.emissions.find((entry) => JSON.parse(entry.signature)[0] === method);
  phase.ingress.raw_persisted_bodies = phase.ingress.raw_persisted_bodies.filter((body) => body.event.id !== emission.event_id);
  phase.sender.delivery_reports = phase.sender.delivery_reports.filter((report) => report.event_id !== emission.event_id);
}

function removeDuplicates(observations) {
  for (const phase of Object.values(observations.phases)) {
    phase.ingress.raw_persisted_bodies = [...new Map(phase.ingress.raw_persisted_bodies.map((body) => [body.event.id, body])).values()];
  }
}

const plants = [
  ["N-01", (observations) => { firstPhase(observations).plan_reference.hash_verified = false; }],
  ["N-02", (observations) => forgetOccurrence(observations, "authenticationSucceeded")],
  ["N-03", (observations) => forgetOccurrence(observations, "authenticationFailed")],
  ["N-04", (observations) => {
    const phase = observations.phases.outages_permanent_400;
    phase.sender.delivery_reports = [];
  }],
  ["N-05", removeDuplicates],
  ["N-06", (observations) => { firstPhase(observations).per_target = "attempted"; }],
  ["N-07", (observations) => { delete firstPhase(observations).ingress.observation; }],
  ["N-08", removeDuplicates],
  ["N-09", (observations) => { firstPhase(observations).sender.controls.synthetic_data.holds = false; }],
  ["N-10", (observations) => { firstPhase(observations).occurrence_count += 1; }],
];

test("producer-built full workload reconciles each frozen source and itemizes protocol failures", async () => {
  const observations = await producerFixture();
  assert.deepEqual(evaluateCases({ observations, expectations: FROZEN }).verdict, { matched: 10, mismatched: 0 });
  for (const phase of FROZEN.phases) {
    const summary = reconcilePhase({ expectations: FROZEN, phase, observed: observations.phases[phase.name] });
    assert.equal(summary.accounted, phase.occurrences);
    assert.equal(summary.unexplained.length, 0);
    assert.equal(summary.successful, true);
    assert.equal(summary.failed, true);
  }
  const malformed = observations.phases.outages_malformed_acknowledgment.reconciliation;
  assert.equal(malformed.persisted_despite_failure_report.length, malformed.denominator);
  assert.equal(malformed.reported_undelivered.length, 0);
  const permanent = observations.phases.outages_permanent_400.reconciliation;
  assert.equal(permanent.reported_undelivered.length, permanent.denominator);
  assert(Object.values(permanent.remainder).every((reasons) => Object.hasOwn(reasons, "non_retryable")));
  assert.equal(plantedControls({ observations, expectations: FROZEN }).distinct_null_passed, true);
});

for (const [caseId, plant] of plants) {
  test(`${caseId} detects its own planted mismatch on producer-built data`, async () => {
    const observations = await producerFixture();
    plant(observations);
    const result = evaluateCases({ observations, expectations: FROZEN });
    assert.equal(result.evaluations.find((entry) => entry.case_id === caseId).matched, false);
  });
}

test("observers are total on missing data and cover volume phases from expectations", async () => {
  for (const observations of [null, {}, { phases: {} }]) {
    assert.equal(evaluateCases({ observations, expectations: FROZEN }).verdict.mismatched, 10);
  }
  const observations = await producerFixture();
  for (const phase of FROZEN.phases) {
    const changed = structuredClone(observations);
    delete changed.phases[phase.name];
    assert.equal(evaluateCases({ observations: changed, expectations: FROZEN }).verdict.mismatched, 10, phase.name);
  }
});

test("nothing persisted outside ground truth, or under a foreign event id, is counted", async () => {
  const observations = await producerFixture();
  const phase = firstPhase(observations);
  const copy = structuredClone(phase.ingress.raw_persisted_bodies[0]);
  copy.event.id = "00000000-0000-4000-8000-000000000000";
  phase.ingress.raw_persisted_bodies.push(copy);
  assert.equal(evaluateCases({ observations, expectations: FROZEN }).verdict.mismatched, 10);
});

test("field-read parity: every ground-truth phase, source and raw persisted boundary is observed", async () => {
  const observations = await producerFixture();
  const reads = new Set();
  const track = (object, path) => new Proxy(object, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof key !== "string") return value;
      const current = `${path}.${key}`;
      reads.add(current);
      if (value === null) return value;
      if (typeof value !== "object") return value;
      return track(value, current);
    },
  });
  const result = evaluateCases({ observations: track(observations, "observations"), expectations: track(FROZEN, "expectations") });
  assert.equal(result.verdict.mismatched, 0);
  for (const phase of FROZEN.phases) {
    assert(reads.has(`observations.phases.${phase.name}.ingress.raw_persisted_bodies`));
    Object.keys(FROZEN.ground_truth[phase.name]).forEach((source) => {
      assert(reads.has(`expectations.ground_truth.${phase.name}.${source}.successful`));
      assert(reads.has(`expectations.ground_truth.${phase.name}.${source}.failed`));
    });
  }
});

test("observation magnitudes do not decide a case; labels and absence of thresholds do", async () => {
  const observations = await producerFixture();
  const phase = firstPhase(observations);
  phase.ingress.observation.persisted_events_per_second = 1e100;
  phase.sender.observation.delivery_latency = { samples: 1, p50_ms: 1e90, p95_ms: 1e95, maximum_ms: 1e99 };
  const result = evaluateCases({ observations, expectations: FROZEN });
  assert.equal(result.evaluations.find((entry) => entry.case_id === "N-07").matched, true);
  const expectations = structuredClone(FROZEN);
  expectations.latency_threshold_ms = 100;
  assert.equal(evaluateCases({ observations, expectations }).evaluations.find((entry) => entry.case_id === "N-07").matched, false);
  delete phase.sender.observation.environment.cpu_count;
  assert.equal(evaluateCases({ observations, expectations: FROZEN }).evaluations.find((entry) => entry.case_id === "N-07").matched, false);
});

test("distinct counting is global by event.id, including across source/signature partitions", async () => {
  const observations = await producerFixture();
  const phase = firstPhase(observations);
  const [first, second] = phase.sender.emissions;
  const previous = second.event_id;
  second.event_id = first.event_id;
  phase.ingress.raw_persisted_bodies.forEach((body) => {
    if (body.event.id === previous) body.event.id = first.event_id;
  });
  assert.equal(evaluateCases({ observations, expectations: FROZEN }).verdict.mismatched, 10);
});
