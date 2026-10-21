import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { validateEntry, validateExpectations } from "../p-map/expectations-validate.mjs";
import { compareStep } from "../p-map/step-evaluation.mjs";
import { evaluationPlan } from "./p-map-evaluation-fixtures.mjs";

const EMPTY_RESULT = evaluateProbe({ expectations: evaluationPlan(), observations: [] });
const INVENTORY_ERROR = "malformed P-map expectations: Cannot read properties of null (reading 'case_id')";
const NULL_ROW = { case_id: undefined, raw: [], accounting: [], notes: [], integrity: false, steps: [],
  matched: false, mismatches: ["malformed planned row: fields: object required"] };

const NULL_PLANS = [
  ["expectations", (input) => { input.expectations = null; }, [],
    "malformed P-map expectations: expectations: object required"],
  ["aggregate-position entry", (input) => { input.expectations.cases[0] = null; },
    [NULL_ROW, ...EMPTY_RESULT.evaluations.slice(1)], INVENTORY_ERROR],
  ["concrete-position entry", (input) => { input.expectations.cases[7] = null; },
    [...EMPTY_RESULT.evaluations.slice(0, 7), NULL_ROW, ...EMPTY_RESULT.evaluations.slice(8)], INVENTORY_ERROR],
];

for (const [label, mutate, evaluations, note] of NULL_PLANS) test(`P-map null ${label} preserves the exact evaluation`, () => {
  const input = { expectations: evaluationPlan(), observations: [] };
  mutate(input);
  assert.deepEqual(evaluateProbe(input), { ...EMPTY_RESULT, evaluations, notes: [note] });
});

test("P-map null case entry preserves the exact plan-validation error", () => {
  const plan = evaluationPlan();
  plan.cases[0] = null;
  assert.throws(() => validateExpectations(plan), { message: INVENTORY_ERROR });
  assert.throws(() => validateEntry(null), { message: "fields: object required" });
});

for (const raw of [null, undefined]) test(`P-map ${raw} public outcome preserves the diagnostic catch text`, () => {
  const step = evaluationPlan().cases[7].expected[0];
  const record = { step_id: step.step_id, kind: "returned", accepted: undefined, sink_count: 0, captures: [], raw };
  assert.deepEqual(compareStep(step, { case_id: "L1", raw: [record], records: [record] }),
    [`${step.step_id}: malformed/missing step: Cannot read properties of ${raw} (reading 'error')`]);
});
