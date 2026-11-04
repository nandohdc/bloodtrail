// Approval gated: build and self-tests never execute this entry point. Same v1 for slots 10–12.
import { runProbe } from "../lib/probe-runner.mjs";
import { validateExpectations } from "./expectations.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { PROBE_FILES } from "./files.mjs";
import { countsSession } from "./session.mjs";

const session = await runProbe({
  probe: "S2-counts", ticket: 841, probeDirectory: "counts", entrypoint: import.meta.url,
  expectationsVersion: 1, supportedVersions: [1],
  validate: validateExpectations, files: PROBE_FILES, session: countsSession, evaluate: evaluateCases,
});
process.exitCode = session.exitCode;
