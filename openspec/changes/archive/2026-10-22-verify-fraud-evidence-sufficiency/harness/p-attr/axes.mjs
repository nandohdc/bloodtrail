import { fieldPolicy, intendedMeaning, resourceContribution } from "./policy.mjs";
import { atPath, targetFacts } from "./comparison.mjs";
import { ORIGINS, leafOrigins } from "./origins.mjs";

const PROTECTED = new Set(["authoritative_server", "verified_assertion", "observed_transport", "derived_server"]);
const NO_AXES = Object.freeze({
  provenance_ambiguity: "n/a", in_occurrence_flag: "n/a", resource_rule: "n/a",
  meaning_misuse: "n/a", discloses_existence: "n/a", per_target_grouping: "n/a",
  ambiguous_fields: [], allowed_source_violations: [], targets: [],
});

// Shared by linkage rows and the criterion verdict; equality is not honesty.
export function honest(axes) {
  return axes.provenance_ambiguity === false && axes.meaning_misuse === false
    && axes.resource_rule === "conforms" && axes.discloses_existence === false
    && axes.per_target_grouping === true;
}

export function originIssues({ event, origins, contents }) {
  const paths = Object.keys(leafOrigins({ value: event, origin: "SC" }));
  const missingOrigins = paths.filter((path) => !ORIGINS.includes(origins[path]))
    .map((path) => `${path}: missing/invalid content origin`);
  // Absent fields have no axes; check only present content's policy coverage.
  const missingPolicies = Object.keys(contents).filter((path) => atPath(event, path) !== undefined)
    .filter((path) => !fieldPolicy(path)?.authority)
    .map((path) => `${path}: missing local field policy`);
  return [...missingOrigins, ...missingPolicies];
}

function ambiguousFields({ event, origins }) {
  return Object.keys(origins).filter((path) => atPath(event, path) !== undefined)
    .filter((path) => origins[path] === "CP")
    .filter((path) => PROTECTED.has(fieldPolicy(path)?.trust));
}

// Skeptic correction: actor.type alone says nothing about a CP target. Scope
// this flag to actor.id PRESENT; authoritative CP actor provenance is invisible.
function occurrenceFlag(event) {
  if (atPath(event, "actor.id") === undefined) return false;
  return atPath(event, "actor.provenance.trust_level") !== fieldPolicy("actor.id")?.trust;
}

function sourceViolations({ event, contents }) {
  return Object.entries(contents).filter(([path]) => atPath(event, path) !== undefined)
    .filter(([path]) => fieldPolicy(path)?.authority === "authenticated_identity")
    .filter(([, content]) => content.source === "lookup")
    .map(([path]) => path);
}

function misused({ path, kind }) {
  if (kind === "presented_identifier") return true;
  const intended = intendedMeaning(path);
  if (intended === undefined) return true; // target in display/free-text slot
  return intended !== kind;
}

// #802 comment 6137582157 AF-C7: a tenant-only claim is not a resource
// carrier (field-policy.json:293-301; catalog.json:201-202 at POLICY_BASE).
// Implementer default: derive that scope from present content, never case ids
// or expectation labels. Honest targetless/type-only baselines still conform.
function targetlessRule(event) {
  return atPath(event, "tenant.claimed_tenant_id") === undefined ? "conforms" : "n/a";
}

function ruleClass({ family, event, targets, contents, origins }) {
  if (targets.length === 0) return targetlessRule(event);
  const rules = targets.map(({ path }) => resourceContribution({ family, path, content: contents[path], origin: origins[path] }));
  if (rules.includes("violates")) return "violates";
  if (rules.includes("circumvents")) return "circumvents";
  return "conforms";
}

export function computeAxes({ accepted, family, event, origins, contents = {}, disclosure = "n/a" }) {
  if (!accepted) return structuredClone(NO_AXES);
  const targets = targetFacts({ event, contents });
  const ambiguous = ambiguousFields({ event, origins });
  return {
    provenance_ambiguity: ambiguous.length > 0, ambiguous_fields: ambiguous,
    in_occurrence_flag: occurrenceFlag(event),
    allowed_source_violations: sourceViolations({ event, contents }),
    resource_rule: ruleClass({ family, event, targets, contents, origins }),
    meaning_misuse: targets.some(misused), discloses_existence: disclosure,
    per_target_grouping: targets.length > 0, targets,
  };
}
