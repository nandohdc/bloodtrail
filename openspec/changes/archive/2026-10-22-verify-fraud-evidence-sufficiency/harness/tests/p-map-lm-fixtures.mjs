import assert from "node:assert/strict";
import { runtimeFixture, ACCEPTED } from "./p-map-runtime-fixtures.mjs";
import { contextDouble, operationDouble } from "./p-map-lm-double-context.mjs";
import { eventDouble } from "./p-map-lm-double-events.mjs";

const refusal = (code, category, path) => ({ ok: false, error: { code, category, path } });
const NO_HANDLE = refusal("PREMATURE_SUCCESS", "validation", "/operation/state");
// Independent scripts: #797 in events.ts:217-225; duplicate in sdk.ts:251-268;
// tenant scope in semantic.ts:391-399; M4 commit in semantic.ts:227-247.
const SCRIPTS = {
  L1: ["logout", refusal("SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state"), "logout"],
  L2: [NO_HANDLE],
  L3: [refusal("TENANT_RESOURCE_CONFLICT", "validation", "/tenant/scope"), "logout", "login", "created"],
  L4: ["logout"], L5a: [NO_HANDLE],
  L5b: [refusal("PREMATURE_SUCCESS", "validation", "/event/commit_state")], L5c: ["denial"],
  M1: ["mfa", "mfa"], M2: ["mfa"], M3: ["mfa"],
  M4: [refusal("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/commit_state"), "mfa"],
};
const BRANDED = ["actor", "tenant", "subject", "session", "authentication", "authorization", "credential", "resource", "source", "authenticated_principal"];
const METHODS = ["sessionRevoked", "authenticationFailed", "authenticationSucceeded", "sessionCreated"];

function assertContexts(identities, input) {
  for (const key of BRANDED) {
    if (input[key] !== undefined) assert(identities.has(input[key]), `${key} must retain constructor identity`);
  }
}

function scriptedFactory(context, config) {
  const sdk = { beginOperation(input = {}) {
    context.ordinal += 1;
    return { ok: true, value: operationDouble({ ordinal: context.ordinal, ...input }) };
  } };
  for (const method of METHODS) sdk[method] = (input) => scriptedCall(context, { config, method, input });
  return sdk;
}

async function scriptedCall(context, { config, method, input }) {
  const owner = context.state.current;
  assertContexts(context.identities, input);
  context.inputs.push({ case_id: owner, method, input });
  const index = context.offsets.get(owner) ?? 0;
  context.offsets.set(owner, index + 1);
  const script = SCRIPTS[owner][index];
  assert.notEqual(script, undefined, `unscripted ${owner} call ${index}`);
  if (typeof script !== "string") return script;
  context.ordinal += 1;
  const capture = eventDouble({ kind: script, input, ordinal: context.ordinal });
  assert.equal(method, capture.method);
  await config.sink.emit(capture.event);
  return ACCEPTED;
}

export function lmFixture({ budget = 1000, identityOffset = 0 } = {}) {
  const { core, identities } = contextDouble();
  const context = { identities, ordinal: identityOffset, inputs: [], offsets: new Map() };
  const fixture = runtimeFixture({ budget, core, factory: (config) => scriptedFactory(context, config) });
  context.state = fixture.state;
  return { ...fixture, inputs: context.inputs };
}
