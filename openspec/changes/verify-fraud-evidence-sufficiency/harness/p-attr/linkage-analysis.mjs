import { isDeepStrictEqual } from "node:util";
import { FAILURE_DATASETS, REQUEST_DATASETS, SUCCESS_DATASETS, TARGETS, REPETITIONS, DECLARED_PAIRS, MIRRORS } from "./linkage-cases.mjs";
import { joinFacts, atPath } from "./comparison.mjs";
import { cohortMetrics, usable } from "./linkage-metrics.mjs";
import { analysisFor, byIdMap, eventView, shapeIssues } from "./observations.mjs";
import { honest } from "./verdict.mjs";

const STAGES = [["L1", FAILURE_DATASETS, REPETITIONS], ["L2", SUCCESS_DATASETS, 1], ["L3", REQUEST_DATASETS, 1]];
function rosterSlots() {
  return STAGES.flatMap(([stage, datasets, repeats]) => datasets.flatMap((dataset) =>
    TARGETS.filter((target) => dataset.family !== "AS" || target.target === "ex").flatMap((target) =>
      Array.from({ length: repeats }, (_, index) => ({
        step_id: `${stage}/${dataset.dataset_id}/${target.target}-${target.suffix}-${index + 1}`,
        family: dataset.family, account: target.account,
        linkage: { stage, dataset_id: dataset.dataset_id, target: target.target, suffix: target.suffix, pid: target.pid, attempt: index + 1 },
      })))));
}
function principalIssues(record) {
  if (record.family !== "AS") return [];
  if (!usable(record)) return [];
  return atPath(record.events[0], "authenticated_principal.id") === record.account ? [] : ["success principal disagrees with independent account ground truth"];
}
function slotIssues({ slot, byId, counts }) {
  const count = counts.get(slot.step_id) ?? 0;
  if (count !== 1) return [`${slot.step_id}: observed ${count}; expected one dataset slot`];
  const record = byId.get(slot.step_id);
  const actual = { step_id: record.step_id, family: record.family, account: record.account, linkage: record.linkage };
  const issues = isDeepStrictEqual(actual, slot) ? [] : ["ground truth/dataset slot mismatch"];
  return [...issues, ...shapeIssues(record), ...principalIssues(record)].map((issue) => `${slot.step_id}: ${issue}`);
}
function inventory(records, byId) {
  const slots = rosterSlots();
  const known = new Set(slots.map((slot) => slot.step_id));
  const map = byId ?? byIdMap(records);
  const counts = new Map();
  for (const record of records) {
    counts.set(record.step_id, (counts.get(record.step_id) ?? 0) + 1);
  }
  const slotResults = new Map(slots.map((slot) => [slot.step_id, slotIssues({ slot, byId: map, counts })]));
  const issues = slots.flatMap((slot) => slotResults.get(slot.step_id));
  issues.push(...records.filter((record) => !known.has(record.step_id)).map((record) => `unknown linkage step ${record.step_id}`));
  const valid = slots.filter((slot) => slotResults.get(slot.step_id).length === 0);
  const ids = new Set(valid.map((slot) => slot.step_id));
  return { issues, records: records.filter((record) => ids.has(record.step_id)) };
}
function datasetRecords({ records, id }) { return records.filter((record) => record.linkage.dataset_id === id); }
// Q3: the observed row records which declared pair(s) actually produced join
// facts, and the same honest(axes) predicate as the verdict, so frozen rows
// are compared on structure, joins and honesty — never counts alone.
function usedPairs({ records, successes, pairs }) {
  const toViews = successes.filter(usable).map((success) => ({ ...eventView(success), family: success.family, account: success.account }));
  const used = new Map();
  for (const record of records.filter(usable)) {
    const from = { ...eventView(record), family: record.family, account: record.account };
    for (const to of toViews) {
      for (const fact of joinFacts({ from, to, pairs })) {
        const pair = { from_family: fact.from_family, from: fact.from, to_family: fact.to_family, to: fact.to };
        used.set(JSON.stringify(pair), pair);
      }
    }
  }
  return [...used.values()];
}
function honestySummary(analyses) {
  const honestAxes = analyses.filter((analysis) => analysis.axes !== null && honest(analysis.axes));
  const rowHonest = analyses.length > 0 && honestAxes.length === analyses.length;
  return { honest: rowHonest, reason: rowHonest
    ? "every present accepted carrier axis is honest"
    : "some present accepted carrier axis fails ambiguity, misuse, rule, disclosure or per-target grouping" };
}
function metrics({ records, from, to, pairs, repeats, analyses, byId }) {
  const failures = datasetRecords({ records, id: from });
  const successes = datasetRecords({ records, id: to });
  const cohorts = Object.fromEntries(["ex", "nx"].map((target) => [target, cohortMetrics({
    records: failures.filter((record) => record.linkage.target === target), successes, pairs,
    targets: TARGETS.filter((item) => item.target === target), repeats,
  })]));
  const analysesOut = failures.filter(usable).map((record) => analysisFor({ record, records, byId, analyses }));
  return { from, to, ...cohorts, axes: analysesOut.map((analysis) => analysis.axes),
    declared_pair: usedPairs({ records: failures, successes, pairs }),
    honesty: honestySummary(analysesOut),
    issues: analysesOut.flatMap((analysis) => analysis.issues) };
}
// Uses only cloned core sink captures and raw method surfaces. No handoff body,
// byte hash, or delivery-attempt claim is manufactured from canonical events.
export function analyzeLinkage({ records, pairs = DECLARED_PAIRS, byId, analyses }) {
  const map = byId ?? byIdMap(records);
  const checked = inventory(records, map);
  const context = { records: checked.records, pairs, byId: map, analyses: analyses ?? new Map() };
  const l1 = FAILURE_DATASETS.map((dataset) => metrics({ ...context, from: dataset.dataset_id, to: "AS-B/main", repeats: REPETITIONS }));
  const l2 = MIRRORS.map((mirror) => metrics({ ...context, ...mirror, repeats: REPETITIONS }));
  const l3 = REQUEST_DATASETS.map((dataset) => metrics({ ...context, from: dataset.dataset_id, to: "AS-B/main", repeats: 1 }));
  const issues = [...checked.issues, ...[...l1, ...l2, ...l3].flatMap((row) => row.issues)];
  return { valid: issues.length === 0, issues,
    declared_pairs: structuredClone(pairs), L1: l1, L2: l2, L3: l3,
    interpretation: "Declared equality establishes a join, not honest attribution. Score ex and nx separately; nx has no success account. Consumer disclosure is independent of acceptance." };
}
