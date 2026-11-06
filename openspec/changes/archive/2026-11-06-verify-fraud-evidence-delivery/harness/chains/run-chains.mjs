// APPROVAL-GATED entry for the Stage 2 chains probe (#840). Build-only tasks never execute this file: it
// runs once per exact-head S1 approval (G44), within the shared G42 limits.
import { runProbe } from "../lib/probe-runner.mjs";
import { validateExpectations } from "./expectations.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { PROBE_FILES } from "./files.mjs";
import { chainsSession } from "./session.mjs";

const session = await runProbe({
  probe: "S2-chains",
  ticket: 840,
  probeDirectory: "chains",
  entrypoint: import.meta.url,
  expectationsVersion: 1,
  supportedVersions: [1],
  validate: validateExpectations,
  files: PROBE_FILES,
  session: chainsSession,
  evaluate: evaluateCases,
});
process.exitCode = session.exitCode;
