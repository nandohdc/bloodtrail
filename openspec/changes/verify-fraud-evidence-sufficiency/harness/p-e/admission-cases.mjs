// Source-driven setup correction (#797); no forged/private occurrence.
// Draft: #803 comment 6137619745 at 5d931ad. Corrected at abcbefa03d5b0afc610deb712d7f4ded5a9e82be.
// G-log implementer default: Node factory. Remaining setup choices are
// implementer defaults. This is build planning, not measured evidence.
export const ADMISSION_CASE = {
  case_id: "P-E-adm", family: "admission", comment_id: "6137619745",
  setup: "Fresh legitimate handle-backed committed MFA occurrence from the truthful order. Deliver with undefined and empty caller transaction ids, repeating each. SDK-construct authenticationFailed with authenticated actor, authoritative tenant, password authentication evidence and documentation source; deliver twice with a nonempty transaction id.",
  expected: "Missing/empty caller ids repeatedly return exactly {status:'refused',code:'transaction_id_required',event_id}. authenticationFailed repeatedly returns exactly {status:'refused',code:'delivery_class_mismatch',event_id}. No transaction_id/commitGateInvoked fields; probe/gate/exchange all zero; no reservation is made.",
  corrected_from: {
    old: "Use P-E-1f's accepted handle-free failure occurrence with no correlation.transaction_id.",
    new: "Use a legitimate handle-backed transaction-critical occurrence, passing undefined/empty caller arguments explicitly.",
    reason: "#797: core events.ts:223-225 now refuses P-E-1f PREMATURE_SUCCESS /operation/state, so no such occurrence exists. Refusal outcomes are unchanged; the old handle-free admission classification no longer applies.",
  },
  classification: "holds: class and caller-id admission guards. SDK cannot detect caller/occurrence transaction mismatch (P-E-6b); admission never reads correlation.transaction_id.",
  basis: ["packages/security-audit-sdk-node/src/delivery-classes.ts:305-328,448-455",
    "packages/security-audit-sdk-node/src/platform.ts:51-53",
    "packages/security-audit-sdk-core/src/events.ts:205-225,227-255",
    "packages/security-audit-sdk-core/src/generated/contract.generated.ts:601-625,656-687",
    "packages/security-audit-sdk-core/src/index.ts:11-46",
    "packages/security-audit-sdk-core/src/testing.ts:21-33",
    "packages/security-audit-sdk-core/tests/conformance-account-authentication-session.test.ts:26-98,190-213,225-249",
    "contracts/security-audit/source/contract.source.json:595-604"],
  confidence: "high", predicted_calls: 26,
  predicted: { probe: 0, gate: 0, exchange: 0, sink: 2, business_commits: 1 },
};
