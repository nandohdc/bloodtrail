import { joinFacts, targetFacts } from "./comparison.mjs";
import { eventView, shapeIssues } from "./observations.mjs";

export function usable(record) {
  return record.accepted === true && shapeIssues(record).length === 0;
}
export function fraction(numerator, denominator) {
  return { numerator, denominator, fraction: numerator / denominator };
}
function view(record) { return { ...eventView(record), family: record.family, account: record.account }; }
function joined({ record, successes, pairs }) {
  if (!usable(record)) return false;
  return successes.filter(usable).some((success) => joinFacts({ from: view(record), to: view(success), pairs }).length > 0);
}
function signature(record) {
  return JSON.stringify(targetFacts(eventView(record)).map(({ path, value }) => [path, value]));
}
function targetGroup({ target, records }) {
  const attempts = records.filter((record) => record.linkage.pid === target.pid).filter(usable);
  const bearing = attempts.filter((record) => targetFacts(eventView(record)).length > 0);
  const signatures = [...new Set(bearing.map(signature))];
  return { pid: target.pid, count: bearing.length, stable: signatures.length === 1, signatures };
}
function groupsFor({ targets, records }) {
  const groups = targets.map((target) => targetGroup({ target, records }));
  return groups.map((group) => ({ pid: group.pid, count: group.count,
    groupable: group.stable && groups.filter((peer) => peer.signatures[0] === group.signatures[0]).length === 1 }));
}
export function cohortMetrics({ records, successes, pairs, targets, repeats }) {
  const denominator = targets.length * repeats;
  const accepted = records.filter(usable);
  const bearing = accepted.filter((record) => targetFacts(eventView(record)).length > 0);
  return { attempts: denominator, observed: records.length, accepted: accepted.length,
    target_coverage: fraction(bearing.length, denominator),
    linkage: fraction(records.filter((record) => joined({ record, successes, pairs })).length, denominator),
    groups: groupsFor({ targets, records }) };
}
