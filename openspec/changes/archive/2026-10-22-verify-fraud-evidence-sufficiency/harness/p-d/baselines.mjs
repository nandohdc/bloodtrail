import { commit, instance, named, operation } from "./runtime.mjs";

export const AUTH = Object.freeze({ method: "password", assurance_level: "aal1", mfa_state: "not_used", credential_type: "password", identity_provider: "https://idp.synthetic.test", delegated: false, impersonated: false });
export const AUTH_MR = Object.freeze({ method: "session", assurance_level: "aal2", mfa_state: "satisfied", credential_type: "session", authenticated_at: "2026-10-01T12:00:00.000Z", identity_provider: "https://idp.synthetic.test", delegated: false, impersonated: false });
export const AUTHZ = Object.freeze({ decision: "allow", policy_id: "policy.synthetic", policy_version: "1.0.0", capability: "remove_mfa", enforcement_point: "mfa-authority", decision_reason: "accepted", tenant_context: { effective_tenant_id: "tnt_synthetic_a" } });

export function authenticationInput(state) {
  return {
    actor: state.c("anonymousActor"), tenant: state.c("authoritativeTenant", { scope: "tenantless" }),
    authentication: state.c("authenticationEvidence", AUTH),
    source: state.c("observedSource", { observed: { address: "203.0.113.10", port: 443 } }),
    request: { id: "req_synthetic_0001", method: "POST", route: "/login" },
    correlation: { correlation_id: "cor_synthetic_0001" }, event: { outcome_reason: { code: "credential_invalid" } },
  };
}

export function removalInput(state) {
  return {
    tenant: state.c("authoritativeTenant", { scope: "tenant", actor_tenant_id: "tnt_synthetic_a", effective_tenant_id: "tnt_synthetic_a", resource_tenant_id: "tnt_synthetic_a" }),
    actor: state.c("authenticatedHumanActor", { id: "usr_synthetic_0001", tenantId: "tnt_synthetic_a" }),
    subject: state.c("authoritativeSubject", { type: "account", id: "acct_synthetic_0001", tenant_id: "tnt_synthetic_a" }),
    authentication: state.c("authenticationEvidence", AUTH_MR), authorization: state.c("authorizationEvidence", AUTHZ),
    resource: state.c("authoritativeResource", { type: "credential", id: "cred_synthetic_0001", owning_tenant_id: "tnt_synthetic_a", data_classification: "confidential" }),
  };
}

export async function baselineAuthentication(state) {
  state.af = authenticationInput(state);
  state.baselineA = instance(state);
  await named(state, { target: state.baselineA, input: state.af });
  state.capture = state.baselineA.sink.events[0];
}

export async function baselineRemoval(state) {
  state.mr = removalInput(state);
  state.baselineM = instance(state);
  state.completed = operation(state, state.baselineM);
  commit(state, state.completed);
  await named(state, { target: state.baselineM, method: "mfaRemoved", input: { ...state.mr, operation: state.completed },
    facts: () => ({ operation_id: state.completed.operationId, transaction_id: state.completed.transactionId, correlation_id: state.completed.correlationId }) });
}

export const BASELINES = [
  { case_id: "PD-00", calls: 7, run: baselineAuthentication },
  { case_id: "PD-01", calls: 11, run: baselineRemoval },
];
