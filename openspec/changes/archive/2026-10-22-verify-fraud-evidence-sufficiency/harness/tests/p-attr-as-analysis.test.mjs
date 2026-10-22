import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecord } from "../p-attr/observations.mjs";
import { evaluateCases } from "../p-attr/evaluate.mjs";
import { resourceContribution } from "../p-attr/policy.mjs";
import { asFixtures } from "./p-attr-as-fixtures.mjs";
import { recordAt } from "./p-attr-af-fixtures.mjs";

// Independent, handwritten from catalog:147-148; field-policy:313-421,503-511,
// 553-601,993-1001; authority-matrix:12-18; spec:90-104 at cc4fdf5.
// NOT copied/generated from AS_CASES, expected outcomes or frozen expectations.
// Tuple: ambiguity, occurrence flag, resource class, misuse, disclosure, grouping.
const ORACLE = [
  ["AS-B/ex", [false, false, "conforms", false, "n/a", true]],
  ["AS-C2/honest-control", [false, false, "conforms", false, "n/a", true]],
  ["AS-C3/ex", [false, false, "circumvents", true, "n/a", true]],
  ["AS-C4/ex", [true, false, "violates", true, "n/a", true]],
  ["AS-C5/ex", [false, false, "violates", false, "n/a", true]],
  ["AS-CR/ex", [true, false, "violates", true, "n/a", true]],
  ["AS-C6/ex", [true, false, "conforms", true, "n/a", true]],
  ["AS-C6s/ex", [true, false, "violates", true, "n/a", true]],
  ["AS-C7/ex", [false, false, "conforms", false, "n/a", true]],
  ["AS-X2/ex-0001", [true, false, "circumvents", true, "n/a", true]],
  ["AS-X2/ex-0002", [true, false, "circumvents", true, "n/a", true]],
  ["AS-X2/ex-0003", [true, false, "circumvents", true, "n/a", true]],
];
const AXES = ["provenance_ambiguity", "in_occurrence_flag", "resource_rule", "meaning_misuse", "discloses_existence", "per_target_grouping"];
const state = await asFixtures();

for (const [id, expected] of ORACLE) {
  test(`independent AS source-table axes: ${id}`, () => {
    const record = recordAt(state, id);
    assert.deepEqual(AXES.map((name) => record.analysis.axes[name]), expected);
    assert.deepEqual(record.analysis.axes.allowed_source_violations, []);
    assert.equal(record.existence_peer, undefined);
  });
}

test("AS-C6s classifies CP credential and SR subject separately instead of laundering the reference", () => {
  const record = recordAt(state, "AS-C6s/ex");
  const paths = ["credential.reference", "subject.id"];
  const rules = paths.map((path) => resourceContribution({ family: "AS", path, content: record.contents[path], origin: record.captured_origins[0][path] }));
  assert.deepEqual(rules, ["conforms", "violates"]);
  assert.deepEqual(record.analysis.axes.ambiguous_fields, ["credential.reference"]);
  assert.equal(record.analysis.axes.meaning_misuse, true);
});

function wrongOrigin(record, path) {
  record.captured_origins[0][path] = "SR";
}

function removeDisplay(record) {
  delete record.events[0].actor.display_name;
}

function promoteTenant(record) {
  record.events[0].tenant.effective_tenant_id = "tnt-b02";
  record.captured_origins[0]["tenant.effective_tenant_id"] = "CP";
}

function alterRefusal(record) {
  record.diagnostic.path = "/actor";
  record.raw.error.path = "/actor";
}

const MUTATIONS = [
  ["baseline", "AS-B/ex", (record) => { record.sink_count = 0; }],
  ["actor", "AS-X2/ex-0001", (record) => wrongOrigin(record, "actor.id")],
  ["hook", "AS-C2/honest-control", (record) => { record.hook_facts[0].purpose = "authentication_failed"; }],
  ["display", "AS-C3/ex", removeDisplay],
  ["subject", "AS-C4/ex", (record) => wrongOrigin(record, "subject.id")],
  ["resource", "AS-CR/ex", (record) => wrongOrigin(record, "resource.id")],
  ["credential", "AS-C6/ex", (record) => wrongOrigin(record, "credential.reference")],
  ["tenant", "AS-C7/ex", promoteTenant],
  ["escalation", "AS-C8/ex", alterRefusal],
];

function planned(record) {
  return { step_id: record.step_id, kind: "returned", accepted: record.accepted,
    diagnostic: record.diagnostic, sink_count: record.sink_count, frozen: record.frozen,
    axes: record.analysis.axes, assertions: { hook_facts: record.hook_facts } };
}

for (const [group, id, mutate] of MUTATIONS) {
  test(`production evaluator detects AS ${group} negative mutation`, () => {
    const original = recordAt(state, id);
    // The independent oracle above establishes axes. This isolated comparison
    // verifies the evaluator actually observes each kind of changed fact.
    const expectations = { cases: [{ case_id: id.split("/")[0], predicted_calls: original.predicted_calls, expected: [planned(original)] }] };
    assert.equal(evaluateCases({ records: [original], expectations })[0].matched, true);
    const changed = structuredClone(original);
    mutate(changed);
    const result = evaluateCases({ records: [changed], expectations })[0];
    assert.equal(result.matched, false);
    assert(result.mismatches.length > 0);
  });
}

test("AS-C3 and AS-C5 corrections are observable axes, not labels injected from the descriptor", () => {
  const display = structuredClone(recordAt(state, "AS-C3/ex"));
  removeDisplay(display);
  assert.equal(analyzeRecord({ record: display, records: [] }).axes.resource_rule, "conforms");
  const subject = structuredClone(recordAt(state, "AS-C5/ex"));
  delete subject.events[0].subject;
  assert.equal(analyzeRecord({ record: subject, records: [] }).axes.resource_rule, "conforms");
});
