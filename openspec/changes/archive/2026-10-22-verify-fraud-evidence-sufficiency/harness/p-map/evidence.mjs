import { atPath } from "../p-e/shape.mjs";

export function array(value) {
  return Array.isArray(value) ? value : [];
}

// Read routing fields without normalizing the value forwarded to validators.
export function fieldOf(value, field) {
  if (value === null || typeof value !== "object") return undefined;
  return value[field];
}

export function caseIdOf(value) {
  return fieldOf(value, "case_id");
}

export { ownsRecord } from "../p-e/evaluation-row.mjs";

export function captured(record) {
  if (record === undefined) return undefined;
  if (record.captures.length !== 1) return undefined;
  return record.captures[0].event;
}

export function oneStep(records, id) {
  const matches = records.filter((record) => record?.step_id === id);
  return matches.length === 1 ? matches[0] : undefined;
}

export function acceptedStep(records, id) {
  const record = oneStep(records, id);
  return record?.kind === "returned" && record.accepted === true && record.sink_count === 1;
}

export function stepMatched(context, id) {
  const row = context.rows.find((entry) => entry.case_id === id.split("/")[0]);
  if (row?.integrity !== true) return false;
  return row.steps.some((step) => step.step_id === id && step.matched);
}

export function measuredField(context, id, path) {
  if (!stepMatched(context, id)) return null;
  const value = atPath(oneStep(context.records, id), path);
  return value === undefined ? null : value;
}
