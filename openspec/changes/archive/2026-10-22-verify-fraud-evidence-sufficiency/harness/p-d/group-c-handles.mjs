import { commit, instance, jsonClone, named, operation, step } from "./runtime.mjs";

const FORGED = { operation_id: "op_synthetic_0001", transaction_id: "txn_synthetic_0001", correlation_id: "cor_synthetic_0002", state: "committed", commit_state: "committed", transactional: true };
const FORMS = [
  ["plain", () => FORGED], ["snapshot", (s, h) => s.method(h, "snapshot")], ["spread", (s, h) => ({ ...h })],
  ["structured", (s, h) => structuredClone(h)], ["json", (s, h) => jsonClone(s.method(h, "snapshot"))],
  ["inherited", (s, h) => Object.create(h)], ["null", () => null], ["string", () => "op_synthetic_0001"],
];
const RECEIVERS = [
  ["plain-transition", (s, p) => s.call("markCommitted.call", () => p.markCommitted.call({}))],
  ["foreign-transition", (s, p, h) => s.call("markCommitted.call", () => p.markCommitted.call(h))],
  ["getter", (s, p) => s.call("state.get.call", () => Object.getOwnPropertyDescriptor(p, "state").get.call({}))],
  ["snapshot", (s, p) => s.call("snapshot.call", () => p.snapshot.call({}))],
  ["inherited-getter", (s, p, h, original) => s.call("state.get.inherited", () => Object.create(original).state)],
];

async function forged(state, target) {
  const h = operation(state, target);
  commit(state, h);
  for (const [id, make] of FORMS) {
    const value = make(state, h);
    await named(state, { id, target, method: "mfaRemoved", input: { ...state.mr, operation: value } });
  }
}

async function foreign(state, target) {
  const other = instance(state);
  const h = operation(state, other);
  commit(state, h);
  for (const [id, owner] of [["foreign", target], ["control", other]]) {
    await named(state, { id, target: owner, method: "mfaRemoved", input: { ...state.mr, operation: h } });
  }
}

async function receivers(state, target) {
  const other = instance(state);
  const h = operation(state, target);
  const foreign = operation(state, other);
  const prototype = Object.getPrototypeOf(h);
  for (const [id, invoke] of RECEIVERS) await step(state, id, target, () => invoke(state, prototype, foreign, h));
}

async function bound(state, target) {
  const h = operation(state, target, { boundEvent: "mfaEnrolled" });
  commit(state, h);
  await named(state, { id: "mismatch", target, method: "mfaRemoved", input: { ...state.mr, operation: h } });
  await step(state, "unknown", target, () => state.method(target.sdk, "beginOperation", { boundEvent: "notACatalogMethod" }));
}

export const C_HANDLE_CASES = [["PD-C6", 14, forged], ["PD-C7", 8, foreign], ["PD-C11", 11, receivers], ["PD-C14", 6, bound]];
