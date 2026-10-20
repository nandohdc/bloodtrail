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
  const peers = byId === undefined
    ? records.filter((candidate) => candidate.step_id === peer)
    : byId.has(peer) ? [byId.get(peer)] : [];
  if (peers.length !== 1) {
    issues.push(`${record.step_id}: missing/duplicate existence peer ${peer}`);
    return "n/a";
  }
  if (peers[0].events.length !== 1) {
    issues.push(`${record.step_id}: existence peer has no unique capture`);
    return "n/a";
  }
  return compareExistence({ ex: eventView(record), nx: eventView(peers[0]) }).discloses;
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
// The Map is keyed by record identity, so every stage (case comparison, verdict,
// linkage rows) that inspects the same record shares one analyzeRecord result.
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
  for (const record of records) byId.set(record.step_id, record);
  return byId;
}
