import { PROBE_FILES as CHAINS_FILES } from "../chains/files.mjs";

export const PROBE_FILES = Object.freeze([
  ...CHAINS_FILES,
  "counts/sender-process.mjs", "counts/ingress-process.mjs", "counts/sender-phases.mjs", "counts/ingress-role.mjs",
  "counts/engine.mjs", "counts/deliveries.mjs", "counts/phases.mjs", "counts/workload.mjs", "counts/environment.mjs", "counts/observations.mjs",
  "lib/runtime-facts.mjs", "load/burst.mjs",
]);
