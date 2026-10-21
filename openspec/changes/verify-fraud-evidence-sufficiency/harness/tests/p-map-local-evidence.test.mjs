import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { measuredField } from "../p-map/evidence.mjs";
import { evaluationFixture } from "./p-map-evaluation-fixtures.mjs";

const FIXTURE = await evaluationFixture();
const CONTROLS = ["U1/tenantless", "K2a/tenantless", "L1/duplicate-success", "R2/tenantless-completed", "C2a/bytes-8193"];
const EXPRESSIONS = ["U1/administrator", "K2a/policy", "L1/not-applicable"];
const SIGNALS = { U1: "S-UNLOCK", K2a: "S-LOCK", L1: "S-LOGOUT" };
const records = (input) => input.observations.flatMap((process) => process.records);
const row = (result, id) => result.evaluations.find((entry) => entry.case_id === id);
const verdict = (result, id) => result.verdicts.find((entry) => entry.case_id === id).verdict;

function mutatedRecord(id) {
  const input = structuredClone(FIXTURE);
  const actual = records(input).find((entry) => entry.step_id === id);
  actual.kind = "thrown";
  return { input, actual };
}

for (const id of CONTROLS) test(`control mismatch ${id} cannot erase an independent accepted expression`, () => {
  const { input } = mutatedRecord(id);
  const result = evaluateProbe(input);
  const owner = row(result, id.split("/")[0]);
  assert.equal(owner.matched, false);
  assert.equal(owner.integrity, true);
  assert.equal(owner.steps.find((step) => step.step_id === id).matched, false);
  assert.equal(verdict(result, "S-CRIT2"), "PASS");
  assert.equal(result.verdicts.find((entry) => entry.case_id === "S-CONTACT").findings.observed.object_item_accepted, true);
  assert.equal(measuredField({ rows: result.evaluations, records: records(input) }, id, "accepted"), null);
  for (const signal of result.verdicts.slice(0, 6)) assert.equal(signal.status, "conclusive");
});

for (const id of EXPRESSIONS) test(`accepted-expression mismatch ${id} remains inconclusive`, () => {
  const input = structuredClone(FIXTURE);
  records(input).find((entry) => entry.step_id === id).raw.value.status = "changed";
  const result = evaluateProbe(input);
  assert.equal(row(result, id.split("/")[0]).matched, false);
  assert.equal(verdict(result, SIGNALS[id.split("/")[0]]), null);
  assert.equal(verdict(result, "S-CRIT2"), "INCONCLUSIVE");
});

const INTEGRITY_FAULTS = [
  ["abort", (input) => { input.observations[2].records.push({ step_id: "U1/aborted", variant: "case_aborted", message: "fixture abort" }); }],
  ["duplicate record", (input) => { input.observations[2].records.push(structuredClone(records(input).find((entry) => entry.step_id === "U1/tenantless"))); }],
  ["unplanned record", (input) => { input.observations[2].records.push({ step_id: "U1/unplanned" }); }],
  ["unowned record", (input) => { input.observations[2].records.push({ step_id: "unknown", case_id: "U1" }); }],
  ["bare owner record", (input) => { input.observations[2].records.push({ step_id: "U1" }); }],
  ["duplicate accounting", (input) => { input.observations[2].accounting.push(structuredClone(input.observations[2].accounting.find((entry) => entry.case_id === "U1"))); }],
  ["duplicate planned case", (input) => { input.expectations.cases.push(structuredClone(input.expectations.cases.find((entry) => entry.case_id === "U1"))); }],
  ["malformed row", (input) => { input.expectations.cases.find((entry) => entry.case_id === "U1").expected = null; }],
];
for (const [label, mutate] of INTEGRITY_FAULTS) test(`case-wide ${label} poisons only its owner's candidates`, () => {
  const input = structuredClone(FIXTURE);
  mutate(input);
  const result = evaluateProbe(input);
  assert.equal(row(result, "U1").integrity, false);
  assert.equal(verdict(result, "S-UNLOCK"), null);
  assert.equal(verdict(result, "S-LOGOUT"), "FITS");
  assert.equal(measuredField({ rows: result.evaluations, records: records(input) }, "U1/scheduled", "accepted"), null);
  assert.equal(result.observations, input.observations);
});
