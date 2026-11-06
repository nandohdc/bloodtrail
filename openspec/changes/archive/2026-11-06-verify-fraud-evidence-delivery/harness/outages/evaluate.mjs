// Compares the outages probe's raw observations with its frozen expectations. A mismatch is reported,
// never corrected: each case records what was expected, what was observed, and whether they are equal.
// Each frozen case names its observer and its pass, so the code does not depend on case positions.
//
// Occurrences are compared by scenario, never by event id (the binding draws event ids at random): the k-th
// occurrence the sender delivered, in workload order, is the k-th entry of its pass's expanded schedule.
// Deliveries are sequential, so each scheduled retry delay belongs to the next retry the exchange saw, and
// each exhaustion alert to the next occurrence that exhausted its budget. An occurrence refused before the
// sink has no delivery: the accounting case reports it as missing, and every later attribution shifts, so
// the cases after it mismatch rather than pass.
import { isDeepStrictEqual } from "node:util";
import { accountingInputs, droppedOccurrenceControl, identities } from "../lib/accounting.mjs";
import { retryDelay, seededJitter } from "../lib/clock.mjs";
import { isolationControls } from "../lib/evaluation.mjs";
import { expandSchedule } from "../lib/faults.mjs";

export function passOf(expectations, name) {
  return expectations.passes.find((pass) => pass.name === name);
}

export function scheduleOf(pass) {
  return expandSchedule({ schedule: pass.schedule, cycles: pass.cycles });
}

const INGESTED = new Set(["persisted", "duplicate"]);

function byEventId(entries) {
  return Map.groupBy(entries, (entry) => entry.event_id);
}

function listOf(groups, key) {
  return groups.get(key) ?? [];
}

function sdkResult(call) {
  if (call === undefined) return null;
  return call.ok ? call.value.status : call.error.code;
}

function storedCopies(ingress) {
  return byEventId(ingress.read_back.filter((entry) => entry.persisted));
}

function scenarioOf({ sender, schedule }) {
  const scenarios = new Map(Object.keys(sender.deliveries).map((eventId, index) => [eventId, schedule[index] ?? null]));
  return (eventId) => scenarios.get(eventId) ?? null;
}

function tally(keys) {
  const counts = {};
  for (const key of keys) counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

// One occurrence's observations at every boundary: the SDK call, the composition's result, the attempts the
// exchange saw, the requests the ingress answered and the copies storage holds.
function profiles({ observed: { sender, ingress }, schedule }) {
  const exchanges = byEventId(sender.exchanges);
  const records = byEventId(ingress.records);
  const stored = storedCopies(ingress);
  return Object.keys(sender.deliveries).map((eventId, index) => ({
    scenario: schedule[index] ?? null,
    sdk: sdkResult(sender.calls[index]),
    delivery: sender.deliveries[eventId].status,
    attempts: sender.deliveries[eventId].attempts,
    exchange_attempts: listOf(exchanges, eventId).map((entry) => entry.attempt),
    requests: listOf(records, eventId).map((entry) => ({ attempt: entry.attempt, action: entry.action, status: entry.status, outcome: entry.outcome.kind })),
    stored: listOf(stored, eventId).length,
  }));
}

// The exchanges that were retries, in order, and the event ids whose delivery exhausted its budget: what
// the retry callbacks are attributed to and judged against.
function retriedExchanges(sender) {
  return sender.exchanges.filter((entry) => entry.attempt > 0);
}

function exhaustedEventIds(sender) {
  return Object.keys(sender.deliveries).filter((eventId) => sender.deliveries[eventId].status === "exhausted");
}

function retryCallbacks({ observed: { sender }, schedule }) {
  const scenario = scenarioOf({ sender, schedule });
  const retried = retriedExchanges(sender);
  const exhausted = exhaustedEventIds(sender);
  return {
    scheduled: sender.callbacks.scheduled.map(([next, delayMs], index) => ({ scenario: scenario(retried[index]?.event_id), next, delay_ms: delayMs })),
    exhausted: sender.callbacks.exhausted.map(([attempts], index) => ({ scenario: scenario(exhausted[index]), attempts })),
  };
}

// The accounting identity over the pass's planned occurrences, with expected losses in the denominator,
// and the delay identity. Unexplained occurrences and disagreements are tallied by scenario.
function accounting({ observed: { sender, ingress }, pass, schedule }) {
  const scenario = scenarioOf({ sender, schedule });
  const { accounting: result, delays } = identities({ sender, ingress, planned: pass.occurrences });
  return {
    denominator: result.denominator, counts: result.counts, missing: result.missing,
    unexplained: tally(result.unexplained.map(scenario)),
    disagreements: tally(result.disagreements.map((entry) => `${scenario(entry.event_id)}:${entry.delivery}`)),
    accounting_holds: result.holds, scheduled_delays: delays.scheduled, delay_identity_holds: delays.holds,
  };
}

// G4's in-process predicates for retry (design.md, the G4 test): attempts stay within the budget; every
// scheduled delay is reported with the ordinal of the attempt it precedes; every delay is within its
// backoff cap and is the seeded jitter's draw applied to that cap; every exhaustion is alerted.
function retryPredicates({ observed: { sender }, expectations }) {
  const { composition } = expectations;
  const maxAttempts = composition.max_attempts;
  const draw = seededJitter(composition.jitter_seed);
  const scheduled = sender.callbacks.scheduled;
  const retried = retriedExchanges(sender);
  const exhausted = exhaustedEventIds(sender);
  return {
    attempts_within_budget: Object.values(sender.deliveries).every((delivery) => delivery.attempts <= maxAttempts) && sender.exchanges.every((entry) => entry.attempt < maxAttempts),
    every_delay_reported: scheduled.length === retried.length && scheduled.every(([next], index) => next === retried[index].attempt),
    delays_within_cap: scheduled.every(([next, delayMs]) => Number.isSafeInteger(delayMs) && delayMs >= 0 && delayMs <= retryDelay({ composition, next })),
    jitter_reproduced: scheduled.every(([next, delayMs]) => delayMs === retryDelay({ composition, next, draw })),
    every_exhaustion_alerted: exhausted.length === sender.callbacks.exhausted.length && sender.callbacks.exhausted.every(([attempts]) => attempts === maxAttempts),
  };
}

function shutdownReport({ observed: { sender } }) {
  return { shutdown_report: sender.shutdown_report };
}

// Every copy of an occurrence, at the exchange, at the ingress and in storage, has one body hash. The first
// two boundaries must hold a copy, and storage must too whenever the collector stored the occurrence (an
// ingest outcome of persisted or duplicate); an exhausted or refused occurrence legitimately has none.
function byteIdentity({ observed: { sender, ingress } }) {
  const exchanges = byEventId(sender.exchanges);
  const records = byEventId(ingress.records);
  const stored = storedCopies(ingress);
  const eventIds = Object.keys(sender.deliveries);
  const identical = eventIds.filter((eventId) => {
    const sent = listOf(exchanges, eventId).map((entry) => entry.body_sha256);
    const received = listOf(records, eventId).map((entry) => entry.body_sha256);
    const kept = listOf(stored, eventId).map((entry) => entry.stored_body_sha256);
    const ingested = listOf(records, eventId).some((entry) => INGESTED.has(entry.outcome.kind));
    const present = sent.length > 0 && received.length > 0 && (kept.length > 0 || !ingested);
    return present && new Set([...sent, ...received, ...kept]).size === 1;
  });
  return { occurrences: eventIds.length, byte_identical: identical.length };
}

// The small pass's frozen profiles, one per scenario: the reference every volume occurrence must equal.
export function frozenProfiles(expectations) {
  const reference = expectations.cases.find((entry) => entry.pass === "small" && entry.observer === "profiles");
  return new Map(reference.expected.map((profile) => [profile.scenario, profile]));
}

function conformance(context) {
  const frozen = frozenProfiles(context.expectations);
  const observed = profiles(context);
  const nonconforming = [];
  const conforming = [];
  observed.forEach((profile, index) => {
    if (isDeepStrictEqual(profile, frozen.get(profile.scenario))) conforming.push(profile.scenario);
    else nonconforming.push({ ordinal: index + 1, scenario: profile.scenario });
  });
  return { occurrences: observed.length, conforming: tally(conforming), nonconforming };
}

export const OBSERVERS = Object.freeze({
  profiles,
  retry_callbacks: retryCallbacks,
  accounting,
  dropped_occurrence_control: ({ observed: { sender, ingress }, pass }) => droppedOccurrenceControl(accountingInputs({ sender, ingress, planned: pass.occurrences })),
  retry_predicates: retryPredicates,
  shutdown_report: shutdownReport,
  byte_identity: byteIdentity,
  isolation_controls: ({ observed }) => isolationControls(observed),
  conformance,
});

function observeCase({ entry, observations, expectations }) {
  const observed = observations === null ? null : (observations.passes[entry.pass] ?? null);
  if (observed === null) return null;
  const pass = passOf(expectations, entry.pass);
  return OBSERVERS[entry.observer]({ observed, expectations, pass, schedule: scheduleOf(pass) });
}

// Every case, or only one pass's cases when `pass` is given (the session's small-pass gate).
export function evaluateCases({ observations, expectations, pass }) {
  const cases = expectations.cases.filter((entry) => pass === undefined || entry.pass === pass);
  const evaluations = cases.map((entry) => {
    const observed = observeCase({ entry, observations, expectations });
    return { case_id: entry.case_id, pass: entry.pass, expected: entry.expected, observed, matched: isDeepStrictEqual(observed, entry.expected) };
  });
  const matched = evaluations.filter((entry) => entry.matched).length;
  return { evaluations, verdict: { matched, mismatched: evaluations.length - matched } };
}
