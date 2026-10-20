import { compareGuarantees } from "./guarantee-analysis.mjs";
import { tabulateSteps } from "./contract-columns.mjs";
import { evaluateRow, ownsRecord } from "./evaluation-row.mjs";
import { validateExpectations } from "./expectations-validate.mjs";

function array(value) {
  return Array.isArray(value) ? value : [];
}

function duplicateIds(cases) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of cases) {
    if (seen.has(entry?.case_id)) duplicates.add(entry?.case_id);
    seen.add(entry?.case_id);
  }
  return duplicates;
}

function planNotes(expectations) {
  try { validateExpectations(expectations); return []; }
  catch (error) { return [error.message]; }
}

function unknownRecords({ cases, records }) {
  return records.filter((record) => !cases.some((entry) => ownsRecord(entry, record)))
    .map((record) => ({ case_id: record?.step_id, matched: false, raw: [record], notes: [],
      mismatches: [`unknown step ${record?.step_id}`] }));
}

function unknownSummaries({ cases, accounting }) {
  return accounting.filter((row) => !cases.some((entry) => typeof entry?.case_id === "string" && entry.case_id === row?.case_id))
    .map((row) => ({ case_id: row?.case_id, matched: false, raw: [], accounting: [row], notes: [],
      mismatches: ["unowned accounting row"] }));
}

function safeAnalysis({ records, rows }) {
  // Raw malformed summaries are kept in accounting. Only structurally readable
  // rows enter tabulation; comparison failures remain local inconclusive rows.
  const readable = rows.filter((row) => Array.isArray(row?.steps));
  const guarantees = compareGuarantees({ records: records.filter(Boolean), rows: rows.filter(Boolean) });
  const contract = tabulateSteps({ records: records.filter(Boolean), rows: readable, comparisons: guarantees });
  return { guarantees, contract };
}

function evaluate(input) {
  const processes = array(input.observations);
  const records = processes.flatMap((process) => array(process?.records));
  const calls = processes.flatMap((process) => array(process?.public_calls));
  const accounting = processes.flatMap((process) => array(process?.accounting));
  const cases = array(input.expectations?.cases);
  const derived = safeAnalysis({ records, rows: accounting });
  const context = { records, calls, accounting, ...derived, duplicates: duplicateIds(cases) };
  const evaluations = cases.map((entry) => evaluateRow(entry, context));
  evaluations.push(...unknownRecords({ cases, records }), ...unknownSummaries({ cases, accounting }));
  return { evaluations, notes: planNotes(input.expectations), verdict: derived,
    observations: processes, accounting };
}

// JSON-shaped malformed plans/records are mismatches, not thrown exceptions.
// Unexpected evaluator defects are separately guarded by lib/probe-runner.
export function evaluateProbe(input) {
  try { return evaluate(input); }
  catch (error) {
    return { evaluations: [{ case_id: "P-E", matched: false, raw: input?.observations,
      notes: [], mismatches: [`malformed evaluation input: ${error.message}`] }],
    notes: [], verdict: { guarantees: [], contract: [] }, observations: input?.observations };
  }
}

export function evaluateCases({ records, expectations, calls = [], accounting = [] }) {
  return evaluateProbe({ expectations, observations: [{ records, public_calls: calls, accounting }] }).evaluations;
}
