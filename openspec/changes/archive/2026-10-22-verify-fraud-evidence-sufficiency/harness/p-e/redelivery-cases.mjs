// Redelivery-family build hypotheses, NOT frozen expectations or measured
// evidence. Drafted at 5d931ad in #803 comment 6137619745, re-derived against
// PE_BASE. P-E-5's redelivery k is frozen at 3 (G-log implementer default;
// the expectations header transcribes it in the freeze story). None of these
// cases changes the draft's outcome, so no corrected_from entry is claimed;
// changed line numbers live in basis. All variant layouts/quiet-interval
// choices here are implementer defaults. G-log implementer defaults supply
// the Node SDK factory and k=3. P-E-x1 stays a supplementary measurement.
// Note for a later Node-binding change, NOT a case: durabilityAttempted can
// be true even if request projection prevents any exchange (http-handoff.ts:
// 100-106; delivery-classes.ts:353-355). These cases do not claim otherwise.
export const PE_BASE = "abcbefa03d5b0afc610deb712d7f4ded5a9e82be";
export const PE_COMMENT = "6137619745";
export const REDELIVERY_K = 3;

const CORE = "packages/security-audit-sdk-core/src/";
const NODE = "packages/security-audit-sdk-node/src/";
const binding = (...paths) => paths.map((path) => `${NODE}${path}`);
const ROW = "contracts/security-audit/source/contract.source.json:595-604";
const INPUT = "packages/security-audit-sdk-core/tests/conformance-account-authentication-session.test.ts:26-98,225-249";

const SHARED = [INPUT, `${CORE}index.ts:11-46`,
  ...binding("platform.ts:51-53", "delivery-classes.ts:203-208,262-267", "http-handoff.ts:98-114,139-163",
    "http-response-classification.ts:31-34,48-53,55-63,72-78"),
  `${CORE}testing.ts:21-33`, ROW];

export const REDELIVERY_CASES = [
  {
    case_id: "P-E-5",
    family: "redelivery",
    scenario: "handoff fails after commit, then caller redelivery k times on the same binding",
    comment_id: PE_COMMENT,
    setup: "Truthful order (P-E-2) for ev and h, with businessCommits=1. On one binding B the exchange script is: calls 1..k return {kind:'response', status:503, acknowledgments:[]}, call k+1 acknowledges. k is frozen at 3. One initial B.deliver, then k redeliveries B.deliver(ev, h.transactionId, countingGate), then one more. After the initial failure, one observed quiet interval (a single macrotask turn, no delay) precedes caller redeliveries. This bounds the observation; it is not a persistence claim.",
    expected: "The initial deliver and redeliveries 1..k-1 each return {status:'failed_closed', code:'audit_durability_unreachable', event_id, commitGateInvoked:true, durabilityAttempted:true}. Redelivery k returns {status:'committed_and_durable', event_id, transaction_id}. Totals after redelivery k: probe=k+1, gate=k+1, exchange=k+1 (4/4/4 for k=3), while businessCommits stays 1. Every exchange request has attempt 0, the same event_id and an identical body SHA-256. After the observed quiet interval following the initial failure, the exchange count is unchanged; static inspection shows no retry scheduler. The final deliver returns {status:'already_delivered', event_id, transaction_id} and the counts stay at k+1 each; the gate is not invoked.",
    classification: "Contract row retry 'persistent retry after commit' is not provided. Retry is caller-driven and re-runs the probe and the commit gate on every attempt.",
    basis: [...SHARED, ...binding("delivery-classes.ts:273-286,320-326,342-356", "http-handoff.ts:13-21")],
    confidence: "high",
    predicted_calls: 31,
    predicted: { probe: 4, gate: 4, exchange: 4, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-7",
    family: "redelivery",
    scenario: "fresh binding instance after success",
    comment_id: PE_COMMENT,
    setup: "After P-E-2 succeeds on B1 (ev and h from the truthful order), create B2 = createTransactionCriticalDelivery({handoff, durabilityProbe}) and call B2.deliver(ev, h.transactionId, countingGate). Then call B1.deliver again.",
    expected: "B2: probe+1, gate+1, exchange+1, and committed_and_durable. Across both instances the exchange has seen the same event_id twice with an identical body hash. B1: already_delivered with counts unchanged.",
    classification: "Contract row idempotency is per instance and in memory only, so the same occurrence is delivered twice across instances or restarts.",
    basis: [...SHARED, ...binding("delivery-classes.ts:258-259,268-286,320-326")],
    confidence: "high",
    predicted_calls: 25,
    predicted: { probe: 2, gate: 2, exchange: 2, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-8",
    family: "redelivery",
    scenario: "permanent rejection after commit",
    comment_id: PE_COMMENT,
    setup: "Truthful order. The exchange returns {kind:'response', status:422, acknowledgments:[]}. Call B.deliver, then redeliver once. Variants: a 2xx with a mismatched acknowledgment, and a 3xx.",
    expected: "Every call returns {status:'failed_closed', code:'audit_durability_unreachable', event_id, commitGateInvoked:true, durabilityAttempted:true} and probe, gate and exchange each rise by 1. The handoff's own non_retryable/http_permanent classification does not appear in the result; only the exchange log shows the 422. A permanent rejection never stops further attempts; the variants (protocol_error) give the identical result.",
    classification: "The binding result cannot tell a permanent rejection from a retryable outage.",
    basis: [...SHARED, ...binding("delivery-classes.ts:342-356")],
    confidence: "high",
    predicted_calls: 30,
    predicted: { probe: 4, gate: 4, exchange: 4, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-x1",
    family: "redelivery",
    scenario: "supplementary: the commit gate or the probe throws",
    comment_id: PE_COMMENT,
    setup: "Truthful order. Call B.deliver(ev, h.transactionId, gate) where the gate throws a synthetic Error. Variant: the probe throws. Then deliver again with the recovered no-op gate/probe.",
    expected: "The deliver promise rejects with the thrown error and returns no result object: the record is a thrown observation {name:'Error', message}, never a binding result. Gate variant: probe=1, gate=1, exchange=0 before the throw. Probe variant: probe=1, gate=0, exchange=0. The reservation is released in the finally, so the next deliver is admitted and runs probe, gate and exchange again, settling committed_and_durable.",
    classification: "The binding does not convert throwing injected callbacks into results, so results-not-exceptions does not hold at this boundary.",
    basis: [...SHARED, ...binding("delivery-classes.ts:273-286,342-356", "http-handoff.ts:108-113")],
    confidence: "high",
    predicted_calls: 41,
    predicted: { probe: 4, gate: 3, exchange: 2, sink: 2, business_commits: 2 },
  },
  {
    case_id: "P-E-2c",
    family: "redelivery",
    scenario: "redelivery after a probe-false or declined fail-closed: the key never settles",
    comment_id: PE_COMMENT,
    setup: "Truthful order (businessCommits=1). Variant A: durabilityProbe scripted [false, true], counting gate 'committed', acknowledging exchange; deliver, then redeliver. Variant B: probe always true, gate scripted ['declined', 'committed']; deliver, then redeliver.",
    expected: "Variant A first call: {status:'failed_closed', code:'audit_durability_unreachable', event_id, commitGateInvoked:false, durabilityAttempted:false}. The second call is admitted, not already_delivered, and returns committed_and_durable. Totals: probe=2, gate=1, exchange=1, businessCommits still 1; the gate's first invocation comes after the business commit. Variant B first call: {status:'failed_closed', code:'business_commit_declined', event_id, commitGateInvoked:true, durabilityAttempted:false}. Second call: committed_and_durable. Totals: probe=2, gate=2, exchange=1.",
    classification: "Contract row retry is not provided; it is caller-driven. A fail_closed result never settles the key, so every redelivery re-runs the probe and the gate. Under the truthful order, 'fail_closed before business commit' is vacuous.",
    basis: [...SHARED, ...binding("delivery-classes.ts:273-286,320-326,342-352")],
    confidence: "high",
    predicted_calls: 41,
    predicted: { probe: 4, gate: 3, exchange: 2, sink: 2, business_commits: 2 },
  },
  {
    case_id: "P-E-x2",
    family: "redelivery",
    scenario: "commit gate or probe resolving an unexpected value fails open",
    comment_id: PE_COMMENT,
    setup: "Truthful order, acknowledging exchange. (a) The gate resolves undefined, or 'failed' through a cast, instead of 'committed' or 'declined': one fresh binding per value, one deliver each. (b) The probe resolves a truthy non-boolean, 1 or 'no', through a cast: one fresh binding per value, one deliver each. (c) The probe resolves falsy non-booleans 0, '' and undefined, scripted across three delivers on one binding.",
    expected: "(a) Both delivers return {status:'committed_and_durable', event_id, transaction_id} with probe=1, gate=1, exchange=1 each: only the exact string 'declined' stops the pipeline. (b) Each truthy value proceeds to the gate and then the exchange: committed_and_durable with 1/1/1 each. (c) Each falsy value returns {status:'failed_closed', code:'audit_durability_unreachable', event_id, commitGateInvoked:false, durabilityAttempted:false} with 1/0/0 each; the key never settles, so all three are admitted.",
    classification: "The commit-gate decision fails open: any value other than 'declined' is treated as committed. The probe decision is truthiness-based.",
    basis: [...SHARED, ...binding("delivery-classes.ts:190,342-356")],
    confidence: "high",
    predicted_calls: 44,
    predicted: { probe: 7, gate: 4, exchange: 4, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-x3",
    family: "redelivery",
    scenario: "exchange throws or times out after the commit",
    comment_id: PE_COMMENT,
    setup: "Truthful order. The exchange (a) throws a synthetic Error or (b) resolves {kind:'timeout'}. Call B.deliver(ev, h.transactionId, countingGate), then redeliver once, per variant on its own binding.",
    expected: "The deliver promise resolves; it does not reject. Result: {status:'failed_closed', code:'audit_durability_unreachable', event_id, commitGateInvoked:true, durabilityAttempted:true}. Counts per call: probe=1, gate=1, exchange=1. The handoff-level code (transport_failure or timeout) does not appear in the result. A redelivery is admitted again and gives the same result.",
    classification: "Unlike P-E-x1, a failing exchange is converted into a result. Like P-E-8, the binding result cannot distinguish the cause.",
    basis: [...SHARED, ...binding("delivery-classes.ts:342-356", "http-handoff.ts:13-21,108-114"),
      `${NODE}http-response-classification.ts:36-46`],
    confidence: "high",
    predicted_calls: 32,
    predicted: { probe: 4, gate: 4, exchange: 4, sink: 1, business_commits: 1 },
  },
];
