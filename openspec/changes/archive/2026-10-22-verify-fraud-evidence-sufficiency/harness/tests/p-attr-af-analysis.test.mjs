import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecord } from "../p-attr/observations.mjs";
import { afFixtures, recordAt } from "./p-attr-af-fixtures.mjs";

// Independent hand-written axis oracle, read from policy:73-81,293-421,
// 493-521,593-601,783-791,1133-1251; catalog:201-202; spec:90-104;
// authority-matrix:12-18, all at cc4fdf5. NOT from AF_CASES or expectations.
// Tuple: ambiguity, actor.id occurrence flag, rule, misuse, disclosure, grouping.
const ORACLE = [
  ["AF-B/ex", [false, false, "conforms", false, false, false]],
  ["AF-C1/ex", [true, true, "circumvents", true, false, true]],
  ["AF-C2/ex", [true, true, "circumvents", true, false, true]],
  ["AF-C3/ex", [false, false, "circumvents", true, false, true]],
  ["AF-C3s/nx", [false, false, "violates", true, false, true]],
  ["AF-C4/ex", [true, false, "violates", true, false, true]],
  ["AF-C5/ex", [false, false, "violates", false, true, true]],
  ["AF-C5/nx", [false, false, "conforms", false, true, false]],
  ["AF-C6/ex", [true, false, "violates", true, false, true]],
  ["AF-C6s/ex", [true, false, "violates", true, true, true]],
  ["AF-C6s/nx", [true, false, "violates", true, true, true]],
  ["AF-C7/ex", [false, false, "n/a", false, false, false]],
  ["AF-X1/ex", [true, false, "circumvents", true, false, true]],
  ["AF-X2/ex", [true, false, "circumvents", true, false, true]],
  ["AF-X3/ex", [false, false, "conforms", false, true, false]],
  ["AF-X4/ex", [false, false, "circumvents", true, true, true]],
  ["AF-X4/nx", [false, false, "conforms", false, true, false]],
  ["AF-F1/id-ex", [true, false, "circumvents", true, false, true]],
  ["AF-F2/ex", [true, false, "circumvents", true, false, true]],
  ["AF-F3/ex", [true, false, "circumvents", true, false, true]],
  ["AF-F4/ex", [true, false, "circumvents", true, false, true]],
  ["AF-C0r/ex", [false, false, "conforms", false, false, false]],
];
const AXES = ["provenance_ambiguity", "in_occurrence_flag", "resource_rule", "meaning_misuse", "discloses_existence", "per_target_grouping"];
const state = await afFixtures();
const tuple = (axes) => AXES.map((name) => axes[name]);

for (const [id, expected] of ORACLE) {
  test(`source-derived independent AF axes: ${id}`, () => {
    assert.deepEqual(tuple(recordAt(state, id).analysis.axes), expected);
  });
}

test("AF-X4 source violation remains separate from CP-only ambiguity and has ex-only linkage candidates", () => {
  const ex = recordAt(state, "AF-X4/ex");
  assert.deepEqual(ex.analysis.axes.allowed_source_violations, ["actor.id", "authenticated_principal.id"]);
  assert.equal(ex.events[0].actor.id, "acct-0001");
  assert.equal(ex.analysis.axes.provenance_ambiguity, false);
  assert.deepEqual(recordAt(state, "AF-X4/nx").analysis.axes.targets, []);
});

function insertResource(record) {
  record.events[0].resource.id = "acct-0001";
  record.captured_origins[0]["resource.id"] = "SR";
  record.contents["resource.id"] = { kind: "resolved_account", source: "safe_resolution" };
}

function underclaim(record, path) {
  record.captured_origins[0][path] = "SR";
}

function corruptTenant(record) {
  record.events[0].tenant.effective_tenant_id = "tnt-b02";
  record.captured_origins[0]["tenant.effective_tenant_id"] = "CP";
}

function refused(record) {
  record.accepted = false;
  record.diagnostic = { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor" };
  record.raw = { ok: false, error: record.diagnostic };
  record.sink_count = 0;
  record.events = [];
  record.frozen = [];
  record.captured_origins = [];
}

const MUTATIONS = [
  ["baseline", "AF-B/ex", insertResource],
  ["actor/display", "AF-C1/ex", (record) => underclaim(record, "actor.id")],
  ["subject/resource", "AF-C4/ex", (record) => underclaim(record, "subject.id")],
  ["credential", "AF-C6/ex", (record) => underclaim(record, "credential.reference")],
  ["tenant", "AF-C7/ex", corruptTenant],
  ["escalation/extra", "AF-X4/ex", refused],
  ["free-form", "AF-F1/id-ex", (record) => {
    underclaim(record, "request.id");
    underclaim(record, "correlation.request_id");
  }],
];

for (const [group, id, mutate] of MUTATIONS) {
  test(`independent AF oracle detects negative ${group} mutation`, () => {
    const record = structuredClone(recordAt(state, id));
    const expected = ORACLE.find(([name]) => name === id)[1];
    mutate(record);
    const analysis = analyzeRecord({ record, records: state.records });
    assert.notDeepEqual(tuple(analysis.axes), expected);
  });
}
