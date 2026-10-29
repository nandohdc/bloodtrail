// APPROVAL-GATED entry for the Stage 2 outbox probe (#842). Build-only tasks never execute this file: it
// runs once per exact-head S1 approval (G44), within the shared G42 limits.
import { runProbe } from "../lib/probe-runner.mjs";
import { validateExpectations } from "./expectations.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { PROBE_FILES } from "./files.mjs";
import { outboxSession } from "./session.mjs";

const session = await runProbe({
  probe: "S2-outbox",
  ticket: 842,
  probeDirectory: "outbox",
  entrypoint: import.meta.url,
  expectationsVersion: 1,
  supportedVersions: [1],
  hostDatabase: true,
  validate: validateExpectations,
  files: PROBE_FILES,
  session: outboxSession,
  evaluate: evaluateCases,
});
process.exitCode = session.exitCode;
