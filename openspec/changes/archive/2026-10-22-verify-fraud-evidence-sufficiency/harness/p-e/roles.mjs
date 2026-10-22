import { runProbe } from "../lib/probe-runner.mjs";
import { evaluateProbe } from "./evaluate.mjs";
import { validateExpectations } from "./expectations-validate.mjs";
import { P_E_BUDGET } from "./budget.mjs";

export const ROLES = [{ role: "sequential" }];
// Explicit approved-file inventory: child closure plus parent/evaluator
// modules. Shared preflight additionally checks EVERY tracked harness Git blob.
export const PROBE_FILES = [
  "p-e/probe-process.mjs", "p-e/run-p-e.mjs", "p-e/roles.mjs", "p-e/workload.mjs",
  "p-e/runtime.mjs", "p-e/budget.mjs", "p-e/inputs.mjs", "p-e/case-steps.mjs",
  "p-e/snapshot.mjs", "p-e/delivery.mjs", "p-e/sink.mjs", "p-e/host.mjs", "p-e/parking.mjs",
  "p-e/scripts.mjs", "p-e/redelivery-steps.mjs", "p-e/outbox-steps.mjs", "p-e/outbox-relay.mjs",
  "p-e/outbox-input-facts.mjs", "p-e/recovery-steps.mjs", "p-e/deferred-workload.mjs",
  "p-e/rollback-retry-workload.mjs", "p-e/fault-workload.mjs", "p-e/construction-cases.mjs",
  "p-e/construction-workload.mjs", "p-e/ordering-cases.mjs", "p-e/ordering-workload.mjs",
  "p-e/redelivery-cases.mjs", "p-e/redelivery-workload.mjs", "p-e/concurrency-cases.mjs",
  "p-e/concurrency-workload.mjs", "p-e/outbox-cases.mjs", "p-e/outbox-workload.mjs",
  "p-e/recovery-cases.mjs", "p-e/recovery-workload.mjs", "p-e/admission-cases.mjs",
  "p-e/admission-workload.mjs", "p-e/guarantees-workload.mjs", "p-e/evaluate.mjs",
  "p-e/expectations-validate.mjs", "p-e/shape.mjs", "p-e/assertions.mjs", "p-e/step-validation.mjs",
  "p-e/metadata.mjs", "p-e/result-shapes.mjs", "p-e/evaluation-row.mjs", "p-e/guarantee-analysis.mjs",
  "p-e/contract-columns.mjs",
  "lib/probe-runner.mjs", "lib/plan.mjs", "lib/arguments.mjs", "lib/kit-pipeline.mjs", "lib/identity.mjs",
  "lib/install.mjs", "lib/runtime-facts.mjs", "lib/launcher.mjs", "lib/database-permissions.mjs", "lib/io.mjs",
  "lib/results.mjs", "lib/orchestrate.mjs", "lib/approval.mjs", "lib/preflight.mjs", "lib/repository.mjs",
  "lib/ledger.mjs", "lib/observe.mjs", "lib/counted.mjs", "lib/expectations.mjs", "lib/metrics.mjs",
  "lib/import-closure.mjs",
];

export { validateExpectations, P_E_BUDGET };

// Injection is exclusively an offline test seam; production always uses the
// shared runner with all approval, inventory, kit-identity and evidence gates.
export function runPe({ entrypoint, runner = runProbe }) {
  return runner({ probe: "P-E", ticket: 803, probeDirectory: "p-e", entrypoint,
    validate: validateExpectations, files: PROBE_FILES, roles: ROLES,
    evaluate: evaluateProbe, retainProcesses: true, databaseScratch: true });
}
