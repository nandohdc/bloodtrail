// Orchestrator side of the outbox session (#842, Q244, Q247, Q253).
// Sequences the units in two passes (small pass and volume pass) under the frozen deadline.
import { exchangeUnit, gatedSession } from "../lib/gated-session.mjs";
import { senderInput as baseSenderInput } from "../copies/session.mjs";
import { evaluateCases } from "./evaluate.mjs";

export function senderInput({ expectations, phase, hostDatabase }) {
  const base = baseSenderInput({ expectations, phase });
  return {
    ...base,
    host_database: hostDatabase,
    control_phase: expectations.phases.find((p) => p.kind === "crash_restart"),
    control_case: expectations.cases.find((c) => c.observer === "crash_persistence_identity"),
    phase: {
      ...base.phase,
      change_count: phase.change_count,
      crash_after_acknowledgment: phase.crash_after_acknowledgment,
    },
  };
}

export function outboxSession({
  service,
  storage,
  hostDatabase,
  flags,
  expectations,
  exchange = exchangeUnit,
  spawn,
}) {
  return gatedSession({
    expectations,
    units: expectations.phases,
    evaluate: evaluateCases,
    key: "phases",
    base: { service, storage, hostDatabase, flags, ...(spawn !== undefined ? { spawn } : {}) },
    runUnit: ({ context, unit }) => exchange({
      context,
      unit,
      probeDirectory: "outbox",
      senderInput: (u) => senderInput({
        expectations: context.expectations,
        phase: u,
        hostDatabase: context.hostDatabase,
      }),
    }),
  });
}
