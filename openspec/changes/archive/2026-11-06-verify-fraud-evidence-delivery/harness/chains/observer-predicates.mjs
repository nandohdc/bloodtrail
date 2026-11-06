// Predicates and accessors for chains probe observers (#840).
import { isDocumentationAddress, isSyntheticId } from "../lib/workload.mjs";

const EMAIL_PATTERN = /@[a-z0-9.-]+\.[a-z]{2,}/i;

export function resolveGroundTruth(config, caseDef) {
  if (caseDef?.ground_truth) {
    return caseDef.ground_truth;
  }
  const gtKey = "ground_truth";
  if (config?.[gtKey]) {
    return config[gtKey];
  }
  return null;
}

export function getReconstructionPhase(observed) {
  if (!observed) return null;
  if (observed.chains_small) return observed.chains_small;
  const phaseList = Object.values(observed);
  return phaseList.length > 0 ? phaseList[0] : null;
}

export function hasReconstructionChains(phase) {
  return Boolean(phase && phase.reconstruction && phase.reconstruction.chains);
}

export function hasSmallReconstruction(observed) {
  return Boolean(observed && observed.chains_small && observed.chains_small.reconstruction);
}

export function hasPerSourceCounts(groundTruth) {
  return Boolean(groundTruth && groundTruth.per_source_counts);
}

export function hasPerTenantPartitions(groundTruth) {
  return Boolean(groundTruth && groundTruth.per_tenant_partitions);
}

export function hasFailedAuthentications(groundTruth) {
  return Boolean(groundTruth && groundTruth.failed_authentications);
}

export function hasChains(groundTruth) {
  return Boolean(groundTruth && groundTruth.chains);
}

export function hasSharedSourcePairs(groundTruth) {
  return Boolean(groundTruth && Array.isArray(groundTruth.shared_source_pairs));
}

export function hasSmallIngress(observed) {
  return Boolean(observed && observed.chains_small && observed.chains_small.ingress);
}

export function hasNonEmptyArray(actualList) {
  return Boolean(Array.isArray(actualList) && actualList.length > 0);
}

export function hasSameLengthArray(actualList, expectedList) {
  return Boolean(Array.isArray(actualList) && actualList.length === expectedList.length);
}

export function getIngressPersistedBodies(phase) {
  if (phase?.ingress?.persisted_bodies) {
    return phase.ingress.persisted_bodies;
  }
  return null;
}

export function isPrincipalSynthetic(body) {
  const acc = body?.authenticated_principal?.id;
  if (!acc) return true;
  return isSyntheticId(acc);
}

export function isActorSynthetic(body) {
  const actor = body?.actor?.id;
  if (!actor) return true;
  return isSyntheticId(actor);
}

export function checkOpaqueIdentifiers(bodies) {
  for (const body of bodies) {
    if (!isPrincipalSynthetic(body)) return false;
    if (!isActorSynthetic(body)) return false;
  }
  return true;
}

export function hasEmailPattern(str) {
  return Boolean(str.includes("@example") || EMAIL_PATTERN.test(str));
}

export function checkNoEmail(bodies) {
  for (const body of bodies) {
    const str = JSON.stringify(body);
    if (hasEmailPattern(str)) {
      return false;
    }
  }
  return true;
}

export function isBodyAddressValid(body) {
  const addr = body?.source?.observed?.address;
  if (!addr) return true;
  return isDocumentationAddress(addr);
}

export function checkDocAddresses(bodies) {
  for (const body of bodies) {
    if (!isBodyAddressValid(body)) return false;
  }
  return true;
}
