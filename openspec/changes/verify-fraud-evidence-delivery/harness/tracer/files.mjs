// The files copied into the own service for the tracer's two role processes, relative to harness/. The
// runner checks before any approval is spent that each role script's relative import closure is inside
// this list, and that every copied byte equals its blob at the approved head.
export const PROBE_FILES = Object.freeze([
  "tracer/sender-process.mjs",
  "tracer/ingress-process.mjs",
  "tracer/workload.mjs",
  "lib/clock.mjs",
  "lib/composition.mjs",
  "lib/controls.mjs",
  "lib/faults.mjs",
  "lib/ingress.mjs",
  "lib/io.mjs",
  "lib/ledger.mjs",
  "lib/loopback-guard.mjs",
  "lib/role-guard.mjs",
  "lib/workload.mjs",
]);
