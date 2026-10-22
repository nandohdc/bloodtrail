import { instance, jsonClone, named, spreadClone, step } from "./runtime.mjs";

const CLONES = [["spread", spreadClone], ["structured", structuredClone], ["json", jsonClone]];
const DELEGATION = { principal_id: "prn_synthetic_0001", expires_at: "2026-12-01T00:00:00.000Z" };
export const FORGED_ACTOR = { type: "authenticated_human", id: "usr_synthetic_0001", provenance: { trust_level: "authoritative_server", source: "hand-written" } };

async function unbranded(state, target) {
  for (const [id, change] of [["tenant", { tenant: { scope: "tenantless" } }], ["actor", { actor: FORGED_ACTOR }], ["claim", { claimedTenant: { claimed_tenant_id: "tnt_synthetic_b" } }]]) {
    await named(state, { id, target, input: { ...state.af, ...change } });
  }
}

async function cloned(state, target, clone) {
  const actor = clone === structuredClone ? state.c("authenticatedHumanActor", { id: "usr_synthetic_0001" }) : state.c("anonymousActor");
  const values = { tenant: state.c("authoritativeTenant", { scope: "tenantless" }), actor };
  for (const field of ["tenant", "actor"]) await named(state, { id: field, target, input: { ...state.af, [field]: clone(values[field]) } });
}

async function scope(state, target, id, frame) {
  let callbacks = 0;
  await step(state, id, target, () => state.method(target.sdk, "runWithContext", frame, () => { callbacks += 1; }), () => ({ callbacks }));
}

async function frameClones(state, target) {
  const actor = state.c("anonymousActor");
  for (const [id, clone] of CLONES) await scope(state, target, id, { actor: clone(actor) });
}

async function helpers(state, target) {
  const tenant = structuredClone(state.c("authoritativeTenant", { scope: "tenantless" }));
  await step(state, "frame", target, () => state.c("createAuditContextFrame", { tenant }));
  let callbacks = 0;
  await step(state, "free", target, () => state.c("runWithAuditContext", { tenant: { scope: "tenantless" } }, () => { callbacks += 1; }, state.node.nodeContextProvider), () => ({ callbacks }));
}

async function factory(state, target) {
  await step(state, "main", target, () => state.call("createNodeSecurityAuditSdk", () => state.node.createNodeSecurityAuditSdk({ ...target.config, authoritativeContext: { tenant: { scope: "tenantless" } } })));
}

async function delegation(state, target) {
  const actor = state.c("administratorActor", { id: "adm_synthetic_0001" });
  await step(state, "main", target, () => state.c("delegatedActorContext", structuredClone(actor), DELEGATION));
}

async function sharedBrands(state, target) {
  const other = instance(state);
  await named(state, { id: "a", target, input: state.af });
  await named(state, { id: "b", target: other, input: state.af });
}

async function remainingSlots(state, target) {
  for (const [id, change] of [["authentication", { authentication: { ...state.af.authentication } }], ["source", { source: structuredClone(state.af.source) }], ["precedence", { actor: { ...state.af.actor }, tenant: { ...state.af.tenant } }]]) {
    await named(state, { id, target, input: { ...state.af, ...change } });
  }
}

async function sharedFrame(state, target) {
  const other = instance(state);
  const { actor, tenant, ...input } = state.af;
  await step(state, "main", other, () => state.method(target.sdk, "runWithContext", { actor, tenant }, () => state.method(other.sdk, "authenticationFailed", input)), () => ({ sink_a: target.sink.events.length }));
}

export const A_CASES = [
  ["PD-A1", 5, unbranded],
  ["PD-A2", 6, (s, t) => cloned(s, t, spreadClone)],
  ["PD-A3", 6, (s, t) => cloned(s, t, structuredClone)],
  ["PD-A4", 6, (s, t) => cloned(s, t, jsonClone)],
  ["PD-A5", 5, (s, t) => scope(s, t, "main", { actor: s.c("anonymousActor"), tenant: { scope: "tenantless" } })],
  ["PD-A6", 9, frameClones], ["PD-A7", 7, helpers], ["PD-A8", 4, factory],
  ["PD-A9", 4, (s, t) => named(s, { target: t, input: { ...s.af, subject: s.c("authoritativeResource", { type: "account", id: "acct_synthetic_0001" }) } })],
  ["PD-A10", 5, delegation], ["PD-A11", 6, sharedBrands], ["PD-A12", 5, remainingSlots], ["PD-A13", 6, sharedFrame],
];
