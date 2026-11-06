// Synthetic host changes and branded event context (#842, Q245-Q246).
import { assertSynthetic } from "../lib/workload.mjs";
import { methodForIndex } from "./call-plan.mjs";

function identityFor(seed, index) {
  const hex = (seed + index).toString(16).padStart(8, "0");
  const identity = Object.fromEntries([
    ["businessId", "biz"], ["transactionId", "tx"], ["tenantId", "ten"],
    ["adminId", "admin"], ["actorId", "actor"], ["subjectId", "sub"],
    ["roleId", "role"], ["resourceId", "res"],
  ].map(([field, kind]) => [field, `syn-${kind}-${hex}`]));
  assertSynthetic({ ids: Object.values(identity), addresses: ["203.0.113.10"] });
  return { ...identity, address: "203.0.113.10" };
}

export function generateWorkloadDefinition({
  count, seed = 842001, clockStart = "2026-10-23T00:00:00.000Z", clockStepMs = 1000,
}) {
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const identity = identityFor(seed, index);
    items.push({
      index, method: methodForIndex(index), identity, businessId: identity.businessId,
      at: new Date(Date.parse(clockStart) + index * clockStepMs).toISOString(),
    });
  }
  return { items, count };
}

function roleContext(core, identity) {
  return {
    actor: core.administratorActor({ id: identity.adminId, tenantId: identity.tenantId }),
    subject: core.authoritativeSubject({
      type: "role", id: identity.subjectId, tenant_id: identity.tenantId,
    }),
    resource: core.authoritativeResource({
      type: "role", id: identity.roleId, owning_tenant_id: identity.tenantId,
      data_classification: "confidential", operation_type: "create",
    }),
    authorization: core.authorizationEvidence({
      decision: "allow", policy_id: "syn-policy-00000842", capability: "assign_role",
      enforcement_point: "authorization-transaction-owner", decision_reason: "accepted",
    }),
  };
}

function resourceContext(core, identity) {
  return {
    actor: core.authenticatedHumanActor({ id: identity.actorId, tenantId: identity.tenantId }),
    resource: core.authoritativeResource({
      type: "sensitive_record", id: identity.resourceId, owning_tenant_id: identity.tenantId,
      data_classification: "confidential", operation_type: "update", change_categories: ["metadata"],
    }),
    authorization: core.authorizationEvidence({
      decision: "allow", policy_id: "syn-policy-00000842", capability: "modify",
      enforcement_point: "resource-transaction-owner", decision_reason: "accepted",
    }),
  };
}

export function buildEventInput({ core, method, identity, at }) {
  const { address, ...ids } = identity;
  assertSynthetic({ ids: [...Object.values(ids), "syn-policy-00000842"], addresses: [address] });
  const contexts = { roleAssigned: roleContext, sensitiveResourceModified: resourceContext };
  return {
    ...contexts[method](core, identity),
    tenant: core.authoritativeTenant({
      scope: "tenant", effective_tenant_id: identity.tenantId,
      actor_tenant_id: identity.tenantId, resource_tenant_id: identity.tenantId,
    }),
    event: {
      timestamp: at, lifecycle_phase: "completed", outcome: "success",
      outcome_reason: { code: "completed" },
    },
  };
}
