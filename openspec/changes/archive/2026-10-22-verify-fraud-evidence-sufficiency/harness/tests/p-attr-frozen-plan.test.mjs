import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateCases, evaluateProbe } from "../p-attr/evaluate.mjs";
import { evaluateWithGuard } from "../lib/probe-runner.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { analyzeLinkage } from "../p-attr/linkage-analysis.mjs";
import { evaluateVerdict, criterionStatus } from "../p-attr/verdict.mjs";
import { compareLinkageExpectations } from "../p-attr/linkage-expectations.mjs";
import { independentObservations } from "./p-attr-analysis-fixtures.mjs";
import { linkageFixture, linkedRecord } from "./p-attr-request-fixtures.mjs";

const EXPECTATIONS = JSON.parse(readFileSync(new URL("../expectations/p-attr.v1.json", import.meta.url), "utf8"));
const CASE = (id) => EXPECTATIONS.cases.find((entry) => entry.case_id === id);

// ---- Q1: keyed targets compare structure and the matches boolean, never the digest ----
function afC3Pair() {
  const ex = independentObservations().find((record) => record.step_id === "AF-C3/main");
  const nx = structuredClone(ex);
  ex.step_id = "AF-C3/ex";
  nx.step_id = "AF-C3/nx";
  ex.existence_peer = nx.step_id;
  nx.existence_peer = ex.step_id;
  return [ex, nx];
}

test("Q1: per-run random keys change digests but never the evaluation", () => {
  const first = afC3Pair();
  const second = afC3Pair();
  assert.notEqual(first[0].events[0].actor.display_name, second[0].events[0].actor.display_name,
    "fresh random keys must produce different digests");
  const plans = { cases: [CASE("AF-C3")] };
  const one = evaluateCases({ records: first, expectations: plans });
  const two = evaluateCases({ records: second, expectations: plans });
  assert(one.every((result) => result.matched), JSON.stringify(one));
  assert(two.every((result) => result.matched));
  assert.deepEqual(one.map((result) => result.mismatches), two.map((result) => result.mismatches));
});

test("Q1: altered key scope, input origin, format or matches boolean is a mismatch; an altered digest is not", () => {
  const plans = { cases: [CASE("AF-C3")] };
  const mutations = [
    [(check) => { check.key_scope.purpose = "authentication_failed"; }, "key scope"],
    [(check) => { check.input_origin = "SR"; }, "input origin"],
    [(check) => { check.digest_format = "sha256-raw"; }, "digest format"],
    [(check) => { check.matches_declared_input = false; }, "matches declared input"],
  ];
  for (const [mutate, fragment] of mutations) {
    const records = afC3Pair();
    mutate(records[0].keyed_checks[0]);
    const failures = evaluateCases({ records, expectations: plans }).filter((result) => !result.matched);
    assert(failures.length > 0, fragment);
    assert(failures[0].mismatches.some((issue) => issue.includes(fragment)), fragment);
  }
  const digestChanged = afC3Pair();
  digestChanged[0].events[0].actor.display_name = "f".repeat(64);
  assert(evaluateCases({ records: digestChanged, expectations: plans }).every((result) => result.matched),
    "the digest itself is an observation and never compared against the freeze");
});

test("Q1: hook-keyed C2 mirrors declare the SDK-supplied purpose and the platform-login fallback", () => {
  const c2 = CASE("AF-C2").expected.find((step) => step.step_id === "AF-C2/ex");
  const target = c2.axes.targets.find((item) => item.path === "actor.id");
  assert.deepEqual(target.keyed.key_scope, { purpose: "authentication_failed", tenant: "platform-login" });
  assert.equal(target.keyed.input_origin, "CP");
  const session = CASE("AS-B").expected[0].axes.targets.find((item) => item.path === "session.id");
  assert.deepEqual(session.keyed.key_scope, { purpose: "fraud-evidence", tenant: null });
  assert.equal(session.keyed.input_origin, "SR");
});

// ---- Q2: the evaluator is total and the runner guards evaluation faults ----
test("Q2: malformed planned steps become mismatch notes, never throws", () => {
  const entry = structuredClone(CASE("AF-B"));
  entry.expected = entry.expected.map((step) => ({ ...step, step_id: "AF-B/main" }));
  delete entry.expected[0].assertions;
  const results = evaluateCases({ records: independentObservations().filter((record) => record.step_id === "AF-B/main"),
    expectations: { cases: [entry] } });
  assert.equal(results[0].matched, false);
  assert(!results[0].mismatches.some((issue) => issue.includes("TypeError")), "no throw escapes as a TypeError");
  const malformed = evaluateCases({ records: [], expectations: { cases: [{ case_id: "AF-B", predicted_calls: 0 }] } });
  assert.equal(malformed[0].matched, false);
  assert(malformed[0].mismatches.some((issue) => issue.includes("malformed planned case")));
});

test("Q2: an evaluation fault becomes an invalidation and keeps the plan contract", () => {
  const context = { expectations: EXPECTATIONS, invalidations: ["prior"] };
  const plan = { evaluate: () => { throw new Error("fixture evaluation burst"); } };
  const result = evaluateWithGuard({ plan, context, observations: [{ records: [{ step_id: "raw-observation" }] }] });
  assert.deepEqual(result.cases, { evaluations: [], verdict: null });
  assert.equal(result.invalidations.length, 2);
  assert.match(result.invalidations[1].message, /evaluation fault: fixture evaluation burst/);
  assert.equal(result.invalidations[1].attribution, "harness_fault");
  const good = evaluateWithGuard({ plan: { evaluate: () => ({ evaluations: [], verdict: { criterion_1: {} } }) },
    context: { expectations: EXPECTATIONS, invalidations: ["prior"] }, observations: [] });
  assert.deepEqual(good.invalidations, ["prior"]);
});

// ---- Q3: linkage records route by their declared inventory ----
test("Q3: linkage records never become unknown matrix steps and frozen per-row aggregates match", async () => {
  const state = await linkageFixture();
  const observations = [{ records: state.records, public_calls: state.calls }];
  const evaluated = evaluateProbe({ observations, expectations: EXPECTATIONS });
  assert(!evaluated.evaluations.some((result) => result.case_id.startsWith("L1/")
    || result.case_id.startsWith("L2/") || result.case_id.startsWith("L3/")),
  "linkage records must route to the linkage evaluation");
  assert(!evaluated.evaluations.some((result) => result.mismatches.some((issue) => issue.includes("unknown step"))));
  const comparison = evaluated.verdict.linkage_expectations;
  assert.equal(comparison.issues.length, 0);
  assert.equal(comparison.rows.length, 38);
  assert(comparison.rows.every((row) => row.matched));
  assert.equal(evaluated.verdict.criterion_1.status, "failed");
  assert.equal(evaluated.verdict.criterion_1.gap_owner, "Bloodtrail contract");
});

// ---- Q4: one refused nx dataset does not void the verdict when the carrier already fails ----
test("Q4: unexpectedly refused nx emissions keep the verdict when ambiguity or misuse already fails the row", async () => {
  const state = await linkageFixture();
  for (const record of state.records.filter((item) => item.step_id.startsWith("L1/AF-C1/main/nx-"))) {
    record.accepted = false;
    record.raw = { ok: false, error: { code: "FIXTURE_REFUSED", category: "validation", path: "/fixture" } };
    record.sink_count = 0;
    record.frozen = [];
    record.events = [];
    record.captured_origins = [];
  }
  const verdict = evaluateVerdict({ records: state.records });
  const candidate = verdict.criterion_1.candidates.find((row) => row.carrier === "AF-C1/main");
  assert.equal(candidate.conclusive, false);
  assert.equal(candidate.could_turn_honest, false);
  assert.equal(verdict.criterion_1.status, "failed");
});

test("Q4: honest axes with refused nx would keep the verdict open, not fail it", () => {
  const row = { from: "honest-hypothesis", issues: [],
    ex: { accepted: 15, target_coverage: { fraction: 1 } }, nx: { accepted: 0, target_coverage: { fraction: 0 } },
    axes: Array.from({ length: 15 }, () => ({ provenance_ambiguity: false, meaning_misuse: false,
      resource_rule: "conforms", discloses_existence: false, per_target_grouping: true,
      allowed_source_violations: [] })) };
  assert.deepEqual(criterionStatus([{ carrier: "honest-hypothesis", conclusive: false, qualifies: false,
    could_turn_honest: true, reasons: [] }]), { status: "inconclusive", qualifying: [] });
});

test("Q5/Q10: the declared linkage inventory, mirrors and slots include the keyed C2 mirror exactly once", async () => {
  const state = await linkageFixture();
  const linked = state.records.filter((record) => record.linkage !== undefined);
  const slots = linked.length;
  assert.equal(slots, EXPECTATIONS.linkage_inventory.declared_slot_count);
  assert.equal(slots, 801);
  const mirrors = EXPECTATIONS.linkage_expectations.L2;
  assert.equal(mirrors.filter((row) => row.to === "AS-C2/keyed-mirror").length, 1);
  assert.equal(mirrors.filter((row) => row.to === "AS-C2/main").length, 1);
  const analyzed = analyzeLinkage({ records: linked });
  assert.deepEqual(analyzed.issues, []);
  const mirrorRecords = linked.filter((record) => record.linkage.dataset_id === "AS-C2/keyed-mirror");
  assert.equal(mirrorRecords.length, 3);
  assert(mirrorRecords.every((record) => record.accepted && record.keyed_checks.some((check) =>
    check.path === "actor.id" && check.key_scope.purpose === "authentication_succeeded" && check.matches_declared_input)));
});

test("frozen linkage rows compare groupable, declared pair and honesty, not just counts", async () => {
  const state = await linkageFixture();
  const evaluated = evaluateProbe({ observations: [{ records: state.records, public_calls: state.calls }], expectations: EXPECTATIONS });
  const comparison = evaluated.verdict.linkage_expectations;
  assert.equal(comparison.issues.length, 0);
  assert.equal(comparison.rows.length, 38);
  assert(comparison.rows.every((row) => row.matched));
  const groupableMutation = structuredClone(evaluated.verdict.linkage);
  groupableMutation.L1.find((row) => row.from === "AF-C1/main").ex.groups[0].groupable = false;
  const groupableIssues = compareLinkageExpectations({ linkage: groupableMutation, expectations: EXPECTATIONS.linkage_expectations }).issues;
  assert(groupableIssues.some((issue) => issue.includes("groupable")), JSON.stringify(groupableIssues));
  const pairMutation = structuredClone(evaluated.verdict.linkage);
  pairMutation.L1.find((row) => row.from === "AF-C5/main").declared_pair =
    [{ from_family: "AF", from: "actor.id", to_family: "AS", to: "authenticated_principal.id" }];
  const pairIssues = compareLinkageExpectations({ linkage: pairMutation, expectations: EXPECTATIONS.linkage_expectations }).issues;
  assert(pairIssues.some((issue) => issue.includes("declared pair")), JSON.stringify(pairIssues));
  const nullPairMutation = structuredClone(evaluated.verdict.linkage);
  nullPairMutation.L1.find((row) => row.from === "AF-C1/main").declared_pair =
    [{ from_family: "AF", from: "subject.id", to_family: "AS", to: "authenticated_principal.id" }];
  const nullPairIssues = compareLinkageExpectations({ linkage: nullPairMutation, expectations: EXPECTATIONS.linkage_expectations }).issues;
  assert(nullPairIssues.some((issue) => issue.includes("no declared join pair planned")), JSON.stringify(nullPairIssues));
  const honestyMutation = structuredClone(evaluated.verdict.linkage);
  honestyMutation.L1.find((row) => row.from === "AF-C5/main").honesty.honest = true;
  const honestyIssues = compareLinkageExpectations({ linkage: honestyMutation, expectations: EXPECTATIONS.linkage_expectations }).issues;
  assert(honestyIssues.some((issue) => issue.includes("honesty")), JSON.stringify(honestyIssues));
});

test("fresh per-run keys never serialize: records retain only key id, purposes and matches booleans", async () => {
  const state = await linkageFixture();
  const serialized = JSON.stringify({ records: state.records, keying: memoryKeying().metadata });
  assert.match(serialized, /k-run-01/);
  assert(!serialized.includes("key_bytes"));
  assert(!serialized.includes("randomBytes"));
  for (const record of state.records.filter((item) => item.keyed_checks?.length > 0).slice(0, 20)) {
    for (const check of record.keyed_checks) {
      assert.equal(typeof check.matches_declared_input, "boolean");
      assert(Object.hasOwn(check, "key_scope") && Object.hasOwn(check, "input_origin") && Object.hasOwn(check, "digest_format"));
      assert(!Object.hasOwn(check, "digest"));
    }
  }
  assert(linkedRecord(state.records, "L1/AF-C2/main/ex-0001-1").keyed_checks[0].matches_declared_input);
});
