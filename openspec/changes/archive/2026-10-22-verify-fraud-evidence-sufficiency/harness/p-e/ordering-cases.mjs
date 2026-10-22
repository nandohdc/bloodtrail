// Ordering-family build hypotheses, NOT frozen expectations or measured
// evidence. Drafted at 5d931ad in #803 comment 6137619745, re-derived against
// PE_BASE. The P-E-4 review correction (fresh-handle linkage) is recorded as
// corrected_from; P-E-3a's committed_and_durable label on a not_committed
// occurrence is an expected finding, not an expectation mismatch.
export const PE_BASE = "abcbefa03d5b0afc610deb712d7f4ded5a9e82be";
export const PE_COMMENT = "6137619745";

const CORE = "packages/security-audit-sdk-core/src/";
const NODE = "packages/security-audit-sdk-node/src/";
const src = (...paths) => paths.map((path) => `${CORE}${path}`);
const binding = (...paths) => paths.map((path) => `${NODE}${path}`);
const ROW = "contracts/security-audit/source/contract.source.json:595-604";
const INPUT = "packages/security-audit-sdk-core/tests/conformance-account-authentication-session.test.ts:26-98,225-249";

const SHARED = [INPUT, `${CORE}index.ts:11-46`,
  ...binding("platform.ts:51-53", "delivery-classes.ts:203-208", "http-handoff.ts:98-114,139-163",
    "http-response-classification.ts:31-33,48-53,55-64,72-78"),
  `${CORE}testing.ts:21-33`, ROW];

export const ORDERING_CASES = [
  {
    case_id: "P-E-2",
    family: "ordering",
    scenario: "truthful order",
    comment_id: PE_COMMENT,
    setup: "1. h = beginOperation({boundEvent:'mfaRemoved'}). 2. Harness business commit: businessCommits=1, seq 'commit'. 3. h.markCommitted(). 4. r = await sdk.mfaRemoved({...MFA_INPUT, operation:h}). 5. ev = capturingSink.events[0]. 6. B = createTransactionCriticalDelivery({handoff, durabilityProbe: counting, resolves true}). 7. res = await B.deliver(ev, h.transactionId, countingGate returning 'committed'). The exchange acknowledges.",
    expected: "r = {ok:true, value:{status:'accepted'}}. ev is frozen, with event.name 'bloodtrail.audit.authentication.mfa.removed', outcome 'success', lifecycle_phase 'completed', commit_state 'committed' and delivery_class 'transaction_critical'. Its correlation has transaction_id = h.transactionId, operation_id = h.operationId and retry_attempt = 0. resource.operation_type is derived as 'delete' when omitted. Counts: probe=1, gate=1, exchange=1. The exchange request has attempt 0, event_id ev.event.id, method POST and path '/v1/security-audit'. res = {status:'committed_and_durable', event_id: ev.event.id, transaction_id: h.transactionId}. The success variant carries no commitGateInvoked or durabilityAttempted fields. seq = [commit, markCommitted, sinkEmit, probe, gate, exchange], so t_commit < t_probe.",
    classification: "Contract row: durability 'atomic with successful business commit' is not established. The probe runs after the commit it was meant to guard.",
    basis: [...SHARED,
      ...binding("delivery-classes.ts:276-284,342-356"),
      ...src("events.ts:106-143,227-253,383-394")],
    confidence: "high",
    predicted_calls: 18,
    predicted: { probe: 1, gate: 1, exchange: 1, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-2b",
    family: "ordering",
    scenario: "truthful order with probe false",
    comment_id: PE_COMMENT,
    setup: "Same as P-E-2, but durabilityProbe resolves false.",
    expected: "res = {status:'failed_closed', code:'audit_durability_unreachable', event_id: ev.event.id, commitGateInvoked:false, durabilityAttempted:false}. Counts: probe=1, gate=0, exchange=0. businessCommits is already 1, so the fail-closed refusal happened after the business commit.",
    classification: "business_failure_posture 'fail_closed before business commit' is vacuous under the truthful order.",
    basis: [...SHARED, ...binding("delivery-classes.ts:347-349,466-479")],
    confidence: "high",
    predicted_calls: 16,
    predicted: { probe: 1, gate: 0, exchange: 0, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-3a",
    family: "ordering",
    scenario: "not_committed occurrence, gate committed",
    comment_id: PE_COMMENT,
    setup: "h = beginOperation({boundEvent:'mfaRemoved'}). Call h.markNotCommitted(), then emit. ev = captured. Then B.deliver(ev, h.transactionId, countingGate returning 'committed'). The exchange acknowledges.",
    expected: "Emit returns ok accepted. ev has outcome 'failure' and commit_state 'not_committed'. Counts: probe=1, gate=1, exchange=1. res = {status:'committed_and_durable', event_id, transaction_id}. The binding labels a not_committed occurrence 'committed_and_durable' (expected finding, not an expectation mismatch). Re-emitting on the same not-committed handle is not refused, because failure is not a terminal success, and each emit mints a new event id.",
    classification: "The binding never reads commit_state or outcome, so its status label misrepresents the occurrence.",
    basis: [...SHARED,
      ...binding("delivery-classes.ts:305-318,342-356,448-455"),
      ...src("events.ts:190-198", "operations.ts:212-222", "sdk.ts:475-483")],
    confidence: "high",
    predicted_calls: 18,
    predicted: { probe: 1, gate: 1, exchange: 1, sink: 1, business_commits: 0 },
  },
  {
    case_id: "P-E-3b",
    family: "ordering",
    scenario: "not_committed occurrence, gate declined",
    comment_id: PE_COMMENT,
    setup: "Same as P-E-3a, but the gate returns 'declined', which is truthful because no business commit happened.",
    expected: "res = {status:'failed_closed', code:'business_commit_declined', event_id, commitGateInvoked:true, durabilityAttempted:false}. Counts: probe=1, gate=1, exchange=0. The record of the not-committed removal never reaches the durability point through this binding.",
    classification: "A truthful gate drops not-committed audit records. Only a gate that says 'committed' makes them durable.",
    basis: [...SHARED, ...binding("delivery-classes.ts:350-352")],
    confidence: "high",
    predicted_calls: 17,
    predicted: { probe: 1, gate: 1, exchange: 0, sink: 1, business_commits: 0 },
  },
  {
    case_id: "P-E-4",
    family: "ordering",
    scenario: "untruthful order, probe false",
    comment_id: PE_COMMENT,
    setup: "h = beginOperation({boundEvent:'mfaRemoved'}). Call h.markCommitted() with no business commit. r = await sdk.mfaRemoved({...MFA_INPUT, operation:h}). ev = captured. Then B.deliver(ev, h.transactionId, countingGate), with the probe resolving false. Afterwards call h.markNotCommitted(), h.markCancelled(), and a plain re-emit on h. Then the corrected linkage follow-up: h2 = beginOperation({boundEvent:'mfaRemoved', transactionId:h.transactionId, correlationId:h.correlationId}); h2.markNotCommitted(); emit mfaRemoved({...MFA_INPUT, operation:h2, retry:{retry_attempt:1, original_event_id:<false event id>}}); beginOperation({operationId:h.operationId}); then B.deliver(corrective, h.transactionId, gate).",
    expected: "r = {ok:true, value:{status:'accepted'}}, and the core sink holds 1 occurrence with commit_state 'committed'. res = {status:'failed_closed', code:'audit_durability_unreachable', event_id, commitGateInvoked:false, durabilityAttempted:false}. Counts: probe=1, gate=0, exchange=0, businessCommits=0. h.state is 'committed'. markNotCommitted and markCancelled each return {ok:false, error:{code:'SDK_INVALID_OPERATION_TRANSITION', category:'lifecycle', path:'/operation/state'}}. The plain re-emit returns {ok:false, error:{code:'SDK_DUPLICATE_SUCCESS', category:'lifecycle', path:'/operation/state'}} and the sink count stays 1. h2 = beginOperation({boundEvent:'mfaRemoved', transactionId:h.transactionId, correlationId:h.correlationId}) returns {ok:true}, with a new h2.operationId and h2.transactionId === h.transactionId. After h2.markNotCommitted(), emitting mfaRemoved({...MFA_INPUT, operation:h2, retry:{retry_attempt:1, original_event_id:<false event id>}}) returns {ok:true, value:{status:'accepted'}}. That occurrence has outcome 'failure', commit_state 'not_committed', correlation.transaction_id = h.transactionId, correlation_id = h.correlationId and original_event_id = <false id>. Only beginOperation({operationId:h.operationId}) is refused: SDK_INVALID_IDENTIFIER / validation / /operation/operation_id. On B, deliver(corrective, h.transactionId, gate) is admitted because the key differs (new event id).",
    classification: "The SDK cannot detect this: an occurrence says committed although no commit happened. The SDK neither requires nor verifies any link between a false committed record and its correction; a link exists only if the host supplies it.",
    basis: [...SHARED,
      ...binding("delivery-classes.ts:347-349,305-327,462-464"),
      ...src("operations.ts:108,86-98,109,112", "sdk.ts:94-104,248-266,279-296", "events.ts:227-253", "validation/semantic.ts:354-360")],
    confidence: "high",
    predicted_calls: 28,
    predicted: { probe: 2, gate: 1, exchange: 1, sink: 2, business_commits: 0 },
    corrected_from: {
      old_text: "A corrective not_committed record needs a fresh handle, which gets a new operation_id and transaction_id, so nothing in the record links it to the false one.",
      reason: "Review correction: beginOperation refuses only a reused operationId (sdk.ts:94-104). It accepts a caller-supplied transactionId and correlationId equal to h's (operations.ts:132-150), and buildCorrelation accepts retry.original_event_id pointing at the false occurrence (events.ts:227-253). The host can link the corrective record; the SDK just never requires or checks that link.",
    },
  },
  {
    case_id: "P-E-4b",
    family: "ordering",
    scenario: "the binding's designed order",
    comment_id: PE_COMMENT,
    setup: "Call h.markCommitted() with no business commit, then emit. ev = captured. Then B.deliver(ev, h.transactionId, gate), where the probe resolves true and the gate performs the business commit and returns 'committed'. The exchange acknowledges. Variant: the gate's commit fails and returns 'declined'.",
    expected: "Main run: probe=1, gate=1 (this is the only business commit), exchange=1, res committed_and_durable. Variant: res = {status:'failed_closed', code:'business_commit_declined', event_id, commitGateInvoked:true, durabilityAttempted:false}, exchange=0, businessCommits=0. The core sink already holds the occurrence that says committed.",
    classification: "The binding's documented order can be satisfied only by an occurrence constructed before the commit, which is untruthful.",
    basis: [...SHARED, ...binding("delivery-classes.ts:234-246,350-357")],
    confidence: "high",
    predicted_calls: 35,
    predicted: { probe: 2, gate: 2, exchange: 1, sink: 2, business_commits: 1 },
  },
];
