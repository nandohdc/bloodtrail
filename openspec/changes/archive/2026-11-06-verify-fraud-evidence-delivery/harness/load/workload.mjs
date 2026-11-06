// The load probe's `best_effort` workload: `authorization.allowed`, the catalog's only `best_effort` event,
// built only from the kit's public context constructors (injected as `core`) in the shape of the SDK's own
// conformance row. Every identifier is synthetic and opaque.
import { assertSynthetic, opaqueId, seededRandom } from "../lib/workload.mjs";

export function policyIdentities({ seed }) {
  const random = seededRandom(seed);
  const ids = {
    tenant: opaqueId({ kind: "tenant", random }), workload: opaqueId({ kind: "workload", random }),
    policy: opaqueId({ kind: "policy", random }), request: opaqueId({ kind: "request", random }),
  };
  assertSynthetic({ ids: Object.values(ids), addresses: [] });
  return { ids };
}

export function allowedInput({ core, identities }) {
  const { ids } = identities;
  return {
    actor: core.workloadIdentityActor({ id: ids.workload }),
    tenant: core.authoritativeTenant({ scope: "tenant", actor_tenant_id: ids.tenant, effective_tenant_id: ids.tenant, resource_tenant_id: ids.tenant }),
    resource: core.authoritativeResource({
      type: "authorization_policy", id: ids.policy, owning_tenant_id: ids.tenant, data_classification: "confidential",
      operation_type: "execute", change_categories: ["metadata"],
    }),
    authorization: core.authorizationEvidence({
      decision: "allow", policy_id: "policy.synthetic-1", policy_version: "1.0.0", capability: "evaluate_authorization",
      enforcement_point: "policy-enforcement-point", decision_reason: "accepted",
      resource_context: { type: "authorization_policy", id: ids.policy }, tenant_context: { effective_tenant_id: ids.tenant },
    }),
    request: { id: ids.request, method: "GET", route: "/api/v1/protected/resource" },
  };
}
