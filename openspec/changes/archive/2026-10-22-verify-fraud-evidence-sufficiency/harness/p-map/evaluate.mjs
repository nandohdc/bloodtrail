import { array, caseIdOf, fieldOf, ownsRecord } from "./evidence.mjs";
import { SIGNAL_IDS } from "./plan.mjs";
import { evaluateRow } from "./evaluation-row.mjs";
import { evaluateAggregate } from "./aggregate-evaluation.mjs";
import { validateExpectations } from "./expectations-validate.mjs";
import { computeVerdicts } from "./verdicts.mjs";
import { observationIssues } from "./observation-validation.mjs";
import { evaluateBaselines } from "./baseline-evaluation.mjs";

function planNotes(expectations) {
  try { validateExpectations(expectations); return []; }
  catch (error) { return [error.message]; }
}

function duplicates(cases) {
  const ids = cases.map(caseIdOf);
  return new Set(ids.filter((id, index) => ids.indexOf(id) !== index));
}

function unowned(context, cases) {
  const records = context.records.filter((record) => !cases.some((entry) => ownsRecord(entry, record)));
  const summaries = context.accounting.filter((row) => !cases.some((entry) => typeof caseIdOf(entry) === "string" && caseIdOf(entry) === row?.case_id));
  return [...records.map((record) => ({ case_id: record?.step_id, matched: false, raw: [record], notes: [],
    mismatches: [`unknown step ${record?.step_id}`] })),
  ...summaries.map((row) => ({ case_id: row?.case_id, matched: false, raw: [], accounting: [row], notes: [],
    mismatches: ["unowned accounting row"] }))];
}

function evaluate(input) {
  const processes = array(input.observations);
  const malformed = observationIssues(input.observations);
  const cases = array(fieldOf(input.expectations, "cases"));
  const context = { records: processes.flatMap((process) => array(process?.records)),
    accounting: processes.flatMap((process) => array(process?.accounting)), duplicates: duplicates(cases) };
  const concrete = cases.filter((entry) => !SIGNAL_IDS.includes(caseIdOf(entry)));
  const rows = concrete.map((entry) => evaluateRow(entry, context));
  const verdicts = computeVerdicts({ records: context.records, rows, readings: input.readings ?? {} });
  const aggregates = cases.filter((entry) => SIGNAL_IDS.includes(caseIdOf(entry)))
    .map((entry) => evaluateAggregate(entry, { ...context, verdicts }));
  const byEntry = new Map([...concrete.map((entry, index) => [entry, rows[index]]),
    ...cases.filter((entry) => SIGNAL_IDS.includes(caseIdOf(entry))).map((entry, index) => [entry, aggregates[index]])]);
  return { evaluations: [...cases.map((entry) => byEntry.get(entry)), ...unowned(context, cases), ...malformed],
    verdicts, baseline_evaluations: evaluateBaselines(processes),
    notes: [...planNotes(input.expectations), ...malformed.flatMap((row) => row.mismatches)],
    observations: input.observations, accounting: context.accounting };
}

// Total on JSON-shaped malformed inputs. Unexpected defects remain protected
// independently by lib/probe-runner, which preserves every process observation.
export function evaluateProbe(input) {
  try { return evaluate(input); }
  catch (error) {
    return { evaluations: [{ case_id: "P-map", matched: false, raw: input?.observations,
      notes: [], mismatches: [`malformed evaluation input: ${error.message}`] }],
    notes: [], verdicts: [], observations: input?.observations };
  }
}

export function evaluateCases({ records, expectations, accounting = [] }) {
  return evaluateProbe({ expectations, observations: [{ records, accounting }] }).evaluations;
}
