import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCases } from "../p-attr/evaluate.mjs";
import { computeAxes } from "../p-attr/axes.mjs";
import { eventView } from "../p-attr/observations.mjs";
import { capture, independentObservations, observation, put } from "./p-attr-analysis-fixtures.mjs";
import { tableExpectations } from "./p-attr-source-table.mjs";

function fixture() {
  return { records: independentObservations(), expectations: tableExpectations() };
}
function entryFor(context, id) {
  return context.expectations.cases.find((entry) => entry.case_id === id);
}
function resultFor(context, id) {
  return evaluateCases(context).find((result) => result.case_id === id);
}

// Verifier reproduction: a duplicate across cases must not let 12 unique
// observations satisfy the original 13-case plan.
test("global planned-step duplicates invalidate every owning case", () => {
  const context = fixture();
  entryFor(context, "AF-C3").expected = structuredClone(entryFor(context, "AF-C1").expected);
  context.records = context.records.filter((record) => record.step_id !== "AF-C3/main");
  for (const id of ["AF-C1", "AF-C3"]) {
    const result = resultFor(context, id);
    assert.equal(result.matched, false);
    assert(result.mismatches.some((issue) => issue.includes("duplicate planned steps")));
  }
});

test("a globally unique planned step still must belong to its case", () => {
  const context = fixture();
  entryFor(context, "AF-C1").case_id = "AF-C7";
  const result = resultFor(context, "AF-C7");
  assert.equal(result.matched, false);
  assert(result.mismatches.some((issue) => issue.includes("does not belong to case AF-C7")));
});

test("observation family must agree with the case owning the step", () => {
  const context = fixture();
  // Display-name classification is otherwise identical for AF and PR.
  context.records.find((record) => record.step_id === "AF-C3/main").family = "PR";
  const result = resultFor(context, "AF-C3");
  assert.equal(result.matched, false);
  assert(result.mismatches.some((issue) => issue.includes("case family")));
});

// Independent source-derived AF-C7 oracle, not generated from expectations or
// computeAxes: field-policy.json:293-301 makes the tenant a client claim;
// catalog.json:201-202 governs resource/target content, not a tenant claim.
// #802 comment 6137582157 explicitly classifies this tenant-only case n/a.
const TENANT_AXES = {
  provenance_ambiguity: false, ambiguous_fields: [], in_occurrence_flag: false,
  allowed_source_violations: [], resource_rule: "n/a", meaning_misuse: false,
  discloses_existence: "n/a", per_target_grouping: false, targets: [],
};
function tenantObservation() {
  const event = capture("AF");
  event.tenant.claimed_tenant_id = "tnt-b02";
  return observation({ id: "AF-C7", event, origins: { "tenant.claimed_tenant_id": "CP" },
    contents: { "tenant.claimed_tenant_id": { kind: "claimed_tenant", source: "request" } } });
}
function analyze(record) {
  return computeAxes({ accepted: record.accepted, family: record.family, ...eventView(record) });
}

test("accepted tenant-only AF-C7 has all independently derived axes, including n/a resource rule", () => {
  const record = tenantObservation();
  assert.deepEqual(analyze(record), TENANT_AXES);
  const expected = { step_id: "AF-C7/main", kind: "returned", accepted: true,
    diagnostic: undefined, sink_count: 1, frozen: [true], axes: TENANT_AXES, assertions: {} };
  const context = { records: [record], expectations: { cases: [
    { case_id: "AF-C7", predicted_calls: 0, expected: [expected] },
  ] } };
  assert.equal(resultFor(context, "AF-C7").matched, true);
  expected.axes = { ...TENANT_AXES, resource_rule: "conforms" };
  assert.equal(resultFor(context, "AF-C7").matched, false);
});

test("tenant nonapplicability uses present content, not a case id or expected label", () => {
  const record = tenantObservation();
  record.step_id = "AF-tenant-control/main";
  assert.equal(analyze(record).resource_rule, "n/a");
  delete record.events[0].tenant.claimed_tenant_id;
  assert.equal(analyze(record).resource_rule, "conforms");
});

test("target content takes precedence over tenant-only nonapplicability", () => {
  const record = tenantObservation();
  put(record.events[0], "actor.id", "pid-ex-0001");
  record.captured_origins[0]["actor.id"] = "CP";
  record.contents["actor.id"] = { kind: "presented_identifier", source: "request" };
  assert.equal(analyze(record).resource_rule, "circumvents");
  put(record.events[0], "subject.id", "acct-0001");
  record.captured_origins[0]["subject.id"] = "SR";
  record.contents["subject.id"] = { kind: "resolved_account", source: "safe_resolution" };
  assert.equal(analyze(record).resource_rule, "violates");
});

for (const family of ["AF", "AS", "PR", "RA"]) {
  test(`${family} honest targetless baseline still conforms`, () => {
    const record = observation({ id: `${family}-B`, event: capture(family) });
    assert.equal(analyze(record).resource_rule, "conforms");
  });
}
