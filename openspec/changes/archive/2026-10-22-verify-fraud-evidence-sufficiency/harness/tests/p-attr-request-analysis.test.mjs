import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCases } from "../p-attr/evaluate.mjs";
import { resourceContribution } from "../p-attr/policy.mjs";
import { recordAt } from "./p-attr-af-fixtures.mjs";
import { REQUEST_FAMILIES, requestFixtures } from "./p-attr-request-fixtures.mjs";

// Independent handwritten oracle, NOT derived from REQUEST_CASES/expectations.
// At cc4fdf5: catalog:32-33,483-485; field-policy:313-341,373-421,503-511,
// 993-1001; authority-matrix:11-18; spec:90-104. Both request families permit
// only safely resolved account targets, unlike AF and AS. Tuple order below.
const AXES = ["provenance_ambiguity", "in_occurrence_flag", "resource_rule", "meaning_misuse", "discloses_existence", "per_target_grouping"];
const ORACLE = [
  ["B/ex", [false, false, "conforms", false, false, false]],
  ["C1/ex", [true, true, "circumvents", true, false, true]],
  ["C2/ex", [true, true, "circumvents", true, false, true]],
  ["C3/ex", [false, false, "circumvents", true, false, true]],
  ["C4/nx", [true, false, "violates", true, false, true]],
  ["C5/subject-ex", [false, false, "conforms", false, true, true]],
  ["C5/subject-nx", [false, false, "conforms", false, true, false]],
  ["C5/resource-ex", [false, false, "conforms", false, true, true]],
  ["C5/resource-nx", [false, false, "conforms", false, true, false]],
  ["CR/nx", [true, false, "violates", true, false, true]],
  ["C6/ex", [true, false, "violates", true, false, true]],
  ["C6s/ex", [true, false, "violates", true, true, true]],
  ["C6s/nx", [true, false, "violates", true, true, true]],
  ["C7/ex", [false, false, "n/a", false, false, false]],
  ["X2/nx", [true, false, "circumvents", true, false, true]],
];
const AMBIGUOUS = [
  ["C1/ex", ["actor.id"]], ["C2/ex", ["actor.id"]], ["C3/ex", []],
  ["C4/ex", ["subject.id"]], ["C5/subject-ex", []], ["C5/resource-ex", []],
  ["CR/ex", ["resource.id"]], ["C6/ex", ["credential.reference"]],
  ["C6s/ex", ["credential.reference"]], ["X2/ex", ["actor.id", "authenticated_principal.id"]],
];
function relabelOrigin(record, path) {
  record.captured_origins[0][path] = "SR";
}
function falseRefusal(record) {
  record.raw.error.path = "/actor";
  record.diagnostic.path = "/actor";
}
const MUTATIONS = [
  ["baseline", "B", (record) => { record.frozen[0] = false; }],
  ["actor", "C1", (record) => relabelOrigin(record, "actor.id")],
  ["hook", "C2", (record) => { record.hook_facts[0].tenant_id = "tnt-altered"; }],
  ["display", "C3", (record) => { delete record.events[0].actor.display_name; }],
  ["subject", "C4", (record) => relabelOrigin(record, "subject.id")],
  ["resource", "CR", (record) => relabelOrigin(record, "resource.id")],
  ["credential", "C6", (record) => relabelOrigin(record, "credential.reference")],
  ["tenant", "C7", (record) => { record.captured_origins[0]["tenant.scope"] = "CP"; }],
  ["escalation", "C9", falseRefusal],
  ["extra", "X2", (record) => relabelOrigin(record, "authenticated_principal.id")],
];
function planFor(record) {
  return { step_id: record.step_id, kind: "returned", accepted: record.accepted,
    diagnostic: record.diagnostic, sink_count: record.sink_count, frozen: record.frozen,
    axes: record.analysis.axes, assertions: { hook_facts: record.hook_facts } };
}
function mutationCheck({ state, family, suffix, mutate }) {
  const records = ["ex", "nx"].map((target) => recordAt(state, `${family}-${suffix}/${target}`));
  const expectations = { cases: [{ case_id: `${family}-${suffix}`, predicted_calls: 0, expected: records.map(planFor) }] };
  const evaluate = (items) => evaluateCases({ records: items, expectations })[0];
  assert.equal(evaluate(records).matched, true);
  const changed = structuredClone(records);
  mutate(changed[0]);
  const result = evaluate(changed);
  assert.equal(result.matched, false);
  assert(result.mismatches.length > 0);
}

for (const { family } of REQUEST_FAMILIES) {
  const state = await requestFixtures({ family });
  for (const [suffix, expected] of ORACLE) {
    test(`${family}-${suffix} independent source-derived axes`, () => {
      const { axes, issues } = recordAt(state, `${family}-${suffix}`).analysis;
      assert.deepEqual(AXES.map((name) => axes[name]), expected);
      assert.deepEqual(axes.allowed_source_violations, []);
      assert.deepEqual(issues, []);
    });
  }
  test(`${family} ambiguity is limited to actual CP fields, including the fabricated principal`, () => {
    for (const [suffix, expected] of AMBIGUOUS) {
      assert.deepEqual(recordAt(state, `${family}-${suffix}`).analysis.axes.ambiguous_fields, expected);
    }
  });
  test(`${family}-C6s separately conforms SR subject without laundering CP credential`, () => {
    const record = recordAt(state, `${family}-C6s/ex`);
    const contributions = ["subject.id", "credential.reference"].map((path) => resourceContribution({
      family, path, content: record.contents[path], origin: record.captured_origins[0][path],
    }));
    assert.deepEqual(contributions, ["conforms", "violates"]);
    assert.equal(recordAt(state, `${family}-C6s/nx`).events[0].subject, undefined);
  });
  for (const [group, suffix, mutate] of MUTATIONS) {
    test(`${family} evaluator detects ${group} negative mutation`, () => mutationCheck({ state, family, suffix, mutate }));
  }
}
