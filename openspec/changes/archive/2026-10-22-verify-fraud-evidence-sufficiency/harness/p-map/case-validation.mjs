import assert from "node:assert/strict";
import { CITATION, keys, list, natural, text, unique } from "../p-e/shape.mjs";
import { CASES_BY_ID } from "./plan.mjs";
import { validateStep } from "./step-validation.mjs";

export const VERDICTS = ["FITS", "STRAINED", "MISREPRESENTS"];
const OPTIONAL = ["verdict", "rubric_reasons", "owner_review_required", "alternative_verdict", "corrected_from"];

export function sourceBasis(value) {
  const basis = list(value, "basis");
  assert(basis.length > 0, "source basis required");
  for (const citation of basis) {
    assert(CITATION.test(citation) || /^#(?:795|804) .+/.test(citation), "invalid source citation");
  }
}

export function validateCommon(entry) {
  text(entry.setup, "setup");
  sourceBasis(entry.basis);
  assert(["high", "medium", "low"].includes(entry.confidence), "invalid confidence");
  natural(entry.predicted_calls, "predicted_calls");
}

export function validateReading(entry, descriptor) {
  assert.equal(entry.verdict, descriptor.candidate_verdict, "case verdict differs from source-derived candidate");
  if (entry.verdict !== undefined) {
    assert(VERDICTS.includes(entry.verdict), "invalid verdict");
    nonemptyReasons(entry.rubric_reasons);
  }
  assert.equal(entry.owner_review_required, descriptor.owner_review_required, "owner review flag differs");
  assert.deepEqual(entry.alternative_verdict, descriptor.alternative_verdict, "alternative reading/condition differs");
}

export function nonemptyReasons(value) {
  const reasons = list(value, "rubric_reasons");
  assert(reasons.length > 0, "rubric reasons required");
  for (const reason of reasons) text(reason, "rubric reason");
}

export function validateCase(entry) {
  keys(entry, ["case_id", "setup", "expected", "basis", "confidence", "predicted_calls"], OPTIONAL);
  const descriptor = CASES_BY_ID.get(entry.case_id);
  assert(descriptor, "unknown concrete case");
  validateCommon(entry);
  assert.equal(entry.predicted_calls, descriptor.predicted_calls, "predicted calls differ from code descriptor");
  validateReading(entry, descriptor);
  const steps = list(entry.expected, "expected");
  for (const step of steps) validateStep(step, entry.case_id);
  unique(steps.map((step) => step.step_id), "planned steps");
  assert.deepEqual(steps.map((step) => step.step_id), descriptor.steps.map((id) => `${entry.case_id}/${id}`), "exact step inventory differs");
  if (entry.corrected_from !== undefined) {
    keys(entry.corrected_from, ["old_text", "reason"]);
    text(entry.corrected_from.old_text, "old expectation");
    text(entry.corrected_from.reason, "correction reason");
  }
  return entry;
}
