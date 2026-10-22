import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { measure } from "../p-map/workload.mjs";
import { evaluationPlan } from "./p-map-evaluation-fixtures.mjs";
import { processFixture } from "./p-map-process-fixtures.mjs";

const MUTATIONS = [
  ["boundary refusal", (baseline) => { baseline.records.at(-1).accepted = false; }],
  ["capture loss", (baseline) => { baseline.records.at(-1).captures = []; }],
  ["duplicate step", (baseline) => { baseline.records.push(baseline.records.at(-1)); }],
  ["owned abort", (baseline) => { baseline.records.push({ step_id: "B-MFA/aborted", variant: "case_aborted" }); }],
  ["accounting loss", (baseline) => { baseline.accounting.pop(); }],
  ["malformed record", (baseline) => { baseline.records[3] = { step_id: 7 }; }],
];
for (const [label, mutate] of MUTATIONS) {
  test(`P-map retained ${label} is routed to its baseline evaluation, not concrete or unknown-step rows`, async () => {
    const observed = await measure(processFixture());
    mutate(observed.baselines);
    const result = evaluateProbe({ observations: [observed], expectations: evaluationPlan() });
    const row = result.baseline_evaluations.find((entry) => entry.case_id === "B-MFA");
    assert.equal(row.matched, false);
    assert(row.mismatches.length > 0);
    assert(result.baseline_evaluations.find((entry) => entry.case_id === "B-LOGOUT").matched);
    assert(result.evaluations.every((entry) => entry.matched), "concrete rows remain independent");
    assert.deepEqual(result.observations[0].baselines, observed.baselines);
  });
}
