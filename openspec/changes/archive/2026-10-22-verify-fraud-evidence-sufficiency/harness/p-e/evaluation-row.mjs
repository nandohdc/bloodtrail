import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { assertionIssues } from "./assertions.mjs";
import { validateCase } from "./expectations-validate.mjs";
import { metadataIssues } from "./metadata.mjs";
import { resultIssues } from "./result-shapes.mjs";
import { OBSERVED_NOT_FROZEN, counters } from "./shape.mjs";

export function exactlyOne(rows, predicate, label) {
  const matches = rows.filter(predicate);
  assert.equal(matches.length, 1, `missing/duplicate ${label}: observed ${matches.length}`);
  return matches[0];
}

function compareStep(step, input) {
  try {
    const record = exactlyOne(input.records, (row) => row?.step_id === step.step_id, step.step_id);
    const issues = [...resultIssues(step.result, record), ...metadataIssues(step, record)];
    if (step.counters !== OBSERVED_NOT_FROZEN && !isDeepStrictEqual(record.counters, step.counters)) {
      issues.push("step counters differ");
    }
    issues.push(...stepAssertionIssues(step, record, input.records));
    return issues.map((issue) => `${step.step_id}: ${issue}`);
  } catch (error) { return [`${step.step_id}: ${error.message}`]; }
}

// Marked step fields stay raw observations, including when an explicit
// assertion also addresses that field. Case-summary assertions remain frozen.
function stepAssertionIssues(step, actual, records) {
  const assertions = step.assertions.filter((rule) => step[rule.path.split(".")[0]] !== OBSERVED_NOT_FROZEN);
  return assertionIssues({ assertions, actual, records });
}

function aggregateIssues(aggregate, input) {
  try {
    const actual = exactlyOne(input[aggregate.source], (row) => row.step_id === aggregate.step_id, aggregate.aggregate_id);
    return assertionIssues({ assertions: aggregate.assertions, actual, records: input.records })
      .map((issue) => `${aggregate.aggregate_id}: ${issue}`);
  } catch (error) { return [`${aggregate.aggregate_id}: ${error.message}`]; }
}

function summaryIssues(entry, input) {
  try {
    const summary = exactlyOne(input.accounting, (row) => row?.case_id === entry.case_id, `${entry.case_id} accounting`);
    counters(summary.actual);
    assert.deepEqual(summary.steps, entry.expected.map((step) => step.step_id.slice(entry.case_id.length + 1)), "accounting step inventory differs");
    return assertionIssues({ assertions: entry.summary.assertions, actual: summary, records: input.records });
  } catch (error) { return [error.message]; }
}

function predictionNotes(entry, calls) {
  const actual = calls.filter((call) => typeof call?.label === "string" && call.label.startsWith(`${entry.case_id}:`)).length;
  if (actual === entry.predicted_calls) return [];
  return [`public-call prediction ${entry.predicted_calls}; observed ${actual}; deviation is a note, not a mismatch or invalidation`];
}

function unplannedSteps(entry, records) {
  const planned = new Set(entry.expected.map((step) => step.step_id));
  return records.filter((record) => !planned.has(record?.step_id))
    .map((record) => `unplanned owned step ${record?.step_id}`);
}

function abortIssues(entry, records, abort) {
  const observed = new Set(records.map((record) => record.step_id));
  return [`case aborted: ${abort.message}`, ...entry.expected
    .filter((step) => !observed.has(step.step_id))
    .map((step) => `${step.step_id}: planned step not observed (case aborted)`)];
}

// Catch at the row boundary as well as at individual comparisons. A malformed
// row never erases independent verdicts and raw records are retained by reference.
export function evaluateRow(entry, input) {
  const raw = input.records.filter((row) => ownsRecord(entry, row));
  const base = { case_id: entry?.case_id, raw, notes: [],
    accounting: input.accounting.filter((row) => row?.case_id === entry?.case_id),
    aggregates: [...input.guarantees, ...input.contract].filter((row) => ownsRecord(entry, row)) };
  try {
    validateCase(entry);
    const abort = raw.find((record) => record.step_id === `${entry.case_id}/aborted` && record.variant === "case_aborted");
    if (abort !== undefined) return { ...base, matched: false, mismatches: abortIssues(entry, raw, abort) };
    const mismatches = entry.expected.flatMap((step) => compareStep(step, input));
    mismatches.push(...summaryIssues(entry, input), ...unplannedSteps(entry, raw));
    mismatches.push(...entry.aggregates.flatMap((aggregate) => aggregateIssues(aggregate, input)));
    if (input.duplicates.has(entry.case_id)) mismatches.push("duplicate planned case identity");
    return { ...base, matched: mismatches.length === 0, mismatches, notes: predictionNotes(entry, input.calls) };
  } catch (error) { return { ...base, matched: false, mismatches: [`malformed planned row: ${error.message}`] }; }
}

export function ownsRecord(entry, record) {
  if (typeof entry?.case_id !== "string") return false;
  if (typeof record?.step_id !== "string") return false;
  return record.step_id.startsWith(`${entry.case_id}/`);
}
