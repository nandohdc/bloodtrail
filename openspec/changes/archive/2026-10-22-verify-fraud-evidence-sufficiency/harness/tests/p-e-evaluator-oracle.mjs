// Independent hand-written oracle. Not imported from workload descriptors or
// frozen JSON. Citations below were read as source text at the pinned base.
const CORE = "packages/security-audit-sdk-core/src/";
const NODE = "packages/security-audit-sdk-node/src/";
const CONTRACT = "contracts/security-audit/source/contract.source.json:595-604";
const DELIVERY = `${NODE}delivery-classes.ts:203-223,258-286,310-356`;
export const eq = (path, value) => ({ path, op: "equal", value });
export const format = (path, value) => ({ path, op: "format", format: value });
export const peer = (path, step_id, otherPath) => ({ path, op: "same", peer: { step_id, path: otherPath } });
export const counts = (probe = 0, gate = 0, exchange = 0, sink = 0) =>
  ({ probe, gate, exchange, sink, business_commits: 0 });
const EXCHANGE = { count: 1, request_attempt: 0, method: "POST", path: "/v1/security-audit" };
const ACCEPT = { variant: "committed_and_durable" };
const PROBE_FALSE = { variant: "failed_closed", code: "audit_durability_unreachable", commitGateInvoked: false, durabilityAttempted: false };
const DELIVERY_FALSE = { ...PROBE_FALSE, commitGateInvoked: true, durabilityAttempted: true };
const DECLINED = { variant: "failed_closed", code: "business_commit_declined", commitGateInvoked: true, durabilityAttempted: false };
const REFUSAL = { variant: "sdk_refusal", diagnostic: { code: "PREMATURE_SUCCESS", category: "validation", path: "/event/commit_state" } };

function step(step_id, result, counters, options = {}) {
  return { step_id, result, counters, assertions: [], ...options };
}
function row({ case_id, family, basis }, expected, summary, aggregates = []) {
  return { case_id, family, basis, expected, setup: "Fresh synthetic public-shape fixture; no package imports.",
    classification: "implementer default: bounded comparison, not a production verdict", confidence: "high",
    predicted_calls: 10, summary: { assertions: summary }, aggregates };
}
const aggregate = (aggregate_id, step_id, assertions) => ({ aggregate_id, step_id, source: "guarantees", assertions });

// Source: events.ts:211-225: direct terminal state mismatches operation evidence;
// #797 removed the no-handle non-success default. No sink/delivery can occur.
const CONSTRUCTION = [
  row({ case_id: "P-E-1b", family: "construction", basis: [`${CORE}events.ts:211-225`] },
    [step("P-E-1b/emit", REFUSAL, counts())], [eq("actual.sink", 0)]),
  row({ case_id: "P-E-1f", family: "construction", basis: [`${CORE}events.ts:222-225`] },
    [step("P-E-1f/emit", { ...REFUSAL, diagnostic: { ...REFUSAL.diagnostic, path: "/operation/state" } }, counts())], [eq("actual.sink", 0)]),
];
// Source: delivery-classes.ts:347-356: probe->gate->handoff; only declined stops
// a successful probe. Not-committed outcome does not prevent the gate.
const ORDERING = [
  row({ case_id: "P-E-2", family: "ordering", basis: [DELIVERY] }, [step("P-E-2/deliver", ACCEPT, counts(1, 1, 1),
    { assertions: [format("raw.event_id", "opaque_id"), format("exchange_attempts.0.body_sha256", "sha256"),
      peer("raw.event_id", "P-E-2/deliver", "exchange_attempts.0.event_id")],
    exchange: EXCHANGE, callback_order: ["probe", "gate", "exchange"] })],
  [eq("order.monotonic_ms", true), { path: "order.positions.commit", op: "before", peer: { step_id: "P-E-2/deliver", path: "probe_position" } }]),
  row({ case_id: "P-E-3b", family: "ordering", basis: [DELIVERY] }, [step("P-E-3b/deliver", DECLINED, counts(1, 1),
    { callback_order: ["probe", "gate"], exchange: { ...EXCHANGE, count: 0 } })], [eq("actual.exchange", 0)]),
];
// Source: :279-286,321-327,353: no scheduler; release on failure, settle on ACK;
// every caller replay has request.attempt zero and identical occurrence bytes.
const REDELIVERY = [
  row({ case_id: "P-E-5", family: "redelivery", basis: [DELIVERY] }, [
    step("P-E-5/deliver", DELIVERY_FALSE, counts(1, 1, 1), { exchange: EXCHANGE }),
    step("P-E-5/retry-3", ACCEPT, counts(1, 1, 1), { assertions: [peer("exchange_attempts.0.body_sha256", "P-E-5/deliver", "exchange_attempts.0.body_sha256")], exchange: EXCHANGE }),
    step("P-E-5/quiet", { variant: "observation" }, counts(), { assertions: [eq("raw.macrotask_turns", 1)] }),
  ], [eq("actual.exchange", 4)], [aggregate("P-E-5/retry-guarantee", "P-E-5/quiet",
    [eq("status", "observed"), eq("columns.retry.classification", "not provided")])]),
  row({ case_id: "P-E-2c", family: "redelivery", basis: [DELIVERY] }, [step("P-E-2c/first", PROBE_FALSE, counts(1)),
    step("P-E-2c/second", ACCEPT, counts(1, 1, 1))], [eq("actual.gate", 1)]),
];
// Source: :274-286,320-326,462-464: synchronous pair reservation; differing
// caller transaction ids are admitted even for one occurrence.
const CONCURRENCY = [
  row({ case_id: "P-E-6", family: "concurrency", basis: [DELIVERY] }, [step("P-E-6/d2", { variant: "refused", code: "duplicate_transaction_delivery" }, counts())], [eq("actual.exchange", 1)]),
  row({ case_id: "P-E-6b", family: "concurrency", basis: [DELIVERY] }, [step("P-E-6b/second", ACCEPT, counts(1, 1, 1),
    { assertions: [eq("same_bytes", true), eq("caller_transaction_matches_occurrence", false)] })], [eq("actual.gate", 2)]),
];
// Source: sdk.ts:248-296,318-338: sink is called synchronously, completion is
// in-memory; work beyond the sink's await can escape synchronous ROLLBACK.
const OUTBOX = [
  row({ case_id: "P-E-9", family: "outbox", basis: [`${CORE}sdk.ts:248-296,318-338`, CONTRACT] }, [step("P-E-9/emit", { variant: "accepted" }, counts(0, 0, 0, 1),
    { assertions: [eq("sink_ran_before_await", true), eq("host_sink.0.inserted_is_transaction", true)] })], [eq("actual.business_commits", 1)]),
  row({ case_id: "P-E-9c", family: "outbox", basis: [`${CORE}sdk.ts:318-338`, CONTRACT] }, [step("P-E-9c/rollback:emit", { variant: "accepted" }, counts(0, 0, 0, 1),
    { assertions: [eq("host_sink.0.inserted_is_transaction", false), eq("database.counts", { business: 0, outbox: 1 })] })], [eq("actual.business_commits", 0)]),
];
// Source: :262-267 and per-instance sets :258-259; contract has shutdown and
// backlog obligations without matching public binding surfaces.
const GUARANTEES = [
  row({ case_id: "P-E-g", family: "guarantees", basis: [DELIVERY, CONTRACT] }, [step("P-E-g/read", { variant: "observation" }, counts(),
    { assertions: [eq("raw.public_keys", ["guarantees", "deliver"]), eq("raw.guarantees_frozen", true)] })], [],
  [aggregate("P-E-g/shutdown", "P-E-g/read", [eq("columns.shutdown.classification", "not provided")]),
    aggregate("P-E-g/backpressure", "P-E-g/read", [eq("columns.backpressure.classification", "not provided")])]),
  row({ case_id: "P-E-7", family: "guarantees", basis: [DELIVERY, CONTRACT] }, [step("P-E-7/b2-deliver", ACCEPT, counts(1, 1, 1),
    { assertions: [eq("cross_instance", { same_event_id: true, identical_body_sha256: true, count: 2 })] })], [],
  [aggregate("P-E-7/idempotency", "P-E-7/b2-deliver", [eq("status", "observed"), eq("columns.idempotency.classification", "not provided")])]),
];

export function oraclePlan() {
  const cases = structuredClone([...CONSTRUCTION, ...ORDERING, ...REDELIVERY, ...CONCURRENCY, ...OUTBOX, ...GUARANTEES]);
  return { probe: "P-E", version: 1, corrected_at: "abcbefa03d5b0afc610deb712d7f4ded5a9e82be",
    drafted_from: { commit: "5d931ad", comment: "https://github.com/nandohdc/bloodtrail/issues/803#issuecomment-6137619745" },
    redelivery_k: 3, decisions: [{ source: "G-log implementer defaults", text: "Node factory; k=3; runtime recorder confirms db.isTransaction." }],
    definitions: { boundaries: "public result, sink, exchange", counters: "count calls before invocation", ordering: "monotonic positions",
      redelivery: "caller replay, not SDK redeliver", classification: "bounded contract-row assessment" },
    database_handling: { engine: "node:sqlite", location: "<pipeline-scratch>/host-database",
      ownership: "harness-local synthetic host database, not Bloodtrail storage or outbox", cleanup: "deleted with scratch in finally",
      permission_flags: ["--permission", "--allow-fs-read=<own-service>", "--allow-fs-write=<pipeline-scratch>/host-database"] },
    predicted_total: 120, planned_occurrence_budget: { predicted_total: 120, processes: { fixture: 240 }, total: 240, limit: 5000 }, cases };
}
