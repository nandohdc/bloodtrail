import { familyWorkload } from "./family-workload.mjs";
import { LOGOUT_CASES } from "./logout-cases.mjs";
import { logoutInput, tenantlessLoginInput } from "./lm-inputs.mjs";
import { logoutFacts } from "./lm-facts.mjs";
import { instance, requireDependency } from "./runtime.mjs";
import { beginOperation, emitOccurrence, markOperation } from "./workload-steps.mjs";

async function revoke(state, { input, ...options }) {
  const record = await emitOccurrence(state, { method: "sessionRevoked", input, ...options });
  logoutFacts(record);
  return record;
}

async function committedLogout(state, { id, actor = "human", decision = "not_applicable" }) {
  const target = instance(state);
  const input = logoutInput(state, { actor, decision });
  const handle = await beginOperation(state, { target, id: `${id}-begin` });
  await markOperation(state, { target, handle, id: `${id}-mark`, method: "markCommitted" });
  await revoke(state, { target, handle, id, input: { ...input, operation: handle } });
  return { target, input, handle };
}

async function userLogout(state, variant) {
  const { target, input, handle } = await variant("not-applicable", () => committedLogout(state, { id: "not-applicable" }));
  await variant("duplicate-success", () => revoke(state, { target, handle, input: { ...input, operation: handle },
    id: "duplicate-success", refusalExpected: true }));
  await variant("allow", () => committedLogout(state, { id: "allow", decision: "allow" }));
}

async function tenantlessRefusal(state) {
  const target = instance(state);
  const input = logoutInput(state, { tenantless: true });
  const handle = await beginOperation(state, { target, id: "begin" });
  await markOperation(state, { target, handle, id: "mark", method: "markCommitted" });
  await revoke(state, { target, handle, id: "tenantless", refusalExpected: true,
    input: { ...input, operation: handle } });
  return { target, handle };
}

async function tenantlessLogout(state, variant) {
  const { target, handle } = await variant("tenantless", () => tenantlessRefusal(state));
  await variant("usable-handle", () => revoke(state, { target, handle, id: "usable-handle",
    input: { ...logoutInput(state), operation: handle } }));
  await tenantlessControls(state, variant);
}

async function tenantlessControls(state, variant) {
  let control;
  try {
    await variant("tenantless-login", async () => {
      const target = instance(state);
      const input = tenantlessLoginInput(state);
      control = { target, input };
      await emitOccurrence(state, { target, input, id: "tenantless-login", method: "authenticationSucceeded" });
    });
  } finally { requireDependency(control, "L3 tenantless-login control"); }
  await variant("tenantless-session", () => emitOccurrence(state,
    { ...control, id: "tenantless-session", method: "sessionCreated" }));
}

async function noHandle(state, { id, options = {}, event }) {
  const target = instance(state);
  const input = logoutInput(state, options);
  if (event !== undefined) input.event = event;
  await revoke(state, { target, input, id, refusalExpected: true });
}

async function honestDenial(state) {
  const target = instance(state);
  const input = logoutInput(state, { actor: "admin", decision: "deny" });
  const handle = await beginOperation(state, { target, id: "begin" });
  await markOperation(state, { target, handle, id: "mark", method: "markNotCommitted" });
  await revoke(state, { target, handle, id: "denied-not-committed",
    input: { ...input, operation: handle, event: { outcome: "denied" } } });
}

const DENIAL = { actor: "admin", decision: "deny" };
const RUNNERS = {
  L1: userLogout,
  L2: (state) => noHandle(state, { id: "no-handle" }),
  L3: tenantlessLogout,
  L4: (state) => committedLogout(state, { id: "anonymous", actor: "anonymous" }),
  L5a: (state) => noHandle(state, { id: "denied-no-handle", options: DENIAL, event: { outcome: "denied" } }),
  L5b: (state) => noHandle(state, { id: "direct-not-committed", options: DENIAL,
    event: { outcome: "denied", commit_state: "not_committed" } }),
  L5c: honestDenial,
};

export async function logoutWorkload(state, cases = LOGOUT_CASES) {
  await familyWorkload(state, { cases, runners: RUNNERS });
}
