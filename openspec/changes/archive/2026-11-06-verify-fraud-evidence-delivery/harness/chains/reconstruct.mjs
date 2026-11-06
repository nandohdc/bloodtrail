// Pure, kit-free, rule-free account-takeover chain reconstruction (#840, Q207).
// Reads persisted bodies only, groups by tenant, account opaque ID, and session fingerprint,
// and orders occurrences strictly by event timestamp.

function isFailedAuthEvent(name) {
  return name === "bloodtrail.audit.authentication.failed";
}

export function codePointCompare(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export const compareByEventTimestamp = (left, right) => codePointCompare(left.timestamp, right.timestamp);

function getPath(target, path) {
  let current = target;
  for (const segment of path) {
    if (!current) return undefined;
    current = current[segment];
  }
  return current;
}

function resolveTenantId(body) {
  const effective = getPath(body, ["tenant", "effective_tenant_id"]);
  if (effective) return effective;
  const scope = getPath(body, ["tenant", "scope"]);
  if (!scope || scope === "tenantless") return null;
  return scope;
}

function resolveAccountId(body) {
  const principalId = getPath(body, ["authenticated_principal", "id"]);
  if (principalId) return principalId;
  const actorType = getPath(body, ["actor", "type"]);
  if (actorType === "authenticated_human") {
    return getPath(body, ["actor", "id"]) || null;
  }
  return null;
}

const SIMPLE_PATHS = [
  ["name", ["event", "name"], ""],
  ["timestamp", ["event", "timestamp"], ""],
  ["eventId", ["event", "id"], ""],
  ["sourceAddress", ["source", "observed", "address"], null],
  ["sessionId", ["session", "id"], null],
];

function extractSimpleFields(body) {
  const fields = {};
  for (const [key, path, fallback] of SIMPLE_PATHS) {
    const val = getPath(body, path);
    fields[key] = val !== undefined ? val : fallback;
  }
  return fields;
}

function extractRecordFields(body) {
  const simple = extractSimpleFields(body);
  return {
    ...simple,
    tenantId: resolveTenantId(body),
    accountId: resolveAccountId(body),
  };
}

function recordPerSourceCount(counts, sourceAddress) {
  if (sourceAddress) {
    counts[sourceAddress] = (counts[sourceAddress] || 0) + 1;
  }
}

function recordFailedAuth(grouped, record) {
  const { sourceAddress, name, timestamp, eventId } = record;
  if (!sourceAddress) return;
  grouped[sourceAddress] = grouped[sourceAddress] || [];
  grouped[sourceAddress].push({ name, timestamp, id: eventId });
}

function hasRequiredChainFields(record) {
  if (!record.tenantId) return false;
  if (!record.accountId) return false;
  return Boolean(record.sessionId);
}

function ensureChainBucket(chains, tenantId, accountId, sessionId) {
  chains[tenantId] = chains[tenantId] || {};
  chains[tenantId][accountId] = chains[tenantId][accountId] || {};
  chains[tenantId][accountId][sessionId] = chains[tenantId][accountId][sessionId] || [];
  return chains[tenantId][accountId][sessionId];
}

function recordChainEvent(chains, record) {
  if (!hasRequiredChainFields(record)) return;
  const { tenantId, accountId, sessionId, name, timestamp, eventId, sourceAddress } = record;
  const events = ensureChainBucket(chains, tenantId, accountId, sessionId);
  events.push({
    name,
    timestamp,
    id: eventId,
    source: sourceAddress,
  });
}

function sortSessionEvents(events, orderComparator) {
  events.sort(orderComparator);
}

function sortAccountSessions(accountObj, orderComparator) {
  for (const sessionId of Object.keys(accountObj)) {
    sortSessionEvents(accountObj[sessionId], orderComparator);
  }
}

function sortTenantChains(tenantObj, orderComparator) {
  for (const accountId of Object.keys(tenantObj)) {
    sortAccountSessions(tenantObj[accountId], orderComparator);
  }
}

function sortChainEvents(chains, orderComparator) {
  for (const tenantId of Object.keys(chains)) {
    sortTenantChains(chains[tenantId], orderComparator);
  }
}

function sortFailedAuths(failedAuths, orderComparator) {
  for (const source of Object.keys(failedAuths)) {
    failedAuths[source].sort(orderComparator);
  }
}

function buildTenantPartitions(chains) {
  const partitions = {};
  for (const tenantId of Object.keys(chains)) {
    partitions[tenantId] = Object.keys(chains[tenantId]).sort(codePointCompare);
  }
  return partitions;
}

function collectSessionEvents(events, sourceBuckets) {
  const item = events[0];
  const src = item && item.source ? item.source : "unknown";
  sourceBuckets[src] = sourceBuckets[src] || [];
  sourceBuckets[src].push(...events);
}

function collectAccountSourceBuckets(accountObj, sourceBuckets) {
  for (const sessionId of Object.keys(accountObj)) {
    collectSessionEvents(accountObj[sessionId], sourceBuckets);
  }
}

function collectTenantSourceBuckets(tenantObj) {
  const sourceBuckets = {};
  for (const accountId of Object.keys(tenantObj)) {
    collectAccountSourceBuckets(tenantObj[accountId], sourceBuckets);
  }
  return sourceBuckets;
}

function buildMergedTenantChains(sourceBuckets) {
  const merged = {};
  for (const [src, events] of Object.entries(sourceBuckets)) {
    const mergedKey = `merged-source-${src}`;
    merged[mergedKey] = {
      "merged-session": events.sort(compareByEventTimestamp),
    };
  }
  return merged;
}

export function reconstructChains(persistedBodies, orderComparator = compareByEventTimestamp) {
  const chains = {};
  const perSourceCounts = {};
  const failedAuths = {};
  const items = persistedBodies || [];

  for (const item of items) {
    const body = typeof item === "string" ? JSON.parse(item) : item;
    const record = extractRecordFields(body);
    recordPerSourceCount(perSourceCounts, record.sourceAddress);

    if (isFailedAuthEvent(record.name)) {
      recordFailedAuth(failedAuths, record);
    } else {
      recordChainEvent(chains, record);
    }
  }

  if (typeof orderComparator === "function") {
    sortChainEvents(chains, orderComparator);
    sortFailedAuths(failedAuths, orderComparator);
  }

  return {
    chains,
    per_source_counts: perSourceCounts,
    per_tenant_partitions: buildTenantPartitions(chains),
    failed_authentications: failedAuths,
  };
}

export function reconstructOrderByArrival(persistedBodies) {
  return reconstructChains(persistedBodies, null);
}

export function reconstructMergeBySource(persistedBodies) {
  const honest = reconstructChains(persistedBodies);
  const mergedChains = {};

  for (const tenantId of Object.keys(honest.chains)) {
    const sourceBuckets = collectTenantSourceBuckets(honest.chains[tenantId]);
    mergedChains[tenantId] = buildMergedTenantChains(sourceBuckets);
  }

  return {
    ...honest,
    chains: mergedChains,
    per_tenant_partitions: buildTenantPartitions(mergedChains),
  };
}
