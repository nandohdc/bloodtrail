import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCases } from "../p-d/evaluate.mjs";

const SOURCES = [
  ["missing record", [], "PD-A2/main/value", true],
  ["missing path", [{ step_id: "PD-A2/main" }], "PD-A2/main/value", true],
  ["undefined", [{ step_id: "PD-A2/main", value: undefined }], "PD-A2/main/value", true],
  ["false", [{ step_id: "PD-A2/main", value: false }], "PD-A2/main/value", false],
  ["zero", [{ step_id: "PD-A2/main", value: 0 }], "PD-A2/main/value", false],
  ["empty", [{ step_id: "PD-A2/main", value: "" }], "PD-A2/main/value", false],
  ["null", [{ step_id: "PD-A2/main", value: null }], "PD-A2/main/value", false],
];
for (const [label, sources, ref, missing] of SOURCES) {
  test(`same_as ${label} ${missing ? "mismatches" : "matches"} an equal observation`, () => {
    const value = sources[0]?.value;
    const observations = [{ records: [{ step_id: "PD-A1/main", value }, ...sources], ledger: { calls: [] } }];
    const expectations = {
      cases: [{ case_id: "PD-A1", expected: [{ step_id: "PD-A1/main", assertions: { value: { same_as: ref } } }] }],
      planned_occurrence_budget: { calls_by_case: { "PD-A1": 0 } },
    };
    const [result] = evaluateCases({ observations, expectations });
    assert.equal(result.matched, !missing);
    assert.deepEqual(result.notes, missing ? [`same_as source missing: ${ref}`] : []);
  });
}
