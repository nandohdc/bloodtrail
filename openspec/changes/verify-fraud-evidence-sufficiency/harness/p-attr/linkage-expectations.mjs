import { isDeepStrictEqual } from "node:util";
import { difference } from "./observations.mjs";

// Q3: L1-L3 expectations are frozen as per-row aggregates — counts, fractions,
// join presence and honesty — never per-slot steps or per-run digests. Rows
// are matched by (stage, from, to); a missing observed row is an issue, and
// observed rows with no frozen row are reported so nothing is silently ignored.

function metricIssues({ path, actual, expected, targets }) {
  const issues = [];
  for (const target of targets) {
    for (const metric of ["attempts", "accepted"]) {
      issues.push(...difference({ path: `${path} ${target} ${metric}`, actual: actual[target][metric], expected: expected[target][metric] }));
    }
    for (const metric of ["target_coverage", "linkage"]) {
      issues.push(...difference({ path: `${path} ${target} ${metric}`,
        actual: { numerator: actual[target][metric].numerator, denominator: actual[target][metric].denominator },
        expected: expected[target][metric] }));
    }
    const groups = (actual[target].groups ?? []).map((group) => group.count);
    issues.push(...difference({ path: `${path} ${target} groups`, actual: groups, expected: expected[target].groups ?? [] }));
  }
  return issues;
}

function pairLabel(pair) {
  return `${pair.from_family}.${pair.from} -> ${pair.to_family}.${pair.to}`;
}

// Grouping is frozen per-target as counts: a zero count plans a non-groupable
// group, a nonzero count plans a groupable one. Compare the observed groupable
// flags against that, so structure is frozen too, not just counts.
function groupableIssues({ path, actual, expected }) {
  const issues = [];
  for (const target of ["ex", "nx"]) {
    const groups = actual[target].groups ?? [];
    const counts = expected[target].groups ?? [];
    for (let index = 0; index < groups.length; index += 1) {
      const plannedGroupable = (counts[index] ?? 0) !== 0;
      if (groups[index].groupable !== plannedGroupable) {
        issues.push(`${path} ${target} group ${index}: groupable ${groups[index].groupable} observed; ${plannedGroupable} planned from frozen count ${counts[index] ?? 0}`);
      }
    }
  }
  return issues;
}

// A null frozen declared pair is enforced by the linkage numerator check;
// the pair comparison itself only fires when the observed row actually joined.
function declaredPairIssues({ path, planned, observed }) {
  const used = observed.declared_pair ?? [];
  if (used.length === 0) return [];
  if (planned.declared_pair === null) {
    return [`${path}: no declared join pair planned, but observed joins used ${used.map(pairLabel).join(", ")}`];
  }
  if (!used.some((pair) => isDeepStrictEqual(pair, planned.declared_pair))) {
    return [`${path}: planned declared pair ${pairLabel(planned.declared_pair)} not among observed join pairs ${used.map(pairLabel).join(", ")}`];
  }
  return [];
}
function honestyIssues({ path, planned, observed }) {
  if (planned.honesty.honest === observed.honesty.honest) return [];
  return [`${path}: honesty ${observed.honesty.honest} observed; ${planned.honesty.honest} planned`];
}

function compareRow({ stage, planned, observed }) {
  const path = `${stage}/${planned.from} -> ${planned.to}`;
  const issues = [...metricIssues({ path, actual: observed, expected: planned, targets: ["ex", "nx"] }),
    ...groupableIssues({ path, actual: observed, expected: planned }),
    ...declaredPairIssues({ path, planned, observed }),
    ...honestyIssues({ path, planned, observed })];
  return { stage, from: planned.from, to: planned.to, matched: issues.length === 0, issues };
}

function missingRow({ stage, row }) {
  return { stage, from: row.from, to: row.to, matched: false,
    issues: [`${stage}/${row.from} -> ${row.to}: frozen row has no observed linkage row`] };
}

function matchedOrMissing({ linkage, stage, row }) {
  const observed = (linkage[stage] ?? []).find((item) => item.from === row.from && item.to === row.to);
  if (observed === undefined) return missingRow({ stage, row });
  return compareRow({ stage, planned: row, observed });
}

function plannedRowFor({ linkage, stage, planned }) {
  return planned.map((row) => matchedOrMissing({ linkage, stage, row }));
}

function observedRow({ frozen, stage, observed }) {
  if (frozen.has(`${stage}/${observed.from} -> ${observed.to}`)) return null;
  return { stage, from: observed.from, to: observed.to, matched: false,
    issues: [`${stage}/${observed.from} -> ${observed.to}: observed linkage row not frozen in the expectations`] };
}

function extraObservedRows({ linkage, frozen }) {
  return ["L1", "L2", "L3"].flatMap((stage) =>
    (linkage[stage] ?? []).map((observed) => observedRow({ frozen, stage, observed })).filter((row) => row !== null));
}

export function compareLinkageExpectations({ linkage, expectations }) {
  if (expectations === undefined) return { rows: [], issues: [] };
  const stages = [["L1", expectations.L1 ?? []], ["L2", expectations.L2 ?? []], ["L3", expectations.L3 ?? []]];
  const rows = stages.flatMap(([stage, planned]) => plannedRowFor({ linkage, stage, planned }));
  const frozen = new Set(rows.map((row) => `${row.stage}/${row.from} -> ${row.to}`));
  rows.push(...extraObservedRows({ linkage, frozen }));
  return { rows, issues: rows.flatMap((row) => row.issues) };
}
