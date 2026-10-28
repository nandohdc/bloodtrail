// Observers for exact chain reconstruction, session fingerprints, and event time ordering (#840, Q208, Q224, Q228, Q230, Q235, Q238, Q239).
import { codePointCompare } from "./reconstruct.mjs";

const HEX_PATTERN = /^[0-9a-f]{64}$/;

function countAccountChains(accounts) {
  if (!accounts) return 0;
  if (typeof accounts !== "object") return 0;
  return Object.keys(accounts).length;
}

function countReconstructedChains(chains) {
  if (!chains) return 0;
  if (typeof chains !== "object") return 0;
  let total = 0;
  for (const tenantId of Object.keys(chains)) {
    total += countAccountChains(chains[tenantId]);
  }
  return total;
}

function isSessionMatching(actualEvents, gtEvents) {
  if (!Array.isArray(actualEvents)) return false;
  if (!Array.isArray(gtEvents)) return false;
  if (actualEvents.length !== gtEvents.length) return false;
  return gtEvents.every((exp, idx) => {
    const act = actualEvents[idx];
    if (!act) return false;
    if (act.name !== exp.name) return false;
    return act.timestamp === exp.timestamp;
  });
}

function isAccountMatching(actualSessions, gtEvents) {
  if (!actualSessions) return false;
  if (typeof actualSessions !== "object") return false;
  const sessions = Object.values(actualSessions);
  if (sessions.length !== 1) return false;
  return isSessionMatching(sessions[0], gtEvents);
}

function isTenantMatching(actualAccounts, gtTenant) {
  if (!actualAccounts) return false;
  if (!gtTenant) return false;
  const actKeys = Object.keys(actualAccounts);
  const gtKeys = Object.keys(gtTenant);
  if (actKeys.length !== gtKeys.length) return false;
  return gtKeys.every((accountId) => isAccountMatching(actualAccounts[accountId], gtTenant[accountId]));
}

function isChainsPhaseMatching(actualChains, gtChains) {
  if (!actualChains) return false;
  if (!gtChains) return false;
  const actTenants = Object.keys(actualChains);
  const gtTenants = Object.keys(gtChains);
  if (actTenants.length !== gtTenants.length) return false;
  return gtTenants.every((tenantId) => isTenantMatching(actualChains[tenantId], gtChains[tenantId]));
}

function hasValidPhaseList(expectations) {
  if (!expectations) return false;
  return Array.isArray(expectations.phases);
}

function getPhaseChains(phaseObs) {
  if (!phaseObs) return null;
  const reconstruction = phaseObs.reconstruction;
  if (!reconstruction) return null;
  return reconstruction.chains || null;
}

function getExpectedChains(expectations, phaseName) {
  if (!expectations) return null;
  const gt = expectations.ground_truth;
  if (!gt) return null;
  const phaseGt = gt[phaseName];
  if (!phaseGt) return null;
  return phaseGt.chains || null;
}

function evaluateSinglePhaseChains(phaseObs, expectations, phaseName) {
  const actual = getPhaseChains(phaseObs);
  if (!actual) return null;
  const gt = getExpectedChains(expectations, phaseName);
  if (!gt) return null;
  const count = countReconstructedChains(actual);
  const matched = isChainsPhaseMatching(actual, gt);
  return { count, matched };
}

function makeChainReconstructionMismatch() {
  return { chains_match: false, reconstructed_chains_count: 0 };
}

function buildChainReconstructionResult(evaluatedCount, allMatch, firstCount) {
  if (evaluatedCount === 0) return makeChainReconstructionMismatch();
  return {
    chains_match: allMatch,
    reconstructed_chains_count: firstCount,
  };
}

// R-01: Every ground-truth chain is reconstructed exactly
export function chainReconstructionObserver({ observed, expectations }) {
  if (!observed) return makeChainReconstructionMismatch();
  if (!hasValidPhaseList(expectations)) return makeChainReconstructionMismatch();

  let allMatch = true;
  let firstCount = 0;
  let evaluatedCount = 0;

  for (const phase of expectations.phases) {
    const phaseObs = observed[phase.name];
    if (phaseObs === null) continue;
    const res = evaluateSinglePhaseChains(phaseObs, expectations, phase.name);
    if (!res) return makeChainReconstructionMismatch();
    if (evaluatedCount === 0) firstCount = res.count;
    evaluatedCount += 1;
    if (!res.matched) allMatch = false;
  }

  return buildChainReconstructionResult(evaluatedCount, allMatch, firstCount);
}

function isSessionIdFingerprint(sessionId) {
  if (typeof sessionId !== "string") return false;
  return HEX_PATTERN.test(sessionId);
}

function checkAccountFingerprints(sessions) {
  if (!sessions) return false;
  if (typeof sessions !== "object") return false;
  return Object.keys(sessions).every(isSessionIdFingerprint);
}

function checkTenantFingerprints(accounts) {
  if (!accounts) return false;
  if (typeof accounts !== "object") return false;
  return Object.values(accounts).every(checkAccountFingerprints);
}

function checkAllChainsFingerprints(chains) {
  if (!chains) return false;
  if (typeof chains !== "object") return false;
  const tenants = Object.values(chains);
  if (tenants.length === 0) return false;
  return tenants.every(checkTenantFingerprints);
}

function hasRawHandleInBody(body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return text.includes("syn-handle-");
}

function checkBodiesForRawHandles(bodies) {
  if (!Array.isArray(bodies)) return false;
  if (bodies.length === 0) return false;
  return !bodies.some(hasRawHandleInBody);
}

function getPhaseBodies(phaseObs) {
  if (!phaseObs) return null;
  if (!phaseObs.ingress) return null;
  return phaseObs.ingress.persisted_bodies || null;
}

function evaluateSinglePhaseFingerprints(phaseObs) {
  const chains = getPhaseChains(phaseObs);
  if (!chains) return null;
  const bodies = getPhaseBodies(phaseObs);
  if (!bodies) return null;
  const isFp = checkAllChainsFingerprints(chains);
  const noRaw = checkBodiesForRawHandles(bodies);
  return { isFp, noRaw };
}

function makeFingerprintsMismatch() {
  return { session_ids_are_fingerprints: false, raw_handles_absent: false };
}

function buildFingerprintsResult(evaluatedCount, allFp, noHandles) {
  if (evaluatedCount === 0) return makeFingerprintsMismatch();
  return {
    session_ids_are_fingerprints: allFp,
    raw_handles_absent: noHandles,
  };
}

// R-07: Session ids are keyed fingerprints, never the handle
export function sessionFingerprintsObserver({ observed, expectations }) {
  if (!observed) return makeFingerprintsMismatch();
  if (!hasValidPhaseList(expectations)) return makeFingerprintsMismatch();

  let allFp = true;
  let noHandles = true;
  let evaluatedCount = 0;

  for (const phase of expectations.phases) {
    const phaseObs = observed[phase.name];
    if (phaseObs === null) continue;
    const res = evaluateSinglePhaseFingerprints(phaseObs);
    if (!res) return makeFingerprintsMismatch();
    evaluatedCount += 1;
    if (!res.isFp) allFp = false;
    if (!res.noRaw) noHandles = false;
  }

  return buildFingerprintsResult(evaluatedCount, allFp, noHandles);
}

function isEventsOrdered(events) {
  if (!Array.isArray(events)) return false;
  for (let i = 0; i < events.length - 1; i += 1) {
    if (codePointCompare(events[i].timestamp, events[i + 1].timestamp) > 0) return false;
  }
  return true;
}

function isAccountSessionsOrdered(sessions) {
  if (!sessions) return false;
  if (typeof sessions !== "object") return false;
  return Object.values(sessions).every(isEventsOrdered);
}

function isTenantAccountsOrdered(accounts) {
  if (!accounts) return false;
  if (typeof accounts !== "object") return false;
  return Object.values(accounts).every(isAccountSessionsOrdered);
}

function isChainsOrdered(chains) {
  if (!chains) return false;
  if (typeof chains !== "object") return false;
  const tenants = Object.values(chains);
  if (tenants.length === 0) return false;
  return tenants.every(isTenantAccountsOrdered);
}

function parseBodyItem(item) {
  return typeof item === "string" ? JSON.parse(item) : item;
}

function getEventTimestamp(item) {
  const body = parseBodyItem(item);
  if (!body) return null;
  const ev = body.event;
  if (!ev) return null;
  return ev.timestamp || null;
}

function isArrivalOrderDiffered(bodies) {
  if (!Array.isArray(bodies)) return false;
  if (bodies.length < 2) return false;
  for (let i = 0; i < bodies.length - 1; i += 1) {
    const currTime = getEventTimestamp(bodies[i]);
    const nextTime = getEventTimestamp(bodies[i + 1]);
    if (codePointCompare(currTime, nextTime) > 0) return true;
  }
  return false;
}

function evaluateSinglePhaseOrder(phaseObs) {
  const chains = getPhaseChains(phaseObs);
  if (!chains) return null;
  const ordered = isChainsOrdered(chains);
  const bodies = getPhaseBodies(phaseObs);
  const differed = bodies ? isArrivalOrderDiffered(bodies) : false;
  return { ordered, differed };
}

function makeEventOrderMismatch() {
  return { event_time_ordered: false, arrival_order_differed: false };
}

function buildEventOrderResult(evaluatedCount, ordered, differed) {
  if (evaluatedCount === 0) return makeEventOrderMismatch();
  return {
    event_time_ordered: ordered,
    arrival_order_differed: differed,
  };
}

// R-08: Chain events reconstructed in event-time order ignoring arrival
export function eventTimeOrderObserver({ observed, expectations }) {
  if (!observed) return makeEventOrderMismatch();
  if (!hasValidPhaseList(expectations)) return makeEventOrderMismatch();

  let ordered = true;
  let differed = false;
  let evaluatedCount = 0;

  for (const phase of expectations.phases) {
    const phaseObs = observed[phase.name];
    if (phaseObs === null) continue;
    const res = evaluateSinglePhaseOrder(phaseObs);
    if (!res) return makeEventOrderMismatch();
    evaluatedCount += 1;
    if (!res.ordered) ordered = false;
    if (res.differed) differed = true;
  }

  return buildEventOrderResult(evaluatedCount, ordered, differed);
}
