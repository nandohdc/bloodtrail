import { analysisFor, byIdMap } from "./observations.mjs";
import { analyzeLinkage } from "./linkage-analysis.mjs";
import { honest } from "./axes.mjs";
import { usable } from "./linkage-metrics.mjs";
import { atPath } from "./comparison.mjs";
import { isDeepStrictEqual } from "node:util";
import { DECLARED_PAIRS } from "./linkage-cases.mjs";

const PRINCIPAL_REFUSAL = { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" };
const TENANT_REFUSAL = { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/claimed_tenant_id" };

function independentFailure(axes) {
  if (axes === null) return false;
  return !honest(axes) || (axes.allowed_source_violations?.length ?? 0) > 0;
}
function rowComplete(row) {
  return (row.issues ?? []).length === 0 && row.ex.accepted === 15 && row.nx.accepted === 15
    && row.axes.length === 30 && row.axes.every((axes) => axes !== null);
}
function coverageComplete(row) {
  return row.nx.target_coverage.fraction === 1 && row.ex.target_coverage.fraction === 1;
}
function acceptanceComplete(row) {
  return row.ex.accepted === 15 && row.nx.accepted === 15;
}
function rowReasons(row) {
  const reasons = [...(row.issues ?? [])];
  if (!acceptanceComplete(row)) reasons.push("accepted carrier coverage incomplete");
  if (!coverageComplete(row)) reasons.push("target coverage incomplete");
  if (row.axes.filter(independentFailure).length > 0) reasons.push("present axes already fail ambiguity/misuse/rule/disclosure/grouping/source");
  return reasons;
}

// Q4: one incomplete row must not void criterion 1. A row with missing or
// invalid evidence is inconclusive by itself; it only keeps the verdict open
// if it could still turn honest (all present analyses already honest and the
// missing data could complete them). If every inconclusive row already fails
// a predicate independent of the missing data (ambiguity, misuse, rule,
// disclosure, allowed source), the verdict is still "no honest carrier".
export function criterionCandidate(row) {
  const complete = rowComplete(row);
  const coverage = coverageComplete(row);
  const accepted = acceptanceComplete(row);
  const qualified = complete && row.axes.every(honest);
  const presentFailures = row.axes.filter(independentFailure).length > 0;
  return { carrier: row.from, conclusive: complete, qualifies: qualified && coverage && accepted,
    could_turn_honest: !complete && !presentFailures, reasons: rowReasons(row),
    acceptance: accepted, nx_coverage: row.nx.target_coverage, ex_coverage: row.ex.target_coverage,
    honest_axes: qualified };
}
export function criterionStatus(candidates) {
  const qualifying = candidates.filter((candidate) => candidate.qualifies).map((candidate) => candidate.carrier);
  const couldTurnHonest = candidates.filter((candidate) => candidate.could_turn_honest).length > 0;
  const status = qualifying.length > 0 ? "passed" : couldTurnHonest ? "inconclusive" : "failed";
  return { status, qualifying };
}
function misrepresenting({ record, records, byId, analyses }) {
  if (!usable(record)) return [];
  const { axes, issues } = analysisFor({ record, records, byId, analyses });
  if (issues.length > 0) return [];
  const reasons = [
    ["provenance ambiguity", axes.provenance_ambiguity === true], ["meaning misuse", axes.meaning_misuse === true],
    ["resource rule", ["violates", "circumvents"].includes(axes.resource_rule)],
    ["existence disclosure", axes.discloses_existence === true], ["allowed source", axes.allowed_source_violations.length > 0],
  ].filter(([, applies]) => applies).map(([label]) => label);
  return reasons.length === 0 ? [] : [{ step_id: record.step_id, reasons }];
}
function refusedAs({ record, diagnostic }) {
  const { kind, accepted, sink_count } = record;
  return isDeepStrictEqual({ kind, accepted, sink_count, diagnostic: record.diagnostic },
    { kind: "returned", accepted: false, sink_count: 0, diagnostic });
}
function anonymousRefusal(record) { return refusedAs({ record, diagnostic: PRINCIPAL_REFUSAL }); }
function typedPrincipal(record) {
  if (!usable(record)) return false;
  return atPath(record.events[0], "actor.type") !== "anonymous" && atPath(record.events[0], "authenticated_principal.id") !== undefined;
}
function principalFinding(records) {
  return ["AF", "AS", "PR", "RA"].map((family) => {
    const rows = records.filter((record) => record.family === family);
    const blocked = rows.filter((record) => record.step_id.startsWith(`${family}-C9/`)).filter(anonymousRefusal);
    const accepted = rows.filter(typedPrincipal);
    return { family, observed_anonymous_only_contrast: blocked.length > 0 && accepted.length > 0,
      refused_steps: blocked.map((record) => record.step_id), accepted_typed_principal_steps: accepted.map((record) => record.step_id) };
  });
}
function conflictingTenant(record) { return refusedAs({ record, diagnostic: TENANT_REFUSAL }); }
export function evaluateVerdict({ records, evaluations = [], pairs = DECLARED_PAIRS, byId, analyses }) {
  const shared = { byId: byId ?? byIdMap(records), analyses: analyses ?? new Map() };
  const linked = records.filter((record) => record.linkage !== undefined);
  const linkage = analyzeLinkage({ records: linked, pairs, ...shared });
  const candidates = linkage.L1.map(criterionCandidate);
  const { status, qualifying } = criterionStatus(candidates);
  const issues = [...linkage.issues, ...[...linkage.L1, ...linkage.L2, ...linkage.L3].flatMap((row) => row.issues)];
  return { criterion_1: { status, candidates, qualifying, issues, gap_owner: status === "failed" ? "Bloodtrail contract" : null },
    linkage, diagnostic_mismatches: evaluations.filter((entry) => !entry.matched),
    findings: { accepted_misrepresenting_carriers: records.flatMap((record) => misrepresenting({ record, records, ...shared })),
      anonymous_only_principal_enforcement: principalFinding(records),
      conflicting_tenant: { observed_steps: records.filter(conflictingTenant).map((record) => record.step_id),
        contract_basis: "openspec/specs/security-audit-event-contract/spec.md:115-117",
        interpretation: "SDK refusal versus contract retention of an untrusted conflicting claim; finding, not an expectation mismatch." } },
    scope: "Observations-derived synthetic evidence summary only; no production or delivery claim." };
}
