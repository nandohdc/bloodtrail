import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

export const G38 = "https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6219739604";
export const CHANGE = "openspec/changes/verify-fraud-evidence-sufficiency";

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
    driver: provenance.driver, scratch_deletion: provenance.scratch_deletion || { not_created: true },
  };
}

export function resultRecord({ runNumber, approvedHead, approval, expectations, started, ended, provenance, cases, invalidations, occurrenceCount }) {
  assert(Number.isInteger(runNumber) && runNumber >= 1 && runNumber <= 10, "run number outside shared authorization");
  assert(Number.isFinite(Date.parse(started)) && Date.parse(ended) >= Date.parse(started), "invalid UTC interval");
  return {
    probe: "P-ids", run_id: runNumber, started_at: started, ended_at: ended,
    ...provenanceFields(provenance),
    authorization: { reference: `${CHANGE}/proposal.md#run-authorization at ${approvedHead}`, G38 },
    approval, expectations, cases, invalidations, occurrence_count: occurrenceCount,
  };
}

export function deliverResults({ path, result, write = writeResults, stderr = (text) => process.stderr.write(text) }) {
  try {
    write({ path, result });
    return true;
  } catch (error) {
    result.invalidations.push(`results write failed: ${error.message}`);
    stderr(serializeResults(result));
    return false;
  }
}

export function writeResults({ path, result }) {
  writeFileSync(path, serializeResults(result), { encoding: "utf8", flag: "wx" });
}
