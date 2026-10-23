// The tracer's workload: one `authentication.succeeded` occurrence, a security_significant event, built
// only from the kit's public context constructors (injected as `core`). Every identifier is synthetic and
// opaque, and the observed address is in a documentation range.
import { createHmac } from "node:crypto";
import { assertSynthetic, documentationAddress, opaqueId, seededRandom } from "../lib/workload.mjs";

const IDENTITY_PROVIDER = "https://idp.example.test";

export function tracerIdentities({ seed }) {
  const random = seededRandom(seed);
  const ids = {
    tenant: opaqueId({ kind: "tenant", random }), account: opaqueId({ kind: "account", random }),
    credential: opaqueId({ kind: "credential", random }), session_handle: opaqueId({ kind: "handle", random }),
  };
  const address = documentationAddress({ random });
  assertSynthetic({ ids: Object.values(ids), addresses: [address] });
  return { ids, address };
}

// G29: the session identifier is a host-computed keyed fingerprint of the server session handle, under one
// per-run key that lives only in the sender's memory and is never recorded.
export function sessionFingerprint({ key, handle }) {
  return createHmac("sha256", key).update(`session|${handle}`).digest("hex");
}

// The session is the one this authentication created, so it is created at the event time and is 0 s old.
export function tracerInput({ core, identities, at, sessionKey }) {
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
  };
}
