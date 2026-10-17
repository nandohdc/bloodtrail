import { afFixtureState, deliverFixture, hookRefusal } from "./p-attr-af-fixtures.mjs";
import { deepFreeze } from "./p-attr-foundation-fixtures.mjs";
import { asWorkload } from "../p-attr/carrier-workload.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";

// Offline scripted public-shape doubles only, NOT SDK conformance evidence.
// Independent source: semantic.ts:102-119,315-316,372-405; events.ts:510-525;
// schema.ts:8-17,96-104,146-156, all at cc4fdf5. Never read AS_CASES here.
const PRINCIPAL = { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" };
const REFUSALS = [
  [(event) => event.tenant === undefined, { code: "MISSING_TENANT_CONTEXT", category: "validation", path: "/tenant" }],
  [(event) => event.authenticated_principal === undefined, { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/authenticated_principal" }],
  [(event) => event.actor.type !== "anonymous" && event.actor.provenance.trust_level === "client_claim", { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" }],
  [(event) => event.actor.type === "anonymous", PRINCIPAL],
  [(event) => event.tenant.scope === "tenant" && event.tenant.claimed_tenant_id !== event.tenant.effective_tenant_id, { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/claimed_tenant_id" }],
];

function asEvent(input) {
  const event = structuredClone(input);
  if (event.tenant !== undefined) Object.assign(event.tenant, event.claimedTenant);
  delete event.claimedTenant;
  event.event = { name: "bloodtrail.audit.authentication.succeeded", outcome: "success", lifecycle_phase: "completed", commit_state: "not_applicable", delivery_class: "security_significant" };
  event.resource = { ...event.resource, operation_type: "execute" };
  event.correlation = {};
  return event;
}

function diagnosticFor({ event, config }) {
  const hooked = hookRefusal({ event, config, purpose: "authentication_succeeded" });
  if (hooked !== undefined) return hooked;
  const match = REFUSALS.find(([matches]) => matches(event));
  return match?.[1];
}

function emitAs({ config, input, mutate }) {
  const event = asEvent(input);
  const diagnostic = diagnosticFor({ event, config });
  return deliverFixture({ config, event, diagnostic, mutate });
}

export function asFixtureState({ mutate = () => {}, budget = 2000 } = {}) {
  const state = afFixtureState({ mutate, budget });
  const create = state.node.createNodeSecurityAuditSdk;
  const human = state.core.authenticatedHumanActor;
  state.core.authenticatedHumanActor = (input) => deepFreeze({ ...human(input), ...displayInput(input) });
  state.node.createNodeSecurityAuditSdk = (config) => ({ ...create(config), authenticationSucceeded: async (input) => emitAs({ config, input, mutate }) });
  return state;
}

function displayInput(input) {
  return input.displayName === undefined ? {} : { display_name: input.displayName };
}

export async function asFixtures(options = {}) {
  const state = asFixtureState(options);
  await asWorkload({ state, keying: memoryKeying() });
  return state;
}

// Hand-counted oracle: seven baseline constructors, sink, Node factory, named
// call =10. Replacement constructors count even when old contexts are unused.
export const AS_COUNTS = [
  ["AS-B", "ex:10"], ["AS-C0", "ex:11 without-principal:11"], ["AS-C1", "ex:11"],
  ["AS-C2", "ex:12 honest-control:11 keyed-mirror:12"], ["AS-C3", "ex:11 anonymous:11"],
  ["AS-C4", "ex:11"], ["AS-C5", "ex:11"], ["AS-CR", "ex:11"],
  ["AS-C6", "ex:11"], ["AS-C6s", "ex:12"], ["AS-C7", "ex:11"],
  ["AS-C7a", "ex:11"], ["AS-C7b", "ex:12"], ["AS-C8", "ex:11"],
  ["AS-C9", "ex:11"], ["AS-X2", "ex-0001:11 ex-0002:11 ex-0003:11"],
];
