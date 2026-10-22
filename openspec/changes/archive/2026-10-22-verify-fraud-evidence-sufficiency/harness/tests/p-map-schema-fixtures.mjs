import assert from "node:assert/strict";
import { measure } from "../p-map/workload.mjs";
import { processFixture } from "./p-map-process-fixtures.mjs";
import { EMISSION_ORACLE } from "./p-map-evaluation-fixtures.mjs";
import { CONSTRUCTOR_PROPERTIES } from "./p-map-schema-rules.mjs";

const EMISSIONS = ["B-LOGOUT/emit", "B-MFA/emit", ...EMISSION_ORACLE.map((row) => row.step_id)];

function nextEmission(context) {
  const owner = context.state.current;
  const index = context.offsets.get(owner) ?? 0;
  context.offsets.set(owner, index + 1);
  const id = EMISSIONS.filter((step) => step.startsWith(`${owner}/`))[index];
  assert(id, `unplanned named input for ${owner}`);
  return id;
}

function collectNamed(context, input) {
  const step_id = nextEmission(context);
  for (const sample of context.pending.splice(0)) context.samples.push({ ...sample, step_id });
  for (const [property, value] of Object.entries(input)) {
    if (property === "operation") continue; // SDK-issued handle, not canonical input data.
    context.samples.push({ step_id, property, value: structuredClone(value), constructor: "named" });
  }
  context.emissions.push(step_id);
}

export async function schemaInputFixture() {
  const { state } = processFixture();
  const context = { state, pending: [], samples: [], offsets: new Map(), emissions: [] };
  const construct = state.c;
  const method = state.method;
  state.c = (name, ...args) => {
    assert(Object.hasOwn(CONSTRUCTOR_PROPERTIES, name), `unmapped constructor ${name}`);
    context.pending.push({ constructor: name, property: CONSTRUCTOR_PROPERTIES[name], value: structuredClone(args[0]) });
    return construct(name, ...args);
  };
  state.method = (owner, name, ...args) => {
    if (args[0]?.actor !== undefined) collectNamed(context, args[0]);
    return method(owner, name, ...args);
  };
  const observed = await measure({ state });
  assert.deepEqual(observed.invalidations, []);
  assert.deepEqual(observed.case_aborts, []);
  assert.deepEqual(context.emissions, EMISSIONS);
  assert.deepEqual(context.pending, []);
  return context;
}
