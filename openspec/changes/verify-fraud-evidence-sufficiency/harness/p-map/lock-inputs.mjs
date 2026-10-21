import { tenantInput } from "./lm-inputs.mjs";

const ACCOUNT = "pmap-acct-0001";
const TENANT = "pmap-tnt-0001";
const ACTORS = {
  service: ["serviceAccountActor", "pmap-svc-authn-0001"],
  workload: ["workloadIdentityActor", "pmap-wl-authn-0001"],
  admin: ["administratorActor", "pmap-adm-0001"],
  scheduled: ["scheduledProcessActor", "pmap-job-unlock-0001"],
};

function actorInput(state, kind) {
  const [method, id] = ACTORS[kind];
  return state.c(method, { id });
}

function policyInput(state, { decision = "allow", release = false } = {}) {
  if (decision === "not_applicable") return state.c("authorizationEvidence", { decision });
  return state.c("authorizationEvidence", { decision,
    policy_id: release ? "pmap-pol-admin-0001" : "pmap-pol-lockout-0001", policy_version: "1.0.0",
    capability: release ? "account.unlock" : "account.lock",
    enforcement_point: release ? "admin-api" : "authn-svc",
    decision_reason: decision === "deny" ? "rate_limited" : "policy_baseline" });
}

function accountResource(state, { tenantless = false, type = "account", operation_type = "update", category }) {
  const input = { type, id: ACCOUNT, operation_type, data_classification: "confidential" };
  if (!tenantless) input.owning_tenant_id = TENANT;
  if (category !== undefined) input.change_categories = [category];
  return state.c("authoritativeResource", input);
}

// G36: rate_limited is permitted but this failure carries no target. The request
// linkage is reused by K2a as an observed join, NOT a #806 profile decision.
export function lockFailureInput(state) {
  return { actor: state.c("anonymousActor"), tenant: tenantInput(state, true),
    authentication: state.c("authenticationEvidence", { method: "password", mfa_state: "not_used",
      credential_type: "password", failure_reason: "rate_limited" }),
    credential: state.c("credentialReference", { type: "password" }),
    source: state.c("observedSource", { observed: { address: "198.51.100.23" } }),
    request: { id: "pmap-req-0005", method: "POST", route: "/login" },
    event: { outcome_reason: { code: "rate_limited" } } };
}

export function lockModificationInput(state, { tenantless = false, actor = "service", decision = "allow", release = false,
  category = release ? "lockout_release" : "lockout" } = {}) {
  const subject = { type: "account", id: ACCOUNT };
  if (!tenantless) subject.tenant_id = TENANT;
  return { actor: actorInput(state, actor), subject: state.c("authoritativeSubject", subject),
    tenant: tenantInput(state, tenantless),
    resource: accountResource(state, { tenantless, category }),
    authorization: policyInput(state, { decision, release }),
    event: { outcome_reason: { code: release ? "operator_requested" : "rate_limited" } } };
}

export function lockConfigurationInput(state, { type }) {
  return { actor: actorInput(state, "workload"), tenant: tenantInput(state),
    resource: accountResource(state, { type, operation_type: "configure", category: "lockout" }),
    authorization: policyInput(state) };
}

export function lockDenialInput(state, { tenantless = false } = {}) {
  return { actor: state.c("anonymousActor"), tenant: tenantInput(state, tenantless),
    resource: accountResource(state, { tenantless, operation_type: "execute" }),
    authorization: policyInput(state, { decision: "deny" }),
    source: state.c("observedSource", { observed: { address: "198.51.100.23" } }) };
}
