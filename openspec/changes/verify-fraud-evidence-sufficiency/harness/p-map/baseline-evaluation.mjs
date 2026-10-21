import { BASELINE_PLAN } from "./baseline-cases.mjs";
import { array } from "./evidence.mjs";

function stepIssues(planned, record) {
  if (record === undefined) return ["missing control step"];
  const issues = [];
  if (record.kind !== "returned" || record.accepted !== planned.accepted) issues.push("control did not return acceptance");
  if (record.sink_count !== planned.sink_count) issues.push("control sink count differs");
  const captures = array(record.captures);
  if (captures.length !== planned.sink_count) issues.push("control capture count differs");
  if (!captures.every((capture) => capture?.frozen === true)) issues.push("control capture was not frozen");
  return issues;
}

// Baselines own a separate retained namespace, never unknown concrete steps.
// Actual public-call drift is NOT a matching condition, even for controls.
export function baselineEvaluation(entry, { records, accounting }) {
  const raw = array(records).filter((record) => typeof record?.step_id === "string")
    .filter((record) => record.step_id.startsWith(`${entry.case_id}/`));
  const rows = array(accounting).filter((row) => row?.case_id === entry.case_id);
  const mismatches = [];
  if (raw.length !== entry.steps.length) mismatches.push("control step inventory differs");
  if (rows.length !== 1) mismatches.push("missing/duplicate control accounting");
  if (rows.some((row) => row.case_aborted === true)) mismatches.push("control aborted");
  for (const planned of entry.steps) {
    const peers = raw.filter((record) => record.step_id === `${entry.case_id}/${planned.id}`);
    if (peers.length !== 1) mismatches.push(`${planned.id}: missing/duplicate control step`);
    mismatches.push(...stepIssues(planned, peers[0]).map((issue) => `${planned.id}: ${issue}`));
  }
  return { case_id: entry.case_id, raw, accounting: rows, matched: mismatches.length === 0, mismatches,
    notes: rows.flatMap((row) => array(row.notes)) };
}

export function evaluateBaselines(processes) {
  const retained = array(processes).map((process) => process?.baselines);
  const records = retained.flatMap((baseline) => array(baseline?.records));
  const accounting = retained.flatMap((baseline) => array(baseline?.accounting));
  return BASELINE_PLAN.map((entry) => baselineEvaluation(entry, { records, accounting }));
}
