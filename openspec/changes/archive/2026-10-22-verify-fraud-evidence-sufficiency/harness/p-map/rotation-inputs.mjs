import { tenantInput } from "./lm-inputs.mjs";

const ACCOUNT = "pmap-acct-0001";
const TENANT = "pmap-tnt-0001";
const CREDENTIAL = "pmap-cred-rec-0001";
const ACTORS = { human: ["authenticatedHumanActor", ACCOUNT], service: ["serviceAccountActor", "pmap-svc-authn-0001"],
  administrator: ["administratorActor", "pmap-adm-0001"] };

function actorInput(state, kind) {
  const [method, id] = ACTORS[kind];
  return state.c(method, { id });
}

function subjectInput(state, tenantless) {
  const input = { type: "account", id: ACCOUNT };
  if (!tenantless) input.tenant_id = TENANT;
  return state.c("authoritativeSubject", input);
}

function resourceInput(state, { tenantless, type = "credential", operation_type = "update", categories }) {
  const input = { type, id: CREDENTIAL, operation_type };
  if (!tenantless) input.owning_tenant_id = TENANT;
  if (categories !== undefined) {
    input.change_categories = categories;
    input.data_classification = "restricted";
  }
  return state.c("authoritativeResource", input);
}

function policyInput(state, capability) {
  // Implementer default: the synthetic handler actually evaluated this policy.
  // Preserve recovery policy context (catalog :3269), even though not listed
  // in required_context; acceptance alone would not prove honest meaning.
  return state.c("authorizationEvidence", { decision: "allow", policy_id: "pmap-pol-recovery-0001",
    policy_version: "1.0.0", capability, enforcement_point: "credential-handler", decision_reason: "accepted" });
}

export function passwordRequestInput(state, { tenantless = false, handle }) {
  return { actor: actorInput(state, "human"), subject: subjectInput(state, tenantless), tenant: tenantInput(state, tenantless),
    source: state.c("observedSource", { observed: { address: "203.0.113.7" } }),
    request: { id: "pmap-req-0010", method: "POST", route: "/account/password" },
    // No operation handle on this not_applicable event. Shared public IDs
    // preserve the genuine operation linkage required by the async contract.
    correlation: { operation_id: handle.operationId, correlation_id: handle.correlationId } };
}

export function passwordCompletionInput(state, { tenantless = false } = {}) {
  return { actor: actorInput(state, "human"), subject: subjectInput(state, tenantless), tenant: tenantInput(state, tenantless),
    authentication: state.c("authenticationEvidence", { method: "password", mfa_state: "satisfied", credential_type: "password",
      authenticated_at: "2026-10-01T10:00:00.000Z" }),
    session: state.c("sessionEvidence", { id: "pmap-sfp-0001" }), resource: resourceInput(state, { tenantless }),
    authorization: policyInput(state, "account.password.update") };
}

export function credentialRotationInput(state, { actor = "human", tenantless = false } = {}) {
  return { actor: actorInput(state, actor), tenant: tenantInput(state, tenantless),
    resource: resourceInput(state, { tenantless, categories: ["rotation"] }),
    credential: state.c("credentialReference", { type: "api_credential" }),
    authorization: policyInput(state, "credential.rotate") };
}

export function rotationRoleInput(state, { actor }) {
  return { actor: actorInput(state, actor), subject: subjectInput(state, false), tenant: tenantInput(state),
    resource: resourceInput(state, { tenantless: false, type: "role", operation_type: "administer" }),
    authorization: policyInput(state, "credential.rotate"), event: { outcome_reason: { code: "completed" } } };
}
