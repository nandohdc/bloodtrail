// Build descriptors only. US-008 transcribes reviewed hypotheses into v1.
// G36 is an owner decision: second-factor reasons are allowed, still targetless.
const CORE = "packages/security-audit-sdk-core/src/";
const CATALOG = "contracts/security-audit/source/contract.source.json";
const COMMON = [`${CATALOG}:2902-2934`, `${CORE}context.ts:139-166,183-196,248-254,284-292,305-307,321-323,388-392`,
  `${CORE}events.ts:190-197,216-225,227-255,258-272,531-545`,
  `${CORE}validation/semantic.ts:50,91-112,227-247,249-352,372-389,391-399`];

export const MFA_CASES = [
  { case_id: "M1", setup: "Targetless second-factor failure on tenantless and tenant login pages",
    predicted_calls: 18, variants: [{ id: "tenantless", predicted_calls: 9 }, { id: "tenant", predicted_calls: 9 }],
    steps: ["tenantless", "tenant"], candidate_verdict: "FITS",
    rubric_reasons: ["Catalog permits failed authentication and mfa_failed; G36 permits second-factor reasons, still no target"],
    attribution: "The engine cannot attribute this targetless occurrence to an account; G36 design input",
    basis: COMMON, confidence: "high" },
  { case_id: "M2", setup: "Failure attaches a server-resolved account subject after the first factor",
    predicted_calls: 10, variants: [{ id: "resolved-subject", predicted_calls: 10 }], steps: ["resolved-subject"],
    candidate_verdict: "MISREPRESENTS",
    rubric_reasons: ["Honest provenance does not satisfy credential-type-only resource rule; subject is resource_context"],
    basis: [...COMMON, "contracts/security-audit/docs/authority-matrix.md:15"], confidence: "medium" },
  { case_id: "M3", setup: "Failure uses authenticated human actor merely because the first factor passed",
    predicted_calls: 9, variants: [{ id: "authenticated-actor", predicted_calls: 9 }], steps: ["authenticated-actor"],
    candidate_verdict: "MISREPRESENTS",
    rubric_reasons: ["First-factor success alone is not validated authenticated identity; actor.id discloses target"],
    basis: [...COMMON, `${CATALOG}:1317-1340`, "contracts/security-audit/docs/authority-matrix.md:12"], confidence: "high" },
  { case_id: "M4", setup: "Started transactional versus explicitly nontransactional handle on authentication.failed",
    predicted_calls: 19, variants: [{ id: "transactional", predicted_calls: 9 }, { id: "nontransactional", predicted_calls: 10 }],
    steps: ["transactional-begin", "transactional", "nontransactional-begin", "nontransactional"],
    basis: [...COMMON, `${CORE}operations.ts:212-222`, `${CORE}validation/semantic.ts:227-247,91-96`],
    confidence: "high", outcome_review: "#812 changes no outcome: failure/pending is catalog-invalid at /event/commit_state; failure/not_applicable remains accepted" },
];
