// The files copied into the own service for the chains probe's two role processes, relative to harness/.
// The runner checks before any approval is spent that each role script's relative import closure is inside
// this list, and that every copied byte equals its blob at the approved head.
import { PROBE_FILES as TRACER_FILES } from "../tracer/files.mjs";

export const PROBE_FILES = Object.freeze([
  "chains/sender-process.mjs",
  "chains/ingress-process.mjs",
  "chains/sender-phases.mjs",
  "chains/ingress-role.mjs",
  "chains/observations.mjs",
  "chains/workload.mjs",
  "chains/controls.mjs",
  "chains/evaluate.mjs",
  "chains/observers-chain.mjs",
  "chains/observers-source.mjs",
  "chains/observers-failed.mjs",
  "chains/observers-identity.mjs",
  "chains/observer-predicates.mjs",
  "chains/call-plan.mjs",
  "chains/reconstruct.mjs",
  "copies/session.mjs",
  "copies/evaluate.mjs",
  "copies/observations.mjs",
  "copies/ingress-role.mjs",
  "copies/restart.mjs",
  "copies/sender-phases.mjs",
  "copies/call-plan.mjs",
  "copies/controls.mjs",
  "copies/consumer-restart.mjs",
  "copies/workload.mjs",
  "lib/accounting.mjs",
  ...TRACER_FILES.filter((path) => !path.startsWith("tracer/")),
]);
