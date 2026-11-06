import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCases } from "../counts/evaluate.mjs";
import { readPlanFile } from "../counts/plans.mjs";
import { FROZEN, rehearsal } from "./counts-rehearsal.mjs";
import { testSenderSdk } from "./counts-fakes.mjs";

let nullResult;
test("session rehearsal matches N-01 through N-10 under the frozen deadline", async (context) => {
  nullResult = await rehearsal();
  const result = evaluateCases({ expectations: FROZEN, observations: nullResult });
  context.diagnostic(result.evaluations.map((entry) => `${entry.case_id}=${entry.matched ? "MATCH" : JSON.stringify(entry.observed)}`).join(" "));
  assert.deepEqual(result.verdict, { matched: 10, mismatched: 0 });
  assert.equal(nullResult.gate.volume_pass, "completed");
  assert.equal(Object.keys(nullResult.phases).length, 20);
  assert(nullResult.occurrence_count <= FROZEN.planned_call_budget.total);
});

function senderPlant(name, report) {
  if (report.type !== "report") return report;
  if (name === "unexplained") {
    const first = report.emissions[0];
    report.delivery_reports = report.delivery_reports.filter((delivery) => delivery.event_id !== first.event_id);
  }
  if (name === "missing observation") delete report.observation;
  return report;
}

function ingressPlant(name, report) {
  if (report.type !== "read_back") return report;
  if (report.raw_persisted_bodies.length === 0) return report;
  if (name === "unexplained") {
    const id = report.raw_persisted_bodies[0].event.id;
    report.raw_persisted_bodies = report.raw_persisted_bodies.filter((body) => body.event.id !== id);
    report.persisted_bodies = report.persisted_bodies.filter((body) => body.event.id !== id);
  }
  return report;
}

for (const name of ["plain-object context", "unexplained", "missing observation"]) {
  test(`session seam ${name} mismatches under the null-controlled deadline`, async () => {
    assert.equal(evaluateCases({ expectations: FROZEN, observations: nullResult }).verdict.mismatched, 0);
    const observations = await rehearsal({
      plainContext: name === "plain-object context",
      transformSender: (report) => senderPlant(name, report), transformIngress: (report) => ingressPlant(name, report),
    });
    assert(evaluateCases({ expectations: FROZEN, observations }).verdict.mismatched > 0);
  });
}

test("session seam duplicate-inflated counter mismatches over the run's own persisted data", async () => {
  assert.equal(evaluateCases({ expectations: FROZEN, observations: nullResult }).verdict.mismatched, 0);
  const observations = await rehearsal({ evaluate: (options) => evaluateCases({ ...options, counter: "raw" }) });
  assert(observations.gate.small_mismatched.includes("N-02"));
  assert(evaluateCases({ expectations: FROZEN, observations }).verdict.mismatched > 0);
  assert.equal(nullResult.planted_controls.raw_counter_failed, true);
  assert.equal(nullResult.planted_controls.distinct_null_passed, true);
});

test("session seam tampered fault-plan hash invalidates before traffic; null completes", async () => {
  assert.equal(evaluateCases({ expectations: FROZEN, observations: nullResult }).verdict.mismatched, 0);
  const read = (file) => Buffer.concat([readPlanFile(file), Buffer.from(" ")]);
  await assert.rejects(rehearsal({ read }), /hash mismatch/);
  assert.equal(evaluateCases({ expectations: FROZEN, observations: null }).verdict.mismatched, 10);
});

test("session seam refuses a copies plan when SDK redelivery never reaches the sink", async () => {
  assert.equal(evaluateCases({ expectations: FROZEN, observations: nullResult }).verdict.mismatched, 0);
  const senderSdk = (options) => ({
    ...testSenderSdk(options),
    redeliver: async () => ({ ok: false, error: { code: "SDK_INVALID_INPUT", path: "/", category: "validation" } }),
  });
  const observations = await rehearsal({ senderSdk });
  assert.equal(observations.phases.copies_identities.plan_reference.executed, false);
  assert(observations.gate.small_mismatched.includes("N-01"));
  assert(evaluateCases({ expectations: FROZEN, observations }).verdict.mismatched > 0);
});
