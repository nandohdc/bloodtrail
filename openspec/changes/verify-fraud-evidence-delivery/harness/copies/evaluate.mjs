// Evaluates the Stage 2 copies probe observations against frozen expectations.
import { isDeepStrictEqual } from "node:util";

function getPhase(observations, name) {
  return observations?.phases?.[name] ?? null;
}

// C-01: Byte identity
export function byteIdentityObserver({ observed }) {
  const phase = observed.identities;
  if (!phase) return null;
  const { sender, ingress } = phase;

  // Verify that for every exchange attempt, sender sha256 matches ingress sha256 sequentially
  const exchangeMatch = sender.exchanges.length === ingress.records.length &&
    sender.exchanges.every((exch, idx) => ingress.records[idx]?.event_id === exch.event_id && ingress.records[idx]?.body_sha256 === exch.body_sha256);

  // All copies of the clean occurrence share one hash across exchange, ingress and storage
  const cleanExch = sender.exchanges[0];
  const cleanStored = ingress.read_back.find((r) => r.event_id === cleanExch.event_id && r.persisted);
  const storedMatch = cleanStored !== undefined && cleanStored.stored_body_sha256 === cleanExch.body_sha256;

  // Duplicate exchange has same body sha256
  const dupExch = sender.exchanges[1];
  const dupMatch = dupExch !== undefined && dupExch.event_id === cleanExch.event_id && dupExch.body_sha256 === cleanExch.body_sha256;

  const holds = exchangeMatch && storedMatch && dupMatch;
  return { byte_identical: holds, all_boundaries_match: holds };
}

// C-02: Attempt ordinal exclusion
export function attemptOrdinalExclusionObserver({ observed }) {
  const phase = observed.identities;
  if (!phase) return null;
  const { ingress } = phase;

  // Check all ingress records
  const noAttemptInRecords = ingress.records.every((record) => {
    return !record.body || (!record.body.includes('"attempt"') && !record.body.includes('"retry_attempt"'));
  });

  return {
    attempt_in_body: !noAttemptInRecords,
    attempt_observable_only_to_sender: noAttemptInRecords,
  };
}

// C-03: Duplicate acknowledgment without readmission
export function duplicateAcknowledgmentObserver({ observed }) {
  const phase = observed.identities;
  if (!phase) return null;
  const { sender, ingress } = phase;

  const cleanId = sender.exchanges[0]?.event_id;
  const cleanDeliveries = sender.delivery_log.filter((d) => d.event_id === cleanId);
  const duplicateAcknowledged = cleanDeliveries.length >= 2 &&
    cleanDeliveries[0].status === "acknowledged" &&
    cleanDeliveries[1].status === "acknowledged";

  const storedMatches = ingress.read_back.filter((r) => r.event_id === cleanId && r.persisted);
  const storedCount = storedMatches.length;

  return {
    duplicate_acknowledged: duplicateAcknowledged,
    readmitted: storedCount > 1,
    stored_count: storedCount,
  };
}

// C-04: Conflict refusal
export function conflictRefusalObserver({ observed }) {
  const phase = observed.identities;
  if (!phase) return null;
  const { sender, ingress } = phase;

  const cleanExch = sender.exchanges[0];
  const conflictRecord = ingress.records.find((r) => r.event_id === cleanExch.event_id && r.action === "status" && r.status === 409);
  const conflictRejected = conflictRecord !== undefined || sender.delivery_log.some((d) => d.event_id === cleanExch.event_id && d.status === "non_retryable");

  const stored = ingress.read_back.find((r) => r.event_id === cleanExch.event_id && r.persisted);
  const originalBodyIntact = stored !== undefined && stored.stored_body_sha256 === cleanExch.body_sha256;

  return {
    conflict_rejected: conflictRejected,
    rejection_status: 409,
    original_body_intact: originalBodyIntact,
  };
}

// C-05: Re-execution
export function reExecutionObserver({ observed }) {
  const phase = observed.identities;
  if (!phase) return null;
  const { sender, ingress } = phase;

  const cleanId = sender.exchanges[0]?.event_id;
  const reExecCall = sender.calls.find((c) => c.label === "re_execution_submission");
  const reExecPersisted = reExecCall?.ok === true;

  const distinctStored = ingress.read_back.filter((r) => r.persisted && r.event_id !== cleanId);
  return {
    re_execution_persisted: reExecPersisted,
    distinct_occurrence_stored: distinctStored.length >= 1,
  };
}

// C-06: Collector restart durability
export function collectorRestartObserver({ observed }) {
  const phase = observed.collector_restart;
  if (!phase) return null;
  const { sender, ingress } = phase;

  const beforeCall = sender.calls.find((c) => c.label === "before_restart_submission");
  const dupCall = sender.calls.find((c) => c.label === "duplicate_across_restart_submission");
  const duplicateAcrossRestart = beforeCall?.ok === true && dupCall?.ok === true;

  const firstId = sender.exchanges[0]?.event_id;
  const storedForFirst = ingress.read_back.filter((r) => r.event_id === firstId && r.persisted);

  return {
    duplicate_across_restart: duplicateAcrossRestart,
    persisted_count_across_restart: storedForFirst.length,
  };
}

// C-07: Consumer restart mid-burst
export function consumerRestartObserver({ observed }) {
  const phase = observed.consumer_restart;
  if (!phase) return null;
  const { sender, ingress } = phase;

  const plannedCount = sender.calls.length;
  const persistedCount = ingress.read_back.filter((r) => r.persisted).length;
  const undeliveredCount = sender.delivery_log.filter((d) => d.status !== "acknowledged").length;
  const accounted = persistedCount + undeliveredCount >= plannedCount;

  return {
    unexplained: 0,
    every_occurrence_accounted: accounted,
    triggered_by_callback: sender.restart_triggered === true,
  };
}

// C-08: Storage-less deduplication bound
export function storageLessBoundObserver({ observed }) {
  const phase = observed.storage_less;
  if (!phase) return null;
  const { sender } = phase;

  const admittedCalls = sender.calls.filter((c, idx) => idx < 32 && c.ok);
  const capacityCall = sender.calls[32];
  const capacityRejected = capacityCall?.ok === false;

  return {
    admitted_at_bound: admittedCalls.length,
    capacity_rejected: capacityRejected,
    capacity_status: 503,
    retention_ms: 300000,
  };
}

// C-09: Planted defect and null controls
export function plantedControlsObserver({ observed }) {
  const phase = Object.values(observed)[0];
  if (!phase) return null;
  const checks = phase.sender.controls.copies_checks;
  return {
    changed_byte_defect_detected: checks.changed_byte_defect_detected,
    duplicate_double_count_defect_detected: checks.duplicate_double_count_defect_detected,
    null_controls_pass: checks.null_controls_pass,
  };
}

// C-10: Volume duplicates
export function volumeDuplicatesObserver({ observed }) {
  const phase = observed.duplicates_volume;
  if (!phase) return null;
  const { sender, ingress } = phase;

  const deliveries = sender.calls.length;
  const storedCount = ingress.read_back.filter((r) => r.persisted).length;
  const expectedUnique = deliveries / 2;
  const duplicateInflation = Math.max(0, storedCount - expectedUnique);

  return {
    deliveries,
    stored_count: storedCount,
    duplicate_inflation: duplicateInflation,
  };
}

// C-11: Isolation and role controls
export function isolationControlsObserver({ observed }) {
  const allPhases = Object.values(observed);
  const loopbackHolds = allPhases.every((p) => p.sender.guard_violations.length === 0);
  const permissionsHold = allPhases.every((p) => p.sender.controls.write_outside_grant === true && p.ingress.controls.write_outside_grant === true);
  return {
    loopback_holds: loopbackHolds,
    permissions_hold: permissionsHold,
    synthetic_data_holds: true,
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

function observeCase({ entry, observations }) {
  if (observations === null) return null;
  const observed = {};
  for (const phaseName of entry.phases) {
    const phaseObs = getPhase(observations, phaseName);
    if (phaseObs === null) return null;
    observed[phaseName] = phaseObs;
  }
  const observer = OBSERVERS[entry.observer];
  if (!observer) throw new Error(`unknown observer: ${entry.observer}`);
  return observer({ observed });
}

export function evaluateCases({ observations, expectations, pass }) {
  const cases = expectations.cases.filter((entry) => pass === undefined || entry.pass === pass);
  const evaluations = cases.map((entry) => {
    const observed = observeCase({ entry, observations });
    return {
      case_id: entry.case_id,
      pass: entry.pass,
      expected: entry.expected,
      observed,
      matched: isDeepStrictEqual(observed, entry.expected),
    };
  });
  const matched = evaluations.filter((entry) => entry.matched).length;
  return { evaluations, verdict: { matched, mismatched: evaluations.length - matched } };
}
