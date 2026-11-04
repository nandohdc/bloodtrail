import { plannedIngress } from "./execution.mjs";

export function frozenCallPlan({ phase, kind }) {
  const exact = (count) => ({ minimum: count, maximum: count });
  const methods = ["authenticationSucceeded", "sessionCreated", "mfaRemoved", "passwordResetCompleted", "sessionRevoked"];
  const plan = Object.fromEntries(methods.map((method) => [method, exact(phase.chain_count)]));
  plan.authenticationFailed = exact(phase.failed_count);
  plan.beginOperation = exact(3 * phase.chain_count);
  plan.markCommitted = exact(3 * phase.chain_count);
  plan.redeliver = exact(phase.extra_call_bound);
  if (kind === "consumer_restart") plan.redeliver.minimum = 0;
  return plan;
}

function callsMatch(ledger, phase) {
  const counts = {};
  ledger.calls.forEach((call) => { counts[call.label] = (counts[call.label] ?? 0) + 1; });
  const known = Object.keys(counts).every((label) => Object.hasOwn(phase.call_plan, label));
  const planned = Object.entries(phase.call_plan).every(([label, bound]) => inRange(counts[label] ?? 0, bound));
  const ordinals = ledger.calls.every((call, index) => call.ordinal === index + 1);
  return [known, planned, ordinals].every(Boolean);
}

function inRange(count, bound) {
  return count >= bound.minimum && count <= bound.maximum;
}

function ingressMatches({ observed, phase, unit }) {
  const emitted = new Set(observed.sender.emissions.map((entry) => entry.event_id));
  const received = new Set(observed.ingress.records.map((record) => record.event_id));
  const foreign = [...received].some((id) => !emitted.has(id));
  return [emitted.size === phase.occurrences, received.size === plannedIngress(unit), !foreign].every(Boolean);
}

export function accountingHolds({ observed, summary, phase, unit }) {
  const ledger = observed.sender.ledger;
  const total = ledger.calls.length;
  const budget = Object.values(phase.call_plan).reduce((sum, bound) => sum + bound.maximum, 0);
  const counts = [observed.occurrence_count, ledger.occurrence_count].every((count) => count === total);
  const bounded = ledger.budget === budget && ledger.exhausted === false;
  const sources = summary.accounted === phase.occurrences;
  return [counts, bounded, sources, callsMatch(ledger, phase), ingressMatches({ observed, phase, unit })].every(Boolean);
}
