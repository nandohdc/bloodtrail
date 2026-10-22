import assert from "node:assert/strict";
import { redeliveryWorkload } from "../p-e/redelivery-workload.mjs";
import { REDELIVERY_CASES } from "../p-e/redelivery-cases.mjs";
import { peState } from "./p-e-case-fixtures.mjs";

// Test-only plumbing. The hand-written oracles live in the test files, not in
// the workload/descriptors. The independent public-shape double is source-
// cited in p-e-case-fixtures; none of these modules loads SDK or kit code.
export function stepRecord(state, caseId, step) {
  const record = state.records.find((entry) => entry.step_id === `${caseId}/${step}`);
  assert.notEqual(record, undefined, `${caseId}/${step}`);
  return record;
}

export async function runCases(ids) {
  const state = peState({ budget: 500 });
  const cases = REDELIVERY_CASES.filter((row) => ids.includes(row.case_id));
  const rows = await redeliveryWorkload(state, cases);
  const plannedIds = rows.flatMap((row) => row.steps.map((step) => `${row.case_id}/${step}`));
  assert.deepEqual(state.records.map((row) => row.step_id), plannedIds);
  assert.equal(new Set(plannedIds).size, plannedIds.length);
  return { state, rows };
}

export function checkTotals(rows, oracle) {
  assert.equal(rows.length, oracle.length);
  for (const expected of oracle) {
    const summary = rows.find((row) => row.case_id === expected.id);
    assert.equal(summary.public_calls, expected.calls, expected.id);
    assert.equal(summary.predicted_calls, expected.calls, expected.id);
    const actual = { probe: expected.probe, gate: expected.gate, exchange: expected.exchange,
      sink: expected.sink, business_commits: expected.business };
    assert.deepEqual(summary.actual, actual, expected.id);
    assert.deepEqual(summary.predicted, actual, expected.id);
  }
}

export function checkDescriptors(ids) {
  const cases = REDELIVERY_CASES.filter((row) => ids.includes(row.case_id));
  assert.deepEqual(cases.map((row) => row.case_id), ids);
  for (const entry of cases) {
    for (const field of ["case_id", "family", "scenario", "comment_id", "setup", "expected",
      "classification", "basis", "confidence", "predicted_calls", "predicted"]) {
      assert.notEqual(entry[field], undefined, `${entry.case_id} ${field}`);
    }
    assert(entry.basis.length > 0 && entry.basis.every((cite) => cite.includes(":")), entry.case_id);
    assert.equal(entry.family, "redelivery");
    assert.equal(entry.corrected_from, undefined);
    assert(entry.basis.some((cite) => cite.includes("delivery-classes.ts")), entry.case_id);
  }
}
