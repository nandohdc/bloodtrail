import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { validateExpectations } from "../p-map/expectations-validate.mjs";
import { evaluationFixture } from "./p-map-evaluation-fixtures.mjs";
import { equal } from "./p-map-evaluation-oracle.mjs";

const fixture = await evaluationFixture();
// Counterfactual public-boundary fixtures, not claims about the SDK. They
// establish the rubric's rule that only accepted expressions can establish fit.
function refuseExpression(input, id) {
  const record = input.observations.flatMap((process) => process.records).find((row) => row.step_id === id);
  const diagnostic = { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" };
  Object.assign(record, { raw: { ok: false, error: diagnostic }, diagnostic, accepted: false, captures: [], sink_count: 0 });
  const plan = input.expectations.cases.find((row) => row.case_id === id.split("/")[0]);
  const step = plan.expected.find((row) => row.step_id === id);
  Object.assign(step, { accepted: false, sink_count: 0, assertions: Object.entries(diagnostic)
    .map(([key, value]) => equal(`diagnostic.${key}`, value)) });
}

const SCENARIOS = [
  { name: "allow variant remains honest when not_applicable expression is refused", refused: ["L1/not-applicable"], verdict: "FITS", best: "L1" },
  { name: "refused honest expressions cannot beat accepted anonymous misrepresentation", refused: ["L1/not-applicable", "L1/allow"], verdict: "MISREPRESENTS", best: "L4" },
];
for (const scenario of SCENARIOS) test(`P-map best accepted candidate: ${scenario.name}`, () => {
  const input = structuredClone(fixture);
  for (const id of scenario.refused) refuseExpression(input, id);
  assert.doesNotThrow(() => validateExpectations(input.expectations));
  const result = evaluateProbe(input);
  assert.equal(result.evaluations.find((row) => row.case_id === "L1").matched, true);
  const signal = result.verdicts.find((row) => row.case_id === "S-LOGOUT");
  assert.equal(signal.verdict, scenario.verdict);
  assert.equal(signal.components[0].best_candidate, scenario.best);
  const criterion = result.verdicts.find((row) => row.case_id === "S-CRIT2");
  assert.deepEqual(criterion.misfits, scenario.best === "L4" ? ["S-LOGOUT"] : []);
});
