// The workload generator for the copies probe (#839). Generates synthetic security_significant
// authentication events using the public kit constructors.
import { createHmac } from "node:crypto";
import { assertSynthetic, documentationAddress, opaqueId, seededRandom } from "../lib/workload.mjs";

const IDENTITY_PROVIDER = "https://idp.example.test";

export function copiesIdentities({ seed, count = 1 }) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const ids = {
      tenant: opaqueId({ kind: "tenant", random }),
      account: opaqueId({ kind: "account", random }),
      credential: opaqueId({ kind: "credential", random }),
      session_handle: opaqueId({ kind: "handle", random }),
    };
    const address = documentationAddress({ random });
    assertSynthetic({ ids: Object.values(ids), addresses: [address] });
    return { ids, address };
  });
}

export function sessionFingerprint({ key, handle }) {
  return createHmac("sha256", key).update(`session|${handle}`).digest("hex");
}

export function authenticationInput({ core, identities, at, sessionKey, override = {} }) {
  const { ids, address } = identities;
  return {
    actor: core.authenticatedHumanActor({ id: ids.account, tenantId: ids.tenant, source: "synthetic-server-authentication-authority" }),
    tenant: core.authoritativeTenant({ scope: "tenant", actor_tenant_id: ids.tenant, effective_tenant_id: ids.tenant, resource_tenant_id: ids.tenant }),
    authenticated_principal: core.authenticatedPrincipal({ type: "human_user", id: ids.account, issuer: IDENTITY_PROVIDER }),
    authentication: core.authenticationEvidence({
      method: "password_mfa", assurance_level: "aal2", mfa_state: "satisfied", credential_type: "session",
      authenticated_at: at, identity_provider: IDENTITY_PROVIDER, delegated: false, impersonated: false,
    }),
    credential: core.credentialReference({ type: "session", reference: ids.credential, key_id: "syn-key-v1" }),
    session: core.sessionEvidence({ id: sessionFingerprint({ key: sessionKey, handle: ids.session_handle }), created_at: at, age_seconds: 0, assurance_level: "aal2" }),
    source: core.observedSource({ observed: { address, port: 443 } }),
    ...override,
  };
}

// Produces a conflicting event by cloning an existing event, preserving event.id while mutating a field.
export function createConflictingEvent(event) {
  const cloned = structuredClone(event);
  if (cloned.data?.source?.observed) {
    cloned.data.source.observed.port = 8443;
  } else if (cloned.data) {
    cloned.data.detail = "conflicting_payload";
  }
  return Object.freeze(cloned);
}
