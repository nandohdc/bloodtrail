// FUTURE approval-gated entry. Task 2.1 never executes this runner or a probe.
import { runProbe } from "../lib/probe-runner.mjs";
import { validateExpectations } from "./expectations.mjs";
import { PROBE_FILES, ROLES } from "./roles.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { serializeMarkerResults } from "./serialize.mjs";

const session = await runProbe({ probe: "P-D", ticket: 801, probeDirectory: "p-d", entrypoint: import.meta.url, validate: validateExpectations, files: PROBE_FILES, roles: ROLES, evaluate: evaluateCases, retainProcesses: true, serialize: serializeMarkerResults });
process.exitCode = session.exitCode;
