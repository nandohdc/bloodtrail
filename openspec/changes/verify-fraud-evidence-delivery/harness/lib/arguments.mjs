import assert from "node:assert/strict";
import { parseArgs } from "node:util";

// G45 is historical. The 2026-10-24 owner addendum permits Codex for #838 and build-only checks.
export const DRIVER_ARGS = ["driver-lane", "driver-model"];
const PIPELINE_ARGS = ["repo", "approved-head", ...DRIVER_ARGS];
export const RUN_ARGS = ["approval-body-file", "approval-url", "approval-created-at", "approval-updated-at", "approval-sha256", "once-marker", "run-number", "results", "window-opened-at"];
export const OPTIONAL_RUN_ARGS = ["expectations-version", "expectations-path"];

export function argumentsFor({ args, run = false, probe, ticket }) {
  const keys = run ? [...PIPELINE_ARGS, ...RUN_ARGS, ...OPTIONAL_RUN_ARGS] : [...PIPELINE_ARGS, ...OPTIONAL_RUN_ARGS];
  const options = Object.fromEntries(keys.map((key) => [key, { type: "string" }]));
  if (!run) options["dry-run"] = { type: "boolean", default: false };
  const { values } = parseArgs({ args, options, strict: true });
  const required = run ? ["approved-head", ...RUN_ARGS, ...DRIVER_ARGS] : DRIVER_ARGS;
  for (const key of required) assert(values[key], `required argument: --${key}`);
  const codex = values["driver-lane"] === "codex" && (!run || (probe === "S2-load" && ticket === 838));
  assert(codex || values["driver-lane"] === "claude-code", "Stage 2 requires the Claude Code lane (G45), except the owner-authorized #838 Codex lane");
  if (values["expectations-version"]) {
    assert(values["expectations-version"] !== "latest", "never discover expectations version 'latest' dynamically");
    const parsed = Number(values["expectations-version"]);
    assert(Number.isSafeInteger(parsed) && parsed > 0, "expectations-version must be a positive integer");
  }
  return {
    ...values, repo: values.repo, approvedHead: values["approved-head"], dryRun: values["dry-run"],
    driver: { lane: values["driver-lane"], model: values["driver-model"] },
    expectationsVersion: values["expectations-version"] ? Number(values["expectations-version"]) : undefined,
    expectationsPath: values["expectations-path"],
  };
}
