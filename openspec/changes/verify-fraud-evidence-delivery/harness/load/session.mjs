// Orchestrator side of the load session (#838): each frozen phase is one exchange between a fresh ingress,
// with its own SQLite file and the phase's scheduled fault plan, and a fresh load sender. The small pass's
// phases run first; the volume pass's only if every small-pass case matched (lib/gated-session.mjs).
import { exchangeUnit, gatedSession } from "../lib/gated-session.mjs";
import { evaluateCases } from "./evaluate.mjs";

// What the load sender reads for one phase: its composition, its run shape and its call budget.
export function senderInput({ expectations, phase }) {
  return {
    contract_version: expectations.contract_version, clock: expectations.clock, workload: { seed: expectations.workload.seed },
    composition: phase.composition,
    phase: { name: phase.name, kind: phase.kind, occurrences: phase.occurrences, shutdown: phase.shutdown, after_shutdown: phase.after_shutdown },
    planned_call_budget: { processes: { sender: expectations.planned_call_budget.processes[phase.name] } },
  };
}

function runPhase({ context, phase }) {
  return exchangeUnit({ context, unit: phase, probeDirectory: "load", senderInput: (unit) => senderInput({ expectations: context.expectations, phase: unit }) });
}

// `exchange` runs one phase; self-tests inject a fixture in place of the role processes.
export function loadSession({ service, storage, flags, expectations, exchange = runPhase }) {
  return gatedSession({
    expectations, units: expectations.phases, evaluate: evaluateCases, key: "phases",
    base: { service, storage, flags }, runUnit: ({ context, unit }) => exchange({ context, phase: unit }),
  });
}
