// Observers for shared source, source counts, tenant partitions, and opaque identifiers (#840, Q222, Q223, Q224, Q228, Q229, Q235, Q237, Q238).
import { isDeepStrictEqual } from "node:util";
import {
  checkDocAddresses,
  checkNoEmail,
  checkOpaqueIdentifiers,
} from "./observer-predicates.mjs";

export { failedAuthenticationsObserver } from "./observers-failed.mjs";

function hasAccount(tenantAccounts, acc) {
  if (!tenantAccounts) return false;
  return Object.hasOwn(tenantAccounts, acc);
}

function findPairInTenants(chains, accA, accB) {
  let foundA = false;
  let foundB = false;
  for (const tenantId of Object.keys(chains)) {
    const tenantAccounts = chains[tenantId];
    if (hasAccount(tenantAccounts, accA)) foundA = true;
    if (hasAccount(tenantAccounts, accB)) foundB = true;
  }
  return foundA && foundB;
}

function isPairSeparated(chains, accA, accB) {
  if (!chains) return false;
  return findPairInTenants(chains, accA, accB);
}

function countMergedPairs(chains, sharedPairs) {
  if (!chains) return 0;
  if (!Array.isArray(sharedPairs)) return 0;
  let merged = 0;
  for (const [accA, accB] of sharedPairs) {
    if (!isPairSeparated(chains, accA, accB)) merged += 1;
  }
  return merged;
}

function evaluatePhasePairs(phaseObs, pairs) {
  if (!phaseObs) return null;
  const reconstruction = phaseObs.reconstruction;
  if (!reconstruction) return null;
  const chains = reconstruction.chains;
  if (!chains) return null;
  if (!Array.isArray(pairs)) return null;
  return countMergedPairs(chains, pairs);
}

function getPhaseGtPairs(gt, phaseName) {
  if (!phaseName) return null;
  const phaseGt = gt[phaseName];
  if (!phaseGt) return null;
  return phaseGt.shared_source_pairs || null;
}

function getGtPairs(entry, phaseName) {
  if (!entry) return null;
  const gt = entry.ground_truth;
  if (!gt) return null;
  const phasePairs = getPhaseGtPairs(gt, phaseName);
  if (phasePairs) return phasePairs;
  return gt.shared_source_pairs || null;
}

function resolvePhasePairs(expectations, caseDef, config, phaseName) {
  const fromExp = getGtPairs(expectations, phaseName);
  if (fromExp) return fromExp;
  const fromCase = getGtPairs(caseDef, phaseName);
  if (fromCase) return fromCase;
  return getGtPairs(config, phaseName);
}

function resolvePhases(expectations, observed) {
  if (expectations && expectations.phases) return expectations.phases;
  if (!observed) return [];
  return Object.keys(observed).map((name) => ({ name }));
}

function makeMergeMismatch() {
  return { shared_source_accounts_separated: false, merged_chains_count: 0, shared_pairs_evaluated: 0 };
}

function buildMergeResult(evaluatedCount, totalMerged, firstPairsCount) {
  if (evaluatedCount === 0) return makeMergeMismatch();
  return {
    shared_source_accounts_separated: totalMerged === 0,
    merged_chains_count: totalMerged,
    shared_pairs_evaluated: firstPairsCount,
  };
}

// R-02: No shared-source merge
export function noSharedSourceMergeObserver({ observed, expectations, caseDef, config }) {
  if (!observed) return makeMergeMismatch();
  const phases = resolvePhases(expectations, observed);
  if (phases.length === 0) return makeMergeMismatch();

  let totalMerged = 0;
  let firstPairsCount = 0;
  let evaluatedCount = 0;

  for (const phase of phases) {
    const phaseObs = observed[phase.name];
    if (phaseObs === null) continue;
    const pairs = resolvePhasePairs(expectations, caseDef, config, phase.name);
    const phaseMerged = evaluatePhasePairs(phaseObs, pairs);
    if (phaseMerged === null) return makeMergeMismatch();
    if (evaluatedCount === 0) firstPairsCount = pairs.length;
    evaluatedCount += 1;
    totalMerged += phaseMerged;
  }

  return buildMergeResult(evaluatedCount, totalMerged, firstPairsCount);
}

function matchSinglePhase(actual, gt) {
  if (!actual) return false;
  if (!gt) return false;
  return isDeepStrictEqual(actual, gt);
}

function getReconField(phaseObs, fieldName) {
  if (!phaseObs) return null;
  const reconstruction = phaseObs.reconstruction;
  if (!reconstruction) return null;
  return reconstruction[fieldName] || null;
}

function getGroundTruthField(expectations, phaseName, fieldName) {
  if (!expectations) return null;
  const gt = expectations.ground_truth;
  if (!gt) return null;
  const phaseGt = gt[phaseName];
  if (!phaseGt) return null;
  return phaseGt[fieldName] || null;
}

function comparePartitionPhase(phaseObs, expectations, phaseName, fieldName) {
  const actual = getReconField(phaseObs, fieldName);
  if (!actual) return null;
  const gt = getGroundTruthField(expectations, phaseName, fieldName);
  if (!gt) return null;
  const count = Object.keys(actual).length;
  const matched = matchSinglePhase(actual, gt);
  return { count, matched };
}

function hasValidPhaseExpectations(expectations) {
  if (!expectations) return false;
  return Array.isArray(expectations.phases);
}

function updatePartitionMatch(result, state) {
  if (state.evaluatedCount === 0) state.firstCount = result.count;
  state.evaluatedCount += 1;
  if (!result.matched) state.allMatch = false;
}

function evaluatePhasePartitionMatch({ observed, expectations, fieldName }) {
  if (!observed) return { allMatch: false, firstCount: 0 };
  if (!hasValidPhaseExpectations(expectations)) return { allMatch: false, firstCount: 0 };

  const state = { allMatch: true, firstCount: 0, evaluatedCount: 0 };

  for (const phase of expectations.phases) {
    const phaseObs = observed[phase.name];
    if (phaseObs === null) continue;
    const result = comparePartitionPhase(phaseObs, expectations, phase.name, fieldName);
    if (!result) return { allMatch: false, firstCount: 0 };
    updatePartitionMatch(result, state);
  }
  const matchResult = state.evaluatedCount > 0 ? state.allMatch : false;
  return { allMatch: matchResult, firstCount: state.firstCount };
}

// R-03: Per-source counts equal ground truth
export function perSourceCountsObserver({ observed, expectations }) {
  const { allMatch, firstCount } = evaluatePhasePartitionMatch({
    observed,
    expectations,
    fieldName: "per_source_counts",
  });
  return {
    source_counts_match: allMatch,
    sources_evaluated: firstCount,
  };
}

// R-04: Per-tenant partitions equal ground truth
export function perTenantPartitionsObserver({ observed, expectations }) {
  const { allMatch, firstCount } = evaluatePhasePartitionMatch({
    observed,
    expectations,
    fieldName: "per_tenant_partitions",
  });
  return {
    tenant_partitions_match: allMatch,
    tenants_evaluated: firstCount,
  };
}

function getPhasePersistedBodies(phaseObs) {
  if (!phaseObs) return null;
  if (!phaseObs.ingress) return null;
  return phaseObs.ingress.persisted_bodies || null;
}

function evaluatePhaseOpaque(bodies) {
  if (!Array.isArray(bodies)) return null;
  if (bodies.length === 0) return null;
  return {
    opaque: checkOpaqueIdentifiers(bodies),
    noEmail: checkNoEmail(bodies),
    docAddrs: checkDocAddresses(bodies),
  };
}

function makeOpaqueMismatch() {
  return { opaque_identifiers: false, no_email_identifiers: false, documentation_addresses_only: false };
}

function buildOpaqueResult(evaluatedCount, res) {
  if (evaluatedCount === 0) return makeOpaqueMismatch();
  return {
    opaque_identifiers: res.opaque,
    no_email_identifiers: res.noEmail,
    documentation_addresses_only: res.docAddrs,
  };
}

function updateOpaqueMatch(result, res) {
  if (!result.opaque) res.opaque = false;
  if (!result.noEmail) res.noEmail = false;
  if (!result.docAddrs) res.docAddrs = false;
}

// R-06: Identifiers are opaque, never email-like, with documentation-range addresses
export function opaqueIdentifiersObserver({ observed, expectations }) {
  if (!observed) return makeOpaqueMismatch();
  if (!hasValidPhaseExpectations(expectations)) return makeOpaqueMismatch();

  let evaluatedCount = 0;
  const res = { opaque: true, noEmail: true, docAddrs: true };

  for (const phase of expectations.phases) {
    const phaseObs = observed[phase.name];
    if (phaseObs === null) continue;
    const bodies = getPhasePersistedBodies(phaseObs);
    const result = evaluatePhaseOpaque(bodies);
    if (!result) return makeOpaqueMismatch();
    evaluatedCount += 1;
    updateOpaqueMatch(result, res);
  }

  return buildOpaqueResult(evaluatedCount, res);
}
