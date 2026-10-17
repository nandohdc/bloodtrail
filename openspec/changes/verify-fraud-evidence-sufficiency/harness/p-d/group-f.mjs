import { marker } from "./markers.mjs";
import { step } from "./runtime.mjs";

const NON_OBJECTS = [["string", "not-an-event"], ["null", null], ["array", []]];
const PRECHECKS = [["version", "schema", "version", "9.9.9"], ["outcome", "event", "outcome", "success"], ["category", "event", "category", "session"]];
const COMPLETE = [
  ["emit", (s, t, e) => s.method(t.sdk, "emit", e)],
  ["redeliver", (s, t, e) => s.method(t.sdk, "redeliver", e)],
  ["named", (s, t, e) => s.method(t.sdk, "authenticationFailed", { redelivery: { event: e } })],
];

function validate(state, { target, id = "main", value, facts }) {
  return step(state, id, target, () => state.c("validateSecurityAuditEvent", value), facts);
}

function mutate(state, fn) {
  const event = structuredClone(state.capture);
  fn(event);
  return event;
}

async function nonObjects(state, target) {
  for (const [id, value] of NON_OBJECTS) await validate(state, { target, id, value });
}

async function nonPlain(state, target) {
  await validate(state, { target, id: "map", value: new Map() });
  let getters = 0;
  const value = Object.defineProperty({}, "value", { enumerable: true, get() { getters += 1; return "x"; } });
  await validate(state, { target, id: "accessor", value, facts: () => ({ getters }) });
}

async function extraKeys(state, target) {
  for (const [id, key] of [["prohibited", marker("keyHash")], ["benign", "extra_field"]]) {
    await validate(state, { target, id, value: mutate(state, (event) => { event[key] = "x"; }) });
  }
}

async function complete(state, target) {
  const event = mutate(state, (value) => { value.actor = { type: "administrator", id: "adm_synthetic_0001", provenance: { trust_level: "authoritative_server", source: "hand-written" } }; });
  await validate(state, { target, id: "validate", value: event, facts: () => ({ input_frozen: Object.isFrozen(event) }) });
  for (const [id, invoke] of COMPLETE) await step(state, id, target, () => invoke(state, target, event));
}

async function prechecks(state, target) {
  for (const [id, parent, key, value] of PRECHECKS) await validate(state, { target, id, value: mutate(state, (event) => { event[parent][key] = value; }) });
}

export const F_CASES = [
  ["PD-F1", 3, (s, t) => validate(s, { target: t, value: {} })],
  ["PD-F2", 3, (s, t) => validate(s, { target: t, value: mutate(s, (e) => { delete e.tenant; }) })],
  ["PD-F3", 3, (s, t) => validate(s, { target: t, value: mutate(s, (e) => { delete e.actor; }) })],
  ["PD-F4", 5, nonObjects], ["PD-F5", 3, (s, t) => validate(s, { target: t, value: undefined })], ["PD-F6", 4, nonPlain],
  ["PD-F7", 3, (s, t) => { const value = {}; value.self = value; return validate(s, { target: t, value }); }],
  ["PD-F8", 3, (s, t) => validate(s, { target: t, value: mutate(s, (e) => { e.event.name = "bloodtrail.audit.synthetic.unknown"; }) })],
  ["PD-F9", 4, extraKeys], ["PD-F10", 6, complete], ["PD-F11", 5, prechecks],
];
