// Orchestrator side of the outages session (#837), under the frozen deadline. Each frozen pass is one
// exchange between a fresh ingress, with its own SQLite file and the pass's scheduled fault plan, and a fresh
// sender. The small pass must match every one of its frozen cases before the volume pass starts (Q19);
// otherwise the volume pass does not run and its cases observe nothing. If the volume pass fails, the
// completed small pass's observations travel with the failure, so the spent run keeps them.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { withDeadline } from "../lib/deadline.mjs";
import { scheduledFaultPlan } from "../lib/faults.mjs";
import { killAll, roleExchange, stopRoles, withRoleStderr } from "../lib/session.mjs";
import { evaluateCases } from "./evaluate.mjs";

// The tracer's sender reads only these fields, so each pass hands it a view with that pass's occurrences
// and call budget.
export function senderInput({ expectations, pass }) {
  return {
    contract_version: expectations.contract_version, clock: expectations.clock, composition: expectations.composition,
    workload: { seed: expectations.workload.seed, occurrences: pass.occurrences },
    planned_call_budget: { processes: { sender: expectations.planned_call_budget.processes[pass.name] } },
  };
}

// Every started role, named by pass, so a deadline or a failure kills and reports all of them.
export function flatRoles(byPass) {
  return Object.fromEntries(Object.entries(byPass).flatMap(([pass, roles]) => Object.entries(roles).map(([name, role]) => [`${pass}_${name}`, role])));
}

async function runPass({ context, pass }) {
  const { service, storage, flags, expectations, byPass, token } = context;
  const directory = join(storage, pass.name);
  mkdirSync(directory);
  byPass[pass.name] = {};
  return roleExchange({
    service, directory, flags, probeDirectory: "outages", senderInput: senderInput({ expectations, pass }),
    faultPlan: scheduledFaultPlan({ scenarios: expectations.scenarios, schedule: pass.schedule, cycles: pass.cycles }), roles: byPass[pass.name], token,
    proceed: () => !context.halted,
  });
}

// The gate records which small-pass cases mismatched. An evaluator fault closes the gate rather than
// failing the session, so the raw observations are kept; the runner's guarded evaluation then reports it.
export function smallPassGate({ passes, expectations }) {
  try {
    const result = evaluateCases({ observations: { passes }, expectations, pass: "small" });
    const mismatched = result.evaluations.filter((entry) => !entry.matched).map((entry) => entry.case_id);
    return { small_matched: mismatched.length === 0, small_mismatched: mismatched };
  } catch (error) {
    return { small_matched: false, small_mismatched: null, evaluation_fault: error.message };
  }
}

// A halted session starts no pass: once the deadline fired or the session failed, no role may be spawned,
// so nothing sends traffic after an S2 stop and nothing writes while scratch is deleted. There is no await
// between this check and the pass's first spawn, and roleExchange asks again before it spawns the sender.
function startPass({ context, exchange, pass }) {
  if (context.halted) throw new Error(`session halted before the ${pass.name} pass started`);
  return exchange({ context, pass });
}

async function runPasses(context, exchange) {
  const [small, volume] = context.expectations.passes;
  const passes = { small: await startPass({ context, exchange, pass: small }), volume: null };
  const gate = smallPassGate({ passes, expectations: context.expectations });
  if (!gate.small_matched) return { passes, gate: { ...gate, volume_pass: "skipped" }, occurrence_count: passes.small.occurrence_count };
  // The volume sender's calls are unknown if it fails, so the run is then entered at its call bound. The
  // record is a snapshot: a volume exchange that settles after the failure cannot rewrite it.
  context.partial = { passes: { small: passes.small, volume: null }, gate: { ...gate, volume_pass: "failed" }, occurrence_count: null };
  passes.volume = await startPass({ context, exchange, pass: volume });
  return { passes, gate: { ...gate, volume_pass: "completed" }, occurrence_count: passes.small.occurrence_count + passes.volume.occurrence_count };
}

// `exchange` runs one pass; self-tests inject a fixture in place of the role processes.
export async function outagesSession({ service, storage, flags, expectations, exchange = runPass }) {
  const byPass = {};
  const token = randomBytes(24).toString("hex");
  const context = { service, storage, flags, expectations, byPass, token, halted: false };
  const halt = () => {
    context.halted = true;
    killAll(flatRoles(byPass));
  };
  try {
    return await withDeadline({ ms: expectations.deadline_ms, onTimeout: halt, work: () => runPasses(context, exchange) });
  } catch (error) {
    context.halted = true;
    if (context.partial !== undefined) error.observations = context.partial;
    throw withRoleStderr({ error, roles: flatRoles(byPass), token });
  } finally {
    await stopRoles(flatRoles(byPass));
  }
}
