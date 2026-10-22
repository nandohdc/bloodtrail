import { runProbe } from "../lib/probe-runner.mjs";
import { evaluateProbe } from "./evaluate.mjs";
import { validateExpectations } from "./expectations-validate.mjs";

export const ROLES = Object.freeze([Object.freeze({ role: "sequential" })]);
// Explicit child AND parent/evaluator import inventory. Shared preflight also
// verifies EVERY tracked harness blob (including tests/plans) at approved HEAD.
export const PROBE_FILES = Object.freeze([
  "p-map/probe-process.mjs", "p-map/run-p-map.mjs", "p-map/roles.mjs",
  "p-map/workload.mjs", "p-map/baselines.mjs", "p-map/baseline-cases.mjs", "p-map/baseline-evaluation.mjs", "p-map/budget.mjs",
  "p-map/aggregate-evaluation.mjs", "p-map/aggregate-validation.mjs",
  "p-map/case-steps.mjs", "p-map/case-validation.mjs", "p-map/contact-cases.mjs",
  "p-map/contact-facts.mjs", "p-map/contact-inputs.mjs", "p-map/contact-workload.mjs",
  "p-map/evaluate.mjs", "p-map/evaluation-row.mjs", "p-map/evidence.mjs",
  "p-map/expectations-validate.mjs", "p-map/family-workload.mjs", "p-map/lm-facts.mjs",
  "p-map/lm-inputs.mjs", "p-map/lock-cases.mjs", "p-map/lock-facts.mjs", "p-map/lock-inputs.mjs",
  "p-map/lockout-workload.mjs", "p-map/logout-cases.mjs", "p-map/logout-workload.mjs",
  "p-map/mfa-cases.mjs", "p-map/mfa-workload.mjs", "p-map/observation-validation.mjs",
  "p-map/plan.mjs", "p-map/rotation-cases.mjs", "p-map/rotation-facts.mjs",
  "p-map/rotation-inputs.mjs", "p-map/rotation-workload.mjs", "p-map/runtime.mjs",
  "p-map/signal-findings.mjs", "p-map/signal-rules.mjs", "p-map/snapshot.mjs",
  "p-map/step-evaluation.mjs", "p-map/step-validation.mjs", "p-map/unlock-workload.mjs",
  "p-map/verdicts.mjs", "p-map/workload-steps.mjs",
  "p-e/runtime.mjs", "p-e/snapshot.mjs", "p-e/shape.mjs", "p-e/assertions.mjs",
  "p-e/case-steps.mjs", "p-e/evaluation-row.mjs", "p-e/inputs.mjs", "p-e/expectations-validate.mjs",
  "p-e/metadata.mjs", "p-e/result-shapes.mjs", "p-e/step-validation.mjs", "p-e/budget.mjs",
  "p-e/admission-cases.mjs", "p-e/concurrency-cases.mjs", "p-e/construction-cases.mjs",
  "p-e/ordering-cases.mjs", "p-e/outbox-cases.mjs", "p-e/recovery-cases.mjs", "p-e/redelivery-cases.mjs",
  "p-e/delivery.mjs", "p-e/guarantees-workload.mjs", "p-e/redelivery-steps.mjs", "p-e/scripts.mjs",
  "lib/probe-runner.mjs", "lib/plan.mjs", "lib/arguments.mjs", "lib/kit-pipeline.mjs", "lib/identity.mjs",
  "lib/install.mjs", "lib/runtime-facts.mjs", "lib/launcher.mjs", "lib/database-permissions.mjs", "lib/io.mjs",
  "lib/results.mjs", "lib/orchestrate.mjs", "lib/approval.mjs", "lib/preflight.mjs", "lib/repository.mjs",
  "lib/ledger.mjs", "lib/observe.mjs", "lib/counted.mjs",
  "lib/import-closure.mjs",
]);

export { validateExpectations };
export { P_MAP_BUDGET } from "./budget.mjs";

// Injection is an offline fixture seam, not a production gate bypass. No
// databaseScratch opt-in: production flags are the shared read-only pair.
export function runPmap({ entrypoint, runner = runProbe }) {
  return runner({ probe: "P-map", ticket: 804, probeDirectory: "p-map", entrypoint,
    validate: validateExpectations, files: PROBE_FILES, roles: ROLES,
    evaluate: evaluateProbe, retainProcesses: true });
}
