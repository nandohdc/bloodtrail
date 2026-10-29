// Scoped context branding mirrors context.ts for the constructors used by this probe.
const brands = new WeakMap();
const FIELDS = [
  ["actor", "actor"], ["subject", "subject"], ["tenant", "tenant"],
  ["resource", "resource"], ["authorization", "authorization"],
];

function brand(kind, input) {
  const value = Object.freeze(structuredClone(input));
  brands.set(value, kind);
  return value;
}

function actor(type, input) {
  return brand("actor", {
    type, id: input.id, tenant_id: input.tenantId,
    provenance: { trust_level: "authoritative_server", source: "configured-authority" },
  });
}

export function outboxCore() {
  return {
    administratorActor: (input) => actor("administrator", input),
    authenticatedHumanActor: (input) => actor("authenticated_human", input),
    authoritativeTenant: (input) => brand("tenant", input),
    authoritativeSubject: (input) => brand("subject", input),
    authoritativeResource: (input) => brand("resource", input),
    authorizationEvidence: (input) => brand("authorization", input),
  };
}

export function unbrandedPath(input) {
  for (const [field, kind] of FIELDS) {
    if (input[field] === undefined) continue;
    if (brands.get(input[field]) !== kind) return `/${field}`;
  }
  return null;
}
