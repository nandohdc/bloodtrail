import { instance, named } from "./runtime.mjs";

function address(state, target, value) {
  return named(state, { target, input: { ...state.af, source: state.c("observedSource", { observed: { address: value, port: 443 } }) } });
}

async function hook(state) {
  const calls = [];
  const transform = (input) => state.call("transform.callback", () => {
    calls.push(input);
    return { value: "kfp_synthetic_0001", key_id: "key_synthetic_v1" };
  });
  const target = instance(state, { transformations: [{ path: "actor.id", transform }] });
  await named(state, { target, input: { ...state.af, actor: state.c("authenticatedHumanActor", { id: "usr_synthetic_0001" }) }, facts: () => ({ hook_calls: calls, key_id_present: JSON.stringify(target.sink.events).includes("key_synthetic_v1") }) });
}

export const E_CASES = [
  ["PD-E1", 4, (s, t) => address(s, t, "203.0.113.10")],
  ["PD-E2", 4, (s, t) => address(s, t, "2001:db8::10")],
  ["PD-E3", 5, hook],
  ["PD-E4", 3, (s, t) => named(s, { target: t, input: { ...s.af, event: { ...s.af.event, timestamp: "2001-01-01T00:00:00.000Z", observed_at: "2000-01-01T00:00:00.000Z" } } })],
];
