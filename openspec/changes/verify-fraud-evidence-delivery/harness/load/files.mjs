// The files copied into the own service for the load probe's two role processes, relative to harness/. Its
// sender is its own, with its workload; its ingress loads the tracer's, so the inventory is the tracer's
// without the tracer's sender. The runner checks before any
// approval is spent that each role script's relative import closure is inside this list, and that every
// copied byte equals its blob at the approved head.
import { PROBE_FILES as TRACER_FILES } from "../tracer/files.mjs";

export const PROBE_FILES = Object.freeze([
  "load/sender-process.mjs", "load/ingress-process.mjs", "load/workload.mjs", "load/burst.mjs", "load/controls.mjs", "load/evaluate.mjs",
  "lib/accounting.mjs", "lib/evaluation.mjs", ...TRACER_FILES.filter((path) => path !== "tracer/sender-process.mjs"),
]);
