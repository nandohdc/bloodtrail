// Construction-family build hypotheses, NOT frozen expectations or measured
// evidence. Drafted at 5d931ad in #803 comment 6137619745, re-derived against
// PE_BASE. Every refusal shape and citation was re-read at the pinned base;
// #797 (783196a) changes P-E-1f from the draft's accepted side observation to
// a refusal, recorded as corrected_from, not silently edited.
export const PE_BASE = "abcbefa03d5b0afc610deb712d7f4ded5a9e82be";
export const PE_COMMENT = "6137619745";

const CORE = "packages/security-audit-sdk-core/src/";
const src = (...paths) => paths.map((path) => `${CORE}${path}`);
const SCHEMA = "contracts/security-audit/schema/security-audit-event.schema.json";
const INPUT = "packages/security-audit-sdk-core/tests/conformance-account-authentication-session.test.ts:26-98,225-249";

const SHARED = [INPUT, ...src("events.ts:190-198,205-225", "sdk.ts:208-246", "errors.ts:41-58",
  "operations.ts:72-84,86-98,108-112,212-222", "generated/contract.generated.ts:656-671,2924-2933")];

export const CONSTRUCTION_CASES = [
  {
    case_id: "P-E-1a",
    family: "construction",
    scenario: "pending handle",
    comment_id: PE_COMMENT,
    setup: "h = sdk.beginOperation({boundEvent:'mfaRemoved'}).value; state 'started', transactional true, no business commit yet. await sdk.mfaRemoved({...MFA_INPUT, operation:h}) with no event.commit_state and no event.outcome. Follow-up: h.markCommitted(), then the same mfaRemoved call again.",
    expected: "The named method resolves and never throws: {ok:false, error:{code:'PREMATURE_SUCCESS', category:'validation', path:'/operation/state'}}. Capturing sink events.length = 0; probe=0, gate=0, exchange=0 because no occurrence exists to deliver; h.state stays 'started'. Follow-up: markCommitted returns {ok:true, value:{state:'committed', commit_state:'committed', ...}}; the second mfaRemoved returns {ok:true, value:{status:'accepted'}} and sink events.length = 1. The refused attempt reserved no completion, so the handle is still usable.",
    classification: "Premature-success guard holds for the handle path (the transaction_critical row is not reached).",
    basis: [...SHARED, ...src("events.ts:216-220", "operations.ts:212-222", "sdk.ts:233-237")],
    confidence: "high",
    predicted_calls: 13,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 1, business_commits: 0 },
  },
  {
    case_id: "P-E-1b",
    family: "construction",
    scenario: "direct commit_state, no handle",
    comment_id: PE_COMMENT,
    setup: "await sdk.mfaRemoved({...MFA_INPUT, event:{commit_state:'committed'}}) with no operation.",
    expected: "{ok:false, error:{code:'PREMATURE_SUCCESS', category:'validation', path:'/event/commit_state'}}. Sink events = 0. probe/gate/exchange = 0.",
    classification: "Premature-success guard holds for the direct path. Its path differs from P-E-1a: /event/commit_state vs /operation/state.",
    basis: [...SHARED, ...src("events.ts:211-215")],
    confidence: "high",
    predicted_calls: 9,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 },
  },
  {
    case_id: "P-E-1c",
    family: "construction",
    scenario: "pending handle plus direct commit_state",
    comment_id: PE_COMMENT,
    setup: "h = sdk.beginOperation({boundEvent:'mfaRemoved'}), not marked. await sdk.mfaRemoved({...MFA_INPUT, operation:h, event:{commit_state:'committed'}}).",
    expected: "{ok:false, error:{code:'PREMATURE_SUCCESS', category:'validation', path:'/event/commit_state'}}. The direct check runs before the pending check. Sink events = 0.",
    classification: "Guard holds. The direct-value check takes precedence.",
    basis: [...SHARED, ...src("events.ts:211-220", "operations.ts:212-222")],
    confidence: "high",
    predicted_calls: 10,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 },
  },
  {
    case_id: "P-E-1d",
    family: "construction",
    scenario: "neither handle nor commit_state",
    comment_id: PE_COMMENT,
    setup: "await sdk.mfaRemoved({...MFA_INPUT}) with no operation and no event fields.",
    expected: "{ok:false, error:{code:'PREMATURE_SUCCESS', category:'validation', path:'/operation/state'}}. The path names /operation/state even though no operation was supplied. Sink events = 0.",
    classification: "Guard holds.",
    basis: [...SHARED, ...src("events.ts:222-225", "generated/contract.generated.ts:663-668")],
    confidence: "high",
    predicted_calls: 9,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 },
  },
  {
    case_id: "P-E-1e",
    family: "construction",
    scenario: "non-transactional started handle",
    comment_id: PE_COMMENT,
    setup: "h = sdk.beginOperation({boundEvent:'mfaRemoved', transactional:false}), not marked. await sdk.mfaRemoved({...MFA_INPUT, operation:h}).",
    expected: "{ok:false, error:{code:'PREMATURE_SUCCESS', category:'validation', path:'/event/commit_state'}}. This one comes from the standalone semantic validator, not from resolveCommitState. Sink events = 0.",
    classification: "Guard holds through a second layer.",
    basis: [...SHARED, ...src("operations.ts:212-214", "events.ts:216-220,503-519", "validation/semantic.ts:227-238"), SCHEMA],
    confidence: "high",
    predicted_calls: 10,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 },
  },
  {
    case_id: "P-E-1f",
    family: "construction",
    scenario: "no handle and outcome failure",
    comment_id: PE_COMMENT,
    setup: "await sdk.mfaRemoved({...MFA_INPUT, event:{outcome:'failure'}}) with no operation.",
    expected: "{ok:false, error:{code:'PREMATURE_SUCCESS', category:'validation', path:'/operation/state'}}. Sink events = 0; probe/gate/exchange = 0. No occurrence exists, and P-E produces none by bypassing the refusal. The draft's accepted side observation (commit_state 'committed' defaulted from the outcome) can no longer be produced.",
    classification: "Corrected by #797: the guard now holds on the handle-less path too. The draft's 'SDK cannot detect' no longer applies; the transaction_critical row is not reached.",
    basis: [...SHARED, ...src("events.ts:205-225", "generated/contract.generated.ts:663-668")],
    confidence: "high",
    predicted_calls: 9,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 },
    corrected_from: {
      old_text: "Accepted: {ok:true, value:{status:'accepted'}}, sink events = 1. The captured occurrence has event.outcome 'failure' and event.commit_state 'committed', although no handle was ever transitioned.",
      reason: "#797 (783196a) removed the outcome-derived commit default: resolveCommitState now refuses every transaction-bound event without operation evidence or a direct terminal commit state (events.ts:222-225), so no occurrence, sink call, probe, gate or exchange happens.",
    },
  },
];
