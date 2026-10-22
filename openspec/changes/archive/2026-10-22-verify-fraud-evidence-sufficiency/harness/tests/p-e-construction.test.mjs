import assert from "node:assert/strict";
import test from "node:test";
import { constructionWorkload } from "../p-e/construction-workload.mjs";
import { CONSTRUCTION_CASES, PE_BASE, PE_COMMENT } from "../p-e/construction-cases.mjs";
import { observations } from "../p-e/runtime.mjs";
import { peState } from "./p-e-case-fixtures.mjs";

// Independent hand-written oracle, derived from the pinned sources, not from
// the workload: events.ts:190-225 (defaultOutcome/resolveCommitState at
// abcbefa), operations.ts:72-112,212-222, semantic.ts:227-238 (the second
// P-E-1e layer), sdk.ts:86-107,208-246 (#797's refusal for P-E-1f). Per-case
// public-call counts are counted from the same sources, call by call.
const ORACLE = [
  { id: "P-E-1a", calls: 13, sink: 1, steps: ["refusal", "mark", "followup"],
    refusal: ["PREMATURE_SUCCESS", "validation", "/operation/state"] },
  { id: "P-E-1b", calls: 9, sink: 0, steps: ["direct"],
    refusal: ["PREMATURE_SUCCESS", "validation", "/event/commit_state"] },
  { id: "P-E-1c", calls: 10, sink: 0, steps: ["direct-over-pending"],
    refusal: ["PREMATURE_SUCCESS", "validation", "/event/commit_state"] },
  { id: "P-E-1d", calls: 9, sink: 0, steps: ["neither"],
    refusal: ["PREMATURE_SUCCESS", "validation", "/operation/state"] },
  { id: "P-E-1e", calls: 10, sink: 0, steps: ["nontransactional"],
    refusal: ["PREMATURE_SUCCESS", "validation", "/event/commit_state"] },
  { id: "P-E-1f", calls: 9, sink: 0, steps: ["handleless-failure"],
    refusal: ["PREMATURE_SUCCESS", "validation", "/operation/state"] },
];

function recordsFor(state, caseId) {
  return state.records.filter((record) => record.step_id.startsWith(`${caseId}/`));
}

function firstRefusal(state, caseId) {
  return recordsFor(state, caseId).find((record) => record.accepted === false);
}

test("P-E construction family: every oracle row owns its steps with exact refusal shapes and counts", async () => {
  const state = peState({ budget: 100 });
  const rows = await constructionWorkload(state);
  assert.equal(rows.length, CONSTRUCTION_CASES.length);
  for (const oracle of ORACLE) {
    const records = recordsFor(state, oracle.id);
    assert.deepEqual(records.map((record) => record.step_id.split("/")[1]), oracle.steps, oracle.id);
    assert(records.every((record) => record.kind === "returned"), oracle.id);
    const refusal = records[0];
    assert.deepEqual([refusal.diagnostic.code, refusal.diagnostic.category, refusal.diagnostic.path], oracle.refusal, oracle.id);
    assert.equal(refusal.accepted, false, oracle.id);
    assert.equal(refusal.unexpected_acceptance, false, oracle.id);
    assert.equal(refusal.captures.length, 0, oracle.id);
    const summary = rows.find((row) => row.case_id === oracle.id);
    assert.equal(summary.public_calls, oracle.calls, oracle.id);
    assert.equal(summary.predicted_calls, oracle.calls, oracle.id);
    assert.deepEqual(summary.actual, summary.predicted, oracle.id);
    assert.equal(summary.actual.sink, oracle.sink, oracle.id);
  }
  assert.equal(state.ledger.report().occurrence_count, 60);
  assert.equal(state.ledger.report().exhausted, false);
  assert.doesNotThrow(() => structuredClone(observations(state)));
});

test("P-E-1a pending-handle refusal reserves nothing; the follow-up commit accepts with one frozen capture", async () => {
  const state = peState({ budget: 100 });
  const [entry] = CONSTRUCTION_CASES;
  await constructionWorkload(state, [entry]);
  const [refusal, mark, followup] = recordsFor(state, "P-E-1a");
  assert.deepEqual(refusal.raw, { ok: false,
    error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } });
  assert.equal(refusal.handle.state, "started");
  assert.deepEqual(refusal.counters, { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 });
  assert.equal(mark.accepted, true);
  assert.equal(mark.raw.value.state, "committed");
  assert.equal(mark.raw.value.commit_state, "committed");
  assert.equal(mark.handle.state, "committed");
  assert.equal(followup.accepted, true);
  assert.deepEqual(followup.raw, { ok: true, value: { status: "accepted" } });
  assert.equal(followup.captures.length, 1);
  assert.equal(followup.captures[0].frozen, true);
  assert.deepEqual(followup.occurrence, {
    event_name: "bloodtrail.audit.authentication.mfa.removed",
    outcome: "success", lifecycle_phase: "completed", commit_state: "committed",
    delivery_class: "transaction_critical", operation_type: "delete", retry_attempt: 0,
    transaction_id_matches_handle: true, operation_id_matches_handle: true, correlation_id_matches_handle: true,
  });
  assert.deepEqual(followup.counters, { probe: 0, gate: 0, exchange: 0, sink: 1, business_commits: 0 });
});

async function singleRefusal(caseId) {
  const state = peState({ budget: 100 });
  const [entry] = CONSTRUCTION_CASES.filter((row) => row.case_id === caseId);
  await constructionWorkload(state, [entry]);
  return firstRefusal(state, caseId);
}

test("P-E-1c direct commit_state check precedes the pending-handle check", async () => {
  const record = await singleRefusal("P-E-1c");
  assert.deepEqual(record.diagnostic, { code: "PREMATURE_SUCCESS", category: "validation", path: "/event/commit_state" });
  assert.equal(record.handle.state, "started");
  assert.equal(record.captures.length, 0);
});

test("P-E-1e non-transactional started handle is refused by the standalone semantic validator", async () => {
  const record = await singleRefusal("P-E-1e");
  assert.deepEqual(record.diagnostic, { code: "PREMATURE_SUCCESS", category: "validation", path: "/event/commit_state" });
  assert.equal(record.handle.state, "started");
  assert.equal(record.handle.transactional, false);
  assert.equal(record.captures.length, 0);
});

test("P-E-1f handle-less failure is refused under #797: no occurrence, sink, probe, gate or exchange", async () => {
  const record = await singleRefusal("P-E-1f");
  assert.deepEqual(record.diagnostic, { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" });
  assert.deepEqual(record.counters, { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 });
});

test("P-E construction descriptors are source-cited, complete and correction-aware", () => {
  assert.equal(PE_BASE, "abcbefa03d5b0afc610deb712d7f4ded5a9e82be");
  assert.equal(PE_COMMENT, "6137619745");
  assert.deepEqual(CONSTRUCTION_CASES.map((row) => row.case_id),
    ["P-E-1a", "P-E-1b", "P-E-1c", "P-E-1d", "P-E-1e", "P-E-1f"]);
  for (const entry of CONSTRUCTION_CASES) {
    for (const field of ["case_id", "family", "scenario", "comment_id", "setup", "expected",
      "classification", "basis", "confidence", "predicted_calls", "predicted"]) {
      assert.notEqual(entry[field], undefined, `${entry.case_id} ${field}`);
    }
    assert(entry.basis.length > 0 && entry.basis.every((cite) => cite.includes(":") || cite.endsWith(".json")), entry.case_id);
    assert.equal(entry.family, "construction");
  }
  const corrected = CONSTRUCTION_CASES.filter((row) => row.corrected_from !== undefined);
  assert.deepEqual(corrected.map((row) => row.case_id), ["P-E-1f"]);
  assert.match(corrected[0].corrected_from.reason, /#797/);
  assert.match(corrected[0].basis.join(" "), /events\.ts:205-225/);
});
