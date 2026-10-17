import assert from "node:assert/strict";
import test from "node:test";
import { computeAxes, originIssues } from "../p-attr/axes.mjs";
import { eventView } from "../p-attr/observations.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { tagged } from "../p-attr/origins.mjs";
import { capture, observation, withTarget, independentObservations, put } from "./p-attr-analysis-fixtures.mjs";
import { SOURCE_TABLE, tableAxes } from "./p-attr-source-table.mjs";

function axes(record) {
  if (!record.accepted) return computeAxes({ accepted: false });
  return computeAxes({ accepted: true, family: record.family, ...eventView(record) });
}

// Q1: keyed targets are structural. The independent table freezes the declared
// scope/origin/format and the run's matches boolean; the computed digest value
// is replaced by the record's keyed checks before comparison, exactly as the
// production evaluator does.
function comparableAxes({ record, computed, row }) {
  const keyedPaths = new Set((row.targets ?? []).filter((target) => target.keyed).map((target) => target.path));
  const targets = computed.targets.map((target) => {
    if (!keyedPaths.has(target.path)) return target;
    const check = (record.keyed_checks ?? []).find((entry) => entry.path === target.path);
    return { path: target.path, kind: target.kind, keyed: check === undefined ? null : {
      key_scope: check.key_scope, input_origin: check.input_origin,
      digest_format: check.digest_format, matches_declared_input: check.matches_declared_input } };
  });
  return { ...computed, targets };
}

for (const row of SOURCE_TABLE) {
  test(`independent source table ${row.id}: all axes (${row.basis.join("; ")})`, () => {
    const record = independentObservations().find((item) => item.step_id === `${row.id}/main`);
    assert.deepEqual(comparableAxes({ record, computed: axes(record), row }), tableAxes(row));
  });
}

test("raw, canonicalized and keyed CP stay CP; anonymous baselines do not flag actor.type", () => {
  const keying = memoryKeying();
  const transformed = keying.transform({ content: tagged({ value: "pid-ex-0001", origin: "CP" }), scope: "authentication_failed" });
  const keyed = withTarget({ id: "AF-C2", path: "actor.id", value: transformed.value, origin: transformed.origin });
  assert.equal(axes(keyed).provenance_ambiguity, true);
  assert.equal(axes(keyed).in_occurrence_flag, true);
  const canonical = withTarget({ id: "AF-C1", path: "actor.id", value: "PID-EX-0001".toLowerCase() });
  assert.equal(axes(canonical).provenance_ambiguity, true);
  for (const family of ["AF", "PR", "RA"]) {
    const baseline = observation({ id: `${family}-B`, event: capture(family) });
    assert.equal(axes(baseline).in_occurrence_flag, false);
  }
});

test("SR/SC display underclaims are not CP ambiguity; CP authoritative actor remains invisible", () => {
  for (const origin of ["SR", "SC"]) {
    const record = withTarget({ id: "AF-C3", path: "actor.display_name", origin });
    assert.equal(axes(record).provenance_ambiguity, false);
    assert.equal(axes(record).meaning_misuse, true);
  }
  const record = withTarget({ id: "AS-X2", path: "actor.id" });
  assert.equal(axes(record).provenance_ambiguity, true);
  assert.equal(axes(record).in_occurrence_flag, false);
});

test("absent fields have no axes and missing origins are explicit errors", () => {
  const record = observation({ id: "AF-B", event: capture("AF"), origins: { "subject.id": "CP" } });
  record.contents["subject.id"] = { target: true, kind: "presented_identifier", source: "request" };
  assert.equal(axes(record).provenance_ambiguity, false);
  assert.equal(axes(record).per_target_grouping, false);
  delete record.captured_origins[0]["actor.type"];
  assert.deepEqual(originIssues(eventView(record)), ["actor.type: missing/invalid content origin"]);
});

test("RA-C9 blocks anonymous+principal only: an authoritative typed fabricated principal is accepted-shaped", () => {
  const record = withTarget({ id: "RA-X2", path: "authenticated_principal.id" });
  record.events[0].actor.type = "authenticated_human";
  record.events[0].actor.provenance.trust_level = "authoritative_server";
  assert.equal(axes(record).provenance_ambiguity, true);
  assert.equal(axes(record).meaning_misuse, true);
  assert.equal(axes(record).resource_rule, "circumvents");
});

test("unmapped present fields surface as missing local field policy and never trip the axes guards", () => {
  const record = withTarget({ id: "AF-C1", path: "actor.id" });
  put(record.events[0], "actor.unmapped_field", "unmapped-value");
  record.contents["actor.unmapped_field"] = { target: true, kind: "presented_identifier", source: "request" };
  record.captured_origins[0]["actor.unmapped_field"] = "CP";
  assert.deepEqual(originIssues(eventView(record)), ["actor.unmapped_field: missing local field policy"]);
  record.contents["actor.unmapped_field"].source = "lookup";
  const computed = axes(record);
  assert.equal(computed.ambiguous_fields.includes("actor.unmapped_field"), false);
  assert.deepEqual(computed.allowed_source_violations, []);
});
