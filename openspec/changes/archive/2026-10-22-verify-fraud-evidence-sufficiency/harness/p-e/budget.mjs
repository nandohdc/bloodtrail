// P-E occurrence budget, derived from the per-case descriptors. The frozen
// expectations header (US-013) must carry the same predicted_total, the same
// one-process allowance and the same 5000 authorization cap; validateBudget
// in expectations-validate.mjs cross-checks the frozen plan against these
// exports before the once-marker claim (G5).
import { ADMISSION_CASE } from "./admission-cases.mjs";
import { CONCURRENCY_CASES } from "./concurrency-cases.mjs";
import { CONSTRUCTION_CASES } from "./construction-cases.mjs";
import { GUARANTEES_CASE } from "./guarantees-workload.mjs";
import { ORDERING_CASES } from "./ordering-cases.mjs";
import { OUTBOX_CASES } from "./outbox-cases.mjs";
import { RECOVERY_CASES } from "./recovery-cases.mjs";
import { REDELIVERY_CASES } from "./redelivery-cases.mjs";

const CASES = [ADMISSION_CASE, GUARANTEES_CASE, ...CONSTRUCTION_CASES, ...ORDERING_CASES,
  ...REDELIVERY_CASES, ...CONCURRENCY_CASES, ...OUTBOX_CASES, ...RECOVERY_CASES];

export const P_E_PREDICTED_TOTAL = CASES.reduce((sum, entry) => sum + entry.predicted_calls, 0);

// G5: per-case predictions keyed by case id, for validateBudget's pre-claim
// cross-check of the frozen expectations.
export const P_E_PREDICTED_CALLS = Object.freeze(new Map(
  CASES.map((entry) => [entry.case_id, entry.predicted_calls])));

// Implementer default: one sequential process; the allowance is about twice
// the prediction, matching the other Stage P probes, far below the cap.
export const P_E_BUDGET = Object.freeze({
  predicted_total: P_E_PREDICTED_TOTAL,
  processes: { sequential: 2 * P_E_PREDICTED_TOTAL },
  total: 2 * P_E_PREDICTED_TOTAL,
  limit: 5000,
});
