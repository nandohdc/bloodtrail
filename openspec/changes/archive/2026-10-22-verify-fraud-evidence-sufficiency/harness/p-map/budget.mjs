import assert from "node:assert/strict";
import { CONCRETE_CASES, SIGNAL_IDS } from "./plan.mjs";
import { BASELINE_PLAN } from "./baseline-cases.mjs";

// Baselines consume calls; seven S rows are analyses, not SDK invocations.
export const P_MAP_PREDICTED_CALLS = Object.freeze(Object.fromEntries([
  ...SIGNAL_IDS.map((case_id) => [case_id, 0]),
  ...CONCRETE_CASES.map((entry) => [entry.case_id, entry.predicted_calls]),
]));
export const P_MAP_PREDICTED_TOTAL = [...BASELINE_PLAN, ...CONCRETE_CASES]
  .reduce((sum, entry) => sum + entry.predicted_calls, 0);

// Implementer default: one sequential process, twice the baseline-inclusive
// prediction. A different actual count within this allowance is only a note.
export const P_MAP_BUDGET = Object.freeze({ predicted_total: P_MAP_PREDICTED_TOTAL,
  processes: Object.freeze({ sequential: 2 * P_MAP_PREDICTED_TOTAL }),
  total: 2 * P_MAP_PREDICTED_TOTAL, limit: 5000 });

export function validateFrozenBudget(value) {
  assert.deepEqual(value.baseline_plan, BASELINE_PLAN, "baseline_plan differs from code descriptors");
  assert.deepEqual(value.planned_occurrence_budget, P_MAP_BUDGET, "planned_occurrence_budget disagrees with p-map/budget.mjs");
  assert.equal(value.predicted_total, P_MAP_PREDICTED_TOTAL, "predicted_total disagrees with p-map/budget.mjs");
  assert(P_MAP_BUDGET.total <= P_MAP_BUDGET.limit, "authorization cap exceeded");
  for (const entry of value.cases) {
    assert.equal(entry.predicted_calls, P_MAP_PREDICTED_CALLS[entry.case_id],
      `${entry.case_id}: predicted_calls disagrees with its code descriptor`);
  }
  const predicted = [...value.baseline_plan, ...value.cases].reduce((sum, entry) => sum + entry.predicted_calls, 0);
  assert.equal(predicted, P_MAP_PREDICTED_TOTAL, "baseline-inclusive per-case prediction sum differs");
}
