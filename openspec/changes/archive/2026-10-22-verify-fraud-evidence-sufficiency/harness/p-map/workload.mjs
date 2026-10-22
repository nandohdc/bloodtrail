import { baselines } from "./baselines.mjs";
import { logoutWorkload } from "./logout-workload.mjs";
import { mfaWorkload } from "./mfa-workload.mjs";
import { contactWorkload, brandWorkload } from "./contact-workload.mjs";
import { lockoutWorkload } from "./lockout-workload.mjs";
import { unlockWorkload } from "./unlock-workload.mjs";
import { rotationWorkload } from "./rotation-workload.mjs";
import { observations } from "./runtime.mjs";
import { P_MAP_PREDICTED_TOTAL } from "./budget.mjs";

// Module-scope sequence. No parallel scheduling, extra SDK calls for S rows,
// persistence, or implicit sharing across families. U2 alone receives K2a's
// live dependency; ordinary case aborts stay contained by familyWorkload.
const INDEPENDENT = [logoutWorkload, mfaWorkload, contactWorkload, brandWorkload];
async function families(state) {
  for (const run of INDEPENDENT) {
    await run(state);
    state.ledger.assertAvailable();
  }
  const lock = await lockoutWorkload(state);
  await unlockWorkload(state, lock);
  await rotationWorkload(state);
}

export async function measure({ state }) {
  try {
    await baselines(state);
    if (state.invalidations.length === 0) await families(state);
    state.ledger.assertAvailable();
  } catch (error) {
    state.invalidations.push({ message: error.message, attribution: "harness_fault", stopped_at: state.current });
  }
  const actual = state.ledger.report().occurrence_count;
  const notes = actual === P_MAP_PREDICTED_TOTAL ? [] : [
    `public-call prediction ${P_MAP_PREDICTED_TOTAL}; observed ${actual}; deviation is a note, not an invalidation`,
  ];
  return { role: "sequential", ...observations(state), baselines: state.baselines,
    case_aborts: state.case_aborts, notes };
}
