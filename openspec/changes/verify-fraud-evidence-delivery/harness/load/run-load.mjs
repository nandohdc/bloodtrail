// APPROVAL-GATED entry for the Stage 2 load probe (#838). Build-only tasks never execute this file: it runs
// once per exact-head S1 approval (G44), within the shared G42 limits.
import { runProbe } from "../lib/probe-runner.mjs";
import { validateExpectations } from "./expectations.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { PROBE_FILES } from "./files.mjs";
import { loadSession } from "./session.mjs";

const session = await runProbe({
  probe: "S2-load", ticket: 838, probeDirectory: "load", entrypoint: import.meta.url,
  expectationsVersion: 2, supportedVersions: [1, 2],
  validate: validateExpectations, files: PROBE_FILES, session: loadSession, evaluate: evaluateCases,
});
process.exitCode = session.exitCode;
