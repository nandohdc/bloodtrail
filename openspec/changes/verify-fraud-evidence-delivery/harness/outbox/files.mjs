// The files copied into the own service for the outbox probe's two role processes, relative to harness/.
// The runner checks before any approval is spent that each role script's relative import closure is inside
// this list, and that every copied byte equals its blob at the approved head.
import { PROBE_FILES as TRACER_FILES } from "../tracer/files.mjs";

export const PROBE_FILES = Object.freeze([
  "outbox/sender-process.mjs",
  "outbox/ingress-process.mjs",
  "outbox/sender-phases.mjs",
  "outbox/ingress-role.mjs",
  "outbox/host.mjs",
  "outbox/host-execution.mjs",
  "outbox/phase-relay.mjs",
  "outbox/observer-access.mjs",
  "outbox/observer-accounting.mjs",
  "outbox/observer-dedup.mjs",
  "outbox/relay.mjs",
  "outbox/workload.mjs",
  "outbox/call-plan.mjs",
  "outbox/controls.mjs",
  "outbox/observations.mjs",
  "outbox/evaluate.mjs",
  "outbox/observers-atomicity.mjs",
  "outbox/observers-identity.mjs",
  "outbox/observer-predicates.mjs",
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
