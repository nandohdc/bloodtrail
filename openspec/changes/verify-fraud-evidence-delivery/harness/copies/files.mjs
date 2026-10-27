// The files copied into the own service for the copies probe's two role processes, relative to harness/.
// The runner checks before any approval is spent that each role script's relative import closure is inside
// this list, and that every copied byte equals its blob at the approved head.
import { PROBE_FILES as TRACER_FILES } from "../tracer/files.mjs";

export const PROBE_FILES = Object.freeze([
  "copies/sender-process.mjs",
  "copies/ingress-process.mjs",
  "copies/workload.mjs",
  "copies/controls.mjs",
  ...TRACER_FILES.filter((path) => !path.startsWith("tracer/")),
]);
