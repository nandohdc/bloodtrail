import { commit, named, operation, step } from "./runtime.mjs";

const CLAIM = { type: "authenticated_human", id: "usr_synthetic_0001" };
const DELEGATORS = ["delegatedActorContext", "impersonatingActorContext"];

async function claimed(state, target, override = {}) {
  const actor = state.c("claimedActor", { ...CLAIM, ...override });
  await named(state, { target, input: { ...state.af, actor }, facts: () => ({ provenance: actor.provenance }) });
}

async function frame(state, target, principal = false) {
  const actor = principal ? state.c("anonymousActor") : state.c("claimedActor", CLAIM);
  const context = { actor, tenant: state.af.tenant };
  if (principal) {
    context.authenticated_principal = state.c("authenticatedPrincipal", { type: "human_user", id: "prn_synthetic_0001" });
  }
  let callbacks = 0;
  await step(state, "main", target, () => state.method(target.sdk, "runWithContext", context, () => {
    callbacks += 1;
    return state.method(target.sdk, "authenticationFailed", { ...state.af, actor: undefined });
  }), () => ({ callbacks }));
}

async function principal(state, target) {
  await named(state, { target, input: { ...state.af, actor: state.c("anonymousActor"), authenticated_principal: state.c("authenticatedPrincipal", { type: "human_user", id: "prn_synthetic_0001" }) } });
}

async function promoted(state, target) {
  for (const method of DELEGATORS) {
    const actor = state.c("claimedActor", { type: "administrator", id: "adm_synthetic_0001" });
    await step(state, method, target, () => state.c(method, actor, { principal_id: "prn_synthetic_0001", expires_at: "2026-12-01T00:00:00.000Z" }));
  }
}

async function tenantConflict(state, target) {
  const h = operation(state, target);
  commit(state, h);
  await named(state, { id: "conflict", target, method: "mfaRemoved", input: { ...state.mr, operation: h, claimedTenant: state.c("claimedTenant", "tnt_synthetic_b") } });
  await named(state, { id: "repeat", target, method: "mfaRemoved", input: { ...state.mr, operation: h } });
  await named(state, { id: "tenantless", target, input: { ...state.af, claimedTenant: state.c("claimedTenant", "tnt_synthetic_b") } });
}

export const B_CASES = [
  ["PD-B1", 4, claimed],
  ["PD-B2", 4, (s, t) => claimed(s, t, { provenance: { trust_level: "authoritative_server", source: "hand-written" } })],
  ["PD-B3", 5, frame], ["PD-B4", 5, principal], ["PD-B5", 6, (s, t) => frame(s, t, true)],
  ["PD-B6", 4, (s, t) => named(s, { target: t, input: { ...s.af, actor: s.c("authenticatedHumanActor", { id: "usr_synthetic_0001" }) }, facts: () => ({ provenance_ambiguity: 1 }) })],
  ["PD-B7", 4, (s, t) => named(s, { target: t, input: { ...s.af, tenant: s.c("claimedTenant", "tnt_synthetic_b") } })],
  ["PD-B8", 8, promoted], ["PD-B9", 9, tenantConflict],
];
