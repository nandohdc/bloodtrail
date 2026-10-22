import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inspectValue } from "./p-map-schema-rules.mjs";
import { schemaInputFixture } from "./p-map-schema-fixtures.mjs";

// Data only: never import an SDK, a generated validator, or installed kit code.
const SCHEMA = JSON.parse(readFileSync(new URL("../../../../../contracts/security-audit/schema/security-audit-event.schema.json", import.meta.url), "utf8"));
const EXEMPTIONS = {
  "C2a/bytes-8193": ["/resource/change_categories/0"], // intentional byte scan refusal; no schema item maxLength
  "C2b/items-17": ["/resource/change_categories"], // intentional schema maxItems refusal; still check every item
};
const fixture = await schemaInputFixture();

function inspectSample(sample, schema = SCHEMA) {
  const context = { schema, paths: new Set(), leaves: 0, skipped: new Set(), violations: [],
    exemptions: EXEMPTIONS[sample.step_id] ?? [] };
  inspectValue(context, { value: sample.value, path: `/${sample.property}`, node: schema.properties[sample.property] });
  return context;
}

test("schema-derived guard covers every P-map constructor/named input, case, variant and both controls", (t) => {
  const paths = new Set();
  const constructors = new Set();
  const exemptions = new Set();
  let leaves = 0;
  for (const sample of fixture.samples) {
    const result = inspectSample(sample);
    assert.deepEqual(result.violations, [], `${sample.step_id} ${sample.constructor}`);
    result.paths.forEach((path) => paths.add(path));
    result.skipped.forEach((path) => exemptions.add(`${sample.step_id}:${path}`));
    if (sample.constructor !== "named") constructors.add(sample.constructor);
    leaves += result.leaves;
  }
  assert.deepEqual([...exemptions].sort(), Object.entries(EXEMPTIONS).flatMap(([step, fields]) => fields.map((path) => `${step}:${path}`)).sort());
  assert.equal(fixture.emissions.length, 61);
  assert.deepEqual([constructors.size, paths.size, leaves, fixture.samples.length], [15, 62, 2291, 756]);
  t.diagnostic(`schema coverage: ${constructors.size} constructors, ${paths.size} canonical scalar paths, ${leaves} scalar leaves, ${fixture.samples.length} inputs, 61 emissions; exemptions ${[...exemptions].join(", ")}`);
});

test("schema guard negative control reports copied policy_version=1 at /authorization/policy_version", () => {
  const sample = structuredClone(fixture.samples.find((entry) => entry.constructor === "authorizationEvidence" && entry.value.policy_version !== undefined));
  sample.value.policy_version = "1";
  assert.deepEqual(inspectSample(sample).violations, [{ path: "/authorization/policy_version", rule: "pattern" }]);
});

const CONSTRAINTS = [
  ["enum", { enum: ["allow"] }, "deny"], ["const", { const: "allow" }, "deny"],
  ["minLength", { minLength: 2 }, "a"], ["maxLength", { maxLength: 1 }, "aa"],
  ["pattern", { pattern: "^[a-z]+$" }, "1"],
];
for (const [rule, definition, value] of CONSTRAINTS) test(`offline leaf guard resolves local refs and checks ${rule}`, () => {
  const schema = { $defs: { leaf: definition }, properties: { authorization: { properties: { decision: { $ref: "#/$defs/leaf" } } } } };
  const sample = { property: "authorization", value: { decision: value } };
  assert.deepEqual(inspectSample(sample, schema).violations, [{ path: "/authorization/decision", rule }]);
});
