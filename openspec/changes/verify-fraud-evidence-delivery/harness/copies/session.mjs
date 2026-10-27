// Orchestrator side of the copies session (#839).
// Sequences the units in two passes (small pass and volume pass) under the frozen deadline.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { scheduledFaultPlan } from "../lib/faults.mjs";
import { gatedSession } from "../lib/gated-session.mjs";
import { assertResolution, spawnRole } from "../lib/launcher.mjs";
import { roleProcessPath } from "../lib/plan.mjs";
import { OWNERS } from "../lib/session.mjs";
import { evaluateCases } from "./evaluate.mjs";

function checkResolutions({ service, resolved }) {
  for (const url of Object.values(resolved)) assertResolution({ service, resolved: url });
}

async function stopRole(name, role) {
  role.send({ type: "stop" });
  await role.next("stopped", name);
  const closed = await role.whenClosed();
  assert.equal(closed.code, 0, `${name} must close cleanly`);
  return closed;
}

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
    },
    planned_call_budget: {
      processes: {
        sender: expectations.planned_call_budget.processes[phase.name],
      },
    },
  };
}

export async function exchangeCopiesUnit({ context, unit, senderInput }) {
  const { service, storage, flags, expectations, byUnit, token } = context;
  const directory = join(storage, unit.name);
  mkdirSync(directory, { recursive: true });
  byUnit[unit.name] = {};
  const roles = byUnit[unit.name];
  const script = (role) => roleProcessPath({ prefix: join(service, "harness"), probeDirectory: "copies", role });

  roles.ingress = spawnRole({ service, script: script("ingress"), flags: flags.ingress });
  roles.ingress.send({
    type: "start",
    token,
    fault_plan: scheduledFaultPlan({ scenarios: expectations.scenarios, schedule: unit.schedule, cycles: unit.cycles }),
    storage_directory: directory,
    owners: OWNERS,
    without_storage: unit.without_storage ?? false,
  });
  const ready = await roles.ingress.next("ready", "ingress");
  checkResolutions({ service, resolved: ready.resolved });
  if (context.halted) throw new Error("session halted before the sender started");

  roles.sender = spawnRole({ service, script: script("sender"), flags: flags.sender });
  roles.sender.send({
    type: "start",
    expectations: senderInput(unit),
    origin: `http://127.0.0.1:${ready.port}`,
    token,
    port: ready.port,
  });

  if (unit.collector_restart) {
    await roles.sender.next("request_ingress_restart", "sender");
    roles.ingress.send({
      type: "restart",
      fault_plan: scheduledFaultPlan({ scenarios: expectations.scenarios, schedule: unit.schedule, cycles: unit.cycles }),
    });
    const restarted = await roles.ingress.next("restarted", "ingress");
    roles.sender.send({ type: "ingress_restarted", port: restarted.port });
  }

  const report = await roles.sender.next("report", "sender");
  checkResolutions({ service, resolved: report.resolved });
  const senderClosed = await stopRole("sender", roles.sender);
  roles.ingress.send({ type: "finalize" });
  const back = await roles.ingress.next("read_back", "ingress");
  assert.equal(back.quiescent, true, "final read-back requires ingress quiescence");
  const ingressClosed = await stopRole("ingress", roles.ingress);
  const { type: _ready, ...ingress } = ready;
  const { type: _report, ...sender } = report;
  return {
    ingress: { ...ingress, records: back.records, read_back: back.read_back, quiescent: back.quiescent },
    sender,
    role_closure: { sender: senderClosed, ingress: ingressClosed },
    occurrence_count: report.ledger.occurrence_count,
  };
}

export function copiesSession({ service, storage, flags, expectations, exchange = exchangeCopiesUnit }) {
  return gatedSession({
    expectations,
    units: expectations.phases,
    evaluate: evaluateCases,
    key: "phases",
    base: { service, storage, flags },
    runUnit: ({ context, unit }) => exchange({
      context,
      unit,
      senderInput: (u) => senderInput({ expectations: context.expectations, phase: u }),
    }),
  });
}
