import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecord } from "../p-attr/observations.mjs";
import { publishedPolicies, withPolicies } from "../p-attr/policy.mjs";
import { capture, observation, withTarget } from "./p-attr-analysis-fixtures.mjs";

// field-policy.json:313-321: actor.id has a local trust/authority policy.
// Removing that fixture entry must report a local policy gap, not TypeError.
test("missing actor policy retains affected and unrelated analyses", () => {
  const policies = new Map(publishedPolicies());
  policies.delete("actor.id");
  const actor = withTarget({ id: "AF-C1", path: "actor.id" });
  const baseline = observation({ id: "AF-B", event: capture("AF") });
  const records = [actor, baseline];
  const expected = analyzeRecord({ record: baseline, records });
  const results = withPolicies(policies, () => records.map((record) => analyzeRecord({ record, records })));
  assert(results[0].issues.includes("actor.id: missing local field policy"));
  assert.notEqual(results[0].axes, null);
  assert.deepEqual(results[1], expected);
  assert.deepEqual(results[1].issues, []);
});

test("actor policy restoration removes only the local gap diagnostic", () => {
  const record = withTarget({ id: "AF-C1", path: "actor.id" });
  const result = analyzeRecord({ record, records: [record] });
  assert.deepEqual(result.issues, []);
  assert.equal(result.axes.in_occurrence_flag, true);
});
