import { exchangeUnit, gatedSession } from "../lib/gated-session.mjs";
import { resolvePhase, referenceFiles } from "./plans.mjs";
import { evaluateCases, plantedControls } from "./evaluate.mjs";
import { reconcilePhase } from "./reconcile.mjs";
import { executionObserved } from "./execution.mjs";

export function senderInput({ expectations, phase }) {
  return {
    contract_version: expectations.contract_version, clock: expectations.clock, workload: expectations.workload,
    composition: phase.composition, phase,
    planned_call_budget: { processes: { sender: expectations.planned_call_budget.processes[phase.name] } },
  };
}

function restartHook(unit) {
  if (unit.kind !== "collector_restart") return undefined;
  return async ({ roles }) => {
    await roles.sender.next("request_ingress_restart", "sender");
    roles.ingress.send({ type: "restart" });
    const restarted = await roles.ingress.next("restarted", "ingress");
    roles.sender.send({ type: "ingress_restarted", port: restarted.port });
  };
}

export async function exchangeCountsUnit({ context, unit }) {
  const result = await exchangeUnit({
    context: Object.create(context, { expectations: { value: { ...context.expectations, scenarios: unit.scenarios } } }),
    unit, probeDirectory: "counts", senderInput: (phase) => senderInput({ expectations: context.expectations, phase }),
    afterSenderStart: restartHook(unit),
  });
  const observed = {
    ...result, plan_reference: { ...unit.reference, hash_verified: unit.hash_verified, executed: executionObserved(unit, result) },
    per_target: "not_attempted", per_target_reference: "G33",
  };
  observed.reconciliation = reconcileObserved({ expectations: context.expectations, phase: unit, observed });
  return observed;
}

function reconcileObserved(options) {
  try {
    return reconcilePhase(options);
  } catch (error) {
    return { missing_or_invalid: error.message };
  }
}

export async function countsSession({ expectations, exchange = exchangeCountsUnit, evaluate = evaluateCases, read, ...base }) {
  const files = referenceFiles(expectations, read);
  const units = expectations.phases.map((phase) => resolvePhase({ expectations, phase, files }));
  const observations = await gatedSession({
    expectations, units, evaluate, key: "phases", base,
    runUnit: ({ context, unit }) => exchange({ context, unit }),
  });
  // The planted counter and null control run on the full run's own storage data before the verdict.
  observations.planted_controls = plantedControls({ expectations, observations });
  return observations;
}
