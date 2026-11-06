// Deterministic fault injection for the harness ingress.
//
// A fault plan is frozen in a probe's expectations file. The ingress decides each request by two keys it
// observes itself: the occurrence's first-seen ordinal (1-based, in arrival order of distinct event ids)
// and the delivery attempt for that occurrence (0-based, counted at the ingress). The plan never reads a
// random source and holds no acceptance logic: "acknowledge" hands the body to the kit's collector.
import assert from "node:assert/strict";

export const FAULT_ACTIONS = Object.freeze(["acknowledge", "status", "delay", "destroy_before_ingest", "destroy_after_ingest", "malformed_after_ingest"]);

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

// A schedule names one scenario per occurrence, repeated `cycles` times: occurrence k (1-based) runs
// schedule[(k - 1) % schedule.length]. The injector's rules and the evaluator's attribution both expand the
// schedule here. The injector counts occurrences in the order event ids first reach the ingress and the
// evaluator in delivery order; the two agree whenever every delivery reaches the ingress, as every frozen
// scenario's does, and any divergence shows as mismatches.
export function expandSchedule({ schedule, cycles }) {
  assert(Array.isArray(schedule) && schedule.length > 0, "a schedule needs at least one scenario");
  assert(Number.isSafeInteger(cycles) && cycles > 0, "a schedule needs a positive number of cycles");
  return Array.from({ length: schedule.length * cycles }, (_, index) => schedule[index % schedule.length]);
}

// A probe freezes named scenarios, each a list of per-attempt rules without an occurrence; each occurrence
// gets its scheduled scenario's rules. The expanded plan is validated like any other.
export function scheduledFaultPlan({ scenarios, schedule, cycles }) {
  const rules = expandSchedule({ schedule, cycles }).flatMap((name, index) => {
    assert(Object.hasOwn(scenarios, name), `unknown scenario: ${name}`);
    return scenarios[name].map((rule) => ({ ...rule, occurrence: index + 1 }));
  });
  return validateFaultPlan({ default: "acknowledge", rules });
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
