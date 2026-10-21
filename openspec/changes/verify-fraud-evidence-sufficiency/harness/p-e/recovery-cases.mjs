// #803 comment 6137619745, drafted 5d931ad; re-derived at abcbefa03d5b0afc610deb712d7f4ded5a9e82be.
// G5: host-composed outbox. Plan/proposal: synthetic scratch SQLite, deleted.
// G-log implementer defaults: Node factory and runtime isTransaction provenance.
// Implementer defaults: fresh host/SDK and full P-E-10 replay per branch,
// namespaced observations, structural identity facts, no relay in these cases.
const CORE = "packages/security-audit-sdk-core/src/";
const SHARED = [`${CORE}index.ts:11-46`, `${CORE}operations.ts:86-112,132-150,176-186,212-224`,
  `${CORE}sdk.ts:86-107,208-245,248-296,318-338,475-483,498-545`,
  `${CORE}events.ts:55-70,134-149,190-225,227-253`,
  `${CORE}validation/semantic.ts:227-253`, `${CORE}generated/contract.generated.ts:656-681`,
  "packages/security-audit-sdk-node/src/platform.ts:51-53",
  "contracts/security-audit/source/contract.source.json:595-604"];

export const RECOVERY_CASES = [
  {
    case_id: "P-E-10b", family: "outbox", comment_id: "6137619745",
    setup: "Five independent full P-E-10 replays, ending markCompensated. New BEGIN/business insert for i fresh handle, ii bounded retry on compensated h, iii pure retained redelivery, iii named retained redelivery, iv reused operationId; COMMIT each.",
    expected: "i accepted, new event/operation/transaction/correlation ids, 1/1 rows. ii PREMATURE_SUCCESS/validation /event/commit_state, no new sink call, 1/0 rows. Both iii paths accepted with byte-identical retained event/id, 1/1 rows. iv SDK_INVALID_IDENTIFIER/validation /operation/operation_id, 1/0 rows. No probe/gate/exchange.",
    corrected_from: { old: "ii accepted with new event id and dangling original_event_id",
      reason: "Skeptic correction: P-E-10 ends compensated; bounded retry bypasses duplicate guard but success/compensated fails semantic validation. Preserve compensation setup." },
    classification: "SDK cannot reverse completion after rollback; fresh handles or retained redelivery compose retries; ii cannot use the compensated handle.",
    basis: SHARED, confidence: "high", predicted_calls: 95,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 8, business_commits: 5 },
    branches: { i: 21, ii: 18, "iii-sdk": 19, "iii-named": 19, iv: 18 },
  },
  {
    case_id: "P-E-10c", family: "outbox", comment_id: "6137619745",
    setup: "Fresh host/SDK, first sink throws before insert. BEGIN/insert/markCommitted/emit/ROLLBACK/snapshot; second BEGIN/insert/plain emit on SAME committed handle/COMMIT/snapshot.",
    expected: "First SDK_SINK_FAILURE/sink /sink with eventName bloodtrail.audit.authentication.mfa.removed, then zero rows and committed snapshot. Second accepted, new event id, same operation/transaction/correlation, one durable business/outbox row. Sink=2, no probe/gate/exchange.",
    classification: "Reservation release follows sink failure, not SQL durability; contrasts with completed success in P-E-10.",
    basis: SHARED, confidence: "high", predicted_calls: 15,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 2, business_commits: 1 },
  },
  {
    case_id: "P-E-10b(v)", family: "outbox", comment_id: "6137619745",
    setup: "Independent full P-E-10 replay including compensation; new BEGIN and fresh handle with old transactionId/correlationId, insert/markCommitted/emit/COMMIT.",
    expected: "beginOperation and emit accepted; new operation/event ids with equal transaction/correlation ids. One durable business/outbox row and row transaction id equals the rolled-back occurrence's. No probe/gate/exchange.",
    classification: "Host can retry under the same transaction id; only operationId reuse is guarded.",
    basis: SHARED, confidence: "high", predicted_calls: 21,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 2, business_commits: 1 },
  },
  {
    case_id: "P-E-10d", family: "outbox", comment_id: "6137619745",
    setup: "Four independent full P-E-10 replays, ending compensated with completed success. Emit a plain, b failure, c failure/not_committed, d bounded retry linked to retained event.",
    expected: "a SDK_DUPLICATE_SUCCESS/lifecycle /operation/state; b SDK_SEMANTIC_VALIDATION_FAILED/validation /event/commit_state; c and d PREMATURE_SUCCESS/validation /event/commit_state. Every variant retains zero rows, compensated handle and unchanged sink count. No mfa.removed compensation record exists.",
    classification: "not provided: mfa.removed has no compensated commit state. #812 consistency does not change these earlier validation/duplicate refusals.",
    basis: SHARED, confidence: "high", predicted_calls: 72,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 4, business_commits: 0 },
    branches: { a: 18, b: 18, c: 18, d: 18 },
  },
  {
    case_id: "P-E-9c", family: "outbox", comment_id: "6137619745",
    setup: "Fresh host/SDK per rollback and commit variant. Sink enters synchronously then awaits Promise.resolve before insert. BEGIN/insert/markCommitted, call emit and immediately finish SQL synchronously without awaiting emit; then settle emit and snapshot, finally close/delete DB.",
    expected: "Sink entered in transaction; zero inserts before await. SQL terminal action precedes outbox insert, inserted_is_transaction=false. Accepted committed occurrence. Rollback leaves 0 business/1 outbox row (orphan); commit leaves 1/1 but establishes no atomicity. Probe/gate/exchange=0/0/0.",
    classification: "finding: deferred insert after rollback durably misrepresents business truth. Commit variant's two rows do not establish atomicity; host must await pending sink work.",
    basis: SHARED, confidence: "high", predicted_calls: 24,
    predicted: { probe: 0, gate: 0, exchange: 0, sink: 2, business_commits: 1 },
    branches: { rollback: 12, commit: 12 },
  },
];
