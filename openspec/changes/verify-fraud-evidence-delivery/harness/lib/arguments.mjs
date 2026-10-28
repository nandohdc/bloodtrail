import assert from "node:assert/strict";
import { parseArgs } from "node:util";

// Probe runs require the Claude Code lane (G46 Q94). Codex is accepted only for build-only checks; runs 3 and 4 recorded lane codex under the owner's 2026-10-24 addendum for #838.
export const DRIVER_ARGS = ["driver-lane", "driver-model"];
const PIPELINE_ARGS = ["repo", "approved-head", ...DRIVER_ARGS];
export const RUN_ARGS = ["approval-body-file", "approval-url", "approval-created-at", "approval-updated-at", "approval-sha256", "once-marker", "run-number", "results", "window-opened-at"];
export const OPTIONAL_RUN_ARGS = [
  "expectations-version",
  "expectations-path",
  "disposition-body-file",
  "disposition-url",
  "disposition-sha256",
  "disposition-created-at",
  "disposition-updated-at",
];

function validateDriverLane(lane, { run }) {
  const codex = lane === "codex" && !run;
  assert(codex || lane === "claude-code", "Stage 2 probe runs require the Claude Code lane (G46 Q94); Codex is accepted only for build-only checks");
}

function parseExpectationsVersion(raw) {
  if (!raw) return undefined;
  assert(raw !== "latest", "never discover expectations version 'latest' dynamically");
  const parsed = Number(raw);
  assert(Number.isSafeInteger(parsed) && parsed > 0, "expectations-version must be a positive integer");
  return parsed;
}

export function argumentsFor({ args, run = false }) {
  const keys = run ? [...PIPELINE_ARGS, ...RUN_ARGS, ...OPTIONAL_RUN_ARGS] : [...PIPELINE_ARGS, ...OPTIONAL_RUN_ARGS];
  const options = Object.fromEntries(keys.map((key) => [key, { type: "string" }]));
  if (!run) options["dry-run"] = { type: "boolean", default: false };
  const { values } = parseArgs({ args, options, strict: true });
  const required = run ? ["approved-head", ...RUN_ARGS, ...DRIVER_ARGS] : DRIVER_ARGS;
  for (const key of required) assert(values[key], `required argument: --${key}`);
  validateDriverLane(values["driver-lane"], { run });
  const expectationsVersion = parseExpectationsVersion(values["expectations-version"]);
  return {
    ...values, repo: values.repo, approvedHead: values["approved-head"], dryRun: values["dry-run"],
    driver: { lane: values["driver-lane"], model: values["driver-model"] },
    expectationsVersion,
    expectationsPath: values["expectations-path"],
  };
}
