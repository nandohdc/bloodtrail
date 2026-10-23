import assert from "node:assert/strict";
import { parseArgs } from "node:util";

// G45: the orchestrator (Claude Code) authors and runs Stage 2; provenance records that lane.
export const DRIVER_ARGS = ["driver-lane", "driver-model"];
const PIPELINE_ARGS = ["repo", "approved-head", ...DRIVER_ARGS];
export const RUN_ARGS = ["approval-body-file", "approval-url", "approval-created-at", "approval-updated-at", "approval-sha256", "once-marker", "run-number", "results", "window-opened-at"];

export function argumentsFor({ args, run = false }) {
  const keys = run ? [...PIPELINE_ARGS, ...RUN_ARGS] : PIPELINE_ARGS;
  const options = Object.fromEntries(keys.map((key) => [key, { type: "string" }]));
  if (!run) options["dry-run"] = { type: "boolean", default: false };
  const { values } = parseArgs({ args, options, strict: true });
  const required = run ? ["approved-head", ...RUN_ARGS, ...DRIVER_ARGS] : DRIVER_ARGS;
  for (const key of required) assert(values[key], `required argument: --${key}`);
  assert.equal(values["driver-lane"], "claude-code", "Stage 2 is driven by the Claude Code lane (G45)");
  return {
    ...values, repo: values.repo, approvedHead: values["approved-head"], dryRun: values["dry-run"],
    driver: { lane: values["driver-lane"], model: values["driver-model"] },
  };
}
