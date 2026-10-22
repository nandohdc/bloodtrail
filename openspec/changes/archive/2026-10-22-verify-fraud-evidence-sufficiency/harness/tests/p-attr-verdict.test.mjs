import assert from "node:assert/strict";
import test from "node:test";
import { evaluateVerdict, criterionCandidate, criterionStatus } from "../p-attr/verdict.mjs";
import { analyzeLinkage } from "../p-attr/linkage-analysis.mjs";
import { afWorkload, asWorkload, requestWorkload } from "../p-attr/carrier-workload.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { linkageFixture, linkedRecord } from "./p-attr-request-fixtures.mjs";

const state = await linkageFixture();
const keying = memoryKeying();
await afWorkload({ state, keying });
await asWorkload({ state, keying });
for (const family of ["PR", "RA"]) await requestWorkload({ family, state, keying });
const observed = evaluateVerdict({ records: state.records });

test("observed complete fixtures yield no honest unresolved AF carrier; never a production claim", () => {
  assert.equal(observed.criterion_1.status, "failed");
  assert.equal(observed.criterion_1.gap_owner, "Bloodtrail contract");
  assert.deepEqual(observed.criterion_1.qualifying, []);
  assert.equal(observed.criterion_1.candidates.length, 25);
  assert.deepEqual(observed.criterion_1.issues, []);
});
test("AF-X4 links but stays misused/disclosing; X1/X2/X3 findings are observations-derived", () => {
  const findings = observed.findings.accepted_misrepresenting_carriers;
  for (const id of ["AF-X1/ex", "AF-X2/ex", "AF-X3/nx", "AF-X4/ex"]) {
    assert(findings.some((finding) => finding.step_id === id));
  }
  const candidate = observed.criterion_1.candidates.find((row) => row.carrier === "AF-X4/main");
  assert.equal(candidate.qualifies, false);
  assert.equal(candidate.nx_coverage.fraction, 0);
});
test("anonymous-only principal enforcement and contract/SDK tenant findings do not become mismatches", () => {
  assert(observed.findings.anonymous_only_principal_enforcement.every((finding) => finding.observed_anonymous_only_contrast));
  assert.equal(observed.findings.conflicting_tenant.observed_steps.length, 7);
  assert.deepEqual(observed.diagnostic_mismatches, []);
  const evaluations = [{ case_id: "RA-C9", matched: false, mismatches: ["diagnostic path"], notes: [] }];
  const result = evaluateVerdict({ records: state.records, evaluations });
  assert.deepEqual(result.diagnostic_mismatches, evaluations);
  assert.deepEqual(result.findings.conflicting_tenant, observed.findings.conflicting_tenant);
});
// Independent definition fixture from #795 criterion 1 and #802 definitions.
// It is a logical positive control, NOT a claim such a contract field exists.
function hypothetical() {
  return { from: "logical-positive-control", ex: { accepted: 15, target_coverage: { fraction: 1 } },
    nx: { accepted: 15, target_coverage: { fraction: 1 } },
    axes: Array.from({ length: 30 }, () => ({ provenance_ambiguity: false, meaning_misuse: false,
      resource_rule: "conforms", discloses_existence: false, per_target_grouping: true })) };
}
const REQUIREMENTS = [
  ["acceptance", (row) => { row.ex.accepted = 14; }],
  ["nx acceptance", (row) => { row.nx.accepted = 14; }],
  ["target-bearing", (row) => { row.ex.target_coverage.fraction = 0; }],
  ["nx coverage", (row) => { row.nx.target_coverage.fraction = 0; }],
  ["ambiguity", (row) => { row.axes[0].provenance_ambiguity = true; }],
  ["misuse", (row) => { row.axes[0].meaning_misuse = true; }],
  ["conformance", (row) => { row.axes[0].resource_rule = "circumvents"; }],
  ["disclosure", (row) => { row.axes[0].discloses_existence = true; }],
  ["complete denominator", (row) => { row.axes.pop(); }],
  ["missing axes", (row) => { row.axes[0] = null; }],
];
for (const [label, mutate] of REQUIREMENTS) {
  test(`criterion 1 independently requires ${label}`, () => {
    const row = hypothetical();
    assert.equal(criterionCandidate(row).qualifies, true);
    mutate(row);
    assert.equal(criterionCandidate(row).qualifies, false);
  });
}
test("missing captures and origin policies: a row is inconclusive by itself, never the verdict", () => {
  // Q4: one incomplete row must not void criterion 1. Every incomplete row in
  // these fixtures already fails a data-independent predicate (AF-C1 is
  // ambiguous), so the verdict stays "no honest carrier" instead of flipping
  // to inconclusive over missing evidence.
  const records = structuredClone(state.records);
  delete linkedRecord(records, "L1/AF-C1/main/ex-0001-1").captured_origins[0]["actor.id"];
  const verdict = evaluateVerdict({ records });
  assert.equal(verdict.criterion_1.status, "failed");
  const candidate = verdict.criterion_1.candidates.find((row) => row.carrier === "AF-C1/main");
  assert.equal(candidate.conclusive, false);
  assert.equal(candidate.could_turn_honest, false);
  assert(candidate.reasons.length > 0);
  linkedRecord(records, "L1/AF-C1/main/ex-0001-1").events = [];
  assert.equal(evaluateVerdict({ records }).criterion_1.status, "failed");
});
test("an incomplete row that could still turn honest keeps the verdict open", () => {
  // Q4 positive control: a hypothetical honest carrier with unexpectedly
  // refused nx emissions has honest present axes, so criterion 1 is
  // inconclusive rather than a false "no honest carrier".
  const row = { from: "honest-control", issues: [],
    ex: { accepted: 15, target_coverage: { fraction: 1 } },
    nx: { accepted: 0, target_coverage: { fraction: 0 } },
    axes: Array.from({ length: 15 }, () => ({ provenance_ambiguity: false, meaning_misuse: false,
      resource_rule: "conforms", discloses_existence: false, per_target_grouping: true,
      allowed_source_violations: [] })) };
  const candidate = criterionCandidate(row);
  assert.equal(candidate.qualifies, false);
  assert.equal(candidate.could_turn_honest, true);
  assert.deepEqual(criterionStatus([candidate]), { status: "inconclusive", qualifying: [] });
  assert.equal(criterionStatus([candidate, { ...candidate, from: "failing", qualifies: false,
    could_turn_honest: false }]).status, "inconclusive");
  assert.equal(criterionStatus([{ ...candidate, from: "failing", could_turn_honest: false }]).status, "failed");
});
test("an incomplete targetless L1 row can never turn honest or flip the verdict", () => {
  // Q4/F6: present accepted occurrences on a targetless row carry zero targets,
  // so per_target_grouping is false (or "n/a" for refused captures). Honesty
  // requires a present per-target grouping; without it every present axis is an
  // independent failure and one incomplete emission stays a failed verdict.
  const targetlessAxis = (per_target_grouping) => ({ provenance_ambiguity: false, meaning_misuse: false,
    resource_rule: "conforms", discloses_existence: false, per_target_grouping,
    allowed_source_violations: [] });
  for (const per_target_grouping of [false, "n/a"]) {
    const row = { from: "AF-B/main", issues: [],
      ex: { accepted: 14, target_coverage: { fraction: 0 } },
      nx: { accepted: 14, target_coverage: { fraction: 0 } },
      axes: Array.from({ length: 28 }, () => targetlessAxis(per_target_grouping)) };
    const candidate = criterionCandidate(row);
    assert.equal(candidate.conclusive, false);
    assert.equal(candidate.qualifies, false);
    assert.equal(candidate.could_turn_honest, false);
    assert(candidate.reasons.length > 0);
    assert.equal(criterionStatus([candidate]).status, "failed");
  }
});
test("nx carrier omission changes coverage, never creates nx-to-success linkage", () => {
  const records = structuredClone(state.records.filter((record) => record.linkage !== undefined));
  for (const record of records.filter((item) => item.step_id.startsWith("L1/AF-C6s/main/nx-"))) delete record.events[0].credential.reference;
  const row = analyzeLinkage({ records }).L1.find((item) => item.from === "AF-C6s/main");
  assert.equal(row.nx.target_coverage.numerator, 0);
  assert.equal(row.nx.linkage.numerator, 0);
});
test("accepted fabricated principal contrast disappears when the actual acceptances disappear", () => {
  const records = state.records.filter((record) => !record.accepted);
  const findings = evaluateVerdict({ records }).findings;
  assert(findings.anonymous_only_principal_enforcement.every((finding) => !finding.observed_anonymous_only_contrast));
  assert.deepEqual(findings.accepted_misrepresenting_carriers, []);
});
