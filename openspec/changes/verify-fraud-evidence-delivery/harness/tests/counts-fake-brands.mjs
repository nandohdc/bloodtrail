// Counts-local extension of the chains fake's constructor surface. Identity, not shape, is authority.
import { createBrandRegistry } from "./fake-sdk-common.mjs";

const brands = createBrandRegistry();
const CONSTRUCTORS = Object.freeze({
  authoritativeSubject: "subject", authenticatedPrincipal: "authenticated_principal",
  credentialReference: "credential", delegationContext: "delegation", authoritativeTenant: "tenant",
  authoritativeResource: "resource", authenticationEvidence: "authentication", authorizationEvidence: "authorization",
  sessionEvidence: "session", serviceWorkload: "initiator", observedSource: "source", destinationContext: "destination",
  dataPolicyContext: "data", riskContext: "risk", integrityContext: "integrity", registeredEnrichmentExtension: "extensions",
});

const brand = brands.brand;

function humanActor(input) {
  return {
    type: "authenticated_human", id: input.id, tenant_id: input.tenantId,
    provenance: { trust_level: "authoritative_server", source: input.source },
  };
}

export function countsCore() {
  return Object.freeze({
    ...Object.fromEntries(Object.entries(CONSTRUCTORS).map(([name, field]) => [name, (input) => brand(field, input)])),
    anonymousActor: (source) => brand("actor", { type: "anonymous", provenance: { trust_level: "client_claim", source } }),
    authenticatedHumanActor: (input) => brand("actor", humanActor(input)),
    claimedTenant: (id) => brand("claimedTenant", { claimed_tenant_id: id }),
  });
}

function unbranded(input, field) {
  if (input[field] === undefined) return false;
  return !brands.has(input[field], field);
}

export function invalidBrand(input) {
  const fields = ["actor", "claimedTenant", ...Object.values(CONSTRUCTORS)];
  return fields.find((field) => unbranded(input, field));
}
