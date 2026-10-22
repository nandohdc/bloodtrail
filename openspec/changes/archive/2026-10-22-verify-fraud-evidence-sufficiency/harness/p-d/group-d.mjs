import { AUTH } from "./baselines.mjs";
import { marker } from "./markers.mjs";
import { named, step } from "./runtime.mjs";

const VALUE_FORMS = {
  "PD-D3": [["main", "bearer16"], ["b1", "bearer15"], ["b2", "bearerBroken"]],
  "PD-D4": [["main", "key16"], ["boundary", "key15"]], "PD-D5": [["main", "privateKey"]],
  "PD-D6": [["upper", "upperWord"], ["lower", "lowerWord"]], "PD-D7": [["main", "underscore"]],
  "PD-D8": [["main", "hyphen"]], "PD-D10": [["main", "pluralValue"]],
};

async function values(state, target) {
  for (const [id, recipe] of VALUE_FORMS[state.current]) {
    await named(state, { id, target, input: { ...state.af, request: { ...state.af.request, user_agent: marker(recipe) } } });
  }
}

function keyed(state, target, recipe, unbranded = false) {
  const input = { ...state.af, request: { ...state.af.request, [marker(recipe)]: "x" } };
  if (unbranded) input.tenant = { scope: "tenantless" };
  return named(state, { target, input });
}

async function refresh(state, target) {
  const key = marker("keyRefresh");
  await named(state, { id: "top", target, input: { ...state.af, [key]: "x" } });
  const authentication = state.c("authenticationEvidence", { ...AUTH, [key]: "x" });
  await named(state, { id: "constructor", target, input: { ...state.af, authentication } });
}

async function deferred(state, target) {
  let callbacks = 0;
  const request = { id: "req_synthetic_0002", user_agent: marker("bearer16") };
  await step(state, "frame", target, () => state.method(target.sdk, "runWithContext", { tenant: state.af.tenant, request }, () => {
    callbacks += 1;
    return state.method(target.sdk, "authenticationFailed", { ...state.af, request: { id: request.id, method: "POST", route: "/login" } });
  }), () => ({ callbacks }));
  const actor = state.c("claimedActor", { type: "anonymous", display_name: marker("hyphen") });
  await named(state, { id: "constructor", target, input: { ...state.af, actor } });
}

async function openSlot(state, target) {
  for (const recipe of ["pluralKey", "joinedKey"]) await named(state, { id: recipe, target, input: { ...state.af, request: { ...state.af.request, [marker(recipe)]: "x" } } });
  const source = state.c("observedSource", { observed: { address: "203.0.113.10", port: 443, proxy_chain: [{ [marker("joinedKey")]: "synthetic-value" }] } });
  await named(state, { id: "open", target, input: { ...state.af, source } });
}

export const D_CASES = [
  ["PD-D1", 3, (s, t) => keyed(s, t, "keyHash")], ["PD-D2", 5, refresh],
  ["PD-D3", 5, values], ["PD-D4", 4, values], ["PD-D5", 3, values], ["PD-D6", 4, values],
  ["PD-D7", 3, values], ["PD-D8", 3, values], ["PD-D9", 3, (s, t) => keyed(s, t, "underscore")],
  ["PD-D10", 3, values], ["PD-D11", 6, deferred],
  ["PD-D12", 3, (s, t) => keyed(s, t, "keyHash", true)], ["PD-D13", 6, openSlot],
];
