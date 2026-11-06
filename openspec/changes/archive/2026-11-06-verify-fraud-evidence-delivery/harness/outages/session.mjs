// Orchestrator side of the outages session (#837): the two frozen passes, each one exchange between a fresh
// ingress, with its own SQLite file and the pass's scheduled fault plan, and a fresh sender. The sequencing,
// the small-pass gate, the halt and the partial observations are lib/gated-session.mjs's.
import { exchangeUnit, gatedSession, passGate } from "../lib/gated-session.mjs";
import { evaluateCases } from "./evaluate.mjs";

export { flatRoles } from "../lib/gated-session.mjs";

// The tracer's sender reads only these fields, so each pass hands it a view with that pass's occurrences
// and call budget.
export function senderInput({ expectations, pass }) {
  return {
    contract_version: expectations.contract_version, clock: expectations.clock, composition: expectations.composition,
    workload: { seed: expectations.workload.seed, occurrences: pass.occurrences },
    planned_call_budget: { processes: { sender: expectations.planned_call_budget.processes[pass.name] } },
  };
}

function runPass({ context, pass }) {
  return exchangeUnit({ context, unit: pass, probeDirectory: "outages", senderInput: (unit) => senderInput({ expectations: context.expectations, pass: unit }) });
}

export function smallPassGate({ passes, expectations }) {
  return passGate({ evaluate: evaluateCases, observations: { passes }, expectations });
}

// `exchange` runs one pass; self-tests inject a fixture in place of the role processes.
export function outagesSession({ service, storage, flags, expectations, exchange = runPass }) {
  return gatedSession({
    expectations, units: expectations.passes.map((pass) => ({ ...pass, pass: pass.name })), evaluate: evaluateCases, key: "passes",
    base: { service, storage, flags }, runUnit: ({ context, unit }) => exchange({ context, pass: unit }),
  });
}
