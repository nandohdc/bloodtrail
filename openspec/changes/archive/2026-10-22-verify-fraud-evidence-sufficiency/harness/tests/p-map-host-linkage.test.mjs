import assert from "node:assert/strict";
import test from "node:test";
import { measure } from "../p-map/workload.mjs";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { evaluationPlan } from "./p-map-evaluation-fixtures.mjs";
import { processFixture } from "./p-map-process-fixtures.mjs";

async function evaluated(options) {
  const observed = await measure(processFixture(options));
  return evaluateProbe({ expectations: evaluationPlan(), observations: [observed] });
}
function assertIndependent(result) {
  assert.equal(result.evaluations.find((entry) => entry.case_id === "K2a").matched, true);
  const lock = result.verdicts.find((entry) => entry.case_id === "S-LOCK");
  assert.equal(lock.verdict, "STRAINED");
  assert.equal(result.verdicts.find((entry) => entry.case_id === "S-CRIT2").verdict, "PASS");
  return lock.findings.observed.host_linkage_preserved;
}

const MISSING = [
  ["K1 refused", { fault: { case_id: "K1", method: "authenticationFailed", kind: "refuse" } }],
  ["K1 aborted", { abort: "K1" }],
];
for (const [label, options] of MISSING) test(`${label}: K2a and criterion remain independent; only linkage is null`, async () => {
  const result = await evaluated(options);
  assert.equal(assertIndependent(result), null);
  assert.equal(result.evaluations.find((entry) => entry.case_id === "K1").matched, false);
});

for (const field of ["request_id", "correlation_id"]) test(`host linkage finding reads actual ${field}, not a precomputed attribution boolean`, async () => {
  const result = await evaluated();
  assert.equal(assertIndependent(result), true);
  const observed = structuredClone(result.observations);
  observed[0].records.find((entry) => entry.step_id === "K2a/policy").captures[0].event.correlation[field] = "pmap-unrelated-link";
  const changed = evaluateProbe({ expectations: evaluationPlan(), observations: observed });
  assert.equal(assertIndependent(changed), false);
});
