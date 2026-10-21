import assert from "node:assert/strict";
import { runtimeFixture, ACCEPTED } from "./p-map-runtime-fixtures.mjs";
import { lockContextDouble } from "./p-map-ku-double-context.mjs";
import { operationDouble } from "./p-map-lm-double-context.mjs";
import { rotationEventDouble } from "./p-map-r-double-events.mjs";

// Scripted boundaries from semantic.ts:249-277,344-369,391-399 and
// events.ts:190-225,238-272, NOT a second implementation of validation.
const CAUSALITY = { ok: false, error: { code: "BAD_CAUSALITY", category: "validation", path: "/correlation" } };
const TENANT = { ok: false, error: { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/scope" } };
const ACTOR = { ok: false, error: { code: "MISSING_REQUIRED_ACTOR", category: "validation", path: "/actor/type" } };
const SCRIPTS = { R1: [CAUSALITY], R2: ["request", "completion", "request", TENANT],
  R3: ["login", "completion"], R4: ["rotation", "rotation", TENANT], R5a: [ACTOR], R5b: ["role"],
  C1: ["rotation", "rotation"] };
const METHODS = ["passwordResetRequested", "passwordResetCompleted", "authenticationSucceeded", "sensitiveResourceModified", "roleAssigned"];
const BRANDED = ["actor", "subject", "tenant", "authentication", "session", "resource", "source", "credential", "authorization", "authenticated_principal"];
const FAULTS = {
  throw: () => { throw new Error("fixture-precursor-throw"); },
  refuse: () => ({ ok: false, error: { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/source" } }),
  "no-capture": () => ACCEPTED,
};

async function scriptedCall(context, { sdk, config, method, input }) {
  const owner = context.state.current;
  for (const field of BRANDED) if (input[field] !== undefined) assert(context.identities.has(input[field]), field);
  const index = context.offsets.get(owner) ?? 0;
  context.offsets.set(owner, index + 1);
  context.inputs.push({ case_id: owner, sdk, method, input });
  const script = SCRIPTS[owner][index];
  assert.notEqual(script, undefined, `unscripted ${owner} ${index}`);
  if (context.fault?.case_id === owner && context.fault.index === index) return FAULTS[context.fault.kind]();
  if (typeof script !== "string") return script;
  context.ordinal += 1;
  const capture = rotationEventDouble({ kind: script, input, ordinal: context.ordinal });
  assert.equal(method, capture.method);
  await config.sink.emit(capture.event);
  return ACCEPTED;
}

function scriptedFactory(context, config) {
  const sdk = { beginOperation() {
    context.ordinal += 1;
    return { ok: true, value: operationDouble({ ordinal: context.ordinal }) };
  } };
  for (const method of METHODS) sdk[method] = (input) => scriptedCall(context, { sdk, config, method, input });
  return sdk;
}

export function rotationFixture({ budget = 1000, identityOffset = 0, fault } = {}) {
  const { core, identities } = lockContextDouble();
  const context = { identities, ordinal: identityOffset, offsets: new Map(), inputs: [], fault };
  const fixture = runtimeFixture({ budget, core, factory: (config) => scriptedFactory(context, config) });
  context.state = fixture.state;
  return { ...fixture, inputs: context.inputs };
}
