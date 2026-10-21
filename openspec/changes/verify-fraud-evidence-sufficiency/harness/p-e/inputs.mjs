// Synthetic MFA_INPUT per #803 comment 6137619745, with the shape the core
// conformance row proves (tests/conformance-account-authentication-session.test.ts:26-98,225-249
// at abcbefa). Every context constructor is a counted public core call, so a
// case's predicted_calls includes its six input constructors. Opaque ids only;
// resource type "credential" follows the catalog resource_rule "credential
// resource without factor contents" and operation_type is omitted, deriving
// to "delete" (core/src/events.ts:383-394).
const INPUT_IDS = {
  actor: "pe-actor-0001",
  tenant: "pe-tenant-0001",
  account: "pe-account-0001",
  factor: "pe-factor-0001",
};

export function mfaInput(state) {
  return {
    actor: state.c("authenticatedHumanActor", { id: INPUT_IDS.actor }),
    tenant: state.c("authoritativeTenant", { scope: "tenant", actor_tenant_id: INPUT_IDS.tenant,
      effective_tenant_id: INPUT_IDS.tenant, resource_tenant_id: INPUT_IDS.tenant }),
    subject: state.c("authoritativeSubject", { type: "account", id: INPUT_IDS.account, tenant_id: INPUT_IDS.tenant }),
    authentication: state.c("authenticationEvidence", { method: "password_mfa", assurance_level: "aal2",
      mfa_state: "satisfied", credential_type: "session", authenticated_at: "2026-07-31T11:55:00.000Z" }),
    authorization: state.c("authorizationEvidence", { decision: "allow", policy_id: "policy.pe-1",
      policy_version: "1.0.0", enforcement_point: "gateway", decision_reason: "accepted" }),
    resource: state.c("authoritativeResource", { type: "credential", id: INPUT_IDS.factor,
      owning_tenant_id: INPUT_IDS.tenant, data_classification: "confidential" }),
  };
}
