import assert from "node:assert/strict";
import test from "node:test";
import { handleFacts } from "../p-map/snapshot.mjs";
import { captured, ownsRecord } from "../p-map/evidence.mjs";
import { handleFacts as sharedHandleFacts } from "../p-e/case-steps.mjs";
import { ownsRecord as sharedOwnsRecord } from "../p-e/evaluation-row.mjs";

test("P-map reuses P-E exports directly, without copies or wrappers", () => {
  assert.equal(handleFacts, sharedHandleFacts);
  assert.equal(ownsRecord, sharedOwnsRecord);
});

test("one capture helper guards absent, empty and ambiguous records", () => {
  assert.equal(captured(undefined), undefined);
  assert.equal(captured({ captures: [] }), undefined);
  assert.equal(captured({ captures: [{}, {}] }), undefined);
  const event = { event: { name: "fixture" } };
  assert.equal(captured({ captures: [{ event }] }), event);
});
