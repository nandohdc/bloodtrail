// Public constructors only, injected and counted. G-log implementer default:
// Node SDK factory. G36 permits second-factor reasons but gives them no target.
// Context brands are retained intact (core/src/context.ts:388-392 at 8e6cdf7).
const IDS = { account: "pmap-acct-0001", admin: "pmap-adm-0001",
  tenant: "pmap-tnt-0001", session: "pmap-sfp-0001" };

export function tenantInput(state, tenantless = false) {
  const input = tenantless ? { scope: "tenantless" } : { scope: "tenant",
    actor_tenant_id: IDS.tenant, effective_tenant_id: IDS.tenant, resource_tenant_id: IDS.tenant };
  return state.c("authoritativeTenant", input);
}

const ACTORS = {
  human: (state) => state.c("authenticatedHumanActor", { id: IDS.account }),
  admin: (state) => state.c("administratorActor", { id: IDS.admin }),
  anonymous: (state) => state.c("anonymousActor"),
};

export function logoutInput(state, { tenantless = false, actor = "human", decision = "not_applicable" } = {}) {
  const subject = { type: "account", id: IDS.account };
  const resource = { type: "session", id: IDS.session, operation_type: "delete" };
  if (!tenantless) {
    subject.tenant_id = IDS.tenant;
    resource.owning_tenant_id = IDS.tenant;
  }
  const authorization = decision === "not_applicable" ? { decision } : {
    decision, policy_id: "pmap-pol-session-0001", enforcement_point: "admin-api" };
  return { actor: ACTORS[actor](state),
    subject: state.c("authoritativeSubject", subject), tenant: tenantInput(state, tenantless),
    session: state.c("sessionEvidence", { id: IDS.session }),
    resource: state.c("authoritativeResource", resource),
    authorization: state.c("authorizationEvidence", authorization),
    request: { id: "pmap-req-0002", method: "POST", route: "/logout" },
    source: state.c("observedSource", { observed: { address: "203.0.113.7" } }) };
}

export function failureInput(state, { tenantless = true, actor = "anonymous" } = {}) {
  return { actor: ACTORS[actor](state), tenant: tenantInput(state, tenantless),
    authentication: state.c("authenticationEvidence", { method: "totp", mfa_state: "failed",
      credential_type: "mfa_factor", failure_reason: "mfa_failed" }),
    credential: state.c("credentialReference", { type: "mfa_factor" }),
    event: { outcome_reason: { code: "mfa_failed" } },
    source: state.c("observedSource", { observed: { address: "2001:db8::17", port: 443 } }),
    request: { id: "pmap-req-0003", method: "POST", route: "/login/mfa" } };
}

// Eight fresh contexts shared by the two L3 tenantless controls. Resource is
// a session reference, not a target carrier. The fingerprint equals L1's.
export function tenantlessLoginInput(state) {
  return { actor: ACTORS.human(state), tenant: tenantInput(state, true),
    authenticated_principal: state.c("authenticatedPrincipal", { type: "human_user", id: IDS.account }),
    authentication: state.c("authenticationEvidence", { method: "password", mfa_state: "not_used",
      credential_type: "password" }),
    credential: state.c("credentialReference", { type: "password" }),
    session: state.c("sessionEvidence", { id: IDS.session }),
    resource: state.c("authoritativeResource", { type: "session", id: IDS.session, operation_type: "create" }),
    source: state.c("observedSource", { observed: { address: "203.0.113.7" } }) };
}

export function resolvedFailureSubject(state) {
  return state.c("authoritativeSubject", { type: "account", id: IDS.account });
}
