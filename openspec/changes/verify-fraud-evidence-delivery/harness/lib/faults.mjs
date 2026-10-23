// Deterministic fault injection for the harness ingress.
//
// A fault plan is frozen in a probe's expectations file. The ingress decides each request by two keys it
// observes itself: the occurrence's first-seen ordinal (1-based, in arrival order of distinct event ids)
// and the delivery attempt for that occurrence (0-based, counted at the ingress). The plan never reads a
// random source and holds no acceptance logic: "acknowledge" hands the body to the kit's collector.
import assert from "node:assert/strict";

export const FAULT_ACTIONS = Object.freeze(["acknowledge", "status", "delay", "destroy_before_ingest", "destroy_after_ingest"]);

function validRule(rule) {
  assert(Number.isSafeInteger(rule.occurrence) && rule.occurrence >= 1, "fault rule occurrence must be a 1-based ordinal");
  assert(Number.isSafeInteger(rule.attempt) && rule.attempt >= 0, "fault rule attempt must be a 0-based ordinal");
  assert(FAULT_ACTIONS.includes(rule.action), `unknown fault action: ${rule.action}`);
  if (rule.action === "status") assert(Number.isSafeInteger(rule.status) && rule.status >= 400 && rule.status <= 599, "status fault needs an HTTP error status");
  if (rule.action === "delay") assert(Number.isSafeInteger(rule.delay_ms) && rule.delay_ms > 0, "delay fault needs delay_ms");
  return rule;
}

export function validateFaultPlan(plan) {
  assert.equal(plan.default, "acknowledge", "a fault plan's default must be acknowledge");
  assert(Array.isArray(plan.rules), "a fault plan needs a rules array");
  const keys = new Set();
  for (const rule of plan.rules.map(validRule)) {
    const key = `${rule.occurrence}/${rule.attempt}`;
    assert(!keys.has(key), `duplicate fault rule: ${key}`);
    keys.add(key);
  }
  return plan;
}

// Tracks first-seen ordinals and per-occurrence attempts, and answers the plan's decision for each request.
export function faultInjector(plan) {
  validateFaultPlan(plan);
  const ordinals = new Map();
  const attempts = new Map();
  const rules = new Map(plan.rules.map((rule) => [`${rule.occurrence}/${rule.attempt}`, rule]));
  return {
    decide(eventId) {
      if (!ordinals.has(eventId)) ordinals.set(eventId, ordinals.size + 1);
      const attempt = attempts.get(eventId) ?? 0;
      attempts.set(eventId, attempt + 1);
      const occurrence = ordinals.get(eventId);
      return { occurrence, attempt, rule: rules.get(`${occurrence}/${attempt}`) ?? { action: "acknowledge" } };
    },
  };
}
