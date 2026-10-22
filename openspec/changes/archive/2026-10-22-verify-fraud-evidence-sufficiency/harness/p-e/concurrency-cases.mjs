// Build hypotheses from #803 comment 6137619745 at 5d931ad, re-derived at
// abcbefa03d5b0afc610deb712d7f4ded5a9e82be. G-log implementer default:
// Node factory. Sequential layout for 6b/6c and all step names are implementer
// defaults. The P-E-6 parking correction changes no expected final outcome.
const NODE = "packages/security-audit-sdk-node/src/delivery-classes.ts:";
const CORE = "packages/security-audit-sdk-core/src/";
const SHARED = ["contracts/security-audit/source/contract.source.json:595-604",
  `${CORE}index.ts:11-46`, `${CORE}testing.ts:21-33`,
  "packages/security-audit-sdk-core/tests/conformance-account-authentication-session.test.ts:26-98,225-249",
  "packages/security-audit-sdk-node/src/platform.ts:51-53",
  "packages/security-audit-sdk-node/src/http-handoff.ts:98-114,139-163"];

export const CONCURRENCY_CASES = [
  {
    case_id: "P-E-6", family: "concurrency", comment_id: "6137619745",
    setup: "Truthful handle-backed occurrence. Create parking deferred BEFORE d1. Start d1 without awaiting it, await d2 for the same pair, explicitly release in finally, await d1 and deliver a third time.",
    expected: "d2 is exactly {status:'refused',code:'duplicate_transaction_delivery',event_id}; probe is already 1 after d1 starts. Do not freeze gate/exchange totals at d2 resolution. d1 is committed_and_durable; third is already_delivered. Final probe/gate/exchange=1/1/1.",
    classification: "holds: pair-key in-flight idempotency within one binding, not per-transaction gate idempotency.",
    basis: [...SHARED, `${NODE}268-286,305-328,342-356,462-464`], confidence: "high",
    predicted_calls: 20, predicted: { probe: 1, gate: 1, exchange: 1, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-6b", family: "concurrency", comment_id: "6137619745",
    setup: "One truthful occurrence and one binding. Sequentially deliver with the handle transaction id, then with pe-txn-other-0001. The occurrence and body remain untouched.",
    expected: "Both return committed_and_durable. Probe/gate/exchange=2/2/2; same event id and body hash, different caller transaction ids; caller transaction id is not checked against occurrence correlation.",
    classification: "SDK cannot detect: caller-supplied transaction differs from the occurrence. Pair-key deduplication holds only per pair.",
    basis: [...SHARED, `${NODE}273-286,305-328,342-356,462-464`], confidence: "high",
    predicted_calls: 22, predicted: { probe: 2, gate: 2, exchange: 2, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-6c", family: "concurrency", comment_id: "6137619745",
    setup: "Fresh handle marked not_committed, no business commit. Emit mfaRemoved twice on that handle, delivering each captured occurrence on one binding with one transaction id.",
    expected: "Two accepted failure/not_committed occurrences have distinct event ids and one transaction id. Both binding results are committed_and_durable. Probe/gate/exchange=2/2/2; the gate runs twice for that transaction id.",
    classification: "holds per pair; SDK cannot detect per-transaction gate non-idempotency. Finding: two occurrences with one transaction id run the gate twice. misrepresents: committed_and_durable labels not_committed occurrences.",
    basis: [...SHARED, `${NODE}273-286,320-328,342-356,462-464`, `${CORE}sdk.ts:475-483`,
      `${CORE}events.ts:190-198,205-225`], confidence: "high",
    predicted_calls: 24, predicted: { probe: 2, gate: 2, exchange: 2, sink: 2, business_commits: 0 },
  },
];
