// Observation fixture authored separately from the plan. These are public-
// shape doubles, not output of the oracle, workloads, frozen JSON or an SDK.
const ZERO = { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 };
const PIPE = { ...ZERO, probe: 1, gate: 1, exchange: 1 };
const DIGEST = "a".repeat(64);
const TXN = "pe-txn-fixture-01";
const EVENT = "pe-event-fixture-01";
const returned = (step_id, raw, counters = ZERO, extra = {}) => ({ step_id, raw, counters,
  kind: "returned", accepted: true, captures: [], ...extra });
const committed = { status: "committed_and_durable", event_id: EVENT, transaction_id: TXN };
const accepted = { ok: true, value: { status: "accepted" } };
const closed = { status: "failed_closed", code: "audit_durability_unreachable", event_id: EVENT,
  commitGateInvoked: true, durabilityAttempted: true };
// Factory, not a shared constant: structuredClone preserves shared references,
// so a record-damage mutation through one step would leak into every record
// built from the same attempt object.
const exchange = () => ({ attempt: 1, exchange_ordinal: 1, request_attempt: 0, event_id: EVENT,
  method: "POST", path: "/v1/security-audit", headers: {}, body_sha256: DIGEST, body_bytes: 120,
  outcome: { kind: "returned", accepted: true, raw: { kind: "response", status: 202,
    acknowledgments: [{ event_id: EVENT, outcome: "accepted" }] } } });
const RECORDS = [
  returned("P-E-1b/emit", { ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/event/commit_state" } }, ZERO, { accepted: false, diagnostic: { code: "PREMATURE_SUCCESS", category: "validation", path: "/event/commit_state" } }),
  returned("P-E-1f/emit", { ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } }, ZERO, { accepted: false, diagnostic: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } }),
  returned("P-E-2/deliver", committed, PIPE, { callback_order: ["probe", "gate", "exchange"], exchange_attempts: [exchange()], probe_position: 3 }),
  returned("P-E-3b/deliver", { status: "failed_closed", code: "business_commit_declined", event_id: EVENT,
    commitGateInvoked: true, durabilityAttempted: false }, { ...ZERO, probe: 1, gate: 1 }, { callback_order: ["probe", "gate"], exchange_attempts: [] }),
  returned("P-E-5/deliver", closed, PIPE, { exchange_attempts: [{ ...exchange(),
    outcome: { kind: "returned", raw: { kind: "response", status: 503, acknowledgments: [] } } }] }),
  returned("P-E-5/retry-3", committed, PIPE, { exchange_attempts: [exchange()] }),
  returned("P-E-5/quiet", { macrotask_turns: 1 }),
  returned("P-E-2c/first", { ...closed, commitGateInvoked: false, durabilityAttempted: false }, { ...ZERO, probe: 1 }),
  returned("P-E-2c/second", committed, PIPE),
  returned("P-E-6/d2", { status: "refused", code: "duplicate_transaction_delivery", event_id: EVENT }, ZERO, { accepted: false, diagnostic: { code: "duplicate_transaction_delivery" } }),
  returned("P-E-6b/second", committed, PIPE, { same_bytes: true, caller_transaction_matches_occurrence: false }),
  returned("P-E-9/emit", accepted, { ...ZERO, sink: 1 }, { sink_ran_before_await: true, host_sink: [{ inserted_is_transaction: true }] }),
  returned("P-E-9c/rollback:emit", accepted, { ...ZERO, sink: 1 }, { host_sink: [{ inserted_is_transaction: false }], database: { counts: { business: 0, outbox: 1 } } }),
  returned("P-E-g/read", { public_keys: ["guarantees", "deliver"], guarantees_frozen: true }),
  returned("P-E-7/b2-deliver", committed, PIPE, { cross_instance: { same_event_id: true, identical_body_sha256: true, count: 2 } }),
];

const SUMMARIES = [
  { case_id: "P-E-1b", actual: { ...ZERO }, steps: ["emit"] },
  { case_id: "P-E-1f", actual: { ...ZERO }, steps: ["emit"] },
  { case_id: "P-E-2", actual: { ...PIPE, business_commits: 1 }, steps: ["deliver"], order: { monotonic_ms: true, positions: { commit: 0 } } },
  { case_id: "P-E-3b", actual: { ...ZERO, probe: 1, gate: 1 }, steps: ["deliver"] },
  { case_id: "P-E-5", actual: { ...ZERO, probe: 4, gate: 4, exchange: 4, business_commits: 1 }, steps: ["deliver", "retry-3", "quiet"] },
  { case_id: "P-E-2c", actual: { ...ZERO, probe: 2, gate: 1, exchange: 1 }, steps: ["first", "second"] },
  { case_id: "P-E-6", actual: { ...PIPE }, steps: ["d2"] },
  { case_id: "P-E-6b", actual: { ...ZERO, probe: 2, gate: 2, exchange: 2 }, steps: ["second"] },
  { case_id: "P-E-9", actual: { ...ZERO, sink: 1, business_commits: 1 }, steps: ["emit"] },
  { case_id: "P-E-9c", actual: { ...ZERO, sink: 1 }, steps: ["rollback:emit"] },
  { case_id: "P-E-g", actual: { ...ZERO }, steps: ["read"] },
  { case_id: "P-E-7", actual: { ...ZERO, probe: 2, gate: 2, exchange: 2 }, steps: ["b2-deliver"] },
];

export function fixtureObservations() {
  return structuredClone([{ records: RECORDS, accounting: SUMMARIES, public_calls: [], invalidations: [],
    ledger: { used: 0, limit: 240, exhausted: false } }]);
}
