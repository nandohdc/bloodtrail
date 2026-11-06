// H-06 and H-07: host-row transaction correlation and durable deferral evidence.
import { allTrue, arrayCount, isDuplicate, phaseFor, read } from "./observer-access.mjs";
import { areTransactionIdsUnique, checkTransactionIdsMatchHost } from "./observer-predicates.mjs";

function duplicateMatchesOriginal(record, records) {
  const original = records.find((r) => allTrue([
    read(r, "outcome.kind") === "persisted", r.event_id === record.event_id,
  ]));
  if (!original) return false;
  if (typeof record.body_sha256 !== "string") return false;
  return record.body_sha256 === original.body_sha256;
}

function duplicateBodiesMatch(records) {
  if (!Array.isArray(records)) return false;
  const duplicates = records.filter(isDuplicate);
  if (duplicates.length === 0) return false;
  return duplicates.every((record) => duplicateMatchesOriginal(record, records));
}

export function deduplicationIdentityObserver(args) {
  const phase = phaseFor(args);
  const bodies = read(phase, "ingress.persisted_bodies");
  const matchHost = checkTransactionIdsMatchHost({
    bodies, rows: read(phase, "sender.host.business_rows"), count: args.config.change_count,
  });
  const unique = areTransactionIdsUnique(bodies);
  return {
    deduplication_by_event_and_transaction_id: allTrue([
      matchHost, unique, duplicateBodiesMatch(read(phase, "ingress.records")),
    ]),
    transaction_ids_match_host: matchHost, transaction_ids_unique: unique,
  };
}

function outageRecordsMatch(records, failures, ids) {
  if (failures <= 0) return false;
  if (!Array.isArray(records)) return false;
  if (!Array.isArray(ids)) return false;
  if (ids.length !== failures) return false;
  const outages = records.filter((record) => record.status === 503);
  if (outages.length !== failures) return false;
  const failed = new Set(ids);
  if (failed.size !== failures) return false;
  return outages.every((record) => failed.has(record.event_id));
}

function sameEventIds(actual, expected) {
  if (!Array.isArray(actual)) return false;
  if (!Array.isArray(expected)) return false;
  if (actual.length !== expected.length) return false;
  if (new Set(actual).size !== expected.length) return false;
  const ids = new Set(expected);
  return actual.every((id) => ids.has(id));
}

function recoveryMatches(phase, count) {
  const failedIds = read(phase, "sender.outage_failed_event_ids");
  return allTrue([
    read(phase, "sender.pending_after_recovery") === 0,
    read(phase, "sender.relayed_count") === count,
    sameEventIds(read(phase, "sender.recovery_delivered_event_ids"), failedIds),
    sameEventIds(read(phase, "sender.recovery_read_event_ids"), failedIds),
  ]);
}

export function outageDeferralObserver(args) {
  const phase = phaseFor(args);
  const initialFailures = read(phase, "sender.initial_outage_failures");
  const pending = read(phase, "sender.pending_outbox");
  const recovered = arrayCount(read(phase, "ingress.persisted_bodies"));
  const deferred = allTrue([
    initialFailures === args.config.change_count, pending === args.config.change_count,
    outageRecordsMatch(read(phase, "ingress.records"), initialFailures, read(phase, "sender.outage_failed_event_ids")),
  ]);
  return {
    deferred_during_outage: deferred,
    delivered_from_durable_record: allTrue([
      deferred, recovered === args.config.change_count, recoveryMatches(phase, args.config.change_count),
    ]),
    initial_failures: initialFailures, pending_outbox: pending, recovered_persisted: recovered,
    pending_after_recovery: read(phase, "sender.pending_after_recovery"),
    relayed_count: read(phase, "sender.relayed_count"),
  };
}
