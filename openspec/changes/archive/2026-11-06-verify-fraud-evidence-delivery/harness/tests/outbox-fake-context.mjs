// Scoped checks for this probe's two events: selected required fields, actor/role shape
// and tenant conflict. This is not the full validation/semantic.ts implementation.
import { failure } from "./outbox-fake-operations.mjs";

function missing(base, path, code = "SDK_MISSING_EVENT_FIELD") {
  const value = path.slice(1).split("/").reduce((current, key) => current?.[key], base);
  if (value) return null;
  return failure(code, path);
}

function actor(base) {
  const absent = missing(base, "/actor/id", "MISSING_REQUIRED_ACTOR");
  if (absent) return failure("MISSING_REQUIRED_ACTOR", "/actor");
  return missing(base, "/actor/type", "MISSING_REQUIRED_ACTOR");
}

function administrator(base) {
  const absent = actor(base);
  if (absent) return absent;
  if (base.actor.type !== "administrator") return failure("MISSING_REQUIRED_ACTOR", "/actor/type");
  return null;
}

function tenant(base) {
  if (!base.tenant) return failure("MISSING_TENANT_CONTEXT", "/tenant");
  return missing(base, "/tenant/effective_tenant_id", "MISSING_TENANT_CONTEXT");
}

function role(base) {
  if (!base.resource) return failure("SDK_MISSING_EVENT_FIELD", "/resource");
  const valid = base.resource.type === "role" && Boolean(base.resource.id);
  if (!valid) return failure("SDK_MISSING_EVENT_FIELD", "/resource");
  return null;
}

function resource(base) {
  const type = missing(base, "/resource/type");
  if (type) return type;
  return missing(base, "/resource/id");
}

function categories(base) {
  const value = base.resource?.change_categories;
  if (!Array.isArray(value)) return failure("SDK_MISSING_EVENT_FIELD", "/resource/change_categories");
  if (value.length === 0) return failure("SDK_MISSING_EVENT_FIELD", "/resource/change_categories");
  return null;
}

const CHECKS = {
  administrator, actor, tenant, role, resource, change_categories: categories,
  subject: (base) => missing(base, "/subject"),
  authorization: (base) => {
    if (!base.authorization?.decision) return failure("SDK_MISSING_EVENT_FIELD", "/authorization");
    return null;
  },
  reason: (base) => missing(base, "/event/outcome_reason/code"),
  transaction: (base) => missing(base, "/correlation/transaction_id"),
  operation: (base) => missing(base, "/correlation/operation_id"),
};

function tenantConflict(base) {
  const resTenant = base.resource?.owning_tenant_id;
  if (!resTenant) return null;
  const tenant = base.tenant;
  if (!tenant) return null;
  const exempt = ["cross_tenant", "platform"].includes(tenant.scope);
  if (exempt) return null;
  if (resTenant === tenant.effective_tenant_id) return null;
  return failure("TENANT_RESOURCE_CONFLICT", "/resource/owning_tenant_id");
}

export function validateContexts(base, definition) {
  for (const context of definition.required_context) {
    const check = CHECKS[context];
    if (!check) throw new Error(`unmodelled required context: ${context}`);
    const error = check(base);
    if (error) return error;
  }
  return tenantConflict(base);
}
