import { isDeepStrictEqual } from "node:util";
import { computeAxes, originIssues } from "./axes.mjs";
import { compareExistence } from "./comparison.mjs";

const ACCEPTED = { ok: true, value: { status: "accepted" } };

export function difference({ path, actual, expected }) {
  if (isDeepStrictEqual(actual, expected)) return [];
  return [`${path}: observed ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}`];
}

function returnedIssues(record) {
  if (record.accepted) return difference({ path: "accepted result", actual: record.raw, expected: ACCEPTED });
  return difference({ path: "refused result", actual: record.raw, expected: { ok: false, error: record.diagnostic } });
}

function thrownIssues(record) {
  if (record.diagnostic === undefined) return ["thrown surface missing diagnostic"];
  const issues = difference({ path: "thrown acceptance", actual: record.accepted, expected: false });
  for (const path of ["code", "category", "path"]) {
    issues.push(...difference({ path: `thrown ${path}`, actual: record.raw[path], expected: record.diagnostic[path] }));
  }
  return issues;
}

function surfaceIssues(record) {
  if (record.kind === "returned") return returnedIssues(record);
  if (record.kind === "thrown") return thrownIssues(record);
  return [`unknown surface ${record.kind}`];
}

export function shapeIssues(record) {
  const issues = difference({ path: "capture count", actual: record.events.length, expected: record.sink_count });
  issues.push(...difference({ path: "outcome sink count", actual: record.sink_count, expected: record.accepted ? 1 : 0 }));
  issues.push(...difference({ path: "frozen captures", actual: record.frozen, expected: record.events.map(() => true) }));
  issues.push(...difference({ path: "capture origin count", actual: record.captured_origins.length, expected: record.events.length }));
  return [...issues, ...surfaceIssues(record)];
}

export function eventView(record) {
  return { event: record.events[0], origins: record.captured_origins[0], contents: record.contents };
}

function disclosureFor({ record, records, byId, issues }) {
  const peer = record.existence_peer;
  if (peer === undefined) return "n/a";
  const map = byId ?? byIdMap(records);
  const candidate = map.get(peer);
  if (candidate === undefined) {
    issues.push(`${record.step_id}: missing/duplicate existence peer ${peer}`);
    return "n/a";
  }
  if (candidate.events.length !== 1) {
    issues.push(`${record.step_id}: existence peer has no unique capture`);
    return "n/a";
  }
  return compareExistence({ ex: eventView(record), nx: eventView(candidate) }).discloses;
}

export function analyzeRecord({ record, records, byId }) {
  const issues = shapeIssues(record);
  if (!record.accepted) return { axes: computeAxes({ accepted: false }), issues };
  if (record.events.length !== 1) return { axes: null, issues: [...issues, "accepted observation needs exactly one capture"] };
  if (record.captured_origins.length !== 1) return { axes: null, issues: [...issues, "accepted observation needs exactly one origin map"] };
  const view = eventView(record);
  issues.push(...originIssues(view));
  const disclosure = disclosureFor({ record, records, byId, issues });
  return { axes: computeAxes({ accepted: true, family: record.family, ...view, disclosure }), issues };
}

// Q10: one step-id map and one cached analysis per record per evaluation pass.
// The Map is keyed by record identity within one peer universe. Linkage uses
// a separate cache after slot validation, never an unfiltered caller's cache.
export function analysisFor({ record, records, byId, analyses }) {
  let analysis = analyses.get(record);
  if (analysis === undefined) {
    analysis = analyzeRecord({ record, records, byId });
    analyses.set(record, analysis);
  }
  return analysis;
}

export function byIdMap(records) {
  const byId = new Map();
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.step_id)) byId.delete(record.step_id);
    else byId.set(record.step_id, record);
    seen.add(record.step_id);
  }
  return byId;
}
