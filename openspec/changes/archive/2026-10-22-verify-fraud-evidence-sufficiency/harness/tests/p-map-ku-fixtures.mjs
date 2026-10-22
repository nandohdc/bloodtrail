import assert from "node:assert/strict";
import { runtimeFixture, ACCEPTED } from "./p-map-runtime-fixtures.mjs";
import { lockContextDouble, lockHandleDouble } from "./p-map-ku-double-context.mjs";
import { lockEventDouble } from "./p-map-ku-double-events.mjs";

const TENANT = { ok: false, error: { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/scope" } };
const INVALID = { ok: false, error: { code: "SDK_INVALID_OPERATION_TRANSITION", category: "lifecycle", path: "/operation" } };
// Scripts independently re-derived from semantic.ts:58,66,227-247,391-399,
// operations.ts:121-128, sdk.ts:213-223. Not selected by validating input.
const SCRIPTS = {
  K1: ["attempt"], K2a: ["lock", TENANT], K2b: ["lock", TENANT], K3: ["configuration", "configuration"],
  K4: ["denial", TENANT], U1: ["unlock", "unlock", TENANT], U2: ["compensation", INVALID, INVALID],
};
const BRANDED = ["actor", "tenant", "subject", "authentication", "authorization", "credential", "resource", "source"];
const METHODS = ["authenticationFailed", "sensitiveResourceModified", "securityConfigurationChanged", "authorizationDenied"];

function assertContexts(context, input) {
  for (const field of BRANDED) {
    if (input[field] !== undefined) assert(context.identities.has(input[field]), `${field} must retain constructor identity`);
  }
}

async function scriptedCall(context, { config, sdk, method, input }) {
  const owner = context.state.current;
  assertContexts(context, input);
  context.inputs.push({ case_id: owner, sdk, method, input });
  const index = context.offsets.get(owner) ?? 0;
  context.offsets.set(owner, index + 1);
  const script = SCRIPTS[owner][index];
  assert.notEqual(script, undefined, `unscripted ${owner} call ${index}`);
  if (typeof script !== "string") return script;
  context.ordinal += 1;
  const capture = lockEventDouble({ kind: script, input, ordinal: context.ordinal });
  assert.equal(method, capture.method);
  await config.sink.emit(capture.event);
  return ACCEPTED;
}

function scriptedFactory(context, config) {
  const sdk = { beginOperation(input = {}) {
    context.ordinal += 1;
    return { ok: true, value: lockHandleDouble({ ordinal: context.ordinal, ...input }) };
  } };
  for (const method of METHODS) sdk[method] = (input) => scriptedCall(context, { config, sdk, method, input });
  return sdk;
}

export function kuFixture({ budget = 1000, identityOffset = 0 } = {}) {
  const { core, identities } = lockContextDouble();
  const context = { identities, ordinal: identityOffset, inputs: [], offsets: new Map() };
  const fixture = runtimeFixture({ budget, core, factory: (config) => scriptedFactory(context, config) });
  context.state = fixture.state;
  return { ...fixture, inputs: context.inputs };
}
