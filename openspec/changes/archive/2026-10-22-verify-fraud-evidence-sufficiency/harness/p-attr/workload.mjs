import { AF_CASES } from "./af-cases.mjs";
import { AS_CASES } from "./as-cases.mjs";
import { PR_CASES, RA_CASES } from "./request-cases.mjs";
import { afWorkload, asWorkload, requestWorkload, callSnapshot } from "./carrier-workload.mjs";
import { linkageWorkload } from "./linkage-workload.mjs";
import { LINKAGE_PREDICTIONS, P_ATTR_BUDGET } from "./linkage-cases.mjs";
import { memoryKeying } from "./keying.mjs";

// Implementer default: one sequential process like P-D; declaration order does
// not control execution. ALL four families' positive controls precede carriers.
const FAMILIES = [
  ["AF", AF_CASES, afWorkload], ["AS", AS_CASES, asWorkload],
  ["PR", PR_CASES, requestWorkload], ["RA", RA_CASES, requestWorkload],
];
const MATRIX_PREDICTIONS = FAMILIES.flatMap(([, cases]) => cases.map(({ case_id, predicted_calls }) => ({ case_id, predicted_calls })));
function selectedCases({ family, cases, baseline }) {
  return cases.filter((entry) => (entry.case_id === `${family}-B`) === baseline);
}
async function matrixPhase({ state, keying, baseline, analyze }) {
  for (const [family, cases, run] of FAMILIES) {
    if (state.invalidations.length > 0) return;
    await run({ family, state, keying, cases: selectedCases({ family, cases, baseline }), analyze });
    state.ledger.assertAvailable();
  }
}
function deviation({ label, predicted, actual }) {
  const notes = actual === predicted ? [] : [`predicted ${predicted}; observed ${actual}; deviation is a note, not an invalidation`];
  return { label, predicted, actual, notes };
}
export function accounting(state) {
  const matrix = MATRIX_PREDICTIONS.map((entry) => deviation({ label: entry.case_id, predicted: entry.predicted_calls,
    actual: state.calls.filter((call) => call.label.split(":")[0] === entry.case_id).length }));
  const datasets = new Map(state.linkage_datasets.map((entry) => [entry.dataset_id, entry.public_calls.length]));
  const linkage = LINKAGE_PREDICTIONS.map((entry) => deviation({ label: entry.dataset_id, predicted: entry.predicted_calls,
    actual: datasets.get(entry.dataset_id) ?? 0 }));
  const setup = deviation({ label: "linkage-setup", predicted: P_ATTR_BUDGET.linkage_setup,
    actual: state.calls.filter((call) => call.label.startsWith("linkage-setup:")).length });
  return { predicted_total: P_ATTR_BUDGET.predicted_total, allowance: P_ATTR_BUDGET.total,
    per_case: [...matrix, setup, ...linkage], total: deviation({ label: "total", predicted: P_ATTR_BUDGET.predicted_total, actual: state.calls.length }) };
}
// analyze=false is the sandboxed probe-process mode: the child has no copy of
// contracts/ and no read grant beyond its own service directory, so no
// analysis (which consults field-policy.json) may run there. Offline tests and
// the parent evaluator default to analyze=true.
export async function measure({ state, keying = memoryKeying(), analyze = true }) {
  state.linkage_datasets = [];
  try {
    await matrixPhase({ state, keying, baseline: true, analyze });
    await matrixPhase({ state, keying, baseline: false, analyze });
    await linkageWorkload({ state, keying, analyze });
    state.ledger.assertAvailable();
  } catch (error) {
    state.invalidations.push({ message: error.message, attribution: "harness_fault", stopped_at: state.current });
  }
  return { role: "matrix", records: state.records, public_calls: state.calls.map(callSnapshot),
    linkage_datasets: state.linkage_datasets, linkage_calls: state.calls.filter((call) => /^(L[123]|linkage-setup):/.test(call.label)).map(callSnapshot),
    keying: keying.metadata, accounting: accounting(state), invalidations: state.invalidations, ledger: state.ledger.report() };
}
