import assert from "node:assert/strict";
import test from "node:test";
import { logoutWorkload } from "../p-map/logout-workload.mjs";
import { LOGOUT_CASES } from "../p-map/logout-cases.mjs";
import { named } from "../p-map/runtime.mjs";
import { beginOperation, markOperation } from "../p-map/workload-steps.mjs";
import { lmFixture } from "./p-map-lm-fixtures.mjs";

function throwingMethod(state, name) {
  const method = state.method;
  state.method = (owner, called, ...args) => {
    if (called === name) throw new Error(`fixture ${name} threw`);
    return method(owner, called, ...args);
  };
}

test("throwing tenantless-login builder aborts L3 naming missing control, without inventing a public session throw", async () => {
  const { state } = lmFixture();
  const construct = state.c;
  state.c = (name, ...args) => {
    if (name === "authenticatedPrincipal") throw new Error("fixture login builder threw");
    return construct(name, ...args);
  };
  await logoutWorkload(state, [LOGOUT_CASES.find((entry) => entry.case_id === "L3")]);
  const abort = state.records.find((entry) => entry.variant === "case_aborted");
  assert.match(abort.message, /missing L3 tenantless-login control dependency/);
  assert(!state.records.some((entry) => entry.step_id === "L3/tenantless-session"));
  assert(!state.records.some((entry) => entry.step_id === "L3/tenantless-login"));
});

const PREREQUISITES = [
  ["beginOperation", "not-applicable-begin", /beginOperation prerequisite refused/],
  ["markCommitted", "not-applicable-mark", /operation transition prerequisite refused/],
];
for (const [method, step, message] of PREREQUISITES) test(`throwing ${method} retains the public throw and intended prerequisite message`, async () => {
  const { state } = lmFixture();
  throwingMethod(state, method);
  await logoutWorkload(state, [LOGOUT_CASES[0]]);
  assert.equal(state.records.find((entry) => entry.step_id === `L1/${step}`).kind, "thrown");
  assert.match(state.records.find((entry) => entry.variant === "case_aborted").message, message);
  assert(!state.records.some((entry) => entry.step_id === "L1/not-applicable"));
});

const MISSING = [
  ["named target", (state) => named(state, { method: "sessionRevoked", input: {} })],
  ["begin target", (state) => beginOperation(state, { id: "begin" })],
  ["mark handle", (state) => markOperation(state, { target: {}, id: "mark", method: "markCommitted" })],
];
for (const [label, invoke] of MISSING) test(`missing ${label} is a harness fault before entering a public step`, async () => {
  const { state } = lmFixture();
  await assert.rejects(async () => invoke(state), /missing .* dependency/);
  assert.deepEqual(state.records, []);
});
