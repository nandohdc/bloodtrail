// Evaluator for the Stage 2 copies probe (#839, Q144, Q159, Q162, Q163, Q165, Q172, Q175).
// Evaluates the eleven cases against observations produced by the copies session.
import { isDeepStrictEqual } from "node:util";
import { DELIVERED } from "../lib/composition.mjs";
import { computeAccounting } from "./observations.mjs";

function matchExchangesWithRecords(phase) {
  const exchanges = phase.sender.exchanges;
  const records = phase.ingress.records;
  if (exchanges.length !== records.length) return false;
  return exchanges.every((exchange, index) => {
    const record = records[index];
    if (!record) return false;
    if (record.event_id !== exchange.event_id) return false;
    return record.body_sha256 === exchange.body_sha256;
  });
}

function isStoredMatch(stored, exchange) {
  if (stored.event_id !== exchange.event_id) return false;
  if (!stored.persisted) return false;
  return stored.stored_body_sha256 === exchange.body_sha256;
}

function matchStoredOccurrence(readBack, exchange) {
  if (!exchange) return false;
  return readBack.some((stored) => isStoredMatch(stored, exchange));
}

function matchDuplicateExchange(phase) {
  const exchanges = phase.sender.exchanges;
  if (exchanges.length < 2) return false;
  const [exchange, duplicate] = exchanges;
  if (duplicate.event_id !== exchange.event_id) return false;
  return duplicate.body_sha256 === exchange.body_sha256;
}

function isFirstAttempt(record, retryOccurrence) {
  return record.occurrence === retryOccurrence && record.attempt === 0;
}

function findRetryFirstHash(records, retryOccurrence) {
  for (const record of records) {
    if (isFirstAttempt(record, retryOccurrence)) {
      return record.body_sha256;
    }
  }
  return null;
}

function checkRetryIdentical(records, retryOccurrence) {
  const group = records.filter((record) => record.occurrence === retryOccurrence);
  if (group.length < 2) return false;
  const firstHash = findRetryFirstHash(group, retryOccurrence);
  if (!firstHash) return false;
  return group.every((record) => record.body_sha256 === firstHash);
}

// C-01: Byte identity across exchange, ingress and storage boundaries (#839, D3, D4, F1)
export function byteIdentityObserver({ observed, config }) {
  if (!observed || !observed.identities) return null;
  const phase = observed.identities;

  const exchangeMatch = matchExchangesWithRecords(phase);
  const [exchange] = phase.sender.exchanges;
  const storedMatch = matchStoredOccurrence(phase.ingress.read_back, exchange);
  const dupMatch = matchDuplicateExchange(phase);
  const schedule = config.schedule;
  const retryOccurrence = schedule.indexOf("retry_once") + 1;
  const retryIdentical = checkRetryIdentical(phase.ingress.records, retryOccurrence);

  const holds = exchangeMatch && storedMatch && dupMatch && retryIdentical;
  return { byte_identical: holds, all_boundaries_match: holds };
}

function findRetriedEventIds(phase) {
  const ids = new Set();
  for (const exchange of phase.sender.exchanges) {
    if (exchange.attempt > 0) ids.add(exchange.event_id);
  }
  return [...ids];
}

function hasRetryAttemptValue(record) {
  return record.retry_attempt !== null && record.retry_attempt !== undefined;
}

function isRetryAttemptConstant(records, eventId) {
  const matching = records.filter((record) => record.event_id === eventId);
  if (matching.length < 2) return false;
  let targetVal = null;
  for (const record of matching) {
    if (!hasRetryAttemptValue(record)) return false;
    targetVal = record.retry_attempt;
    break;
  }
  return matching.every((record) => record.retry_attempt === targetVal);
}

function isBodyIdentical(records, eventId) {
  const matching = records.filter((record) => record.event_id === eventId);
  if (matching.length < 2) return false;
  let targetHash = null;
  for (const record of matching) {
    targetHash = record.body_sha256;
    break;
  }
  if (!targetHash) return false;
  return matching.every((record) => record.body_sha256 === targetHash);
}

function areAllRetriesConstant(retriedIds, records) {
  return retriedIds.length > 0 && retriedIds.every((id) => isRetryAttemptConstant(records, id));
}

function areAllBodiesIdentical(retriedIds, records) {
  return retriedIds.length > 0 && retriedIds.every((id) => isBodyIdentical(records, id));
}

// C-02: Attempt ordinal exclusion and constant retry_attempt (#839, D4, Q108, Q120)
export function attemptOrdinalExclusionObserver({ observed }) {
  if (!observed || !observed.identities) return null;
  const phase = observed.identities;

  const retriedIds = findRetriedEventIds(phase);
  const multiCount = retriedIds.length;
  const retryConstant = areAllRetriesConstant(retriedIds, phase.ingress.records);
  const bodyConstant = areAllBodiesIdentical(retriedIds, phase.ingress.records);

  return {
    multi_attempt_occurrences: multiCount,
    retry_attempt_constant_across_attempts: retryConstant,
    body_identical_across_attempts: bodyConstant,
  };
}

function isDeliveredStatus(entry) {
  return Boolean(entry && DELIVERED.has(entry.status));
}

function checkDuplicateAcknowledged(phase, initialId) {
  const initialDeliveries = phase.sender.delivery_log.filter((entry) => entry.event_id === initialId);
  if (initialDeliveries.length < 2) return false;
  const [, entry] = initialDeliveries;
  return isDeliveredStatus(entry);
}

function isPersistedRecord(record) {
  return Boolean(record.outcome && record.outcome.kind === "persisted");
}

// C-03: Duplicate acknowledgment without readmission (#839, D3)
export function duplicateAcknowledgmentObserver({ observed }) {
  if (!observed || !observed.identities) return null;
  const phase = observed.identities;

  const [exchange] = phase.sender.exchanges;
  if (!exchange) return null;
  const initialId = exchange.event_id;
  const duplicateAcked = checkDuplicateAcknowledged(phase, initialId);
  const matchingRecords = phase.ingress.records.filter((record) => record.event_id === initialId);
  const storedCount = matchingRecords.filter(isPersistedRecord).length;
  const readmitted = storedCount > 1;

  return {
    duplicate_acknowledged: duplicateAcked,
    readmitted,
    stored_count: storedCount,
  };
}

function isRejectedConflictCandidate(record, initialId) {
  if (record.event_id !== initialId) return false;
  if (!record.outcome) return false;
  return record.outcome.kind === "rejected";
}

function findConflictRecord(records, initialId) {
  for (const record of records) {
    if (isRejectedConflictCandidate(record, initialId)) {
      return record;
    }
  }
  return null;
}

function isConflictRejected(outcomeKind, conflictCode) {
  return outcomeKind === "rejected" && conflictCode === "COLLECTOR_STORAGE_CONFLICT";
}

// C-04: Conflict refusal (#839, D4, F2)
export function conflictRefusalObserver({ observed }) {
  if (!observed || !observed.identities) return null;
  const phase = observed.identities;

  const [exchange] = phase.sender.exchanges;
  if (!exchange) return null;
  const initialId = exchange.event_id;
  const record = findConflictRecord(phase.ingress.records, initialId);
  let outcomeKind = null;
  let conflictCode = null;
  if (record) {
    outcomeKind = record.outcome.kind;
    conflictCode = record.outcome.code;
  }
  const conflictRejected = isConflictRejected(outcomeKind, conflictCode);
  const originalBodyIntact = matchStoredOccurrence(phase.ingress.read_back, exchange);

  return {
    conflict_rejected: conflictRejected,
    outcome_kind: outcomeKind,
    conflict_code: conflictCode,
    original_body_intact: originalBodyIntact,
  };
}

function isReExecutionRecord(record, initialId) {
  if (record.retry_attempt < 1) return false;
  if (record.original_event_id !== initialId) return false;
  if (!record.outcome) return false;
  return record.outcome.kind === "persisted";
}

function findReExecutionId(records, initialId) {
  for (const record of records) {
    if (isReExecutionRecord(record, initialId)) {
      return record.event_id;
    }
  }
  return null;
}

function isStoredPersistedMatch(stored, eventId) {
  return stored.event_id === eventId && stored.persisted === true;
}

function isStoredPersisted(readBack, eventId) {
  if (!eventId) return false;
  return readBack.some((stored) => isStoredPersistedMatch(stored, eventId));
}

function isCallSuccessful(call) {
  return Boolean(call && call.ok === true);
}

function checkReExecutionPersisted(call, initialPersisted, reExecPersisted) {
  if (!isCallSuccessful(call)) return false;
  return initialPersisted && reExecPersisted;
}

function isReExecutionCall(call) {
  return call.label === "re_execution_submission";
}

// C-05: Re-execution persistence with causal link (#839, D4)
export function reExecutionObserver({ observed }) {
  if (!observed || !observed.identities) return null;
  const phase = observed.identities;

  const [exchange] = phase.sender.exchanges;
  if (!exchange) return null;
  const initialId = exchange.event_id;
  const call = phase.sender.calls.find(isReExecutionCall);
  const reExecId = findReExecutionId(phase.ingress.records, initialId);

  const initialPersisted = isStoredPersisted(phase.ingress.read_back, initialId);
  const reExecPersisted = isStoredPersisted(phase.ingress.read_back, reExecId);
  const persisted = checkReExecutionPersisted(call, initialPersisted, reExecPersisted);
  const distinctStored = Boolean(reExecId && reExecId !== initialId);

  return {
    re_execution_persisted: persisted,
    distinct_occurrence_stored: distinctStored,
  };
}

function isValidBoundary(boundary, recordsLength) {
  return Number.isSafeInteger(boundary) && boundary >= 0 && boundary <= recordsLength;
}

function hasOutcome({ record, id, kind }) {
  if (record.event_id !== id) return false;
  if (!record.outcome) return false;
  return record.outcome.kind === kind;
}

function checkPersistedBefore(records, initialId, boundary) {
  if (!isValidBoundary(boundary, records.length)) return false;
  for (const record of records.slice(0, boundary)) {
    if (hasOutcome({ record, id: initialId, kind: "persisted" })) {
      return true;
    }
  }
  return false;
}

function checkDuplicateAfter(records, initialId, boundary) {
  if (!isValidBoundary(boundary, records.length)) return false;
  for (const record of records.slice(boundary)) {
    if (hasOutcome({ record, id: initialId, kind: "duplicate" })) {
      return true;
    }
  }
  return false;
}

// C-06: Collector restart duplicate preservation (#839, D2, D4, Q115, Q117, Q132, Q165)
export function collectorRestartObserver({ observed }) {
  if (!observed || !observed.collector_restart) return null;
  const phase = observed.collector_restart;

  const restarts = phase.ingress.restarts;
  const restartCount = Array.isArray(restarts) ? restarts.length : 0;
  if (restartCount !== 1) {
    return {
      restart_count: restartCount,
      persisted_before_boundary: false,
      duplicate_at_or_after_boundary: false,
      read_back_persisted: false,
      storage_closed: false,
      storage_reopened: false,
    };
  }

  const [restart] = restarts;
  const [exchange] = phase.sender.exchanges;
  if (!exchange) return null;
  const initialId = exchange.event_id;
  const persistedBefore = checkPersistedBefore(phase.ingress.records, initialId, restart.before_record_count);
  const duplicateAfter = checkDuplicateAfter(phase.ingress.records, initialId, restart.before_record_count);
  const readBackPersisted = isStoredPersisted(phase.ingress.read_back, initialId);

  return {
    restart_count: restartCount,
    persisted_before_boundary: persistedBefore,
    duplicate_at_or_after_boundary: duplicateAfter,
    read_back_persisted: readBackPersisted,
    storage_closed: restart.storage_closed === true,
    storage_reopened: restart.storage_reopened === true,
  };
}

function isRedeliveryLabel(label) {
  return typeof label === "string" && label.startsWith("consumer_restart_redelivery_");
}

function findRedeliveredEventIds(phase) {
  const counts = new Map();
  for (const exchange of phase.sender.exchanges) {
    counts.set(exchange.event_id, (counts.get(exchange.event_id) ?? 0) + 1);
  }
  const redelivered = [];
  for (const [id, count] of counts) {
    if (count > 1) redelivered.push(id);
  }
  return redelivered;
}

function checkRedeliveriesMatchFirstExchange(phase, redeliveredIds) {
  if (redeliveredIds.length === 0) return false;
  for (const eventId of redeliveredIds) {
    const matching = phase.sender.exchanges.filter((exchange) => exchange.event_id === eventId);
    if (matching.length < 2) return false;
    const [exchange, duplicate] = matching;
    if (duplicate.body_sha256 !== exchange.body_sha256) return false;
  }
  return true;
}

function checkRedeliveriesPersisted(phase, redeliveredIds) {
  if (redeliveredIds.length === 0) return false;
  return redeliveredIds.every((eventId) => isStoredPersisted(phase.ingress.read_back, eventId));
}

function findRedeliveryCalls(calls) {
  return calls.filter((call) => isRedeliveryLabel(call.label));
}

function checkAbandonedReport(sender, redeliveryCount) {
  const health = sender.health;
  if (!health || !health.before_restart) return false;
  const count = health.before_restart.abandoned;
  return typeof count === "number" && count >= 1 && count === redeliveryCount;
}

function checkFencedAttempts(phase, redeliveredIds) {
  const fenced = phase.sender.fenced_attempts;
  if (!Array.isArray(fenced) || fenced.length < 1) return false;
  const allowed = new Set(redeliveredIds);
  return fenced.every((entry) => allowed.has(entry.event_id));
}

function checkEventRecordsMatchExchanges(sender, ingress, eventId) {
  const records = ingress.records.filter((record) => record.event_id === eventId).length;
  const exchanges = sender.exchanges.filter((exchange) => exchange.event_id === eventId).length;
  return records === exchanges;
}

function hasFencedAttempts(fenced) {
  return Array.isArray(fenced) && fenced.length > 0;
}

function isMatchingFencedExchange(exchange, entry) {
  return exchange.event_id === entry.event_id && exchange.attempt === entry.attempt;
}

function checkFencedAttemptsNotExchanged(exchanges, fencedAttempts) {
  for (const entry of fencedAttempts) {
    if (exchanges.some((exchange) => isMatchingFencedExchange(exchange, entry))) {
      return false;
    }
  }
  return true;
}

function hasShutdownCounts(sender) {
  return sender.exchanges_at_shutdown !== undefined && sender.comp1_exchanges_count !== undefined;
}

export function checkShutdownExchangesMatch(sender) {
  if (!hasShutdownCounts(sender)) {
    return false;
  }
  return sender.comp1_exchanges_count === sender.exchanges_at_shutdown;
}

function checkFencedProducedNoIngress(phase, redeliveredIds) {
  if (redeliveredIds.length === 0) return false;
  const sender = phase.sender;
  const ingress = phase.ingress;
  const fenced = sender.fenced_attempts;
  if (!hasFencedAttempts(fenced)) return false;
  if (!checkFencedAttemptsNotExchanged(sender.exchanges, fenced)) return false;
  if (!checkShutdownExchangesMatch(sender)) return false;
  return redeliveredIds.every((eventId) => checkEventRecordsMatchExchanges(sender, ingress, eventId));
}

// C-07: Consumer restart mid-burst (#839, D3, D4, Q107, Q114, Q116, Q130, Q144, Q159, Q175)
export function consumerRestartObserver({ observed, config }) {
  if (!observed || !observed.consumer_restart) return null;
  const phase = observed.consumer_restart;
  const sender = phase.sender;

  const redeliveries = findRedeliveryCalls(sender.calls);
  const unacknowledgedCount = redeliveries.length;
  const abandonedMatches = checkAbandonedReport(sender, unacknowledgedCount);

  const redeliveredIds = findRedeliveredEventIds(phase);
  const redeliveriesMatch = checkRedeliveriesMatchFirstExchange(phase, redeliveredIds);
  const redeliveriesPersisted = checkRedeliveriesPersisted(phase, redeliveredIds);

  const planned = config.occurrences;
  const accounting = computeAccounting(phase, planned);
  const noAbandoned = accounting.counts.abandoned === 0;
  const fencedAttemptsMatch = checkFencedAttempts(phase, redeliveredIds);
  const fencedNoIngress = checkFencedProducedNoIngress(phase, redeliveredIds);
  const unexplained = accounting.counts.unexplained;

  return {
    restart_triggered: sender.restart_triggered === true,
    abandoned_matches_unacknowledged: abandonedMatches,
    redeliveries_match_first_exchange: redeliveriesMatch,
    redeliveries_persisted: redeliveriesPersisted,
    no_abandoned_in_accounting: noAbandoned,
    fenced_attempts: fencedAttemptsMatch,
    fenced_produced_no_ingress: fencedNoIngress,
    unexplained,
  };
}

function isAdmittedRecord(record) {
  return Boolean(record.outcome && record.outcome.kind === "admitted");
}

function isCapacityRecord(record) {
  return Boolean(record.outcome && record.outcome.code === "COLLECTOR_DEDUPLICATION_CAPACITY");
}

function isCapacityRejected(outcomeKind, capacityCode) {
  return outcomeKind === "rejected" && capacityCode === "COLLECTOR_DEDUPLICATION_CAPACITY";
}

// C-08: Storage-less capacity bound (#839, D3, Q114, Q127)
export function storageLessBoundObserver({ observed }) {
  if (!observed || !observed.storage_less) return null;
  const phase = observed.storage_less;

  const records = phase.ingress.records;
  const admittedCount = records.filter(isAdmittedRecord).length;
  const record = records.find(isCapacityRecord);
  let outcomeKind = null;
  let capacityCode = null;
  if (record) {
    outcomeKind = record.outcome.kind;
    capacityCode = record.outcome.code;
  }
  const capacityRejected = isCapacityRejected(outcomeKind, capacityCode);

  return {
    admitted_at_bound: admittedCount,
    capacity_rejected: capacityRejected,
    outcome_kind: outcomeKind,
    capacity_code: capacityCode,
  };
}

// C-09: Pre-traffic planted defect and null controls attestation (#839, D5, Q113, Q127)
export function plantedControlsObserver({ observed }) {
  if (!observed) return null;
  const [phase] = Object.values(observed);
  if (!phase) return null;

  const checks = phase.sender.controls.copies_checks;
  return {
    changed_byte_defect_detected: checks.changed_byte_defect_detected === true,
    duplicate_double_count_defect_detected: checks.duplicate_double_count_defect_detected === true,
    null_controls_pass: checks.null_controls_pass === true,
  };
}

function checkLoopbackIsolation(phase) {
  return phase.sender.controls.loopback_guard.holds === true;
}

function checkPermissionIsolation(phase) {
  const senderHolds = phase.sender.controls.write_outside_grant.holds === true;
  const ingressHolds = phase.ingress.controls.write_outside_grant.holds === true;
  return senderHolds && ingressHolds;
}

function checkSyntheticIsolation(phase) {
  return phase.sender.controls.synthetic_data.holds === true;
}

function isSingleViolation(violations) {
  return Array.isArray(violations) && violations.length === 1;
}

function checkGuardViolation(phase) {
  const violations = phase.sender.guard_violations;
  if (!isSingleViolation(violations)) return false;
  const [violation] = violations;
  return violation.host === "192.0.2.1";
}

// C-10: Pre-traffic isolation controls attestation (#839, D5, Q127, Q175)
export function isolationControlsObserver({ observed }) {
  if (!observed) return null;
  const phaseList = Object.values(observed);
  if (phaseList.length === 0) return null;

  return {
    loopback_holds: phaseList.every(checkLoopbackIsolation),
    permissions_hold: phaseList.every(checkPermissionIsolation),
    synthetic_data_holds: phaseList.every(checkSyntheticIsolation),
    guard_violations_match: phaseList.every(checkGuardViolation),
  };
}

// C-11: Volume duplicates (#839, D3, Q114)
export function volumeDuplicatesObserver({ observed }) {
  if (!observed || !observed.duplicates_volume) return null;
  const phase = observed.duplicates_volume;

  const deliveries = phase.sender.calls.length;
  const storedCount = phase.ingress.records.filter(isPersistedRecord).length;
  const uniqueIds = new Set();
  for (const exchange of phase.sender.exchanges) {
    uniqueIds.add(exchange.event_id);
  }
  const duplicateInflation = Math.max(0, storedCount - uniqueIds.size);

  return {
    deliveries,
    stored_count: storedCount,
    duplicate_inflation: duplicateInflation,
  };
}

export const OBSERVERS = Object.freeze({
  byte_identity: byteIdentityObserver,
  attempt_ordinal_exclusion: attemptOrdinalExclusionObserver,
  duplicate_acknowledgment: duplicateAcknowledgmentObserver,
  conflict_rejection: conflictRefusalObserver,
  re_execution: reExecutionObserver,
  collector_restart: collectorRestartObserver,
  consumer_restart: consumerRestartObserver,
  storage_less_bound: storageLessBoundObserver,
  planted_controls: plantedControlsObserver,
  volume_duplicates: volumeDuplicatesObserver,
  isolation_controls: isolationControlsObserver,
});

function hasObservationsPhases(observations) {
  return Boolean(observations && observations.phases);
}

function hasPhaseExpectations(expectations) {
  return Boolean(expectations && Array.isArray(expectations.phases));
}

function resolvePhaseConfig(expectations, phaseName) {
  if (!hasPhaseExpectations(expectations)) return null;
  return expectations.phases.find((phaseConfig) => phaseConfig.name === phaseName) ?? null;
}

function getPhaseObservation(observations, caseDef) {
  if (!hasObservationsPhases(observations)) return null;
  const observed = {};
  for (const phaseName of caseDef.phases) {
    const phaseObs = observations.phases[phaseName];
    if (!phaseObs) return null;
    observed[phaseName] = phaseObs;
  }
  return observed;
}

function observeCase({ caseDef, observations, expectations }) {
  const observed = getPhaseObservation(observations, caseDef);
  if (!observed) return null;
  const observer = OBSERVERS[caseDef.observer];
  if (!observer) throw new Error(`unknown observer: ${caseDef.observer}`);
  const [phaseName] = caseDef.phases;
  const config = resolvePhaseConfig(expectations, phaseName);
  return observer({ observed, config, caseDef });
}

function matchesPass(caseDef, pass) {
  return pass === undefined || caseDef.pass === pass;
}

export function evaluateCases({ observations, expectations, pass }) {
  const cases = expectations.cases.filter((caseDef) => matchesPass(caseDef, pass));
  const evaluations = cases.map((caseDef) => {
    const observed = observeCase({ caseDef, observations, expectations });
    return {
      case_id: caseDef.case_id,
      pass: caseDef.pass,
      expected: caseDef.expected,
      observed,
      matched: isDeepStrictEqual(observed, caseDef.expected),
    };
  });
  const matched = evaluations.filter((evaluation) => evaluation.matched).length;
  return { evaluations, verdict: { matched, mismatched: evaluations.length - matched } };
}
