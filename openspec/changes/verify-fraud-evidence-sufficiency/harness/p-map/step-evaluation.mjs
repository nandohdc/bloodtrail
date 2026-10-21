import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { assertionIssues } from "../p-e/assertions.mjs";
import { validateStep } from "./step-validation.mjs";

export function compareStep(step, context) {
  try {
    validateStep(step, context.case_id);
    const actual = plannedRecord(step, context.raw);
    const issues = [...boundaryIssues(actual), ...fieldIssues(step, actual)];
    issues.push(...assertionIssues({ assertions: step.assertions, actual, records: context.records }));
    return issues.map((issue) => `${step.step_id}: ${issue}`);
  } catch (error) { return [`${step?.step_id}: malformed/missing step: ${error.message}`]; }
}

function plannedRecord(step, raw) {
  const records = raw.filter((record) => record?.step_id === step.step_id);
  assert.equal(records.length, 1, `missing/duplicate step: observed ${records.length}`);
  return records[0];
}

function fieldIssues(step, actual) {
  return ["kind", "accepted", "sink_count"].filter((field) => actual[field] !== step[field])
    .map((field) => `${field} differs`);
}

function boundaryIssues(record) {
  if (!Array.isArray(record.captures)) return ["malformed captures"];
  const issues = record.captures.flatMap(captureIssues);
  if (record.captures.length !== record.sink_count) issues.push("sink count disagrees with captures");
  issues.push(...publicIssues(record));
  return issues;
}

function captureIssues(capture) {
  if (capture?.frozen !== true) return ["nonfrozen capture"];
  return canonicalIssues(capture.event);
}

function canonicalIssues(event) {
  if (event === null || typeof event !== "object") return ["malformed capture"];
  if (Array.isArray(event)) return ["malformed capture"];
  return metadataIssues(event.event);
}

function metadataIssues(metadata) {
  if (typeof metadata?.name !== "string") return ["missing canonical event name"];
  if (typeof metadata?.id !== "string") return ["missing structural event identity"];
  return [];
}

function publicIssues(record) {
  if (record.kind !== "returned") return [];
  if (record.raw?.ok !== record.accepted) return ["raw public outcome disagrees with acceptance"];
  return record.accepted ? [] : diagnosticIssues(record);
}

function diagnosticIssues(record) {
  const error = record.raw.error;
  if (error === null || typeof error !== "object") return ["malformed public diagnostic"];
  const diagnostic = { code: error.code, category: error.category, path: error.path };
  return isDeepStrictEqual(diagnostic, record.diagnostic) ? [] : ["raw refusal disagrees with diagnostic"];
}
