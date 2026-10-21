import assert from "node:assert/strict";
import { list, object, unique } from "../p-e/shape.mjs";
import { CASE_IDS, CORRECTED_AT, COMMENT, SIGNAL_IDS } from "./plan.mjs";
import { validateCase } from "./case-validation.mjs";
import { validateAggregate } from "./aggregate-validation.mjs";
import { validatePeers } from "./step-validation.mjs";
import { validateFrozenBudget } from "./budget.mjs";

export { validateCase } from "./case-validation.mjs";

// Unconditional code-derived budget validation happens before shared-runner
// preflight/claim, never deferred to a child after an approval has been spent.
export function validateExpectations(value) {
  try {
    object(value, "expectations");
    assert.equal(value.probe, "P-map");
    assert.equal(value.version, 1);
    assert.equal(value.corrected_at, CORRECTED_AT);
    assert.deepEqual(value.drafted_from, { commit: "5d931ad", comment: COMMENT });
    const cases = list(value.cases, "cases");
    assert.deepEqual(cases.map((entry) => entry.case_id), CASE_IDS, "exact case inventory/order differs");
    for (const entry of cases) validateEntry(entry);
    const concrete = cases.filter((entry) => !SIGNAL_IDS.includes(entry.case_id));
    unique(concrete.flatMap((entry) => entry.expected.map((step) => step.step_id)), "planned steps");
    validatePeers(cases);
    validateFrozenBudget(value);
    return value;
  } catch (error) { throw new Error(`malformed P-map expectations: ${error.message}`); }
}

export function validateEntry(entry) {
  if (SIGNAL_IDS.includes(entry?.case_id)) return validateAggregate(entry);
  return validateCase(entry);
}
