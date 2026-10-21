import assert from "node:assert/strict";

function failure(raw, message, process_index) {
  return { case_id: "P-map", matched: false, raw: [raw], accounting: [], notes: [], process_index,
    mismatches: [message] };
}

function processIssues(process, index) {
  try {
    assert(process !== null && typeof process === "object", "process must be an object");
    assert(!Array.isArray(process), "process must not be an array");
    assert(Array.isArray(process.records), "records must be an array");
    assert(Array.isArray(process.accounting), "accounting must be an array");
    return [];
  } catch (error) {
    return [failure(process, `malformed observation process ${index}: ${error.message}`, index)];
  }
}

// Report malformed containers independently of their readable contents. The
// evaluator still routes valid arrays to their owners and retains original input.
export function observationIssues(observations) {
  if (!Array.isArray(observations)) return [failure(observations, "observations must be an array")];
  return observations.flatMap(processIssues);
}
