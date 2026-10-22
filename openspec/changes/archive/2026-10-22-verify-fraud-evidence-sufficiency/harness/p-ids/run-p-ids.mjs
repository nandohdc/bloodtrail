// FUTURE approval-gated entry. Build-only tasks must never execute this file.
import { runProbe } from "../lib/probe-runner.mjs";
import { validateExpectations } from "../lib/expectations.mjs";
import { PROBE_FILES, ROLES } from "./roles.mjs";
import { evaluateCases } from "./evaluate.mjs";

const session = await runProbe({ probe: "P-ids", ticket: 800, probeDirectory: "p-ids", entrypoint: import.meta.url, validate: validateExpectations, files: PROBE_FILES, roles: ROLES, evaluate: evaluateCases });
process.exitCode = session.exitCode;
