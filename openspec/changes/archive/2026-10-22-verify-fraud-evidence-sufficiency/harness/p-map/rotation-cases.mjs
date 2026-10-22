// Provisional implementer-default build plan, NOT frozen expectations/results.
// Every source below re-derived at 8e6cdf781445574c67883a465eb37581ca14b5ab.
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/source/contract.source.json";
const COMPLETION = [`${CONTRACT}:3238-3275`, `${CORE}events.ts:190-225,238-272`,
  `${CORE}validation/semantic.ts:32,55-56,91-111,227-247,249-319,354-369,391-399`,
  "packages/security-audit-sdk-core/API.md:198"];
const ASYNC = "openspec/specs/security-audit-event-contract/spec.md:149-167";
const ROLE = [`${CONTRACT}:3407-3443`, `${CORE}validation/semantic.ts:249-277,344-346,380-384,426-435`,
  `${CORE}events.ts:190-225`];

export const ROTATION_CASES = [
  { case_id: "R1", setup: "Committed password change completion with authenticated human, subject, tenant, authentication, session and credential resource, but no causal links",
    predicted_calls: 12, variants: [{ id: "unlinked", predicted_calls: 12 }], steps: ["begin", "mark", "unlinked"],
    rubric_reasons: ["Refused construction cannot establish signal fit; successful async completion needs an original attempt"],
    consistency_analysis: "#812 success/committed is consistent; #797 handle evidence is present, so missing causality remains the first failure",
    basis: COMPLETION, confidence: "high" },
  { case_id: "R2", setup: "Genuine password-change request/completion pair, captured request ID used for both links; repeat tenantless request with refused completion",
    predicted_calls: 37, variants: [{ id: "pair", predicted_calls: 19 }, { id: "tenantless", predicted_calls: 18 }],
    steps: ["pair-begin", "pair-request", "pair-mark", "pair-completed", "tenantless-begin", "tenantless-request", "tenantless-mark", "tenantless-completed"],
    candidate_verdict: "STRAINED", decision_source: "implementer default", owner_review_required: true,
    rubric_reasons: ["Authenticated actor and takeover/credential lifecycle cover a genuine password-change pair under the recommended reading; purpose still names reset, not change"],
    alternative_verdict: { verdict: "MISREPRESENTS", condition: "Reset only: password reset purpose does not cover authenticated password change",
      consequence: "Criterion 2 fails on password-change coverage; R4 API/other credentials and C5 MFA factors do not substitute" },
    construction_default: "Implementer default: public handle operation/correlation getters link the request without passing a transactional handle; markCommitted follows the request. Completion carries genuine recovery-handler policy context, not invented authorization",
    coverage: { password: "R2", api_other: "R4", mfa_factor: "C5", substitutes_for_password: false },
    basis: [...COMPLETION, `${CONTRACT}:3182-3216`, `${CORE}operations.ts:31-46`, ASYNC], confidence: "medium" },
  { case_id: "R3", setup: "Emit tenantless login, then a committed password completion with both links naming that captured login, not a password-change request",
    predicted_calls: 23, variants: [{ id: "login-link", predicted_calls: 23 }], steps: ["login", "begin", "mark", "completed"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["SDK checks presence/self-reference, not referenced-event semantics: login is not the original request of this completion"],
    consistency_analysis: "#812 retains success/committed; causality presence passes but original-event meaning is wrong",
    basis: [...COMPLETION, `${CONTRACT}:2847-2880`, ASYNC], confidence: "medium" },
  { case_id: "R4", setup: "Committed API/other credential rotation via sensitive modification, human and service variants, plus tenantless refusal",
    predicted_calls: 32, variants: [{ id: "human", predicted_calls: 11 }, { id: "service", predicted_calls: 11 }, { id: "tenantless", predicted_calls: 10 }],
    steps: ["human-begin", "human-mark", "human", "service-begin", "service-mark", "service", "tenantless-begin", "tenantless-mark", "tenantless"],
    candidate_verdict: "STRAINED", rubric_reasons: ["Credential resource, real policy and commit keep meanings; generic sensitive modification and free-form rotation category do not name credential rotation"],
    coverage: "API/other credentials only; does not establish password-change or MFA-factor fit",
    basis: [`${CONTRACT}:445-454,465-478,3814-3855`, `${CORE}context.ts:194-200,252-254,284-292`,
      `${CORE}validation/semantic.ts:66,249-289,326-330,391-399,426-435`, `${CORE}events.ts:190-225`], confidence: "medium" },
  { case_id: "R5a", setup: "Committed rotation mislabeled role assignment, human actor, role resource containing credential-record ID and completed reason",
    predicted_calls: 10, variants: [{ id: "human", predicted_calls: 10 }], steps: ["begin", "mark", "human"],
    rubric_reasons: ["Refused administrator-only construction cannot establish rotation fit"], basis: ROLE, confidence: "high" },
  { case_id: "R5b", setup: "R5a with administrator actor; retain credential-record ID mislabeled as a role",
    predicted_calls: 11, variants: [{ id: "administrator", predicted_calls: 11 }], steps: ["begin", "mark", "administrator"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Accepted role resource contains a credential record, contradicting role-assignment purpose and resource meaning"],
    basis: ROLE, confidence: "high" },
];
