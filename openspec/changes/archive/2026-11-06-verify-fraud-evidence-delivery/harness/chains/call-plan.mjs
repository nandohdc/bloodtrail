// Pure workload call plan per phase for the Stage 2 chains probe (#840, Q209, Q225, Q230, Q231, Q240).
// Defines the ordered steps the sender executes and bounds planned call budget.
import { generateWorkloadDefinition } from "./workload.mjs";

export const TRANSACTION_BOUND_METHODS = Object.freeze(new Set([
  "mfaRemoved",
  "passwordResetCompleted",
  "sessionRevoked",
]));

function pushBoundSteps(steps, { phaseName, method, subIndex, callIndex }) {
  steps.push({
    label: `${phaseName}_call_${callIndex}`,
    step: "begin_operation",
    index: subIndex,
    method,
  });
  steps.push({
    label: `${phaseName}_call_${callIndex + 1}`,
    step: "mark_committed",
    index: subIndex,
    method,
  });
  steps.push({
    label: `${phaseName}_call_${callIndex + 2}`,
    step: "emit",
    index: subIndex,
    method,
  });
}

function pushNonBoundStep(steps, { phaseName, method, subIndex, callIndex }) {
  steps.push({
    label: `${phaseName}_call_${callIndex}`,
    step: "emit",
    index: subIndex,
    method,
  });
}

export function phaseCallPlan(phase, workloadSeed) {
  const seedBase = workloadSeed !== undefined ? workloadSeed : phase.seed;
  if (typeof seedBase !== "number") {
    throw new TypeError("phaseCallPlan requires a numeric workload seed");
  }
  const seed = seedBase + (phase.seed_offset ?? 0);
  const chainCount = phase.chain_count;
  const tenantCount = phase.tenant_count;
  const failedCount = phase.failed_count;

  const workload = generateWorkloadDefinition({
    seed,
    chainCount,
    tenantCount,
    failedCount,
  });

  const steps = [];
  let callIndex = 0;
  for (let i = 0; i < workload.submissionSteps.length; i += 1) {
    const sub = workload.submissionSteps[i];
    const stepContext = {
      phaseName: phase.name,
      method: sub.method,
      subIndex: i,
      callIndex,
    };
    if (TRANSACTION_BOUND_METHODS.has(sub.method)) {
      pushBoundSteps(steps, stepContext);
      callIndex += 3;
    } else {
      pushNonBoundStep(steps, stepContext);
      callIndex += 1;
    }
  }
  return steps;
}
