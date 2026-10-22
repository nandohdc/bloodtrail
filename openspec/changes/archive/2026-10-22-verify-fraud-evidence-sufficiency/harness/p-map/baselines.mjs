import { BASELINE_PLAN } from "./baseline-cases.mjs";
import { runCase } from "./case-steps.mjs";
import { baselineEvaluation } from "./baseline-evaluation.mjs";
import { logoutInput, failureInput } from "./lm-inputs.mjs";
import { instance } from "./runtime.mjs";
import { beginOperation, markOperation, emitOccurrence } from "./workload-steps.mjs";

async function logout(state) {
  const target = instance(state);
  const input = logoutInput(state);
  const handle = await beginOperation(state, { target, id: "begin" });
  await markOperation(state, { target, handle, id: "mark", method: "markCommitted" });
  await emitOccurrence(state, { target, handle, id: "emit", method: "sessionRevoked", input: { ...input, operation: handle } });
}

async function mfa(state) {
  const target = instance(state);
  await emitOccurrence(state, { target, id: "emit", method: "authenticationFailed", input: failureInput(state) });
}

const RUNNERS = { "B-LOGOUT": logout, "B-MFA": mfa };

async function controls(state) {
  for (const entry of BASELINE_PLAN) {
    await runCase(state, entry, () => RUNNERS[entry.case_id](state));
    const { matched } = baselineEvaluation(entry, state);
    state.accounting.at(-1).matched = matched;
    if (!matched) {
      state.invalidations.push({ attribution: "precondition", case_id: entry.case_id,
        message: "P-map baseline precondition failed; all remaining work stopped" });
      break;
    }
  }
}

// Baselines own their records/accounting in a distinct retained namespace, not
// any of the 39 rubric cases. Public-call/ledger accounting remains process-wide.
// This runs only before concrete work, including when a control aborts/exhausts.
export async function baselines(state) {
  try { await controls(state); }
  finally {
    state.baselines = { records: state.records.splice(0), accounting: state.accounting.splice(0),
      case_aborts: state.case_aborts.splice(0) };
  }
}
