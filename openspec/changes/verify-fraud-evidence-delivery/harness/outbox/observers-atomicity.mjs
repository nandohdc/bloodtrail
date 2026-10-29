// H-01 through H-05; phase names and denominators come from frozen expectations.
import { allTrue, arrayCount, isDuplicate, phaseFor, read } from "./observer-access.mjs";
import { exactEventIdentities, isCommitAtomicityValid, isRollbackDiscarded, storedExactlyOnce } from "./observer-predicates.mjs";
export { deduplicationIdentityObserver, outageDeferralObserver } from "./observer-dedup.mjs";

export function commitAtomicityObserver(args) {
  const host = read(phaseFor(args), "sender.host");
  return {
    atomicity_holds: isCommitAtomicityValid(host, args.config.change_count, read(phaseFor(args), "sender.transaction_order")),
    business_count: read(host, "business_count"), outbox_count: read(host, "outbox_count"),
  };
}

export function rollbackDiscardObserver(args) {
  const phase = phaseFor(args);
  const host = read(phase, "sender.host");
  const relayed = read(phase, "sender.relayed_count");
  const persisted = arrayCount(read(phase, "ingress.persisted_bodies"));
  return {
    rollback_discarded: isRollbackDiscarded({ host, relayed, persisted, count: args.config.change_count }),
    business_count: read(host, "business_count"), outbox_count: read(host, "outbox_count"),
    inserted_count: arrayCount(read(host, "sink_records")),
    relayed_count: relayed, persisted_count: persisted,
  };
}

export function atLeastOnceRelayObserver(args) {
  const phase = phaseFor(args);
  const relayed = read(phase, "sender.relayed_count");
  const persisted = arrayCount(read(phase, "ingress.persisted_bodies"));
  return {
    all_committed_relayed: allTrue([
      relayed === args.config.change_count, persisted === args.config.change_count,
      exactEventIdentities({
        bodies: read(phase, "ingress.persisted_bodies"), host: read(phase, "sender.host"),
        count: args.config.change_count,
      }),
    ]),
    relayed_count: relayed, persisted_count: persisted,
  };
}

export function crashPersistenceIdentityObserver(args) {
  const phase = phaseFor(args);
  const bodies = read(phase, "ingress.persisted_bodies");
  const persistedCount = arrayCount(bodies);
  const ids = Array.isArray(bodies) ? bodies.map((body) => read(body, "event.id")) : [];
  const crashFired = read(phase, "sender.crash_fired") === true;
  const pending = read(phase, "sender.pending_after_resume");
  return {
    persisted_exactly_once: allTrue([
      crashFired, pending === 0, persistedCount === args.config.change_count,
      exactEventIdentities({ bodies, host: read(phase, "sender.host"), count: args.config.change_count }),
      storedExactlyOnce(bodies, read(phase, "ingress.read_back")),
    ]),
    persisted_count: persistedCount, unique_event_ids: new Set(ids).size,
    crash_fired: crashFired, pending_after_resume: pending,
  };
}

export function redeliveryDuplicateObserver(args) {
  const records = read(phaseFor(args), "ingress.records");
  const duplicates = Array.isArray(records) ? records.filter(isDuplicate).length : -1;
  return {
    duplicates_recognized: duplicates === args.caseDef.expected.duplicate_count,
    duplicate_count: duplicates,
  };
}
