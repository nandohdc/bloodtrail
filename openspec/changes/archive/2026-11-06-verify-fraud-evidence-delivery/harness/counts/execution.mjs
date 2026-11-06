import { scheduledFaultPlan } from "../lib/faults.mjs";

function ruleMatches(record, rule) {
  const action = record.action === rule.action;
  const status = rule.status === undefined || record.status === rule.status;
  const delay = rule.delay_ms === undefined || record.delayed_ms === rule.delay_ms;
  return [action, status, delay].every(Boolean);
}

export function plannedIngress(phase) {
  if (phase.kind !== "burst") return phase.occurrences;
  return Math.min(phase.composition.capacity, phase.occurrences - phase.after_shutdown);
}

export function executionObserved(unit, observed) {
  try {
    return observedExecution(unit, observed);
  } catch {
    return false;
  }
}

function observedExecution(unit, observed) {
  const records = observed.ingress.records;
  if (!Array.isArray(records)) return false;
  const plan = scheduledFaultPlan({ scenarios: unit.scenarios, schedule: unit.schedule, cycles: unit.cycles });
  const rules = new Map(plan.rules.map((rule) => [`${rule.occurrence}/${rule.attempt}`, rule]));
  const ordinals = new Set(records.map((record) => record.occurrence));
  const expected = plannedIngress(unit);
  const complete = Array.from({ length: expected }, (_, index) => ordinals.has(index + 1)).every(Boolean);
  const actions = records.every((record) => ruleMatches(record, rules.get(`${record.occurrence}/${record.attempt}`) ?? { action: "acknowledge" }));
  const applicable = plan.rules.filter((rule) => rule.occurrence <= expected);
  const fired = applicable.every((rule) => records.some((record) => atRule(record, rule)));
  return [complete, ordinals.size === expected, actions, fired, copiesObserved(unit, observed)].every(Boolean);
}

function atRule(record, rule) {
  return record.occurrence === rule.occurrence && record.attempt === rule.attempt && ruleMatches(record, rule);
}

function outcomeKind(record) {
  return record.outcome?.kind;
}

function isDuplicate(record) {
  return outcomeKind(record) === "duplicate" && record.status === 202;
}

function isConflict(record) {
  return outcomeKind(record) === "rejected" && record.status === 409;
}

function isOccurrenceOne(record) {
  return record.occurrence === 1;
}

// The copies plans' defining steps. A refused redelivery leaves no other trace in the verdict.
const COPY_STEPS = Object.freeze({
  consumer_restart: restartTriggered,
  collector_restart: duplicateCrossedRestart,
  identities: identityStepsObserved,
  duplicates_volume: everyOccurrenceDuplicated,
});

function copiesObserved(unit, observed) {
  if (!Object.hasOwn(COPY_STEPS, unit.kind)) return true;
  return COPY_STEPS[unit.kind]({ unit, ...observed });
}

function restartTriggered({ sender }) {
  return sender.restart_triggered === true;
}

function everyOccurrenceDuplicated({ unit, ingress }) {
  const duplicated = new Set(ingress.records.filter(isDuplicate).map((record) => record.occurrence));
  return Array.from({ length: unit.occurrences }, (_, index) => duplicated.has(index + 1)).every(Boolean);
}

function identityStepsObserved({ ingress }) {
  const first = ingress.records.filter(isOccurrenceOne);
  if (!first.some(isDuplicate)) return false;
  if (!first.some(isConflict)) return false;
  return reExecuted(ingress.records, first[0].event_id);
}

function reExecuted(records, original) {
  if (typeof original !== "string" || original.length === 0) return false;
  return records.some((record) => record.retry_attempt === 1 && record.original_event_id === original);
}

function restartBoundary(restarts) {
  if (!Array.isArray(restarts) || restarts.length !== 1) return null;
  const boundary = restarts[0].before_record_count;
  if (!Number.isSafeInteger(boundary) || boundary < 0) return null;
  return boundary;
}

function duplicateCrossedRestart({ ingress }) {
  const boundary = restartBoundary(ingress.restarts);
  if (boundary === null) return false;
  return ingress.records.some((record, index) => index >= boundary && isOccurrenceOne(record) && isDuplicate(record));
}
