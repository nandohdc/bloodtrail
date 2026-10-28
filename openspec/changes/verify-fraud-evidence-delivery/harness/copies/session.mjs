// Orchestrator side of the copies session (#839).
// Sequences the units in two passes (small pass and volume pass) under the frozen deadline.
import { exchangeUnit, gatedSession } from "../lib/gated-session.mjs";
import { evaluateCases } from "./evaluate.mjs";

export function senderInput({ expectations, phase }) {
  return {
    contract_version: expectations.contract_version,
    clock: expectations.clock,
    workload: { seed: expectations.workload.seed },
    composition: phase.composition,
    phase: {
      name: phase.name,
      kind: phase.kind,
      occurrences: phase.occurrences,
      gate_timers: phase.gate_timers ?? false,
      schedule: phase.schedule,
      cycles: phase.cycles,
      distinct_occurrences: phase.distinct_occurrences,
    },
    planned_call_budget: {
      processes: {
        sender: expectations.planned_call_budget.processes[phase.name],
      },
    },
  };
}

export function exchangeCopiesUnit({ context, unit, senderInput: makeSenderInput }) {
  const afterSenderStart = unit.kind === "collector_restart"
    ? async ({ roles }) => {
        await roles.sender.next("request_ingress_restart", "sender");
        roles.ingress.send({ type: "restart" });
        const restarted = await roles.ingress.next("restarted", "ingress");
        roles.sender.send({ type: "ingress_restarted", port: restarted.port });
      }
    : undefined;

  return exchangeUnit({
    context,
    unit,
    probeDirectory: "copies",
    senderInput: makeSenderInput,
    ingressOptions: { without_storage: unit.kind === "storage_less" },
    afterSenderStart,
  });
}

export function copiesSession({ service, storage, flags, expectations, exchange = exchangeCopiesUnit, spawn }) {
  return gatedSession({
    expectations,
    units: expectations.phases,
    evaluate: evaluateCases,
    key: "phases",
    base: { service, storage, flags, ...(spawn !== undefined ? { spawn } : {}) },
    runUnit: ({ context, unit }) => exchange({
      context,
      unit,
      senderInput: (u) => senderInput({ expectations: context.expectations, phase: u }),
    }),
  });
}
