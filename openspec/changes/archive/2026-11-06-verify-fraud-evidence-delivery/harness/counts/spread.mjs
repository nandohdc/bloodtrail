// Kit-free post-run reducer; call writeSpread only after the three approved results exist.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { codePointCompare } from "./order.mjs";
import { serializeResults } from "../lib/results.mjs";

function range(values) {
  const available = values.filter((value) => value !== null);
  assert(available.every(Number.isFinite), "nonfinite observation");
  if (available.length === 0) return { minimum: null, median: null, maximum: null, samples: 0 };
  const sorted = available.sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return { minimum: sorted[0], median, maximum: sorted.at(-1), samples: sorted.length };
}

function observationsFor(phase) {
  const latency = phase.sender.observation.delivery_latency;
  return {
    ingress_persisted_events_per_second: phase.ingress.observation.persisted_events_per_second,
    delivery_latency_p50_ms: latency.p50_ms, delivery_latency_p95_ms: latency.p95_ms,
    delivery_latency_maximum_ms: latency.maximum_ms,
  };
}

function phaseSpread(results, name) {
  const phases = results.map((result) => result.observations.phases[name]);
  const samples = phases.map(observationsFor);
  const metrics = Object.keys(samples[0]).sort(codePointCompare);
  return {
    environments: phases.map((phase) => ({ ingress: phase.ingress.observation.environment, sender: phase.sender.observation.environment })),
    observations: Object.fromEntries(metrics.map((metric) => [metric, range(samples.map((sample) => sample[metric]))])),
  };
}

export function spread(results) {
  assert.equal(results.length, 3, "three results required");
  const ordered = [...results].sort((left, right) => left.run_id - right.run_id);
  assert.deepEqual(ordered.map((result) => result.run_id), [10, 11, 12]);
  const names = Object.keys(ordered[0].observations.phases).sort(codePointCompare);
  ordered.forEach((result) => {
    assert.equal(result.probe, "S2-counts");
    assert.match(result.authorization.reference, / at [0-9a-f]{40}$/);
    assert.equal(result.authorization.reference, ordered[0].authorization.reference, "results must name the same approved head");
    assert.deepEqual(result.expectations, ordered[0].expectations, "results must pin the same expectations");
    assert.deepEqual(Object.keys(result.observations.phases).sort(codePointCompare), names);
  });
  return { probe: "S2-counts", run_ids: [10, 11, 12], phases: Object.fromEntries(names.map((name) => [name, phaseSpread(ordered, name)])) };
}

export function writeSpread({ files, output }) {
  const result = spread(files.map((file) => JSON.parse(readFileSync(file, "utf8"))));
  writeFileSync(output, serializeResults(result), { flag: "wx" });
  return result;
}
