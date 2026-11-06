import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eventTimeOrderObserver,
  noSharedSourceMergeObserver,
} from "../chains/evaluate.mjs";
import {
  codePointCompare,
  reconstructChains,
  reconstructMergeBySource,
  reconstructOrderByArrival,
} from "../chains/reconstruct.mjs";
import {
  CHAIN_EVENTS,
  generateWorkloadDefinition,
  sessionFingerprint,
} from "../chains/workload.mjs";

function makePersistedBodiesFromWorkload(workload) {
  return workload.submissionSteps.map((step, idx) => {
    const ident = step.identity;
    const isFailed = step.method === "authenticationFailed";
    return {
      event: {
        id: `evt_test_${idx}`,
        name: isFailed ? "bloodtrail.audit.authentication.failed" : CHAIN_EVENTS[step.stepIndex],
        timestamp: step.at,
      },
      tenant: isFailed ? { scope: "tenantless" } : { effective_tenant_id: ident.tenantId, scope: "tenant" },
      actor: isFailed ? { type: "anonymous" } : { type: "authenticated_human", id: ident.accountId },
      authenticated_principal: isFailed ? undefined : { id: ident.accountId },
      session: isFailed ? undefined : { id: sessionFingerprint({ key: workload.sessionKey, handle: ident.sessionHandle }) },
      source: { observed: { address: ident.address, port: 443 } },
    };
  });
}

function assertSessionEventsMatch(events, expected) {
  assert.equal(events.length, 5);
  for (let i = 0; i < 5; i += 1) {
    assert.equal(events[i].name, expected[i].name);
    assert.equal(events[i].timestamp, expected[i].timestamp);
  }
}

function assertAccountChains(actualSessions, expectedChains, accountId) {
  const sessionKeys = Object.keys(actualSessions);
  assert.equal(sessionKeys.length, 1, `expected 1 session for ${accountId}`);
  assertSessionEventsMatch(actualSessions[sessionKeys[0]], expectedChains);
}

function assertTenantChains(actualTenant, expectedTenant) {
  for (const accountId of Object.keys(expectedTenant)) {
    assert(actualTenant[accountId], `missing account ${accountId}`);
    assertAccountChains(actualTenant[accountId], expectedTenant[accountId], accountId);
  }
}

function assertAllReconstructedChains(resultChains, gtChains) {
  for (const tenantId of Object.keys(gtChains)) {
    assert(resultChains[tenantId], `missing tenant ${tenantId}`);
    assertTenantChains(resultChains[tenantId], gtChains[tenantId]);
  }
}

function findAccountTenant(chains, accountId) {
  for (const [tenantId, accounts] of Object.entries(chains)) {
    if (Object.hasOwn(accounts, accountId)) return tenantId;
  }
  return null;
}

function assertSharedPairSeparated(chains, accA, accB) {
  const tenantA = findAccountTenant(chains, accA);
  const tenantB = findAccountTenant(chains, accB);
  assert(tenantA !== null, `account ${accA} not found`);
  assert(tenantB !== null, `account ${accB} not found`);
  assert.notEqual(accA, accB);

  const eventsA = Object.values(chains[tenantA][accA])[0];
  const eventsB = Object.values(chains[tenantB][accB])[0];
  assert.equal(eventsA.length, 5);
  assert.equal(eventsB.length, 5);
}

function assertEventsOrderedByTime(events) {
  for (let i = 0; i < events.length - 1; i += 1) {
    const isOrdered = codePointCompare(events[i].timestamp, events[i + 1].timestamp) <= 0;
    assert(isOrdered, `events out of timestamp order: ${events[i].timestamp} > ${events[i + 1].timestamp}`);
  }
}

function assertSessionOrdering(sessions) {
  for (const sessionId of Object.keys(sessions)) {
    assertEventsOrderedByTime(sessions[sessionId]);
  }
}

function assertAccountOrdering(accounts) {
  for (const accountId of Object.keys(accounts)) {
    assertSessionOrdering(accounts[accountId]);
  }
}

function assertChainsOrderedByTime(chains) {
  for (const tenantId of Object.keys(chains)) {
    assertAccountOrdering(chains[tenantId]);
  }
}

function assertFailedAuthEvent(ev) {
  assert.equal(ev.name, "bloodtrail.audit.authentication.failed");
  assert.equal(ev.accountId, undefined);
}

function assertFailedAuthGroup(events) {
  for (const ev of events) {
    assertFailedAuthEvent(ev);
  }
  for (let i = 0; i < events.length - 1; i += 1) {
    assert(codePointCompare(events[i].timestamp, events[i + 1].timestamp) <= 0);
  }
}

function assertFailedAuthentications(failedAuths) {
  let total = 0;
  for (const events of Object.values(failedAuths)) {
    total += events.length;
    assertFailedAuthGroup(events);
  }
  assert.equal(total, 6);
}

function assertNoFailedAuthInChainEvents(events) {
  for (const ev of events) {
    assert.notEqual(ev.name, "bloodtrail.audit.authentication.failed");
  }
}

function assertNoFailedAuthInSessions(sessions) {
  for (const sessionId of Object.keys(sessions)) {
    assertNoFailedAuthInChainEvents(sessions[sessionId]);
  }
}

function assertNoFailedAuthInAccounts(accounts) {
  for (const accountId of Object.keys(accounts)) {
    assertNoFailedAuthInSessions(accounts[accountId]);
  }
}

function assertNoFailedAuthInChains(chains) {
  for (const tenantId of Object.keys(chains)) {
    assertNoFailedAuthInAccounts(chains[tenantId]);
  }
}

test("reconstructChains reconstructs exact chains matching ground truth", () => {
  const workload = generateWorkloadDefinition({
    seed: 840001,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });
  const bodies = makePersistedBodiesFromWorkload(workload);
  const result = reconstructChains(bodies);

  assertAllReconstructedChains(result.chains, workload.groundTruth.chains);
});

test("shared-source accounts stay in separate chains", () => {
  const workload = generateWorkloadDefinition({
    seed: 840001,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });
  const bodies = makePersistedBodiesFromWorkload(workload);
  const result = reconstructChains(bodies);

  for (const [accA, accB] of workload.groundTruth.shared_source_pairs) {
    assertSharedPairSeparated(result.chains, accA, accB);
  }
});

test("reconstruction orders by event time, ignoring arrival order", () => {
  const workload = generateWorkloadDefinition({
    seed: 840001,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });
  const bodies = makePersistedBodiesFromWorkload(workload);
  const result = reconstructChains(bodies);

  assertChainsOrderedByTime(result.chains);
});

test("failed authentications are grouped by source and time and not linked to accounts", () => {
  const workload = generateWorkloadDefinition({
    seed: 840001,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });
  const bodies = makePersistedBodiesFromWorkload(workload);
  const result = reconstructChains(bodies);

  assertFailedAuthentications(result.failed_authentications);
  assertNoFailedAuthInChains(result.chains);
});

test("planted defect: merge-by-source fails noSharedSourceMergeObserver", () => {
  const workload = generateWorkloadDefinition({
    seed: 840001,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });
  const bodies = makePersistedBodiesFromWorkload(workload);
  const planted = reconstructMergeBySource(bodies);

  const obs = noSharedSourceMergeObserver({
    observed: { chains_small: { reconstruction: planted, ingress: { persisted_bodies: bodies } } },
    caseDef: { ground_truth: workload.groundTruth },
  });
  assert.equal(obs.shared_source_accounts_separated, false);
  assert.equal(obs.merged_chains_count > 0, true);
});

test("planted defect: arrival-order reconstruction fails eventTimeOrderObserver", () => {
  const workload = generateWorkloadDefinition({
    seed: 840001,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });
  const bodies = makePersistedBodiesFromWorkload(workload);
  const planted = reconstructOrderByArrival(bodies);

  const obs = eventTimeOrderObserver({
    observed: { chains_small: { reconstruction: planted, ingress: { persisted_bodies: bodies } } },
  });
  assert.equal(obs.event_time_ordered, false);
});
