import { tenantInput } from "./lm-inputs.mjs";

// Implementer-default opaque category examples, NOT a registry or profile
// vocabulary. All constructors are fresh per emission; only X1 loses a brand.
const ACCOUNT = "pmap-acct-0001";
const TENANT = "pmap-tnt-0001";

function authorityInput(state, tenantless, capability) {
  return { actor: state.c("authenticatedHumanActor", { id: ACCOUNT }),
    tenant: tenantInput(state, tenantless),
    authorization: state.c("authorizationEvidence", { decision: "allow", policy_id: "pmap-pol-profile-0001",
      policy_version: "1.0.0", capability, enforcement_point: "profile-api", decision_reason: "accepted" }) };
}

function subjectInput(state, tenantless) {
  const subject = { type: "account", id: ACCOUNT };
  if (!tenantless) subject.tenant_id = TENANT;
  return state.c("authoritativeSubject", subject);
}

function resourceInput(state, { tenantless, categories, operation_type = "update", spreadResource = false }) {
  const resource = { type: "account", id: ACCOUNT, operation_type, data_classification: "restricted" };
  if (!tenantless) resource.owning_tenant_id = TENANT;
  if (!spreadResource) resource.change_categories = categories;
  const branded = state.c("authoritativeResource", resource);
  // X1 intentionally copies the object identity, unlike every other variant.
  return spreadResource ? { ...branded, change_categories: categories } : branded;
}

export function contactInput(state, { categories = ["contact_email"], tenantless = false, spreadResource = false } = {}) {
  return { ...authorityInput(state, tenantless, "account.contact.update"),
    subject: subjectInput(state, tenantless),
    resource: resourceInput(state, { categories, tenantless, spreadResource }),
    source: state.c("observedSource", { observed: { address: "203.0.113.7" } }),
    request: { id: "pmap-req-0004", method: "POST", route: "/account/contact" } };
}

export function contactConfigurationInput(state) {
  return { ...authorityInput(state, false, "account.contact.update"),
    resource: resourceInput(state, { categories: ["contact_email"], tenantless: false, operation_type: "configure" }) };
}

export function factorInput(state, { id, operation_type }) {
  return { ...authorityInput(state, false, "account.mfa.update"), subject: subjectInput(state, false),
    authentication: state.c("authenticationEvidence", { method: "password_mfa", mfa_state: "satisfied", credential_type: "session" }),
    resource: state.c("authoritativeResource", { type: "credential", id, owning_tenant_id: TENANT, operation_type }),
    credential: state.c("credentialReference", { type: "mfa_factor" }) };
}
