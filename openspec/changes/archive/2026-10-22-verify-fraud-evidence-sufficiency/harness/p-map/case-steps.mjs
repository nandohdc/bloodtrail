import { thrown } from "../lib/observe.mjs";

function predictionNotes({ predicted, actual }) {
  if (predicted === actual) return [];
  return [`public-call prediction ${predicted}; observed ${actual}; deviation is a note, not a mismatch or invalidation`];
}

function accountCase(state, { entry, start, recordStart, aborted }) {
  const actual = state.ledger.report().occurrence_count - start;
  const row = { case_id: entry.case_id, predicted_calls: entry.predicted_calls,
    public_calls: actual, steps: state.records.slice(recordStart).map((record) => record.step_id),
    notes: predictionNotes({ predicted: entry.predicted_calls, actual }) };
  if (aborted) Object.assign(row, { case_aborted: true, matched: false });
  state.accounting.push(row);
}

function recordAbort(state, entry, error) {
  const safe = error instanceof Error ? error : new Error(String(error));
  state.case_aborts.push(entry.case_id);
  state.records.push({ step_id: `${entry.case_id}/aborted`, variant: "case_aborted",
    ...thrown({ error: safe }), message: safe.message });
}

// Ordinary work-function faults belong to this case and do not invalidate
// unrelated evidence. A public call's refusal/throw belongs to its step instead.
// Baseline preconditions are checked separately by the eventual workload.
export async function runCase(state, entry, work) {
  state.current = entry.case_id;
  const start = state.ledger.report().occurrence_count;
  const recordStart = state.records.length;
  let aborted = false;
  try {
    const result = await work();
    state.ledger.assertAvailable();
    return result;
  } catch (error) {
    state.ledger.assertAvailable(); // Sticky exhaustion must escape containment.
    aborted = true;
    recordAbort(state, entry, error);
    return null;
  } finally {
    accountCase(state, { entry, start, recordStart, aborted });
  }
}
