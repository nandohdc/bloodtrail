import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const BYTES = readFileSync(new URL("../expectations/p-map.v1.json", import.meta.url));
const PLAN = JSON.parse(BYTES);
const REMOVED = {
  "K2a/policy": ["join.complete", "join.failure_target_absent", "join.lock_account_resolved", "join.shared_request_id", "join.shared_correlation_id", "join.distinct_event_ids", "join.reattribution_possible"],
  "L3/tenantless": ["handle_state_unchanged"],
  "U2/same-instance": ["compensation.original_still_committed", "handle.state"],
  "M4/nontransactional": ["handle.state"],
  "C5/enrolled": ["replacement.removed_resource_type", "replacement.removed_credential_type"],
  "R1/unlinked": ["causality.complete"],
  "R2/pair-completed": ["causality.original_is_password_request", "causality.original_is_login"],
  "R3/completed": ["causality.original_is_password_request", "causality.original_is_login"],
};

test("reviewed v1 content hash, counts and sole pre-run revision are pinned", () => {
  assert.equal(createHash("sha256").update(BYTES).digest("hex"), "a63e26fb8f30b1cf4ed3419affee0564152f149d485529254470703e44caca27");
  assert.equal(PLAN.revisions.length, 1);
  const revision = PLAN.revisions[0];
  assert.equal(revision.source, "orchestrator review of edfe063");
  const inventory = Object.fromEntries(revision.changes.map((change) => [change.step_id, change.removed ?? change.moved]));
  assert.deepEqual(inventory, REMOVED);
  const steps = PLAN.cases.flatMap((entry) => Array.isArray(entry.expected) ? entry.expected : []);
  assert.deepEqual([steps.length, steps.reduce((sum, step) => sum + step.assertions.length, 0)], [134, 749]);
});

for (const [id, paths] of Object.entries(REMOVED)) test(`reviewed ${id} has no tautological or cross-case frozen assertion`, () => {
  const entry = PLAN.cases.find((row) => row.case_id === id.split("/")[0]);
  const step = entry.expected.find((row) => row.step_id === id);
  for (const path of paths) assert(!step.assertions.some((rule) => rule.path === path), path);
});
