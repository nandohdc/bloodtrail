import { atPath } from "./comparison.mjs";
import { analysisFor, byIdMap, difference } from "./observations.mjs";
import { evaluateVerdict } from "./verdict.mjs";
import { compareLinkageExpectations } from "./linkage-expectations.mjs";

const OUTCOME_FIELDS = ["kind", "accepted", "diagnostic", "sink_count", "frozen"];
const AXES_FIELDS = ["provenance_ambiguity", "in_occurrence_flag", "resource_rule", "meaning_misuse",
  "discloses_existence", "per_target_grouping", "ambiguous_fields", "allowed_source_violations"];

// Q1: keyed planned targets are structural. The evaluator compares the declared
// key scope, input origin, digest format and the run's matches_declared_input
// boolean; it never compares a digest value, so per-run random HMAC keys can
// never mismatch the frozen expectations.
function targetIssues({ planned, actualTargets, record }) {
  const actual = actualTargets.filter((target) => target.path === planned.path);
  if (actual.length !== 1) return [`axes target ${planned.path}: observed ${actual.length}; expected 1`];
  const issues = difference({ path: `axes target ${planned.path} kind`, actual: actual[0].kind, expected: planned.kind });
  if (planned.keyed !== undefined) {
    const checks = (record.keyed_checks ?? []).filter((check) => check.path === planned.path);
    if (checks.length !== 1) return [...issues, `axes target ${planned.path}: observed ${checks.length} keyed checks; expected 1`];
    const check = checks[0];
    issues.push(...difference({ path: `axes target ${planned.path} key scope`, actual: check.key_scope, expected: planned.keyed.key_scope }));
    issues.push(...difference({ path: `axes target ${planned.path} input origin`, actual: check.input_origin, expected: planned.keyed.input_origin }));
    issues.push(...difference({ path: `axes target ${planned.path} digest format`, actual: check.digest_format, expected: planned.keyed.digest_format }));
    issues.push(...difference({ path: `axes target ${planned.path} matches declared input`, actual: check.matches_declared_input, expected: planned.keyed.matches_declared_input }));
    return issues;
  }
  return [...issues, ...difference({ path: `axes target ${planned.path} value`, actual: actual[0].value, expected: planned.value })];
}

function axesIssues({ planned, actual, record }) {
  if (planned === undefined) return ["planned axes missing"];
  const issues = [];
  for (const key of AXES_FIELDS) issues.push(...difference({ path: `computed axes ${key}`, actual: actual?.[key], expected: planned[key] }));
  const plannedTargets = planned.targets ?? [];
  const actualTargets = actual?.targets ?? [];
  for (const target of plannedTargets) issues.push(...targetIssues({ planned: target, actualTargets, record }));
  const plannedPaths = new Set(plannedTargets.map((target) => target.path));
  for (const target of actualTargets) {
    if (!plannedPaths.has(target.path)) issues.push(`computed axes target ${target.path}: observed but not planned`);
  }
  return issues;
}

// Q10: one step-id map and one cached analysis per record for this pass;
// analysisFor is shared with the verdict and linkage stages via the same Map.
function compareStep({ planned, record, records, caseId, analyses, byId }) {
  const analysis = analysisFor({ record, records, byId, analyses });
  const issues = [...analysis.issues];
  issues.push(...difference({ path: "case family", actual: record.family, expected: planned.family ?? caseId.split("-")[0] }));
  for (const path of OUTCOME_FIELDS) issues.push(...difference({ path, actual: record[path], expected: planned[path] }));
  if (planned.accepted === false && record.accepted === true) issues.push("expected refusal but observed acceptance");
  issues.push(...axesIssues({ planned: planned.axes, actual: analysis.axes, record }));
  for (const [path, expected] of Object.entries(planned.assertions ?? {})) {
    issues.push(...difference({ path, actual: atPath(record, path), expected }));
  }
  return issues.map((issue) => `${planned.step_id}: ${issue}`);
}

function stepIssues({ planned, byId, records, caseId, counts, analyses }) {
  // A planned step without step_id is reported by ownershipIssues; never let
  // an undefined id reach counts/byId/compareStep.
  if (typeof planned.step_id !== "string") return [];
  const observed = counts.get(planned.step_id) ?? 0;
  if (observed !== 1) return [`${planned.step_id}: observed ${observed} records; expected 1`];
  return compareStep({ planned, record: byId.get(planned.step_id), records, caseId, analyses, byId });
}

function plannedCounts(cases) {
  const counts = new Map();
  const steps = cases.flatMap((entry) => entry.expected ?? []);
  for (const step of steps) counts.set(step.step_id, (counts.get(step.step_id) ?? 0) + 1);
  return counts;
}

function ownershipIssues({ entry, counts }) {
  if (!Array.isArray(entry.expected) || entry.expected.length === 0) {
    return [`${entry.case_id}: malformed planned case; expected steps missing`];
  }
  const issues = [];
  for (const step of entry.expected) {
    if (typeof step.step_id !== "string") {
      issues.push(`${entry.case_id}: planned step missing step_id`);
      continue;
    }
    if (counts.get(step.step_id) > 1) issues.push(`${entry.case_id}: duplicate planned steps: ${step.step_id}`);
    if (step.step_id.split("/")[0] !== entry.case_id) issues.push(`${step.step_id}: planned step does not belong to case ${entry.case_id}`);
  }
  return issues;
}

function predictionNotes({ entry, calls }) {
  const actual = calls.filter((call) => call.label.split(":")[0] === entry.case_id).length;
  if (actual === entry.predicted_calls) return [];
  return [`public-call prediction ${entry.predicted_calls}; observed ${actual}; deviation is a note, not an invalidation`];
}

function evaluateCase({ entry, records, calls, counts, byId, recordCounts, analyses }) {
  const issues = ownershipIssues({ entry, counts });
  issues.push(...(entry.expected ?? []).flatMap((planned) => stepIssues({ planned, byId, records, caseId: entry.case_id, counts: recordCounts, analyses })));
  return { case_id: entry.case_id, matched: issues.length === 0, mismatches: issues, notes: predictionNotes({ entry, calls }) };
}

// Expectations are supplied by the caller; never derive them from observations.
// Counts are notes only; sticky allowance exhaustion belongs to lib/ledger.
export function evaluateCases({ records, expectations, calls = [], byId, analyses }) {
  const counts = plannedCounts(expectations.cases);
  const map = byId ?? byIdMap(records);
  const recordCounts = new Map();
  for (const record of records) {
    recordCounts.set(record.step_id, (recordCounts.get(record.step_id) ?? 0) + 1);
  }
  const cache = analyses ?? new Map();
  const results = expectations.cases.map((entry) => evaluateCase({ entry, records, calls, counts, byId: map, recordCounts, analyses: cache }));
  const known = new Set(counts.keys());
  for (const record of records) {
    if (!known.has(record.step_id)) results.push({ case_id: record.step_id, matched: false, mismatches: [`unknown step ${record.step_id}`], notes: [] });
  }
  return results;
}

// Shared-runner adapter. Preserve observations separately from comparisons;
// linkage stages name step namespaces, not event families. Q3: records routed
// to the declared linkage inventory never become "unknown steps" here; the
// linkage inventory reports its own unknowns. Linkage expectations are frozen
// as per-row aggregates, never per-run digests or per-slot steps.
export function evaluateProbe({ observations, expectations }) {
  const records = observations.flatMap((process) => process.records);
  const calls = observations.flatMap((process) => process.public_calls);
  const matrixRecords = records.filter((record) => record.linkage === undefined);
  const byId = byIdMap(records);
  const analyses = new Map();
  const evaluations = evaluateCases({ records: matrixRecords, calls, expectations, byId, analyses });
  const verdict = evaluateVerdict({ records, evaluations, pairs: expectations.declared_join_pairs, byId, analyses });
  const comparison = compareLinkageExpectations({ linkage: verdict.linkage, expectations: expectations.linkage_expectations });
  verdict.linkage_expectations = { ...comparison, valid: comparison.issues.length === 0 };
  return { evaluations: evaluations.map((entry) => ({ ...entry,
    raw: records.filter((record) => record.step_id.split("/")[0] === entry.case_id) })),
    verdict };
}
