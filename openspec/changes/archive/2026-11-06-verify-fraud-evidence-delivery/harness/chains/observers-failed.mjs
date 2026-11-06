// Observers and predicates for failed authentications and G13 compliance (#840, Q224, Q235, Q238).

function countReconstructedFailed(failedAuths) {
  if (!failedAuths) return 0;
  if (typeof failedAuths !== "object") return 0;
  let count = 0;
  for (const items of Object.values(failedAuths)) {
    if (Array.isArray(items)) count += items.length;
  }
  return count;
}

function matchFailedEntry(act, exp) {
  if (!act) return false;
  if (act.name !== exp.name) return false;
  return act.timestamp === exp.timestamp;
}

function verifyFailedGroup(actualList, expectedList) {
  if (!Array.isArray(actualList)) return false;
  if (!Array.isArray(expectedList)) return false;
  if (actualList.length !== expectedList.length) return false;
  return expectedList.every((exp, idx) => matchFailedEntry(actualList[idx], exp));
}

function verifyFailedAuthPhase(actual, expected) {
  if (!actual) return false;
  if (!expected) return false;
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (actualKeys.length !== expectedKeys.length) return false;
  return expectedKeys.every((src) => verifyFailedGroup(actual[src], expected[src]));
}

function hasValidG13Actor(actor) {
  if (!actor) return false;
  if (actor.type !== "anonymous") return false;
  return actor.id === undefined;
}

function hasForbiddenCredentialRef(credential) {
  if (!credential) return false;
  return credential.reference !== undefined;
}

function hasForbiddenG13Target(body) {
  if (body.authenticated_principal !== undefined) return true;
  if (hasForbiddenCredentialRef(body.credential)) return true;
  return body.presented_identifier !== undefined;
}

function hasForbiddenDirectResource(body) {
  const res = body.resource;
  if (!res) return false;
  if (res.id === undefined) return false;
  return res.type !== "credential";
}

function hasForbiddenContextResource(body) {
  if (!body.authorization) return false;
  const ctx = body.authorization.resource_context;
  if (!ctx) return false;
  if (ctx.id === undefined) return false;
  return ctx.type !== "credential";
}

function hasForbiddenResourceTarget(body) {
  return hasForbiddenDirectResource(body) || hasForbiddenContextResource(body);
}

function hasForbiddenSubjectType(subject) {
  if (!subject) return false;
  return subject.type !== "credential";
}

function hasForbiddenResourceType(resource) {
  if (!resource) return false;
  if (resource.type === undefined) return false;
  return resource.type !== "credential";
}

function isFailedBodyG13Compliant(body) {
  if (!body) return false;
  if (!hasValidG13Actor(body.actor)) return false;
  if (hasForbiddenG13Target(body)) return false;
  if (hasForbiddenResourceTarget(body)) return false;
  if (hasForbiddenSubjectType(body.subject)) return false;
  return !hasForbiddenResourceType(body.resource);
}

function isFailedAuthEvent(body) {
  if (!body) return false;
  if (!body.event) return false;
  return body.event.name === "bloodtrail.audit.authentication.failed";
}

function isNonCompliantFailedBody(body) {
  if (!isFailedAuthEvent(body)) return false;
  return !isFailedBodyG13Compliant(body);
}

function checkBodiesG13(persistedBodies) {
  if (!Array.isArray(persistedBodies)) return false;
  for (const item of persistedBodies) {
    const body = typeof item === "string" ? JSON.parse(item) : item;
    if (isNonCompliantFailedBody(body)) return false;
  }
  return true;
}

function getFailedEventId(body) {
  if (!isFailedAuthEvent(body)) return null;
  return body.event.id || null;
}

function collectFailedEventIds(persistedBodies) {
  const ids = new Set();
  if (!Array.isArray(persistedBodies)) return ids;
  for (const item of persistedBodies) {
    const body = typeof item === "string" ? JSON.parse(item) : item;
    const id = getFailedEventId(body);
    if (id) ids.add(id);
  }
  return ids;
}

function isFailedEventMatch(ev, failedIds) {
  if (failedIds.has(ev.id)) return true;
  return ev.name === "bloodtrail.audit.authentication.failed";
}

function hasFailedEvent(events, failedIds) {
  if (!Array.isArray(events)) return false;
  return events.some((ev) => isFailedEventMatch(ev, failedIds));
}

function checkAccountSessions(sessions, failedIds) {
  if (!sessions) return false;
  return Object.values(sessions).some((events) => hasFailedEvent(events, failedIds));
}

function checkTenantAccounts(tenantAccounts, failedIds) {
  if (!tenantAccounts) return false;
  return Object.values(tenantAccounts).some((sessions) => checkAccountSessions(sessions, failedIds));
}

function isFailedIdInChains(chains, failedIds) {
  if (!chains) return false;
  return Object.values(chains).some((tenantAccounts) => checkTenantAccounts(tenantAccounts, failedIds));
}

function getPhaseFailedAuth(phaseObs) {
  if (!phaseObs) return null;
  const reconstruction = phaseObs.reconstruction;
  if (!reconstruction) return null;
  return reconstruction.failed_authentications || null;
}

function getPhaseChains(phaseObs) {
  if (!phaseObs) return null;
  const reconstruction = phaseObs.reconstruction;
  if (!reconstruction) return null;
  return reconstruction.chains || null;
}

function getGroundTruthFailed(expectations, phaseName) {
  if (!expectations) return null;
  const gt = expectations.ground_truth;
  if (!gt) return null;
  const phaseGt = gt[phaseName];
  if (!phaseGt) return null;
  return phaseGt.failed_authentications || null;
}

function getPhasePersistedBodies(phaseObs) {
  if (!phaseObs) return null;
  if (!phaseObs.ingress) return null;
  return phaseObs.ingress.persisted_bodies || null;
}

function hasValidPhaseExpectations(expectations) {
  if (!expectations) return false;
  return Array.isArray(expectations.phases);
}

function evaluateSinglePhaseFailedAuth(phaseObs, expectations, phaseName) {
  const actual = getPhaseFailedAuth(phaseObs);
  if (!actual) return null;
  const gt = getGroundTruthFailed(expectations, phaseName);
  if (!gt) return null;
  const bodies = getPhasePersistedBodies(phaseObs);
  if (!bodies) return null;

  const count = countReconstructedFailed(actual);
  const authMatch = verifyFailedAuthPhase(actual, gt);
  const g13Match = checkBodiesG13(bodies);
  const phaseMatch = authMatch && g13Match;

  const failedIds = collectFailedEventIds(bodies);
  const chains = getPhaseChains(phaseObs);
  const inChains = isFailedIdInChains(chains, failedIds);
  const unlinked = !inChains;

  return { count, phaseMatch, unlinked };
}

function makeFailedAuthMismatch() {
  return { failed_authentications_match: false, unlinked_from_accounts: false, failed_count: 0 };
}

function buildFailedAuthResult(evaluatedCount, allMatch, allUnlinked, firstCount) {
  if (evaluatedCount === 0) return makeFailedAuthMismatch();
  return {
    failed_authentications_match: allMatch,
    unlinked_from_accounts: allUnlinked,
    failed_count: firstCount,
  };
}

// R-05: Failed authentications are grouped by source and time and not linked (G13)
export function failedAuthenticationsObserver({ observed, expectations }) {
  if (!observed) return makeFailedAuthMismatch();
  if (!hasValidPhaseExpectations(expectations)) return makeFailedAuthMismatch();

  let allMatch = true;
  let allUnlinked = true;
  let firstCount = 0;
  let evaluatedCount = 0;

  for (const phase of expectations.phases) {
    const phaseObs = observed[phase.name];
    if (phaseObs === null) continue;
    const res = evaluateSinglePhaseFailedAuth(phaseObs, expectations, phase.name);
    if (!res) return makeFailedAuthMismatch();
    if (evaluatedCount === 0) firstCount = res.count;
    evaluatedCount += 1;
    if (!res.phaseMatch) allMatch = false;
    if (!res.unlinked) allUnlinked = false;
  }

  return buildFailedAuthResult(evaluatedCount, allMatch, allUnlinked, firstCount);
}
