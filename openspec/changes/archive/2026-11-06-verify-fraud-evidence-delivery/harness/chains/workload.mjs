// Seeded workload generator for the Stage 2 chains probe (#840, Q202-Q206).
// Produces synthetic account-takeover event chains, failed authentications,
// and ground-truth structures using public core constructors and documentation addresses.
import { createHmac } from "node:crypto";
import { assertSynthetic, documentationAddress, opaqueId, seededRandom } from "../lib/workload.mjs";
import { codePointCompare } from "./reconstruct.mjs";

export const IDENTITY_PROVIDER = "https://idp.example.test";
export const CHAIN_EVENTS = Object.freeze([
  "bloodtrail.audit.authentication.succeeded",
  "bloodtrail.audit.session.created",
  "bloodtrail.audit.authentication.mfa.removed",
  "bloodtrail.audit.account.password_reset.completed",
  "bloodtrail.audit.session.revoked",
]);

export const CHAIN_METHODS = Object.freeze([
  "authenticationSucceeded",
  "sessionCreated",
  "mfaRemoved",
  "passwordResetCompleted",
  "sessionRevoked",
]);

export function sessionFingerprint({ key, handle }) {
  return createHmac("sha256", key).update(`session|${handle}`).digest("hex");
}

export function deriveDeterministicKey(seed) {
  const hash = createHmac("sha256", "chains-session-salt").update(String(seed)).digest();
  return hash;
}

function ensureUniqueAddress(random, existing) {
  let address = documentationAddress({ random });
  while (existing.has(address)) {
    address = documentationAddress({ random });
  }
  existing.add(address);
  return address;
}

function generateAccountPool({ count, random }) {
  const accounts = [];
  for (let i = 0; i < count; i += 1) {
    const accountId = opaqueId({ kind: "account", random });
    const credentialId = opaqueId({ kind: "credential", random });
    const sessionHandle = opaqueId({ kind: "handle", random });
    const recoveryRequestId = opaqueId({ kind: "recovery", random });
    accounts.push({
      accountId,
      credentialId,
      sessionHandle,
      causationId: recoveryRequestId,
      originalEventId: recoveryRequestId,
    });
  }
  return accounts;
}

function assignSourceAddresses({ count, sharedPairs, random }) {
  const addresses = [];
  const used = new Set();
  const pair1 = ensureUniqueAddress(random, used);
  const pair2 = ensureUniqueAddress(random, used);

  addresses.push(pair1, pair1);
  addresses.push(pair2, pair2);

  for (let i = 4; i < count; i += 1) {
    addresses.push(ensureUniqueAddress(random, used));
  }
  return addresses;
}

function permuteChainIndices(random) {
  const order = [0, 1, 2, 3, 4];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  if (order.every((val, idx) => val === idx)) {
    const swap = order[0];
    order[0] = order[1];
    order[1] = swap;
  }
  return order;
}

export function buildEventInput({ core, method, identity, at, sessionKey }) {
  const { accountId, tenantId, credentialId, sessionHandle, address } = identity;
  const fp = sessionFingerprint({ key: sessionKey, handle: sessionHandle });

  if (method === "authenticationFailed") {
    return {
      actor: core.anonymousActor("request_boundary"),
      tenant: core.authoritativeTenant({ scope: "tenantless" }),
      authentication: core.authenticationEvidence({
        method: "password_mfa", assurance_level: "aal2", mfa_state: "failed", credential_type: "session",
        authenticated_at: at, identity_provider: IDENTITY_PROVIDER, delegated: false, impersonated: false,
        failure_reason: "credential_invalid",
      }),
      source: core.observedSource({ observed: { address, port: 443 } }),
      request: {
        id: identity.requestId ?? "syn-req-auth-failed",
        method: "POST",
      },
      event: { timestamp: at },
    };
  }

  const baseInput = {
    actor: core.authenticatedHumanActor({ id: accountId, tenantId, source: "synthetic-server-authentication-authority" }),
    tenant: core.authoritativeTenant({ scope: "tenant", actor_tenant_id: tenantId, effective_tenant_id: tenantId, resource_tenant_id: tenantId }),
    authenticated_principal: core.authenticatedPrincipal({ type: "human_user", id: accountId, issuer: IDENTITY_PROVIDER }),
    source: core.observedSource({ observed: { address, port: 443 } }),
    session: core.sessionEvidence({ id: fp, created_at: at, age_seconds: 0, assurance_level: "aal2" }),
    event: { timestamp: at },
  };

  if (method === "authenticationSucceeded") {
    return {
      ...baseInput,
      authentication: core.authenticationEvidence({
        method: "password_mfa", assurance_level: "aal2", mfa_state: "satisfied", credential_type: "session",
        authenticated_at: at, identity_provider: IDENTITY_PROVIDER, delegated: false, impersonated: false,
      }),
      credential: core.credentialReference({ type: "session", reference: credentialId, key_id: "syn-key-v1" }),
    };
  }

  if (method === "sessionCreated") {
    return {
      ...baseInput,
      authentication: core.authenticationEvidence({
        method: "session", assurance_level: "aal2", mfa_state: "satisfied", credential_type: "session",
        authenticated_at: at, identity_provider: IDENTITY_PROVIDER, delegated: false, impersonated: false,
      }),
    };
  }

  if (method === "mfaRemoved") {
    return {
      ...baseInput,
      subject: core.authoritativeSubject({ type: "credential", id: credentialId, tenant_id: tenantId }),
      credential: core.credentialReference({ type: "password", reference: credentialId, key_id: "syn-key-v1" }),
      authentication: core.authenticationEvidence({
        method: "session", assurance_level: "aal2", mfa_state: "satisfied", credential_type: "session",
        authenticated_at: at, identity_provider: IDENTITY_PROVIDER, delegated: false, impersonated: false,
      }),
      authorization: core.authorizationEvidence({
        decision: "allow", capability: "remove_mfa", enforcement_point: "mfa-account-authority",
        policy_id: "policy.audit-fixture", policy_version: "1.0.0",
      }),
      resource: core.authoritativeResource({ type: "credential", id: credentialId, owning_tenant_id: tenantId, data_classification: "confidential" }),
    };
  }

  if (method === "passwordResetCompleted") {
    return {
      ...baseInput,
      subject: core.authoritativeSubject({ type: "credential", id: credentialId, tenant_id: tenantId }),
      credential: core.credentialReference({ type: "password", reference: credentialId, key_id: "syn-key-v1" }),
      authentication: core.authenticationEvidence({
        method: "session", assurance_level: "aal2", mfa_state: "satisfied", credential_type: "session",
        authenticated_at: at, identity_provider: IDENTITY_PROVIDER, delegated: false, impersonated: false,
      }),
      authorization: core.authorizationEvidence({
        decision: "allow",
        capability: "complete_password_reset",
        enforcement_point: "recovery-transaction-owner",
        policy_id: "policy.audit-fixture",
        policy_version: "1.0.0",
        decision_reason: "accepted",
        resource_context: {
          type: "credential",
          id: credentialId,
        },
        tenant_context: {
          effective_tenant_id: tenantId,
        },
        override: false,
        break_glass: false,
      }),
      correlation: {
        causation_id: identity.causationId,
        original_event_id: identity.originalEventId,
      },
      resource: core.authoritativeResource({ type: "credential", id: credentialId, owning_tenant_id: tenantId, data_classification: "confidential" }),
    };
  }

  return {
    ...baseInput,
    subject: core.authoritativeSubject({ type: "session", id: fp, tenant_id: tenantId }),
    authorization: core.authorizationEvidence({
      decision: "allow", capability: "revoke_session", enforcement_point: "session-authority",
      policy_id: "policy.audit-fixture", policy_version: "1.0.0",
    }),
    resource: core.authoritativeResource({ type: "session", id: fp, owning_tenant_id: tenantId, data_classification: "confidential" }),
  };
}

function buildTenants(tenantCount, random) {
  const tenants = [];
  for (let i = 0; i < tenantCount; i += 1) {
    tenants.push(opaqueId({ kind: "tenant", random }));
  }
  return tenants;
}

function distributeAccountsToTenants(accounts, tenants) {
  const assigned = [];
  const perTenant = accounts.length / tenants.length;
  for (let i = 0; i < accounts.length; i += 1) {
    const tenantIdx = Math.floor(i / perTenant);
    assigned.push({ ...accounts[i], tenantId: tenants[tenantIdx] });
  }
  return assigned;
}

function assertSyntheticIdentities(chainsIdentities, addresses) {
  const allIds = [];
  for (const item of chainsIdentities) {
    allIds.push(item.accountId, item.credentialId, item.sessionHandle, item.tenantId);
    if (item.causationId) allIds.push(item.causationId);
    if (item.originalEventId) allIds.push(item.originalEventId);
  }
  assertSynthetic({ ids: allIds, addresses: [...new Set(addresses)] });
}

function createTimeClock(clockStart, clockStepMs) {
  let curTimeMs = Date.parse(clockStart);
  return () => {
    const ts = new Date(curTimeMs).toISOString();
    curTimeMs += clockStepMs;
    return ts;
  };
}

function initializeTenantMaps(tenants) {
  const groundTruthChains = {};
  const perTenantPartitions = {};
  for (const t of tenants) {
    groundTruthChains[t] = {};
    perTenantPartitions[t] = [];
  }
  return { groundTruthChains, perTenantPartitions };
}

function buildSingleChainEvents({ ident, nextTime, perSourceCounts, groundTruthChains }) {
  groundTruthChains[ident.tenantId][ident.accountId] = [];
  const chainItems = [];
  for (let step = 0; step < 5; step += 1) {
    const timestamp = nextTime();
    const eventName = CHAIN_EVENTS[step];
    const method = CHAIN_METHODS[step];
    groundTruthChains[ident.tenantId][ident.accountId].push({ name: eventName, timestamp });
    const current = perSourceCounts[ident.address] || 0;
    perSourceCounts[ident.address] = current + 1;
    chainItems.push({ method, identity: ident, at: timestamp, stepIndex: step });
  }
  return chainItems;
}

function buildChainsEvents({ chainsIdentities, chainCount, nextTime, perSourceCounts, groundTruthChains, perTenantPartitions }) {
  const chainsEvents = [];
  for (let c = 0; c < chainCount; c += 1) {
    const ident = chainsIdentities[c];
    perTenantPartitions[ident.tenantId].push(ident.accountId);
    chainsEvents.push(buildSingleChainEvents({ ident, nextTime, perSourceCounts, groundTruthChains }));
  }
  return chainsEvents;
}

function sortTenantPartitions(perTenantPartitions, tenants) {
  for (const t of tenants) {
    perTenantPartitions[t].sort(codePointCompare);
  }
}

function buildFailedAuthentications({ failedCount, addresses, nextTime, perSourceCounts, random }) {
  const failedAuthsBySource = {};
  const failedItems = [];
  for (let f = 0; f < failedCount; f += 1) {
    const timestamp = nextTime();
    const addr = addresses[f % addresses.length];
    const current = perSourceCounts[addr] || 0;
    perSourceCounts[addr] = current + 1;
    if (!failedAuthsBySource[addr]) {
      failedAuthsBySource[addr] = [];
    }
    failedAuthsBySource[addr].push({ name: "bloodtrail.audit.authentication.failed", timestamp });
    failedItems.push({
      method: "authenticationFailed",
      identity: {
        address: addr,
        accountId: null,
        tenantId: null,
        sessionHandle: null,
        credentialId: null,
        requestId: opaqueId({ kind: "req", random }),
      },
      at: timestamp,
    });
  }
  return { failedAuthsBySource, failedItems };
}

function appendPermutedChain(submissionSteps, chainItems, random) {
  const permutation = permuteChainIndices(random);
  for (const stepIdx of permutation) {
    submissionSteps.push(chainItems[stepIdx]);
  }
}

function buildSubmissionSteps({ chainCount, chainsEvents, failedItems, random }) {
  const submissionSteps = [];
  for (let c = 0; c < chainCount; c += 1) {
    appendPermutedChain(submissionSteps, chainsEvents[c], random);
  }
  for (const failedStep of failedItems) {
    submissionSteps.push(failedStep);
  }
  return submissionSteps;
}

export function generateWorkloadDefinition({
  seed,
  chainCount,
  tenantCount,
  failedCount,
  clockStart = "2026-10-23T00:00:00.000Z",
  clockStepMs = 1000,
  sessionKey,
}) {
  const random = seededRandom(seed);
  const key = sessionKey !== undefined ? sessionKey : deriveDeterministicKey(seed);

  const tenants = buildTenants(tenantCount, random);
  const rawAccounts = generateAccountPool({ count: chainCount, random });
  const accountsWithTenants = distributeAccountsToTenants(rawAccounts, tenants);
  const addresses = assignSourceAddresses({ count: chainCount, sharedPairs: 2, random });

  const chainsIdentities = accountsWithTenants.map((acc, idx) => ({
    ...acc,
    address: addresses[idx],
  }));

  assertSyntheticIdentities(chainsIdentities, addresses);

  const nextTime = createTimeClock(clockStart, clockStepMs);
  const { groundTruthChains, perTenantPartitions } = initializeTenantMaps(tenants);
  const perSourceCounts = {};

  const chainsEvents = buildChainsEvents({
    chainsIdentities,
    chainCount,
    nextTime,
    perSourceCounts,
    groundTruthChains,
    perTenantPartitions,
  });

  sortTenantPartitions(perTenantPartitions, tenants);

  const { failedAuthsBySource, failedItems } = buildFailedAuthentications({
    failedCount,
    addresses,
    nextTime,
    perSourceCounts,
    random,
  });

  const submissionSteps = buildSubmissionSteps({
    chainCount,
    chainsEvents,
    failedItems,
    random,
  });

  const sharedPairs = [
    [chainsIdentities[0].accountId, chainsIdentities[1].accountId],
    [chainsIdentities[2].accountId, chainsIdentities[3].accountId],
  ];

  return {
    submissionSteps,
    groundTruth: {
      chains: groundTruthChains,
      per_source_counts: perSourceCounts,
      per_tenant_partitions: perTenantPartitions,
      failed_authentications: failedAuthsBySource,
      shared_source_pairs: sharedPairs,
    },
    sessionKey: key,
  };
}
