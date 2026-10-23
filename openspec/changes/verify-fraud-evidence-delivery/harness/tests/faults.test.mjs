import assert from "node:assert/strict";
import { test } from "node:test";
import { faultInjector, validateFaultPlan } from "../lib/faults.mjs";

test("the injector keys decisions by first-seen ordinal and per-occurrence attempt", () => {
  const injector = faultInjector({ default: "acknowledge", rules: [{ occurrence: 1, attempt: 0, action: "status", status: 503 }, { occurrence: 2, attempt: 1, action: "destroy_after_ingest" }] });
  const decisions = ["a", "b", "a", "b", "b"].map((id) => injector.decide(id));
  assert.deepEqual(decisions.map((entry) => [entry.occurrence, entry.attempt, entry.rule.action]), [
    [1, 0, "status"], [2, 0, "acknowledge"], [1, 1, "acknowledge"], [2, 1, "destroy_after_ingest"], [2, 2, "acknowledge"],
  ]);
});

test("identical plans and arrivals give identical decisions", () => {
  const plan = { default: "acknowledge", rules: [{ occurrence: 1, attempt: 0, action: "delay", delay_ms: 10 }] };
  const run = () => ["x", "x", "y"].map((id) => faultInjector(plan).decide(id).rule.action);
  assert.deepEqual(run(), run());
});

test("invalid plans are refused", () => {
  const rows = [
    { default: "status", rules: [] },
    { default: "acknowledge", rules: [{ occurrence: 0, attempt: 0, action: "acknowledge" }] },
    { default: "acknowledge", rules: [{ occurrence: 1, attempt: -1, action: "acknowledge" }] },
    { default: "acknowledge", rules: [{ occurrence: 1, attempt: 0, action: "random" }] },
    { default: "acknowledge", rules: [{ occurrence: 1, attempt: 0, action: "status", status: 200 }] },
    { default: "acknowledge", rules: [{ occurrence: 1, attempt: 0, action: "delay" }] },
    { default: "acknowledge", rules: [{ occurrence: 1, attempt: 0, action: "acknowledge" }, { occurrence: 1, attempt: 0, action: "acknowledge" }] },
  ];
  for (const plan of rows) assert.throws(() => validateFaultPlan(plan), undefined, JSON.stringify(plan));
});
