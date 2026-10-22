import { CASES_BY_ID } from "./plan.mjs";

// Rubric from #804 comment 6137646538; classifications are applicability
// hypotheses from the cited catalog, NOT an inference that acceptance is fit.
// Every component needs an accepted expression; API/MFA cannot cover passwords.
function candidate(case_id, steps, alternatives = []) {
  const entry = CASES_BY_ID.get(case_id);
  return { case_id, expressions: [steps, ...alternatives].map((group) => group.map((id) => `${case_id}/${id}`)),
    verdict: entry.candidate_verdict,
    rubric_reasons: entry.rubric_reasons, basis: entry.basis,
    owner_review_required: entry.owner_review_required, alternative_verdict: entry.alternative_verdict };
}

export const SIGNAL_RULES = [
  { case_id: "S-LOGOUT", components: [
    { name: "logout", candidates: [candidate("L1", ["not-applicable"], [["allow"]]), candidate("L4", ["anonymous"])] }],
    findings_from: ["L3", "L5c"] },
  { case_id: "S-MFA", components: [
    { name: "second_factor_failure", candidates: [candidate("M1", ["tenantless"], [["tenant"]]),
      candidate("M2", ["resolved-subject"]), candidate("M3", ["authenticated-actor"])] }], findings_from: [] },
  { case_id: "S-CONTACT", components: [
    { name: "email_and_nonfactor_phone", candidates: [candidate("C1", ["email", "phone"]),
      candidate("C3", ["after-value"]), candidate("C4", ["configuration"])] },
    { name: "factor_phone", candidates: [candidate("C5", ["removed", "enrolled"])] }], findings_from: ["C2a", "C6"] },
  { case_id: "S-LOCK", components: [
    { name: "imposed_lock", candidates: [candidate("K2a", ["policy"]), candidate("K1", ["attempt"]),
      candidate("K2b", ["not-applicable"]), candidate("K3", ["account", "relabeled"]), candidate("K4", ["tenant"])] }], findings_from: [] },
  { case_id: "S-UNLOCK", components: [
    { name: "independent_release", candidates: [candidate("U1", ["administrator"], [["scheduled"]]),
      candidate("U2", ["same-instance"])] }], findings_from: [] },
  { case_id: "S-ROTATE", components: [
    { name: "password_change", candidates: [candidate("R2", ["pair-request", "pair-completed"]),
      candidate("R3", ["login", "completed"]), candidate("R5b", ["administrator"])] },
    { name: "api_other", candidates: [candidate("R4", ["human"], [["service"]])] },
    { name: "mfa_factor", candidates: [candidate("C5", ["removed", "enrolled"])] }], findings_from: [] },
];

export const RULES_BY_ID = new Map(SIGNAL_RULES.map((rule) => [rule.case_id, rule]));
export const RANK = { FITS: 0, STRAINED: 1, MISREPRESENTS: 2 };
export const RUBRIC = {
  FITS: "Catalog purpose, trigger or investigation covers the signal; every field keeps its contract meaning",
  STRAINED: "Contract-legal and trust/authority retained, but purpose does not name the signal or a field meaning is stretched",
  MISREPRESENTS: "Requires contradicting field trust/authority, a catalog resource/actor rule, or lifecycle/commit semantics",
};
export const READINGS = { K2a: "Automatic threshold policy evaluation is a genuine authorization decision",
  R2: "Takeover and credential lifecycle plus authenticated actors cover authenticated password change" };

export function dependencies(rule) {
  return [...new Set([...rule.components.flatMap((part) => part.candidates.map((item) => item.case_id)), ...rule.findings_from])];
}

export function ownerReadings(rule) {
  return rule.components.flatMap((part) => part.candidates).filter((entry) => entry.owner_review_required === true)
    .map((entry) => ({ case_id: entry.case_id, default_verdict: entry.verdict,
      default_condition: READINGS[entry.case_id], ...entry.alternative_verdict, decision_source: "implementer default" }));
}
