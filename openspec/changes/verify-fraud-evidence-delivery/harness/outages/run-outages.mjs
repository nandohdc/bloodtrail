// APPROVAL-GATED entry for the Stage 2 outages probe (#837). Build-only tasks never execute this file: it
// runs once per exact-head S1 approval (G44), within the shared G42 limits.
import { runProbe } from "../lib/probe-runner.mjs";
import { validateExpectations } from "./expectations.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { PROBE_FILES } from "./files.mjs";
import { outagesSession } from "./session.mjs";

const session = await runProbe({
  probe: "S2-outages", ticket: 837, probeDirectory: "outages", entrypoint: import.meta.url,
  validate: validateExpectations, files: PROBE_FILES, session: outagesSession, evaluate: evaluateCases,
});
process.exitCode = session.exitCode;
