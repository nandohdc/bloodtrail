import assert from "node:assert/strict";
import { P_E_BUDGET, P_E_PREDICTED_CALLS } from "./budget.mjs";
import { CITATION, FAMILIES, keys, list, natural, object, text, unique } from "./shape.mjs";
import { validateAssertions } from "./assertions.mjs";
import { validateAggregate, validateReferences, validateStep } from "./step-validation.mjs";

export const CORRECTED_AT = "abcbefa03d5b0afc610deb712d7f4ded5a9e82be";
const CASE_ID = /^P-E-(?:[1-9][0-9]*[a-z]?(?:\(v\))?|x[1-3]|adm|g)$/;
const DEFINITIONS = ["boundaries", "counters", "ordering", "redelivery", "classification"];

export function validateCase(entry) {
  keys(entry, ["case_id", "family", "setup", "expected", "basis", "classification", "confidence",
    "predicted_calls", "summary", "aggregates"], ["corrected_from", "comment_id", "added_by"]);
  assert.match(entry.case_id, CASE_ID, "invalid case identity");
  assert(FAMILIES.includes(entry.family), "unknown case family");
  for (const key of ["setup", "classification"]) text(entry[key], key);
  assert(["high", "medium", "low"].includes(entry.confidence), "invalid confidence");
  const basis = list(entry.basis, "basis");
  assert(basis.length > 0, "source basis required");
  for (const citation of basis) assert.match(citation, CITATION, "invalid source citation");
  natural(entry.predicted_calls, "predicted_calls");
  const steps = list(entry.expected, "expected");
  assert(steps.length > 0, "expected steps required");
  for (const step of steps) validateStep(step, entry.case_id);
  unique(steps.map((step) => step.step_id), "planned steps");
  keys(entry.summary, ["assertions"]);
  validateAssertions(entry.summary.assertions);
  for (const aggregate of list(entry.aggregates, "aggregates")) validateAggregate(aggregate, entry.case_id);
  unique(entry.aggregates.map((row) => row.aggregate_id), "aggregate ids");
  if (entry.corrected_from !== undefined) validateCorrection(entry.corrected_from);
  return entry;
}

function validateCorrection(correction) {
  keys(correction, ["old_text", "reason"]);
  text(correction.old_text, "corrected_from.old_text");
  text(correction.reason, "corrected_from.reason");
}

function validateHeader(value) {
  object(value, "expectations");
  assert.equal(value.probe, "P-E");
  assert.equal(value.version, 1);
  assert.equal(value.corrected_at, CORRECTED_AT);
  object(value.drafted_from, "drafted_from");
  assert.equal(value.drafted_from.commit, "5d931ad");
  assert.equal(value.drafted_from.comment, "https://github.com/nandohdc/bloodtrail/issues/803#issuecomment-6137619745");
  assert.equal(value.redelivery_k, 3);
  for (const key of DEFINITIONS) text(value.definitions[key], `definitions.${key}`);
  for (const decision of list(value.decisions, "decisions")) {
    keys(decision, ["source", "text"]);
    text(decision.source, "decision.source");
    text(decision.text, "decision.text");
  }
  assert(value.decisions.length > 0, "decisions required");
  validateDatabase(value.database_handling);
}

function validateDatabase(database) {
  keys(database, ["engine", "location", "ownership", "cleanup", "permission_flags"]);
  assert.equal(database.engine, "node:sqlite");
  assert.equal(database.location, "<pipeline-scratch>/host-database");
  assert.equal(database.ownership, "harness-local synthetic host database, not Bloodtrail storage or outbox");
  assert.equal(database.cleanup, "deleted with scratch in finally");
  assert.deepEqual(database.permission_flags, ["--permission", "--allow-fs-read=<own-service>",
    "--allow-fs-write=<pipeline-scratch>/host-database"]);
}

function validateBudget(value) {
  const budget = value.planned_occurrence_budget;
  keys(budget, ["predicted_total", "processes", "total", "limit"]);
  validateFrozenBudget(value);
  assert.equal(budget.limit, 5000);
  natural(budget.total, "budget.total");
  assert(budget.total <= budget.limit, "authorization cap exceeded");
  const prediction = value.cases.reduce((sum, row) => sum + row.predicted_calls, 0);
  assert.equal(value.predicted_total, prediction, "per-case prediction sum");
  assert.equal(budget.predicted_total, prediction);
  object(budget.processes, "budget.processes");
  const allowances = Object.values(budget.processes);
  assert(allowances.length > 0, "process allowances required");
  for (const allowance of allowances) natural(allowance, "process allowance");
  assert.equal(allowances.reduce((sum, count) => sum + count, 0), budget.total);
  assert(budget.total >= prediction, "allowance below prediction");
  assert(budget.total <= 2 * prediction, "allowance exceeds twice prediction");
}

// G5: the frozen plan must agree with the code-derived budget before the
// once-marker claim; the child probe-process asserts the same values after
// claiming, so a drift must be refused here instead of spending the approval.
// This is unconditional: even a self-consistent truncated plan must not spend
// an approval on a budget that the child process will reject.
function validateFrozenBudget(value) {
  assert.deepEqual(value.planned_occurrence_budget, P_E_BUDGET,
    "planned_occurrence_budget disagrees with p-e/budget.mjs");
  assert.equal(value.predicted_total, P_E_BUDGET.predicted_total,
    "predicted_total disagrees with p-e/budget.mjs");
  for (const entry of value.cases) {
    assert.equal(entry.predicted_calls, P_E_PREDICTED_CALLS.get(entry.case_id),
      `${entry.case_id}: predicted_calls disagrees with its code descriptor`);
  }
}

export function validateExpectations(value) {
  try {
    validateHeader(value);
    const cases = list(value.cases, "cases");
    assert(cases.length > 0, "planned cases required");
    for (const entry of cases) validateCase(entry);
    unique(cases.map((entry) => entry.case_id), "case ids");
    const ids = cases.flatMap((entry) => entry.expected.map((step) => step.step_id));
    unique(ids, "planned steps");
    validateReferences({ cases, stepIds: new Set(ids) });
    validateBudget(value);
    return value;
  } catch (error) { throw new Error(`malformed P-E expectations: ${error.message}`); }
}
