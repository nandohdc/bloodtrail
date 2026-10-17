import assert from "node:assert/strict";
import test from "node:test";
import { fixtureState } from "./process-fixture.mjs";
import { ROLES } from "../p-ids/roles.mjs";
import { measureRole } from "../p-ids/measure.mjs";
import { captureState } from "../p-ids/workload.mjs";
import { evaluateCases } from "../p-ids/evaluate.mjs";
import { jsonFile } from "../lib/io.mjs";

const EXPECTATIONS = jsonFile(new URL("../expectations/p-ids.v1.json", import.meta.url));
const processFor = ({ observations, role }) => observations.find((entry) => entry.role === role);
function repeatAcross({ observations, left, right, field }) {
  processFor({ observations, role: right }).ids[field][0] = processFor({ observations, role: left }).ids[field][0];
}
function setupDiagnostic({ observations, field }) {
  const process = processFor({ observations, role: "setup" });
  process.outcomes.find((entry) => entry.label === "core:a").diagnostic[field] = "wrong-fixture";
}
const MUTATIONS = [
  { case_id: "P-ids-00", variants: ["code", "category", "path"].map((field) => (observations) => setupDiagnostic({ observations, field })) },
  { case_id: "P-ids-01", variants: [(observations) => repeatAcross({ observations, left: "core-A", right: "core-B", field: "event_id" })] },
  { case_id: "P-ids-02", variants: [(observations) => repeatAcross({ observations, left: "core-A", right: "core-B", field: "operation_id" })] },
  { case_id: "P-ids-03", variants: [(observations) => repeatAcross({ observations, left: "core-C", right: "core-D", field: "handle_operationId" })] },
  { case_id: "P-ids-04", variants: [(observations) => {
    processFor({ observations, role: "core-F" }).ids.handle_operationId[0] = processFor({ observations, role: "core-E" }).ids.event_id[0];
  }] },
  { case_id: "P-ids-05", variants: [(observations) => processFor({ observations, role: "core-G" }).ids.direct.pop()] },
  { case_id: "P-ids-06", variants: [(observations) => { processFor({ observations, role: "core-A" }).retention.generatedEventIds.size = 99; }] },
  { case_id: "P-ids-07", variants: [
    (observations) => { processFor({ observations, role: "controls" }).outcomes.find((entry) => !entry.accepted).diagnostic.path = "/wrong-fixture"; },
    (observations) => processFor({ observations, role: "controls" }).outcomes.push({ label: "fixture", accepted: false, diagnostic: {} }),
  ] },
  { case_id: "P-ids-08", variants: [(observations) => processFor({ observations, role: "node-A" }).handles.pop()] },
  { case_id: "P-ids-09", variants: [(observations) => repeatAcross({ observations, left: "node-C", right: "node-D", field: "event_id" })] },
  { case_id: "P-ids-10", variants: [(observations) => repeatAcross({ observations, left: "core-H", right: "core-I", field: "event_id" })] },
];

async function validObservations() {
  const observations = [];
  for (const plan of ROLES) {
    const state = fixtureState({ role: plan.role, budget: EXPECTATIONS.planned_occurrence_budget.processes[plan.role] });
    await measureRole({ state, plan });
    observations.push(captureState({ state }));
  }
  return observations;
}

const VALID = await validObservations();
for (const { case_id, variants } of MUTATIONS) {
  test(`${case_id} minimal negative fixture mutations flip matched without changing analysis-only 11`, () => {
    const original = evaluateCases({ observations: VALID, expectations: EXPECTATIONS });
    assert.equal(original.find((entry) => entry.case_id === case_id).matched, true);
    for (const mutate of variants) {
      const observations = structuredClone(VALID);
      mutate(observations);
      const evaluated = evaluateCases({ observations, expectations: EXPECTATIONS });
      assert.equal(evaluated.find((entry) => entry.case_id === case_id).matched, false);
      assert.equal(evaluated[11].matched, null);
    }
  });
}
