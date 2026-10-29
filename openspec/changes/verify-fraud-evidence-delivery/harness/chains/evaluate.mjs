// Evaluator for the Stage 2 chains probe (#840, Q208, Q235).
// Evaluates the eleven cases against observations produced by the chains session.
import { isDeepStrictEqual } from "node:util";
import {
  chainReconstructionObserver,
  eventTimeOrderObserver,
  sessionFingerprintsObserver,
} from "./observers-chain.mjs";
import {
  failedAuthenticationsObserver,
  noSharedSourceMergeObserver,
  opaqueIdentifiersObserver,
  perSourceCountsObserver,
  perTenantPartitionsObserver,
} from "./observers-source.mjs";
import {
  accountingIdentityObserver,
  isolationControlsObserver,
  plantedControlsObserver,
} from "./observers-identity.mjs";

export {
  accountingIdentityObserver,
  chainReconstructionObserver,
  eventTimeOrderObserver,
  failedAuthenticationsObserver,
  isolationControlsObserver,
  noSharedSourceMergeObserver,
  opaqueIdentifiersObserver,
  perSourceCountsObserver,
  perTenantPartitionsObserver,
  plantedControlsObserver,
  sessionFingerprintsObserver,
};

export const OBSERVERS = Object.freeze({
  chain_reconstruction: chainReconstructionObserver,
  no_shared_source_merge: noSharedSourceMergeObserver,
  per_source_counts: perSourceCountsObserver,
  per_tenant_partitions: perTenantPartitionsObserver,
  failed_authentications: failedAuthenticationsObserver,
  opaque_identifiers: opaqueIdentifiersObserver,
  session_fingerprints: sessionFingerprintsObserver,
  event_time_order: eventTimeOrderObserver,
  planted_controls: plantedControlsObserver,
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
  const found = expectations.phases.find((phaseConfig) => phaseConfig.name === phaseName) || null;
  if (!found) return null;
  const groundTruth = expectations.ground_truth?.[phaseName] ?? expectations.ground_truth ?? null;
  return { ...found, ground_truth: groundTruth };
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
  const gt = expectations?.ground_truth?.[phaseName] ?? expectations?.ground_truth;
  return observer({ observed, config, caseDef: { ...caseDef, ground_truth: gt }, expectations });
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
