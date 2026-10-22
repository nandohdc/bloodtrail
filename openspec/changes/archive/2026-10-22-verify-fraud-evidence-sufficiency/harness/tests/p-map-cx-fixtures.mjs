import assert from "node:assert/strict";
import { runtimeFixture, ACCEPTED } from "./p-map-runtime-fixtures.mjs";
import { contextDouble, operationDouble } from "./p-map-lm-double-context.mjs";
import { contactEventDouble } from "./p-map-cx-double-events.mjs";

const refusal = (code, category, path) => ({ ok: false, error: { code, category, path } });
// Independent scripts, never an input-driven validator. Sources at 8e6cdf7:
// prohibited.ts:10,48; schema.ts:9-17,123-127; semantic.ts:66,391-399;
// context.ts:388-392 and duplicate-copy-probe.ts:100-102 (one core only).
const SCRIPTS = {
  C1: ["contact", "contact"],
  C2a: ["contact", "contact", "contact", "contact", refusal("FIELD_LIMIT_EXCEEDED", "validation", "/resource/change_categories/0")],
  C2b: [refusal("FIELD_LIMIT_EXCEEDED", "validation", "/resource/change_categories")],
  C3: ["contact"], C4: ["configuration"], C5: ["removed", "enrolled"],
  C6: [refusal("TENANT_RESOURCE_CONFLICT", "validation", "/tenant/scope")],
  X1: [refusal("AUTHORITY_ESCALATION", "authority", "/resource")],
};
const BRANDED = ["actor", "tenant", "subject", "authentication", "authorization", "credential", "resource", "source"];
const METHODS = ["sensitiveResourceModified", "securityConfigurationChanged", "mfaRemoved", "mfaEnrolled"];

function assertContexts(context, input) {
  for (const field of BRANDED) {
    if (input[field] === undefined) continue;
    const expected = !(context.state.current === "X1" && field === "resource");
    assert.equal(context.identities.has(input[field]), expected, `${field} constructor identity`);
  }
}

async function scriptedCall(context, { config, method, input }) {
  const owner = context.state.current;
  assertContexts(context, input);
  context.inputs.push({ case_id: owner, method, input });
  const index = context.offsets.get(owner) ?? 0;
  context.offsets.set(owner, index + 1);
  const script = SCRIPTS[owner][index];
  assert.notEqual(script, undefined, `unscripted ${owner} call ${index}`);
  if (typeof script !== "string") return script;
  context.ordinal += 1;
  const capture = contactEventDouble({ kind: script, input, ordinal: context.ordinal });
  assert.equal(method, capture.method);
  await config.sink.emit(capture.event);
  return ACCEPTED;
}

function scriptedFactory(context, config) {
  const sdk = { beginOperation() {
    context.ordinal += 1;
    return { ok: true, value: operationDouble({ ordinal: context.ordinal }) };
  } };
  for (const method of METHODS) sdk[method] = (input) => scriptedCall(context, { config, method, input });
  return sdk;
}

export function cxFixture({ budget = 1000, identityOffset = 0 } = {}) {
  const { core, identities } = contextDouble();
  const context = { identities, ordinal: identityOffset, inputs: [], offsets: new Map() };
  const fixture = runtimeFixture({ budget, core, factory: (config) => scriptedFactory(context, config) });
  context.state = fixture.state;
  return { ...fixture, inputs: context.inputs, identities };
}
