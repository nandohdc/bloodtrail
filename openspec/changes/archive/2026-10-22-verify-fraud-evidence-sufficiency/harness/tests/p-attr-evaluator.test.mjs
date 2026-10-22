import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCases } from "../p-attr/evaluate.mjs";
import { independentObservations, put, capture, observation } from "./p-attr-analysis-fixtures.mjs";
import { tableExpectations } from "./p-attr-source-table.mjs";

function fixture() {
  return { records: independentObservations(), expectations: tableExpectations() };
}
function recordFor(context, id) {
  return context.records.find((record) => record.step_id === `${id}/main`);
}
function mismatch(context, fragment) {
  const failures = evaluateCases(context).filter((result) => !result.matched);
  assert(failures.length > 0);
  assert(failures.flatMap((result) => result.mismatches).some((issue) => issue.includes(fragment)), fragment);
}
const MUTATIONS = [
  ["surface", (record) => { record.kind = "thrown"; }, "kind"],
  ["acceptance", (record) => { record.raw.value.status = "queued"; }, "accepted result"],
  ["sink count", (record) => { record.sink_count = 2; }, "sink_count"],
  ["frozen state", (record) => { record.frozen = [false]; }, "frozen"],
  ["origin", (record) => { record.captured_origins[0]["actor.id"] = "SR"; }, "computed axes"],
  ["flag", (record) => { record.events[0].actor.provenance.trust_level = "authoritative_server"; }, "computed axes"],
  ["rule", (record) => { record.family = "AS"; record.contents["actor.id"].kind = "performer"; }, "computed axes"],
  ["meaning", (record) => { record.contents["actor.id"].kind = "performer"; }, "computed axes"],
  ["missing origin", (record) => { delete record.captured_origins[0]["actor.id"]; }, "missing/invalid content origin"],
  ["missing origin map", (record) => { record.captured_origins = []; }, "exactly one origin map"],
];

test("source-derived accepted/refused table matches whole diagnostics and computed axes", () => {
  const results = evaluateCases(fixture());
  assert.equal(results.length, 13);
  assert(results.every((result) => result.matched), JSON.stringify(results));
});

for (const [label, mutate, fragment] of MUTATIONS) {
  test(`evaluator rejects altered ${label}`, () => {
    const context = fixture();
    mutate(recordFor(context, "AF-C1"));
    mismatch(context, fragment);
  });
}

for (const field of ["code", "category", "path"]) {
  test(`evaluator compares exact diagnostic ${field} and raw result`, () => {
    const context = fixture();
    const record = recordFor(context, "AF-C8");
    record.diagnostic = { ...record.diagnostic, [field]: "altered" };
    record.raw = { ok: false, error: record.diagnostic };
    mismatch(context, "diagnostic");
  });
}

for (const family of ["AF", "AS", "PR", "RA"]) {
  test(`independent negative mutation for ${family} group`, () => {
    const context = fixture();
    const record = context.records.find((item) => item.family === family);
    record.sink_count = 4;
    mismatch(context, "sink_count");
  });
}

test("refusal expected but accepted is an explained mismatch", () => {
  const context = fixture();
  const index = context.records.findIndex((record) => record.step_id === "AF-C8/main");
  context.records[index] = observation({ id: "AF-C8", event: capture("AF") });
  mismatch(context, "expected refusal but observed acceptance");
});

test("a planned step missing step_id is a readable mismatch, never a TypeError", () => {
  const context = fixture();
  delete context.expectations.cases.find((entry) => entry.case_id === "AF-C1").expected[0].step_id;
  const failures = evaluateCases(context).filter((result) => !result.matched);
  assert(failures.length > 0);
  assert(failures[0].mismatches.includes("AF-C1: planned step missing step_id"));
});

test("missing, duplicate, unknown observations and duplicate plan steps never pass silently", () => {
  const missing = fixture();
  missing.records.shift();
  mismatch(missing, "observed 0 records");
  const duplicate = fixture();
  duplicate.records.push(structuredClone(duplicate.records[0]));
  mismatch(duplicate, "observed 2 records");
  const unknown = fixture();
  unknown.records.push({ ...unknown.records[0], step_id: "AF-C1/unknown" });
  mismatch(unknown, "unknown step");
  const plan = fixture();
  plan.expectations.cases[0].expected.push(plan.expectations.cases[0].expected[0]);
  mismatch(plan, "duplicate planned steps");
});

test("thrown diagnostic triples are checked independently of the returned surface", () => {
  const context = fixture();
  const record = recordFor(context, "AF-C8");
  const planned = context.expectations.cases.find((entry) => entry.case_id === "AF-C8").expected[0];
  record.kind = "thrown";
  record.raw = { name: "SecurityAuditSdkError", message: "AUTHORITY_ESCALATION", ...record.diagnostic };
  planned.kind = "thrown";
  assert(evaluateCases(context).every((result) => result.matched));
  record.raw.path = "/altered";
  mismatch(context, "thrown path");
});

function pairedFixture() {
  const context = fixture();
  const ex = recordFor(context, "AF-C1");
  const nx = structuredClone(ex);
  nx.step_id = "AF-C1/nx";
  nx.events[0].actor.id = "pid-nx-0001";
  ex.existence_peer = nx.step_id;
  nx.existence_peer = ex.step_id;
  const entry = context.expectations.cases[0];
  entry.expected[0].axes.discloses_existence = false;
  const nxPlan = structuredClone(entry.expected[0]);
  nxPlan.step_id = nx.step_id;
  nxPlan.axes.targets[0].value = "pid-nx-0001";
  entry.expected.push(nxPlan);
  context.records.push(nx);
  return context;
}

test("disclosure and captured assertions are computed and compared, not copied from labels", () => {
  const context = pairedFixture();
  assert(evaluateCases(context).every((result) => result.matched));
  recordFor(context, "AF-C1").events[0].actor.type = "authenticated_human";
  mismatch(context, "discloses_existence");
  const captured = fixture();
  put(recordFor(captured, "RA-B"), "events.0.resource.operation_type", "execute");
  mismatch(captured, "events.0.resource.operation_type");
});

test("missing existence peer is an observation mismatch; counts differ only as notes", () => {
  const context = pairedFixture();
  recordFor(context, "AF-C1").existence_peer = "AF-C1/absent";
  mismatch(context, "missing/duplicate existence peer");
  const counts = fixture();
  counts.calls = [{ label: "AF-C1:claimedActor" }];
  const results = evaluateCases(counts);
  assert(results.every((result) => result.matched));
  assert.match(results[0].notes[0], /deviation is a note, not an invalidation/);
});
