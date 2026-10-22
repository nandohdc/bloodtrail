// Implementer-default build plan, NOT frozen expectations or measured results.
// Source ranges re-derived at 8e6cdf781445574c67883a465eb37581ca14b5ab.
// Predicted public calls include sink construction/factory, constructors,
// handle methods, named methods and each observed sink callback.
const CORE = "packages/security-audit-sdk-core/src/";
const CATALOG = "contracts/security-audit/source/contract.source.json";
const COMMON = [`${CORE}context.ts:139-166,183-196,210-212,248-250,284-292,299-315,321-323,388-392`,
  `${CORE}events.ts:185-225,531-545`, `${CORE}validation/semantic.ts:49-54,91-112,227-247,249-352,372-399,426-435`,
  `${CATALOG}:3126-3161`];

export const LOGOUT_CASES = [
  { case_id: "L1", setup: "User logout, genuine committed handle; not_applicable and allow decisions, duplicate success",
    predicted_calls: 27,
    variants: [{ id: "not-applicable", predicted_calls: 13 }, { id: "duplicate-success", predicted_calls: 1 },
      { id: "allow", predicted_calls: 13 }],
    steps: ["not-applicable-begin", "not-applicable-mark", "not-applicable", "duplicate-success",
      "allow-begin", "allow-mark", "allow"],
    candidate_verdict: "FITS", rubric_reasons: ["Catalog investigation explicitly covers logout; user, session and commit meanings retained"],
    basis: [...COMMON, `${CORE}sdk.ts:208-282`, `${CORE}operations.ts:108,161-181`], confidence: "high" },
  { case_id: "L2", setup: "Default success without a handle",
    predicted_calls: 10, variants: [{ id: "no-handle", predicted_calls: 10 }], steps: ["no-handle"],
    basis: [...COMMON, `${CORE}events.ts:190-197,223-225`], confidence: "high" },
  { case_id: "L3", setup: "Tenantless revocation refusal, same usable handle retried under tenant; tenantless login/session controls",
    predicted_calls: 35,
    variants: [{ id: "tenantless", predicted_calls: 12 }, { id: "usable-handle", predicted_calls: 9 },
      { id: "tenantless-login", predicted_calls: 12 }, { id: "tenantless-session", predicted_calls: 2 }],
    steps: ["begin", "mark", "tenantless", "usable-handle", "tenantless-login", "tenantless-session"],
    basis: [...COMMON, `${CORE}validation/semantic.ts:49,53-54,391-399`, `${CORE}sdk.ts:234-248`,
      `${CATALOG}:2847-2880,3072-3100`], confidence: "high" },
  { case_id: "L4", setup: "Committed revocation with anonymous actor; acceptance is not honest logout",
    predicted_calls: 13, variants: [{ id: "anonymous", predicted_calls: 13 }], steps: ["anonymous-begin", "anonymous-mark", "anonymous"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Contradicts catalog actor_rule: authenticated actor required"],
    basis: [...COMMON, `${CORE}validation/semantic.ts:249-263,372-389,461-463`], confidence: "high" },
  { case_id: "L5a", setup: "Explicit denied administrator revocation, deny policy, no handle",
    predicted_calls: 10, variants: [{ id: "denied-no-handle", predicted_calls: 10 }], steps: ["denied-no-handle"],
    corrected_from: { expected: "Accepted denied/committed occurrence (draft #804 comment 6137646538)",
      corrected_to: "Returned PREMATURE_SUCCESS/validation at /operation/state; zero sink calls",
      reason: "#797: every transaction-bound outcome requires SDK-issued terminal evidence; no catalog-first fallback" },
    basis: [...COMMON, `${CORE}events.ts:209-226`], confidence: "high" },
  { case_id: "L5b", setup: "Explicit denied revocation, direct not_committed, no handle",
    predicted_calls: 10, variants: [{ id: "direct-not-committed", predicted_calls: 10 }], steps: ["direct-not-committed"],
    basis: [...COMMON, `${CORE}events.ts:213-215`], confidence: "high" },
  { case_id: "L5c", setup: "Administrator denial explicitly uses markNotCommitted and outcome denied (not default failure)",
    predicted_calls: 13, variants: [{ id: "denied-not-committed", predicted_calls: 13 }],
    steps: ["begin", "mark", "denied-not-committed"], candidate_verdict: "FITS",
    rubric_reasons: ["Denial and genuine not_committed evidence agree; no success claim"],
    basis: [...COMMON, `${CORE}operations.ts:109,212-222`, `${CORE}validation/semantic.ts:91-96,426-435`],
    confidence: "high", outcome_review: "#812 changes no outcome: explicit denied + not_committed remains accepted" },
];
