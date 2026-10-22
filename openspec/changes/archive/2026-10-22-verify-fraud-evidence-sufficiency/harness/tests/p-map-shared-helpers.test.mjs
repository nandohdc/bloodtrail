import assert from "node:assert/strict";
import test from "node:test";
import { handleFacts } from "../p-map/snapshot.mjs";
import { captured, caseIdOf, fieldOf, ownsRecord } from "../p-map/evidence.mjs";
import { handleFacts as sharedHandleFacts } from "../p-e/case-steps.mjs";
import { ownsRecord as sharedOwnsRecord } from "../p-e/evaluation-row.mjs";

test("P-map reuses P-E exports directly, without copies or wrappers", () => {
  assert.equal(handleFacts, sharedHandleFacts);
  assert.equal(ownsRecord, sharedOwnsRecord);
});

const ROUTING_VALUES = [null, undefined, false, true, 0, 1, "fixture", {}, []];
for (const [index, value] of ROUTING_VALUES.entries()) test(`P-map routing reader ignores missing fields (${index})`, () => {
  assert.equal(caseIdOf(value), undefined);
  assert.equal(fieldOf(value, "cases"), undefined);
  assert.equal(fieldOf(value, "dependencies"), undefined);
});

for (const value of [{}, []]) test(`P-map routing reader preserves fields on ${Array.isArray(value) ? "arrays" : "objects"}`, () => {
  const fields = { case_id: "fixture", cases: [null], dependencies: null };
  Object.assign(value, fields);
  assert.equal(caseIdOf(value), fields.case_id);
  for (const [field, expected] of Object.entries(fields)) assert.strictEqual(fieldOf(value, field), expected);
});

test("one capture helper guards absent, empty and ambiguous records", () => {
  assert.equal(captured(undefined), undefined);
  assert.equal(captured({ captures: [] }), undefined);
  assert.equal(captured({ captures: [{}, {}] }), undefined);
  const event = { event: { name: "fixture" } };
  assert.equal(captured({ captures: [{ event }] }), event);
});
