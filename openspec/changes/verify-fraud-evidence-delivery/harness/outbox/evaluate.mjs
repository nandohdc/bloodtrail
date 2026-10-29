// Evaluator for the Stage 2 outbox probe (#842, Q243, Q251).
// Evaluates the eleven cases against observations produced by the outbox session.
import { isDeepStrictEqual } from "node:util";
import {
  atLeastOnceRelayObserver,
  commitAtomicityObserver,
  crashPersistenceIdentityObserver,
  deduplicationIdentityObserver,
  outageDeferralObserver,
  redeliveryDuplicateObserver,
  rollbackDiscardObserver,
} from "./observers-atomicity.mjs";
import {
  accountingIdentityObserver,
  hostDbIsolationObserver,
  isolationControlsObserver,
  plantedControlsObserver,
} from "./observers-identity.mjs";

export {
  accountingIdentityObserver,
  atLeastOnceRelayObserver,
  commitAtomicityObserver,
  crashPersistenceIdentityObserver,
  deduplicationIdentityObserver,
  hostDbIsolationObserver,
  isolationControlsObserver,
  outageDeferralObserver,
  plantedControlsObserver,
  redeliveryDuplicateObserver,
  rollbackDiscardObserver,
};

export const OBSERVERS = Object.freeze({
  commit_atomicity: commitAtomicityObserver,
  rollback_discard: rollbackDiscardObserver,
  at_least_once_relay: atLeastOnceRelayObserver,
  crash_persistence_identity: crashPersistenceIdentityObserver,
  redelivery_duplicate: redeliveryDuplicateObserver,
  deduplication_identity: deduplicationIdentityObserver,
  outage_deferral: outageDeferralObserver,
  planted_controls: plantedControlsObserver,
  host_db_isolation: hostDbIsolationObserver,
  isolation_controls: isolationControlsObserver,
  accounting_identity: accountingIdentityObserver,
});

function hasObservationsPhases(observations) {
  return Boolean(observations && observations.phases);
}

function hasPhaseExpectations(expectations) {
  return Boolean(expectations && Array.isArray(expectations.phases));
}

function resolvePhaseConfig(expectations, phaseName) {
  if (!hasPhaseExpectations(expectations)) return null;
  return expectations.phases.find((phaseConfig) => phaseConfig.name === phaseName) || null;
}

function getPhaseObservation(observations, expectations) {
  if (!hasObservationsPhases(observations) || !hasPhaseExpectations(expectations)) return null;
  const observed = {};
  for (const phase of expectations.phases) {
    if (Object.hasOwn(observations.phases, phase.name)) {
      observed[phase.name] = observations.phases[phase.name];
    }
  }
  return observed;
}

function observeCase({ caseDef, observations, expectations }) {
  const observed = getPhaseObservation(observations, expectations);
  const observer = OBSERVERS[caseDef.observer];
  if (!observer) throw new Error(`unknown observer: ${caseDef.observer}`);
  const [phaseName] = caseDef.phases;
  const config = resolvePhaseConfig(expectations, phaseName);
  return observer({ observed, config, caseDef, expectations });
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
  const matched = evaluations.filter((entry) => entry.matched).length;
  const mismatched = evaluations.length - matched;
  return {
    evaluations,
    verdict: {
      matched,
      mismatched,
      holds: mismatched === 0,
    },
  };
}
