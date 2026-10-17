import assert from "node:assert/strict";
import test from "node:test";
import { analyzeLinkage } from "../p-attr/linkage-analysis.mjs";
import { DECLARED_PAIRS } from "../p-attr/linkage-cases.mjs";
import { linkageFixture, L1_TABLE, L2_TABLE, rowAt, rowAtTo, linkedRecord } from "./p-attr-request-fixtures.mjs";

const state = await linkageFixture();
const observed = analyzeLinkage({ records: state.records });
for (const [id, linked, exTargets, nxTargets] of L1_TABLE) {
  test(`source-derived L1 ex/nx linkage and grouping ${id}`, () => {
    const row = rowAt(observed.L1, id);
    assert.deepEqual(row.ex.linkage, { numerator: linked, denominator: 15, fraction: linked / 15 });
    assert.equal(row.nx.linkage.numerator, 0);
    assert.equal(row.ex.target_coverage.numerator, exTargets);
    assert.equal(row.nx.target_coverage.numerator, nxTargets);
    assert.deepEqual(row.nx.groups.map((group) => group.count), nxTargets === 15 ? [5, 5, 5] : [0, 0, 0]);
    assert(row.nx.groups.every((group) => group.groupable === (nxTargets === 15)));
    assert.deepEqual(row.issues, []);
  });
}
for (const [id, linked] of L2_TABLE) {
  test(`source-derived L2 mirror is equality not honest attribution ${id}`, () => {
    const row = rowAtTo(observed.L2, id);
    assert.equal(row.ex.linkage.numerator, linked);
    assert.equal(row.nx.linkage.numerator, 0);
    assert(row.nx.groups.every((group) => group.count === 5 && group.groupable));
    assert(row.axes.some((axes) => axes.meaning_misuse));
  });
}
test("every slot is present and classified without fabricated delivery evidence", () => {
  assert.equal(observed.valid, true);
  assert.deepEqual(observed.issues, []);
  assert.equal(JSON.stringify(observed).includes("body_hash"), false);
});
test("missing skeptic joins reject C4 and raw actor mirrors; exact declarations restore them", () => {
  const original = DECLARED_PAIRS.filter((pair) => pair.from !== pair.to);
  const dropped = analyzeLinkage({ records: state.records, pairs: original });
  for (const id of ["AS-C4/main", "AS-X2/main"]) {
    assert.equal(rowAtTo(dropped.L2, id).ex.linkage.numerator, 0);
    assert.equal(rowAtTo(observed.L2, id).ex.linkage.numerator, 15);
  }
});
test("the declared C2 mirror joins nothing across purpose scopes; the refused control row stays separate", () => {
  const mirror = rowAtTo(observed.L2, "AS-C2/keyed-mirror");
  const control = rowAtTo(observed.L2, "AS-C2/main");
  assert.equal(mirror.ex.linkage.numerator, 0);
  assert.equal(control.ex.linkage.numerator, 0);
  const mirrorRecords = state.records.filter((record) => record.step_id.startsWith("L2/AS-C2/keyed-mirror/"));
  const controlRecords = state.records.filter((record) => record.step_id.startsWith("L2/AS-C2/main/"));
  assert.equal(mirrorRecords.length, 3);
  assert(mirrorRecords.every((record) => record.accepted), "the declared keyed mirror must be accepted");
  assert(controlRecords.every((record) => !record.accepted), "the refused AS-C2 control stays refused");
  assert(mirror.axes.some((axes) => axes.meaning_misuse));
});
test("undeclared PR/RA resource and subject equality cannot count", () => {
  const dropped = analyzeLinkage({ records: state.records, pairs: DECLARED_PAIRS.filter((pair) => pair.from_family === "AF") });
  assert(dropped.L3.every((row) => row.ex.linkage.numerator === 0));
  assert(observed.L3.every((row) => row.ex.linkage.numerator === 3));
});
test("safe-resolution L3 is conformant, consumer-disclosing and ex-only, unlike honest nx coverage", () => {
  for (const row of observed.L3) {
    assert.equal(row.ex.linkage.fraction, 1);
    assert.equal(row.nx.target_coverage.numerator, 0);
    assert(row.axes.every((axes) => axes.resource_rule === "conforms" && axes.discloses_existence === true));
    assert(row.axes.every((axes) => axes.meaning_misuse === false && axes.provenance_ambiguity === false));
  }
  const x4 = rowAt(observed.L1, "AF-X4/main");
  assert.equal(x4.ex.linkage.fraction, 1);
  assert(x4.axes.some((axes) => axes.meaning_misuse && axes.discloses_existence));
});
const MUTATIONS = [
  ["ground truth", (records) => { records[0].account = "acct-9999"; }],
  ["success principal ground truth", (records) => { linkedRecord(records, "L2/AS-C4/main/ex-0001-1").events[0].authenticated_principal.id = "acct-9999"; }],
  ["missing content origin", (records) => { delete linkedRecord(records, "L1/AF-C1/main/ex-0001-1").captured_origins[0]["actor.id"]; }],
  ["nx invented account", (records) => { linkedRecord(records, "L1/AF-C5/main/nx-0001-1").account = "acct-0001"; }],
  ["dataset denominator", (records) => { records.pop(); }],
  ["duplicate slot", (records) => { records.push(structuredClone(records[0])); }],
  ["missing capture", (records) => { records[0].events = []; }],
  ["unknown slot", (records) => { records[0].step_id = "L1/unplanned/ex-0001-1"; }],
  ["target metadata", (records) => { records[0].linkage.pid = "pid-nx-0001"; }],
];
for (const [label, mutate] of MUTATIONS) {
  test(`linkage inventory rejects ${label} without changing ground-truth denominators`, () => {
    const records = structuredClone(state.records);
    mutate(records);
    const result = analyzeLinkage({ records });
    assert.equal(result.valid, false);
    assert(result.issues.length > 0);
    assert(result.L1.every((row) => row.ex.attempts === 15 && row.nx.attempts === 15));
  });
}
test("altered carrier value removes only its observed join, not the fixed denominator", () => {
  const records = structuredClone(state.records);
  linkedRecord(records, "L1/AF-C5/main/ex-0001-1").events[0].subject.id = "acct-9999";
  const row = rowAt(analyzeLinkage({ records }).L1, "AF-C5/main");
  assert.equal(row.ex.linkage.numerator, 14);
  assert.equal(row.ex.linkage.denominator, 15);
});
