import { CASES } from "./cases.mjs";
import { instance, thrownOutcome, SetupRefusal } from "./runtime.mjs";

export async function executeCases({ state, cases = CASES, makeInstance = instance }) {
  for (const entry of cases) {
    state.current = entry.case_id;
    try {
      const target = entry.fresh ? makeInstance(state) : undefined;
      await entry.run(state, target);
    } catch (error) {
      state.ledger.assertAvailable();
      if (!(error instanceof SetupRefusal) && !state.publicErrors.has(error)) throw new Error(`harness fault in ${entry.case_id}: ${error.message}`);
      state.records.push({ step_id: `${entry.case_id}/setup`, ...thrownOutcome({ error, state }), sink_count: 0, frozen: [], events: [], facts: {} });
    }
    state.ledger.assertAvailable();
    if (baselineInvalid({ state, entry })) break;
  }
}

function baselineInvalid({ state, entry }) {
  if (!["PD-00", "PD-01"].includes(entry.case_id)) return false;
  const observation = state.records.find((record) => record.step_id === `${entry.case_id}/main`);
  if (observation?.surface === "accepted" && observation.sink_count === 1) return false;
  state.invalidations.push({ message: `${entry.case_id} precondition failed; all remaining cases stopped` });
  return true;
}

export async function measure({ state, cases = CASES }) {
  try { await executeCases({ state, cases }); }
  catch (error) { state.invalidations.push({ message: error.message, attribution: "harness_fault" }); }
  return { role: "integrity", records: state.records, public_calls: state.calls, invalidations: state.invalidations, ledger: state.ledger.report() };
}
