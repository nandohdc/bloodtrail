import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { spread, writeSpread } from "../counts/spread.mjs";
import { resultRecord, serializeResults } from "../lib/results.mjs";
import { producerFixture } from "./counts-fixture.mjs";
import { FROZEN } from "./counts-rehearsal.mjs";
import { evaluateCases } from "../counts/evaluate.mjs";

async function resultsFixture() {
  const observations = await producerFixture();
  return [10, 11, 12].map((runNumber) => ({
    ...resultRecord({
      probe: "S2-counts", ticket: 841, runNumber, approvedHead: FROZEN.base, approval: { fixture: true },
      expectations: { path: "expectations/counts.v1.json", sha256: "producer-built" },
      started: "2026-10-29T00:00:00Z", ended: "2026-10-29T00:01:00Z", provenance: {},
      cases: evaluateCases({ observations, expectations: FROZEN }), invalidations: [],
      occurrenceCount: observations.occurrence_count, callBound: FROZEN.planned_call_budget.total,
    }),
    observations: structuredClone(observations),
  }));
}

test("spread reads three producer-built files, writes deterministic min/median/max", async () => {
  const results = await resultsFixture();
  const root = mkdtempSync(join(tmpdir(), "counts-spread-"));
  try {
    const files = results.map((result) => {
      const file = join(root, `run-${result.run_id}.json`);
      writeFileSync(file, serializeResults(result));
      return file;
    });
    const output = join(root, "spread.json");
    const summary = writeSpread({ files: [...files].reverse(), output });
    assert.equal(readFileSync(output, "utf8"), serializeResults(spread(results)));
    const plan = summary.phases.outages_clean.observations;
    const ingress = plan.ingress_persisted_events_per_second;
    assert.equal(ingress.minimum, ingress.median);
    assert.equal(ingress.maximum, ingress.median);
    assert.throws(() => writeSpread({ files, output }), /EEXIST/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("spread preserves empty samples, and rejects missing plans, observations and runs", async () => {
  const results = await resultsFixture();
  const latency = spread(results).phases.outages_permanent_400.observations.delivery_latency_p50_ms;
  assert.deepEqual(latency, { minimum: null, median: null, maximum: null, samples: 0 });
  assert.throws(() => spread(results.slice(0, 2)));
  const mutations = [
    (values) => { values[1].run_id = 10; },
    (values) => { delete values[1].observations.phases.outages_clean; },
    (values) => { delete values[1].observations.phases.outages_clean.sender.observation; },
    (values) => { values[1].expectations.sha256 = "different"; },
    (values) => { values[1].authorization.reference = "another head at " + "0".repeat(40); },
  ];
  for (const mutate of mutations) {
    const values = structuredClone(results);
    mutate(values);
    assert.throws(() => spread(values));
  }
});

test("spread selects the middle producer observation, independent of file and Unicode key order", async () => {
  const results = await resultsFixture();
  const names = ["outages_clean", "outages_status_503", "outages_status_429"];
  const values = names.map((name) => results[0].observations.phases[name].ingress.observation.persisted_events_per_second);
  results.forEach((result, index) => {
    const phase = result.observations.phases.outages_clean;
    phase.ingress.observation.persisted_events_per_second = values[index];
    result.observations.phases = { "\u{10000}": structuredClone(phase), "\uE000": phase };
  });
  const result = spread([...results].reverse());
  assert.deepEqual(Object.keys(result.phases), ["\uE000", "\u{10000}"]);
  const sorted = [...values].sort((left, right) => left - right);
  assert.deepEqual(result.phases["\uE000"].observations.ingress_persisted_events_per_second, {
    minimum: sorted[0], median: sorted[1], maximum: sorted[2], samples: 3,
  });
});
