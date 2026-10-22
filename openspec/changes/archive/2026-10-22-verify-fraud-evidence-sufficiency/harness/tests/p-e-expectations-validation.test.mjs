import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateExpectations } from "../p-e/expectations-validate.mjs";
import { resultIssues, validateResult } from "../p-e/result-shapes.mjs";
import { eq, format } from "./p-e-evaluator-oracle.mjs";
import { preflightFixture } from "./approval-fixture.mjs";
import { runApprovedSession } from "../lib/orchestrate.mjs";

// Known-good base for the mutation tests: the frozen 32-case plan passes the
// strict validator (including the G5 code cross-check), so any rejection
// below comes from the mutation itself, never from the base.
const PLAN = JSON.parse(readFileSync(new URL("../expectations/p-e.v1.json", import.meta.url), "utf8"));

const BAD_HEADERS = [
  { name: "null", mutate: () => null },
  { name: "probe", mutate: (plan) => { plan.probe = "P-D"; } },
  { name: "version", mutate: (plan) => { plan.version = 2; } },
  { name: "base", mutate: (plan) => { plan.corrected_at = "5d931ad"; } },
  { name: "source comment", mutate: (plan) => { plan.drafted_from.comment = "other"; } },
  { name: "k", mutate: (plan) => { plan.redelivery_k = 2; } },
  { name: "definitions", mutate: (plan) => { plan.definitions = null; } },
  { name: "decisions", mutate: (plan) => { plan.decisions = []; } },
  { name: "database", mutate: (plan) => { plan.database_handling.location = "/tmp"; } },
  { name: "network grant", mutate: (plan) => { plan.database_handling.permission_flags.push("--allow-net"); } },
  { name: "allowance cap", mutate: (plan) => { plan.planned_occurrence_budget.total = 5001; } },
  { name: "duplicate cases", mutate: (plan) => { plan.cases.push(structuredClone(plan.cases[0])); } },
];
const BAD_ROWS = [
  { name: "null", mutate: () => null },
  { name: "identity", mutate: (row) => { row.case_id = "other"; } },
  { name: "family", mutate: (row) => { row.family = "other"; } },
  { name: "setup", mutate: (row) => { row.setup = ""; } },
  { name: "basis", mutate: (row) => { row.basis = ["uncited"]; } },
  { name: "classification", mutate: (row) => { row.classification = null; } },
  { name: "confidence", mutate: (row) => { row.confidence = false; } },
  { name: "prediction", mutate: (row) => { row.predicted_calls = -1; } },
  { name: "missing steps", mutate: (row) => { row.expected = []; } },
  { name: "null step", mutate: (row) => { row.expected = [null]; } },
  { name: "ownership", mutate: (row) => { row.expected[0].step_id = "P-E-2/other"; } },
  { name: "duplicate steps", mutate: (row) => { row.expected.push(structuredClone(row.expected[0])); } },
  { name: "result", mutate: (row) => { row.expected[0].result = { variant: "other" }; } },
  { name: "diagnostic", mutate: (row) => { delete row.expected[0].result.diagnostic.path; } },
  { name: "counter", mutate: (row) => { row.expected[0].counters.probe = -1; } },
  { name: "counter field", mutate: (row) => { delete row.expected[0].counters.sink; } },
  { name: "assertion", mutate: (row) => { row.expected[0].assertions = [null]; } },
  { name: "unknown op", mutate: (row) => { row.expected[0].assertions = [{ path: "raw", op: "other" }]; } },
  { name: "unsafe path", mutate: (row) => { row.expected[0].assertions = [eq("__proto__.raw", 1)]; } },
  { name: "literal identity", mutate: (row) => { row.expected[0].assertions = [eq("raw.event_id", "pe-random")]; } },
  { name: "literal digest", mutate: (row) => { row.expected[0].assertions = [eq("raw", { digest: "a".repeat(64) })]; } },
  { name: "unknown format", mutate: (row) => { row.expected[0].assertions = [format("raw.event_id", "other")]; } },
  { name: "absent peer", mutate: (row) => { row.expected[0].assertions = [{ path: "raw.id", op: "same", peer: { step_id: "P-E-99/absent", path: "raw.id" } }]; } },
  { name: "callback metadata", mutate: (row) => { row.expected[0].callback_order = [null]; } },
  { name: "exchange metadata", mutate: (row) => { row.expected[0].exchange = { count: 1 }; } },
  { name: "aggregate ownership", mutate: (row) => { row.aggregates = [{ aggregate_id: "P-E-2/stolen", source: "guarantees", step_id: "P-E-2/stolen", assertions: [] }]; } },
  { name: "summary", mutate: (row) => { row.summary = null; } },
  { name: "correction", mutate: (row) => { row.corrected_from = { old_text: "old", reason: "" }; } },
];
const VARIANTS = [
  { variant: "accepted" }, { variant: "sdk_value" }, { variant: "observation" }, { variant: "thrown" },
  { variant: "sdk_refusal", diagnostic: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } },
  { variant: "committed_and_durable" }, { variant: "already_delivered" },
  { variant: "refused", code: "transaction_id_required" },
  { variant: "failed_closed", code: "audit_durability_unreachable", commitGateInvoked: false, durabilityAttempted: false },
];

for (const mutation of BAD_HEADERS) {
  test(`strict header validation rejects ${mutation.name}`, () => {
    const plan = structuredClone(PLAN);
    const changed = mutation.mutate(plan);
    assert.throws(() => validateExpectations(changed === null ? changed : plan), /malformed P-E expectations:/);
  });
}
for (const mutation of BAD_ROWS) {
  test(`strict row validation rejects ${mutation.name}`, () => {
    const plan = structuredClone(PLAN);
    const changed = mutation.mutate(plan.cases[0]);
    if (changed === null) plan.cases[0] = null;
    assert.throws(() => validateExpectations(plan), /malformed P-E expectations:/);
  });
}

// G5: one mutation per budget cross-check assertion. The cross-checks run
// before the self-consistency checks, so each drift is refused by its own
// new assertion and the exact message pins which check fired.
const BUDGET_DRIFTS = [
  { name: "process allowance", mutate: (plan) => { plan.planned_occurrence_budget.processes.sequential += 1; },
    message: /malformed P-E expectations: planned_occurrence_budget disagrees with p-e\/budget\.mjs/ },
  { name: "predicted total", mutate: (plan) => { plan.predicted_total += 1; },
    message: /malformed P-E expectations: predicted_total disagrees with p-e\/budget\.mjs/ },
  { name: "case prediction", mutate: (plan) => { plan.cases[0].predicted_calls += 1; },
    message: /malformed P-E expectations: P-E-1a: predicted_calls disagrees with its code descriptor/ },
  { name: "truncated self-consistent plan", mutate: (plan) => {
    plan.cases = [plan.cases[0]];
    plan.cases[0].predicted_calls = 14;
    plan.predicted_total = 14;
    plan.planned_occurrence_budget = { predicted_total: 14, processes: { sequential: 28 }, total: 28, limit: 5000 };
  }, message: /malformed P-E expectations: planned_occurrence_budget disagrees with p-e\/budget\.mjs/ },
];

for (const drift of BUDGET_DRIFTS) {
  test(`budget cross-check refuses a ${drift.name} drift before claim`, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "pe-budget-preclaim-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const fixture = preflightFixture({ directory });
    const plan = structuredClone(PLAN);
    drift.mutate(plan);
    // Same order as probe-runner: validate the plan before entering approval
    // handling. This is an offline unit check, never a probe or kit launch.
    await assert.rejects(async () => {
      validateExpectations(plan);
      await runApprovedSession({ ...fixture, session: () => assert.fail("must not start"),
        failure: () => assert.fail("must not claim"), refuse: () => assert.fail("must reject plan first") });
    }, drift.message);
    for (const path of [fixture.options["once-marker"], fixture.options.results, join(directory, "scratch")]) {
      assert.equal(existsSync(path), false, path);
    }
  });
}

test("the frozen budget passes the code cross-check unchanged", () => {
  assert.equal(validateExpectations(PLAN), PLAN);
});

test("future corrections have nonempty old text and reason without changing the frozen version", () => {
  const plan = structuredClone(PLAN);
  plan.cases[1].corrected_from = { old_text: "Handle-less failure accepted.", reason: "#797 removes outcome-derived terminal commit state (events.ts:222-225)." };
  assert.equal(validateExpectations(plan), plan);
});

test("all result variants validate and wrong observed shapes mismatch without throwing", () => {
  for (const variant of VARIANTS) {
    assert.doesNotThrow(() => validateResult(variant));
    assert(resultIssues(variant, { kind: "returned", accepted: true, raw: null }).length > 0);
  }
  assert.throws(() => validateResult({ variant: "failed_closed", code: "business_commit_declined", commitGateInvoked: false, durabilityAttempted: true }));
  assert.throws(() => validateResult({ variant: "refused", code: "other" }));
});
