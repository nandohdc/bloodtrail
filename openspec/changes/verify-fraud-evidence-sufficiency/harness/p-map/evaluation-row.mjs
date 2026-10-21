import assert from "node:assert/strict";
import { natural } from "../p-e/shape.mjs";
import { validateCase } from "./case-validation.mjs";
import { ownsRecord } from "./evidence.mjs";
import { compareStep } from "./step-evaluation.mjs";
import { READINGS } from "./signal-rules.mjs";

function summaryIssues(entry, summaries) {
  try {
    assert.equal(summaries.length, 1, "missing/duplicate accounting row");
    const summary = summaries[0];
    natural(summary.public_calls, "observed public calls");
    assert.deepEqual(summary.steps, entry.expected.map((step) => step.step_id), "accounting step inventory differs");
    assert.notEqual(summary.case_aborted, true, "case aborted in accounting");
    return [];
  } catch (error) { return [error.message]; }
}

function recordIssues(entry, raw) {
  const planned = new Set(entry.expected.map((step) => step.step_id));
  return raw.flatMap((record) => {
    if (record.variant === "case_aborted") return [`case aborted: ${record.message}`];
    return planned.has(record.step_id) ? [] : [`unplanned owned step ${record.step_id}`];
  });
}

function predictionNotes(entry, accounting) {
  const actual = accounting[0]?.public_calls;
  if (actual === entry.predicted_calls) return [];
  return [`public-call prediction ${entry.predicted_calls}; observed ${actual}; deviation is a note, not an invalidation`];
}

function evaluateSteps(entry, input) {
  return entry.expected.map((step) => {
    const mismatches = compareStep(step, input);
    return { step_id: step.step_id, matched: mismatches.length === 0, mismatches };
  });
}

function integrityIssues(entry, context, raw, accounting) {
  const issues = [...summaryIssues(entry, accounting), ...recordIssues(entry, raw)];
  if (context.records.some((record) => unownedTouch(entry, record))) issues.push("unowned record touches case");
  if (context.duplicates.has(entry.case_id)) issues.push("duplicate planned case identity");
  return issues;
}

function unownedTouch(entry, record) {
  if (ownsRecord(entry, record)) return false;
  return record?.step_id === entry.case_id || record?.case_id === entry.case_id || record?.current === entry.case_id;
}

function uniqueRecords(raw) {
  const ids = raw.map((record) => record.step_id);
  return new Set(ids).size === ids.length;
}

// Route first, validate second: even malformed rows retain their owned records.
export function evaluateRow(entry, context) {
  const raw = context.records.filter((record) => ownsRecord(entry, record));
  const accounting = context.accounting.filter((row) => typeof entry?.case_id === "string" && row?.case_id === entry.case_id);
  const base = { case_id: entry?.case_id, raw, accounting, notes: [], integrity: false, steps: [] };
  try {
    validateCase(entry);
    const input = { ...context, raw, case_id: entry.case_id };
    const steps = evaluateSteps(entry, input);
    const issues = integrityIssues(entry, context, raw, accounting);
    const mismatches = [...steps.flatMap((step) => step.mismatches), ...issues];
    return { ...base, steps, integrity: issues.length === 0 && uniqueRecords(raw),
      matched: mismatches.length === 0, mismatches,
      notes: predictionNotes(entry, accounting), ...reading(entry) };
  } catch (error) { return { ...base, matched: false, mismatches: [`malformed planned row: ${error.message}`] }; }
}

function reading(entry) {
  if (entry.verdict === undefined) return {};
  const result = { candidate_verdict: entry.verdict, rubric_reasons: entry.rubric_reasons };
  if (entry.owner_review_required === true) Object.assign(result, { owner_review_required: true,
    default_verdict: entry.verdict, default_condition: READINGS[entry.case_id],
    alternative_verdict: entry.alternative_verdict, decision_source: "implementer default" });
  return result;
}
