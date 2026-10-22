import assert from "node:assert/strict";
import { parseArgs } from "node:util";

export const DRIVER_ARGS = ["driver-run-id", "driver-harness", "driver-provider", "driver-model", "driver-thinking"];
const PIPELINE_ARGS = ["repo", "approved-head", ...DRIVER_ARGS];
export const RUN_ARGS = ["approval-body-file", "approval-url", "approval-created-at", "approval-updated-at", "approval-sha256", "once-marker", "run-number", "results", "window-opened-at"];

export function argumentsFor({ args, run = false }) {
  const keys = run ? [...PIPELINE_ARGS, ...RUN_ARGS] : PIPELINE_ARGS;
  const options = Object.fromEntries(keys.map((key) => [key, { type: "string" }]));
  if (!run) options["dry-run"] = { type: "boolean", default: false };
  const { values } = parseArgs({ args, options, strict: true });
  const required = run ? ["approved-head", ...RUN_ARGS, ...DRIVER_ARGS] : DRIVER_ARGS;
  for (const key of required) assert(values[key], `required argument: --${key}`);
  assert.equal(values["driver-harness"], "pi");
  return { ...values, repo: values.repo, approvedHead: values["approved-head"], dryRun: values["dry-run"], driver: Object.fromEntries(DRIVER_ARGS.map((key) => [key.slice(7).replaceAll("-", "_"), values[key]])) };
}
