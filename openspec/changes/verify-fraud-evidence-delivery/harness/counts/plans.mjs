// Frozen references are checked before any role can send traffic. No fault rules are copied here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../lib/io.mjs";
import { expandSchedule } from "../lib/faults.mjs";

const ROOT = new URL("../expectations/", import.meta.url);
export const PLAN_FILES = Object.freeze(["outages.v1.json", "load.v2.json", "copies.v2.json"]);
const VERIFIED = new WeakMap();
const HASHES = new WeakMap();

export function referenceFiles(expectations, read) {
  if (read !== undefined) return verifyReferences(expectations, read);
  return VERIFIED.get(expectations) ?? verifyReferences(expectations);
}

export function readPlanFile(file) {
  assert(PLAN_FILES.includes(file), "unrecognized fault-plan file");
  return readFileSync(new URL(file, ROOT));
}

function inventory(file, frozen) {
  if (file === "outages.v1.json") return Object.keys(frozen.scenarios);
  return frozen.phases.map((phase) => phase.name);
}

export function verifyReferences(expectations, read = readPlanFile) {
  const verified = {};
  const hashes = {};
  for (const file of PLAN_FILES) {
    const bytes = read(file);
    const frozen = JSON.parse(bytes);
    const entries = expectations.plans.filter((plan) => plan.file === file);
    assert.deepEqual(entries.map((plan) => plan.id), inventory(file, frozen), `incomplete plan inventory: ${file}`);
    hashes[file] = sha256(bytes);
    entries.forEach((plan) => assert.equal(hashes[file], plan.sha256, `fault-plan hash mismatch: ${file}/${plan.id}`));
    verified[file] = frozen;
  }
  VERIFIED.set(expectations, verified);
  HASHES.set(verified, hashes);
  return verified;
}

export function referencedPlan(reference, files) {
  const frozen = files[reference.file];
  if (reference.file !== "outages.v1.json") return frozen.phases.find((phase) => phase.name === reference.id);
  const volume = frozen.passes.find((pass) => pass.name === "volume");
  return {
    kind: "outage", pass: "small", composition: frozen.composition,
    occurrences: expandSchedule(volume).filter((id) => id === reference.id).length,
    schedule: [reference.id], cycles: 1, after_shutdown: 0,
  };
}

export function resolvePhase({ expectations, phase, files }) {
  const reference = expectations.plans.find((plan) => plan.phase === phase.name);
  const frozen = files[reference.file];
  const original = referencedPlan(reference, files);
  const schedule = expandSchedule(original);
  const expanded = Array.from({ length: phase.occurrences }, (_, index) => schedule[index % schedule.length]);
  return {
    ...phase, kind: original.kind, composition: original.composition,
    shutdown: original.shutdown, after_shutdown: original.after_shutdown ?? 0,
    schedule: expanded, cycles: 1,
    reference, hash_verified: HASHES.get(files)?.[reference.file] === reference.sha256, scenarios: frozen.scenarios,
  };
}

export function plannedCalls(phase) {
  return 11 * phase.chain_count + phase.failed_count + phase.extra_call_bound;
}
