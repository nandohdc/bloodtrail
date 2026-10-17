import { fixtureState, deepFreeze } from "./p-attr-foundation-fixtures.mjs";
import { afWorkload } from "../p-attr/carrier-workload.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";

// Offline public-shape doubles; not kit code, not an alternate conformance gate.
// These few scripted surfaces were read independently at the pinned base:
// events.ts:287-352; semantic.ts:372-405; schema.ts:96-104,126-129.
const D = {
  tenant: { code: "MISSING_TENANT_CONTEXT", category: "validation", path: "/tenant" },
  conflict: { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/claimed_tenant_id" },
  actor: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" },
  principal: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" },
  length: { code: "FIELD_LIMIT_EXCEEDED", category: "validation", path: "/authentication/method" },
  hook: { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" },
  async: { code: "SDK_UNSUPPORTED_HOOK_RESULT", category: "privacy", path: "/actor/id" },
};
const REFUSALS = [
  ["tenant", (event) => event.tenant === undefined],
  ["conflict", (event) => event.tenant.scope === "tenant" && event.tenant.claimed_tenant_id !== event.tenant.effective_tenant_id],
  ["actor", (event) => event.actor.type !== "anonymous" && event.actor.provenance.trust_level === "client_claim"],
  ["principal", (event) => event.actor.type === "anonymous" && event.authenticated_principal !== undefined],
  ["length", (event) => event.authentication.method.length > 64],
];
const COPIED = ["authoritativeSubject", "authoritativeResource", "authorizationEvidence"];

function contextualActor({ input, trust, source }) {
  return deepFreeze({ ...input, provenance: { trust_level: trust, source } });
}

function hookResult({ event, hook, purpose }) {
  if (event.actor.id === undefined) return;
  if (event.tenant === undefined) return D.hook;
  const output = hook.transform({ path: "actor.id", value: event.actor.id, purpose, tenantId: event.tenant.effective_tenant_id });
  if (output instanceof Promise) return D.async;
  event.actor.id = output.value;
}

function syntheticEvent(input) {
  const event = structuredClone(input);
  if (event.tenant !== undefined) Object.assign(event.tenant, event.claimedTenant);
  delete event.claimedTenant;
  event.event = { ...event.event, name: "bloodtrail.audit.authentication.failed", outcome: "failure", lifecycle_phase: "completed", commit_state: "not_applicable", delivery_class: "security_significant" };
  event.resource = { ...event.resource, operation_type: "execute" };
  event.correlation = { request_id: event.request.id };
  return event;
}

export function hookRefusal({ event, config, purpose = "authentication_failed" }) {
  for (const hook of config.transformations ?? []) {
    const diagnostic = hookResult({ event, hook, purpose });
    if (diagnostic !== undefined) return diagnostic;
  }
}

function refusal(context) {
  const diagnostic = hookRefusal(context);
  if (diagnostic !== undefined) return diagnostic;
  const match = REFUSALS.find(([, matches]) => matches(context.event));
  return D[match?.[0]];
}

function emit({ config, input, mutate }) {
  const event = syntheticEvent(input);
  const diagnostic = refusal({ event, config });
  return deliverFixture({ config, event, diagnostic, mutate });
}

export function deliverFixture({ config, event, diagnostic, mutate }) {
  const raw = diagnostic === undefined ? { ok: true, value: { status: "accepted" } } : { ok: false, error: diagnostic };
  const observed = { event, raw };
  mutate(observed);
  if (observed.raw.ok) config.sink.events.push(deepFreeze(observed.event));
  return observed.raw;
}

export function afFixtureState({ mutate = () => {}, budget = 2000 } = {}) {
  const state = fixtureState({ budget });
  for (const name of COPIED) state.core[name] = (input) => deepFreeze(structuredClone(input));
  state.core.claimedTenant = (id) => deepFreeze({ claimed_tenant_id: id });
  state.core.claimedActor = (input) => contextualActor({ input, trust: "client_claim", source: "request_boundary" });
  state.core.authoritativeActor = (input) => contextualActor({ input, trust: "authoritative_server", source: "configured-authority" });
  state.node.createNodeSecurityAuditSdk = (config) => ({ authenticationFailed: async (input) => emit({ config, input, mutate }) });
  return state;
}

export async function afFixtures(options = {}) {
  const state = afFixtureState(options);
  await afWorkload({ state, keying: memoryKeying() });
  return state;
}

export function recordAt(state, id) {
  return state.records.find((record) => record.step_id === id);
}

// Independent roster/count oracle, NOT generated from the production descriptors.
// Per variant totals include baseline's four constructors even when replaced,
// sink + Node factory + named call, and each actually invoked hook callback.
export const AF_COUNTS = [
  ["AF-B", "ex:7 nx:7"], ["AF-C0t", "ex:8 nx:8"], ["AF-C1", "ex:8 nx:8"],
  ["AF-C2", "ex:9 nx:9 absent-ex:7 absent-nx:7"], ["AF-C3", "ex:8 nx:8"], ["AF-C3s", "ex:8 nx:8"],
  ["AF-C4", "ex:8 nx:8"], ["AF-C5", "ex:8 nx:7"], ["AF-CR", "ex:8 nx:8 credential-type-ex:8 credential-type-nx:8"],
  ["AF-C6", "ex:8 nx:8"], ["AF-C6s", "ex:9 nx:8"], ["AF-C7", "ex:8 nx:8"], ["AF-C7a", "ex:8 nx:8"],
  ["AF-C7b", "ex:9 nx:9 equal-claim-ex:9 equal-claim-nx:9"], ["AF-C8", "ex:8 nx:8"], ["AF-C9", "ex:8 nx:8"],
  ["AF-X1", "ex:8 nx:8"], ["AF-X2", "ex:8 nx:8"], ["AF-X3", "ex:8 nx:8"], ["AF-X4", "ex:9 nx:7"],
  ["AF-F1", "id-ex:7 id-nx:7 route-ex:7 route-nx:7"], ["AF-F2", "ex:8 nx:8 length-control-ex:8 length-control-nx:8"],
  ["AF-F3", "ex:8 nx:8"], ["AF-C2h-t", "ex:9 nx:9"], ["AF-C2-async", "ex:9 nx:9"], ["AF-C0r", "ex:8 nx:8"], ["AF-F4", "ex:7 nx:7"],
];
