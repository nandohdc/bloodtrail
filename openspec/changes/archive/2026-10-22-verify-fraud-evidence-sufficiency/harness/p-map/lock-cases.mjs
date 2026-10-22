// Implementer-default build plan, not frozen expectations or probe results.
// G36 is an owner decision; other choices remain labelled defaults, not policy.
// Sources re-derived at 8e6cdf781445574c67883a465eb37581ca14b5ab.
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/source/contract.source.json";
const MODIFICATION = [`${CONTRACT}:3814-3855,2286-2296`, `${CORE}events.ts:190-225,238-272`,
  `${CORE}validation/semantic.ts:66,227-289,326-330,391-399,426-435`];

export const LOCKOUT_CASES = [
  { case_id: "K1", setup: "Targetless rate-limited password attempt, tenantless and no handle; retain capture for K2a join analysis",
    predicted_calls: 9, variants: [{ id: "attempt", predicted_calls: 9 }], steps: ["attempt"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Records a refused attempt, not an imposed committed lock; rate_limited is not locked"],
    finding: "G36 owner decision permits the reason but still withholds the target; attribution limitation is a design input",
    basis: [`${CONTRACT}:518-536,2902-2934`, `${CORE}events.ts:223,238-254`,
      `${CORE}validation/semantic.ts:50,249-352`, "openspec/specs/security-audit-event-contract/spec.md:149-167", "#795 decision log G36"], confidence: "medium" },
  { case_id: "K2a", setup: "Genuine recorded lockout-policy allow and synthetic committed lock; retain same SDK/handle only for U2, plus tenantless control",
    predicted_calls: 21, variants: [{ id: "policy", predicted_calls: 11 }, { id: "tenantless", predicted_calls: 10 }],
    steps: ["policy-begin", "policy-mark", "policy", "tenantless-begin", "tenantless-mark", "tenantless"],
    candidate_verdict: "STRAINED", rubric_reasons: ["Generic purpose and free-form category; policy evaluation is a genuine authorization decision under implementer default"],
    decision_source: "implementer default", owner_review_required: true,
    alternative_verdict: { verdict: "MISREPRESENTS", condition: "Automatic threshold policy evaluation is not a genuine authorization decision",
      consequence: "Criterion 2 fails on lockout" },
    finding: "Join K1 capture to account-resolved lock using genuine shared linkage; whether forbidden belongs to #806",
    basis: [...MODIFICATION, `${CORE}context.ts:198-200`, "contracts/security-audit/docs/authority-matrix.md:16"], confidence: "medium" },
  { case_id: "K2b", setup: "Fresh committed lock with authorization not_applicable, and tenantless control",
    predicted_calls: 21, variants: [{ id: "not-applicable", predicted_calls: 11 }, { id: "tenantless", predicted_calls: 10 }],
    steps: ["not-applicable-begin", "not-applicable-mark", "not-applicable", "tenantless-begin", "tenantless-mark", "tenantless"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Accepted not_applicable contradicts policy allow required for success, independently of SDK acceptance"],
    basis: MODIFICATION, confidence: "medium" },
  { case_id: "K3", setup: "Committed lock labelled configuration: account resource then security_configuration resource with the same account ID",
    predicted_calls: 20, variants: [{ id: "account", predicted_calls: 10 }, { id: "relabeled", predicted_calls: 10 }],
    steps: ["account-begin", "account-mark", "account", "relabeled-begin", "relabeled-mark", "relabeled"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Account is not a configuration resource; changing its type mislabels its meaning"],
    basis: [`${CONTRACT}:465-478,2162-2173,3998-4036`, `${CORE}context.ts:202-204`,
      `${CORE}validation/semantic.ts:69,249-280,328-330`, `${CORE}events.ts:205-225`], confidence: "high" },
  { case_id: "K4", setup: "Account-labelled anonymous authorization deny during login; tenant and tenantless variants without handles",
    predicted_calls: 17, variants: [{ id: "tenant", predicted_calls: 9 }, { id: "tenantless", predicted_calls: 8 }], steps: ["tenant", "tenantless"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Routes authentication rejection through authorization to attach an account target withheld by authentication.failed"],
    basis: [`${CONTRACT}:3351-3385,2906,2927`, `${CORE}events.ts:223`,
      `${CORE}validation/semantic.ts:58,391-399,426-435`, "#795 decision log G36"], confidence: "medium" },
];

export const UNLOCK_CASES = [
  { case_id: "U1", setup: "Independent explicit unlock commits by administrator and scheduled process; fresh handles, plus tenantless refusal",
    predicted_calls: 32, variants: [{ id: "administrator", predicted_calls: 11 }, { id: "scheduled", predicted_calls: 11 },
      { id: "tenantless", predicted_calls: 10 }],
    steps: ["administrator-begin", "administrator-mark", "administrator", "scheduled-begin", "scheduled-mark", "scheduled",
      "tenantless-begin", "tenantless-mark", "tenantless"],
    candidate_verdict: "STRAINED", rubric_reasons: ["Independent committed account modification keeps meanings but generic purpose and category are free-form"],
    lazy_expiry: { emission: false, analysis: "TTL checked at the next login has no commit point; recording committed release would require the host to synthesize one" },
    basis: [...MODIFICATION, `${CONTRACT}:534`, `${CORE}context.ts:210-220`], confidence: "medium" },
  { case_id: "U2", setup: "K2a's same-instance live handle marked compensated; default partial, then foreign SDK and object-spread copied handle refusals",
    predicted_calls: 22, variants: [{ id: "same-instance", predicted_calls: 8 }, { id: "foreign", predicted_calls: 8 }, { id: "copied", predicted_calls: 6 }],
    steps: ["compensate", "same-instance", "foreign", "copied"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["An independent later unlock is not rollback of the original lock"],
    consistency_analysis: "#812 does not change default partial/compensating/compensated: success-only consistency and duplicate-success checks do not apply",
    process_limit: "No persisted/reconstructed or later-process handle has instance authority; foreign and copied negatives measure the public refusal",
    basis: [...MODIFICATION, `${CORE}operations.ts:88-111,121-128,213-220`, `${CORE}sdk.ts:213-223,251-268,475-479,513-547`,
      "openspec/specs/security-audit-event-contract/spec.md:149-167"], confidence: "medium" },
];
