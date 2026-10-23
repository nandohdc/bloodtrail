// A probe session in two passes, under the frozen deadline. Each pass runs its units in order; a unit is one
// role exchange (a fresh ingress and a fresh sender). The small pass must match every one of its frozen
// cases before the volume pass starts (Q19); otherwise the volume pass does not run and its cases observe
// nothing. Observations are keyed by unit name under `key` ("passes" or "phases").
//
// A halted session starts no unit: once the deadline fired or the session failed, no role may be spawned,
// so nothing sends traffic after an S2 stop and nothing writes while scratch is deleted. There is no await
// between the check and a unit's first spawn, and roleExchange asks again before it spawns the sender.
// Once a unit has completed, every completed unit's observations travel with a later failure, so the spent
// run keeps them; the call count is then unknown and the run is entered at its call bound.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { withDeadline } from "./deadline.mjs";
import { scheduledFaultPlan } from "./faults.mjs";
import { killAll, roleExchange, stopRoles, withRoleStderr } from "./session.mjs";

export const PASSES = Object.freeze(["small", "volume"]);

// Every started role, named by unit, so a deadline or a failure kills and reports all of them.
export function flatRoles(byUnit) {
  return Object.fromEntries(Object.entries(byUnit).flatMap(([unit, roles]) => Object.entries(roles).map(([name, role]) => [`${unit}_${name}`, role])));
}

// The gate records which small-pass cases mismatched. An evaluator fault closes the gate rather than
// failing the session, so the raw observations are kept; the runner's guarded evaluation then reports it.
export function passGate({ evaluate, observations, expectations }) {
  try {
    const result = evaluate({ observations, expectations, pass: "small" });
    const mismatched = result.evaluations.filter((entry) => !entry.matched).map((entry) => entry.case_id);
    return { small_matched: mismatched.length === 0, small_mismatched: mismatched };
  } catch (error) {
    return { small_matched: false, small_mismatched: null, evaluation_fault: error.message };
  }
}

function startUnit({ context, runUnit, unit }) {
  if (context.halted) throw new Error(`session halted before ${unit.name} started`);
  return runUnit({ context, unit });
}

function occurrenceCount(done) {
  return Object.values(done).filter((observed) => observed !== null).reduce((sum, observed) => sum + observed.occurrence_count, 0);
}

function withSkipped(done, units) {
  return { ...done, ...Object.fromEntries(units.map((unit) => [unit.name, null])) };
}

// What a failure in the next unit leaves: a snapshot of the completed units, every other unit unobserved, so
// a unit that settles after the failure cannot rewrite it.
function snapshot({ context, units, done, gate, key }) {
  if (Object.keys(done).length === 0) return;
  const pending = units.filter((unit) => !Object.hasOwn(done, unit.name));
  context.partial = { [key]: withSkipped({ ...done }, pending), gate, occurrence_count: null };
}

const NOT_JUDGED = Object.freeze({ small_matched: null, small_mismatched: null, volume_pass: "skipped" });

async function runPasses({ context, units, runUnit, evaluate, key }) {
  const [small, volume] = PASSES.map((pass) => units.filter((unit) => unit.pass === pass));
  const done = {};
  for (const unit of small) {
    snapshot({ context, units, done, gate: NOT_JUDGED, key });
    done[unit.name] = await startUnit({ context, runUnit, unit });
  }
  const gate = passGate({ evaluate, observations: { [key]: withSkipped(done, volume) }, expectations: context.expectations });
  if (!gate.small_matched) return { [key]: withSkipped(done, volume), gate: { ...gate, volume_pass: "skipped" }, occurrence_count: occurrenceCount(done) };
  for (const unit of volume) {
    snapshot({ context, units, done, gate: { ...gate, volume_pass: "failed" }, key });
    done[unit.name] = await startUnit({ context, runUnit, unit });
  }
  return { [key]: done, gate: { ...gate, volume_pass: "completed" }, occurrence_count: occurrenceCount(done) };
}

// One unit's exchange: a fresh storage directory and role set under the unit's name, the unit's scheduled
// fault plan, and the probe's sender input for the unit (`senderInput(unit)`). A halt stops the sender's spawn.
export function exchangeUnit({ context, unit, probeDirectory, senderInput }) {
  const { service, storage, flags, expectations, byUnit, token } = context;
  const directory = join(storage, unit.name);
  mkdirSync(directory);
  byUnit[unit.name] = {};
  return roleExchange({
    service, directory, flags, probeDirectory, senderInput: senderInput(unit),
    faultPlan: scheduledFaultPlan({ scenarios: expectations.scenarios, schedule: unit.schedule, cycles: unit.cycles }), roles: byUnit[unit.name], token,
    proceed: () => !context.halted,
  });
}

// `runUnit({ context, unit })` runs one unit, normally through exchangeUnit.
export async function gatedSession({ expectations, units, runUnit, evaluate, key, base = {} }) {
  const byUnit = {};
  const token = randomBytes(24).toString("hex");
  const context = { ...base, expectations, byUnit, token, halted: false };
  const halt = () => {
    context.halted = true;
    killAll(flatRoles(byUnit));
  };
  try {
    return await withDeadline({ ms: expectations.deadline_ms, onTimeout: halt, work: () => runPasses({ context, units, runUnit, evaluate, key }) });
  } catch (error) {
    context.halted = true;
    if (context.partial !== undefined) error.observations = context.partial;
    throw withRoleStderr({ error, roles: flatRoles(byUnit), token });
  } finally {
    await stopRoles(flatRoles(byUnit));
  }
}
