// Observers for planted controls, isolation controls, and accounting identity (#840, #910, Q220, Q224).
import { computeAccounting } from "./observations.mjs";

function hasChainsChecks(phase) {
  if (!phase) return false;
  const sender = phase.sender;
  if (!sender) return false;
  const controls = sender.controls;
  if (!controls) return false;
  return Boolean(controls.chains_checks);
}

// R-09: Planted controls attestation
export function plantedControlsObserver({ observed }) {
  const phaseList = observed ? Object.values(observed).filter(Boolean) : [];
  const phase = phaseList.length > 0 ? phaseList[0] : null;
  if (!hasChainsChecks(phase)) {
    return {
      merge_by_source_defect_detected: false,
      arrival_order_defect_detected: false,
      null_controls_pass: false,
    };
  }

  const checks = phase.sender.controls.chains_checks;
  return {
    merge_by_source_defect_detected: checks.merge_by_source_defect_detected === true,
    arrival_order_defect_detected: checks.arrival_order_defect_detected === true,
    null_controls_pass: checks.null_controls_pass === true,
  };
}

function checkLoopbackIsolation(phase) {
  if (!phase) return false;
  const sender = phase.sender;
  if (!sender) return false;
  const controls = sender.controls;
  if (!controls) return false;
  if (!controls.loopback_guard) return false;
  return controls.loopback_guard.holds === true;
}

function hasWriteGrantHold(role) {
  if (!role) return false;
  const controls = role.controls;
  if (!controls) return false;
  if (!controls.write_outside_grant) return false;
  return controls.write_outside_grant.holds === true;
}

function checkPermissionIsolation(phase) {
  if (!phase) return false;
  const senderHolds = hasWriteGrantHold(phase.sender);
  const ingressHolds = hasWriteGrantHold(phase.ingress);
  return senderHolds && ingressHolds;
}

function checkSyntheticIsolation(phase) {
  if (!phase) return false;
  const sender = phase.sender;
  if (!sender) return false;
  const controls = sender.controls;
  if (!controls) return false;
  if (!controls.synthetic_data) return false;
  return controls.synthetic_data.holds === true;
}

function checkGuardViolation(phase) {
  if (!phase) return false;
  const sender = phase.sender;
  if (!sender) return false;
  const violations = sender.guard_violations;
  if (!Array.isArray(violations)) return false;
  if (violations.length !== 1) return false;
  const violation = violations[0];
  if (!violation) return false;
  return violation.host === "192.0.2.1";
}

// R-10: Pre-traffic isolation controls attestation
export function isolationControlsObserver({ observed }) {
  const phaseList = observed ? Object.values(observed).filter(Boolean) : [];
  if (phaseList.length === 0) {
    return {
      loopback_holds: false,
      permissions_hold: false,
      synthetic_data_holds: false,
      guard_violations_match: false,
    };
  }

  return {
    loopback_holds: phaseList.every(checkLoopbackIsolation),
    permissions_hold: phaseList.every(checkPermissionIsolation),
    synthetic_data_holds: phaseList.every(checkSyntheticIsolation),
    guard_violations_match: phaseList.every(checkGuardViolation),
  };
}

function findPhaseOccurrences(phases, phaseName) {
  if (!Array.isArray(phases)) return 0;
  const found = phases.find((p) => p.name === phaseName);
  if (!found) return 0;
  return typeof found.occurrences === "number" ? found.occurrences : 0;
}

function getPhasePlannedOccurrences(expectations, phaseName, config) {
  const phases = expectations ? expectations.phases : null;
  const fromPhases = findPhaseOccurrences(phases, phaseName);
  if (fromPhases > 0) return fromPhases;
  if (config && config.name === phaseName) {
    if (typeof config.occurrences === "number") return config.occurrences;
  }
  return 0;
}

function isValidPhaseInput(phase, planned) {
  if (!phase) return false;
  if (typeof planned !== "number") return false;
  return planned > 0;
}

function evaluateSinglePhaseAccounting(phase, planned) {
  if (!isValidPhaseInput(phase, planned)) {
    return { holds: false, everyPersisted: false, unexplained: -1 };
  }
  const accounting = computeAccounting(phase, planned);
  const holds = accounting.holds === true;
  const counts = accounting.counts;
  const persisted = counts ? counts.persisted : undefined;
  const everyPersisted = persisted === planned;
  const unexplained = counts && typeof counts.unexplained === "number" ? counts.unexplained : -1;
  return { holds, everyPersisted, unexplained };
}

function makeAccountingMismatch() {
  return {
    all_phases_hold: false,
    unexplained_total: -1,
    every_occurrence_persisted: false,
  };
}

function getCasePhaseNames(caseDef) {
  if (!caseDef) return [];
  const phaseNames = caseDef.phases;
  if (!Array.isArray(phaseNames)) return [];
  return phaseNames;
}

function getObservedPhase(observed, phaseName) {
  if (!observed) return null;
  return observed[phaseName] || null;
}

function updateUnexplainedTotal(currentTotal, unexplained) {
  if (unexplained < 0) return -1;
  if (currentTotal < 0) return -1;
  return currentTotal + unexplained;
}

// R-11: Accounting identity for every phase (#910 lesson, Q220, Q224)
export function accountingIdentityObserver({ observed, expectations, caseDef, config }) {
  const phaseNames = getCasePhaseNames(caseDef);
  if (phaseNames.length === 0) return makeAccountingMismatch();

  let allHold = true;
  let unexplainedTotal = 0;
  let everyPersisted = true;

  for (const phaseName of phaseNames) {
    const phase = getObservedPhase(observed, phaseName);
    if (!phase) return makeAccountingMismatch();
    const planned = getPhasePlannedOccurrences(expectations, phaseName, config);
    const result = evaluateSinglePhaseAccounting(phase, planned);
    if (!result.holds) allHold = false;
    if (!result.everyPersisted) everyPersisted = false;
    unexplainedTotal = updateUnexplainedTotal(unexplainedTotal, result.unexplained);
  }

  return {
    all_phases_hold: allHold,
    unexplained_total: unexplainedTotal,
    every_occurrence_persisted: everyPersisted,
  };
}
