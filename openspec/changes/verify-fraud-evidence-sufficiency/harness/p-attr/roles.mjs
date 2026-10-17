import { runProbe } from "../lib/probe-runner.mjs";
import { evaluateProbe } from "./evaluate.mjs";
import { validateExpectations } from "./expectations-validate.mjs";
import { DECLARED_PAIRS, P_ATTR_BUDGET } from "./linkage-cases.mjs";

export const ROLES = [{ role: "matrix" }];
// Explicit approved-file inventory: child closure plus parent/evaluator modules.
// Shared preflight additionally checks EVERY tracked harness Git blob.
export const PROBE_FILES = [
  "p-attr/probe-process.mjs", "p-attr/run-p-attr.mjs", "p-attr/roles.mjs", "p-attr/workload.mjs",
  "p-attr/runtime.mjs", "p-attr/baselines.mjs", "p-attr/keying.mjs", "p-attr/origins.mjs",
  "p-attr/carrier-workload.mjs", "p-attr/af-cases.mjs", "p-attr/af-inputs.mjs", "p-attr/af-controls.mjs",
  "p-attr/as-cases.mjs", "p-attr/as-inputs.mjs", "p-attr/request-cases.mjs", "p-attr/request-inputs.mjs",
  "p-attr/axes.mjs", "p-attr/policy.mjs", "p-attr/comparison.mjs", "p-attr/observations.mjs", "p-attr/evaluate.mjs",
  "p-attr/linkage-cases.mjs", "p-attr/linkage-prepare.mjs", "p-attr/linkage-workload.mjs",
  "p-attr/linkage-analysis.mjs", "p-attr/linkage-metrics.mjs", "p-attr/linkage-expectations.mjs",
  "p-attr/expectations-validate.mjs", "p-attr/expected-targets.mjs", "p-attr/verdict.mjs",
  "lib/probe-runner.mjs", "lib/plan.mjs", "lib/arguments.mjs", "lib/kit-pipeline.mjs", "lib/identity.mjs",
  "lib/install.mjs", "lib/runtime-facts.mjs", "lib/launcher.mjs", "lib/io.mjs", "lib/results.mjs",
  "lib/orchestrate.mjs", "lib/approval.mjs", "lib/preflight.mjs", "lib/repository.mjs",
  "lib/ledger.mjs", "lib/observe.mjs", "lib/counted.mjs", "lib/expectations.mjs", "lib/metrics.mjs",
];

export { validateExpectations, DECLARED_PAIRS, P_ATTR_BUDGET };

// Injection is exclusively an offline test seam; production always uses the
// shared runner with all approval, inventory, kit-identity and evidence gates.
export function runAttr({ entrypoint, runner = runProbe }) {
  return runner({ probe: "P-attr", ticket: 802, probeDirectory: "p-attr", entrypoint,
    validate: validateExpectations, files: PROBE_FILES, roles: ROLES,
    evaluate: evaluateProbe, retainProcesses: true });
}
