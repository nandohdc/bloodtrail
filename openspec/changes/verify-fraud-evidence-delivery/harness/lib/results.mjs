import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { requireProbe } from "./plan.mjs";

// G42: Stage 2 environment and limits (owner, 2026-10-22).
export const G42 = "https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049";
// G46: the owner's amendment of G42's run limit (2026-10-27).
export const G46 = "https://github.com/nandohdc/bloodtrail/issues/833#issuecomment-6449640834";
export const CHANGE = "openspec/changes/verify-fraud-evidence-delivery";
// Stage 2 shared run limit under G42 as amended by G46.
export const RUN_LIMIT = 16;

function codePointCompare(left, right) {
  const a = Array.from(left, (character) => character.codePointAt(0));
  const b = Array.from(right, (character) => character.codePointAt(0));
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(codePointCompare).map((key) => [key, ordered(value[key])]));
  }
  return value;
}

// Every invalidation has one shape: its message, the S2 stop condition when a stop caused it, and the
// failed roles' bounded stderr when a session attached it.
export function invalidationOf(failure) {
  if (typeof failure === "string") return { message: failure };
  const fields = { message: failure.message, condition: failure.condition, halt_error: failure.halt_error, role_stderr: failure.role_stderr, role_closure_error: failure.role_closure_error, role_closure_confirmed: failure.role_closure_confirmed };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export function serializeResults(value) {
  return JSON.stringify(ordered(value), null, 2) + "\n";
}

function kitIdentity(provenance) {
  const identity = provenance.identity || {};
  return {
    commit: identity.commit || null, package_set_digest: identity.package_set_digest || null,
    manifest_digest: identity.manifest_digest || null, kit_digest: provenance.kit_digest || null,
    distributable: identity.distributable === true, artifacts: identity.artifacts || [],
  };
}

function provenanceFields(provenance) {
  return {
    kit_identity: kitIdentity(provenance), install: provenance.install || null,
    runtime: provenance.runtime || null, environment: provenance.environment || null,
    permission_flags: provenance.permission_flags || [], executed_file_hashes: provenance.executed_file_hashes || {},
    role_files: provenance.role_files || {},
    driver: provenance.driver, scratch_deletion: provenance.scratch_deletion || { not_created: true },
  };
}

// occurrence_count is the sender ledger's exact count, or null when the run failed before the sender
// reported it; call_bound is the planned budget the sender's ledger hard-caps at, so a failed run's G42
// ledger row is never under-reported.
function countWithinBound({ count, bound }) {
  if (count === null) return true;
  return Number.isSafeInteger(count) && count >= 0 && count <= bound;
}

export function resultRecord({ runNumber, approvedHead, approval, expectations, started, ended, provenance, cases, invalidations, occurrenceCount, callBound, probe, ticket }) {
  requireProbe({ probe, ticket });
  assert(Number.isInteger(runNumber) && runNumber >= 1 && runNumber <= RUN_LIMIT, "run number outside shared authorization");
  assert(Number.isFinite(Date.parse(started)) && Date.parse(ended) >= Date.parse(started), "invalid UTC interval");
  assert(Number.isSafeInteger(callBound) && callBound > 0, "call bound must be the planned budget");
  assert(countWithinBound({ count: occurrenceCount, bound: callBound }), "occurrence count outside its bound");
  return {
    probe, run_id: runNumber, started_at: started, ended_at: ended,
    ...provenanceFields(provenance),
    authorization: { reference: `${CHANGE}/proposal.md#run-authorization at ${approvedHead}`, G42, G46 },
    approval, expectations, cases, invalidations, occurrence_count: occurrenceCount, call_bound: callBound,
  };
}

export function deliverResults({ path, result, serialize = serializeResults, write = writeResults, stderr = (text) => process.stderr.write(text) }) {
  try {
    write({ path, result, serialize });
    return true;
  } catch (error) {
    result.invalidations.push(invalidationOf(`results write failed: ${error.message}`));
    stderr(serialize(result));
    return false;
  }
}

export function writeResults({ path, result, serialize = serializeResults }) {
  writeFileSync(path, serialize(result), { encoding: "utf8", flag: "wx" });
}
