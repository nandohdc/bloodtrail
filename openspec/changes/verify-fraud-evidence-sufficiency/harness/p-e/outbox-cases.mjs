// #803 comment 6137619745 at 5d931ad; hypotheses re-derived at
// abcbefa03d5b0afc610deb712d7f4ded5a9e82be. G5: host-composed outbox.
// Plan/proposal: scratch node:sqlite is host-local, never Bloodtrail storage.
// G-log implementer defaults: Node factory; Node 26 isTransaction provenance.
// Implementer defaults: fresh file/SDK per case, explicit snapshot step, and
// P-E-9b uses ONE bare handoff (composed retry is Stage 2).
const CORE = "packages/security-audit-sdk-core/src/";
const NODE = "packages/security-audit-sdk-node/src/";
const SHARED = [`${CORE}index.ts:11-46`, `${CORE}operations.ts:100-112,212-224`,
  `${CORE}sdk.ts:208-245,248-296,299-338,475-483`, `${CORE}events.ts:90-143,227-253,383-394`,
  `${CORE}validation/index.ts:9-21`, `${CORE}errors.ts:74-82`,
  "packages/security-audit-sdk-core/tests/conformance-account-authentication-session.test.ts:225-249",
  `${NODE}platform.ts:51-53`, "contracts/security-audit/source/contract.source.json:595-604"];

export const OUTBOX_CASES = [
  {
    case_id: "P-E-9", family: "outbox", comment_id: "6137619745",
    setup: "Fresh host file and Node SDK with synchronous transaction-bound sink. BEGIN, business insert, markCommitted, mfaRemoved; record sink entry immediately before awaiting; await before COMMIT. Inspect snapshot/rows, then plain re-emit.",
    expected: "Accepted before COMMIT; sink enters and inserts synchronously with isTransaction true. One business and outbox row survives; public event/correlation/body match the handle. Handle and snapshot remain committed. Re-emit refuses SDK_DUPLICATE_SUCCESS/lifecycle at /operation/state without another sink call. Probe/gate/exchange=0/0/0.",
    classification: "holds through host composition: business row and audit record commit atomically, not a binding guarantee.",
    basis: SHARED, confidence: "high", predicted_calls: 13,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-9b", family: "outbox", comment_id: "6137619745",
    setup: "Independently reproduce committed P-E-9 setup. Parse stored outbox text; create bare handoff with injected ACK and call handoff(parsed, 0) exactly once after COMMIT. No transaction-critical binding.",
    expected: "acknowledged/acknowledged, event_id equals row, attempt 0. One live exchange body hash equals the stored text hash; one business and one outbox row remain. Probe/gate/exchange=0/0/1.",
    classification: "holds: byte identity across this host-outbox round trip and single bare handoff; no composed retry claim.",
    basis: [...SHARED, `${NODE}http-handoff.ts:98-114,139-175`, `${NODE}http-response-classification.ts:48-53,72-78`],
    confidence: "high", predicted_calls: 15,
    predicted: { probe: 0, gate: 0, exchange: 1, sink: 1, business_commits: 1 },
  },
  {
    case_id: "P-E-10", family: "outbox", comment_id: "6137619745",
    setup: "Fresh host/SDK: BEGIN, business insert, markCommitted, await accepted emit, ROLLBACK. Snapshot, plain re-emit, markNotCommitted, markCancelled, markCommitted, markCompensated, in that order.",
    expected: "Accepted before rollback with one synchronous transactional insert. Zero business/outbox rows survive. Public handle/snapshot stay committed. Re-emit refuses SDK_DUPLICATE_SUCCESS; reverse/cancel transitions refuse SDK_INVALID_OPERATION_TRANSITION (all lifecycle /operation/state). Same-state markCommitted succeeds as no-op; markCompensated succeeds last. Sink remains 1; probe/gate/exchange=0/0/0.",
    classification: "durable atomicity holds through host composition; SDK cannot detect rollback: committed in-memory state and completed success diverge from zero durable rows. Compensation misrepresents a never-durable commit.",
    basis: [...SHARED, `${CORE}operations.ts:86-98,176-186`], confidence: "high", predicted_calls: 17,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 1, business_commits: 0 },
  },
];
