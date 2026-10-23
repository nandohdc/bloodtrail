// Compares the load probe's raw observations with its frozen expectations. A mismatch is reported, never
// corrected. Each frozen case names its pass, its observer and the phases it reads, so the code does not
// depend on case positions. Event ids are random, so every observer reports counts and tallies.
import { isDeepStrictEqual } from "node:util";
import { accountFor, accountingInputs } from "../lib/accounting.mjs";
import { isolationControls } from "../lib/evaluation.mjs";

// A shutdown that overran its deadline by more than half of it (and at least 100 ms, for the event loop's
// timer granularity) is not bounded; a 200 ms deadline is checked at 300 ms, not at a flat second.
export const DEADLINE_MARGIN = Object.freeze({ ratio: 0.5, floor_ms: 100 });

export function phaseOf(expectations, name) {
  return expectations.phases.find((phase) => phase.name === name);
}

function tally(keys) {
  const counts = {};
  for (const key of keys) counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

function sdkResult(call) {
  return call.ok ? call.value.status : call.error.code;
}

function statuses(sender) {
  return Object.values(sender.deliveries).map((delivery) => delivery.status);
}

function stored(ingress) {
  return ingress.read_back.filter((entry) => entry.persisted).length;
}

// The overload rejections, and those of them that nevertheless reached the exchange (which must be none).
function overloadRejections(sender) {
  const rejected = Object.entries(sender.deliveries).filter(([, delivery]) => delivery.status === "rejected_overload");
  const rejectedIds = new Set(rejected.map(([eventId]) => eventId));
  return { rejected, reachedExchange: sender.exchanges.filter((entry) => rejectedIds.has(entry.event_id)).length };
}

// The admission gate during a burst: every decision, the depth and capacity both the results and the
// rejected-overload callbacks report, and how far each rejected occurrence got (it must not reach the
// exchange, and the ingress must see only admitted occurrences).
function admission({ observed: { sender, ingress } }) {
  const { rejected, reachedExchange } = overloadRejections(sender);
  return {
    submitted: Object.keys(sender.deliveries).length,
    admitted: sender.callbacks.admitted.length,
    admitted_depth_max: Math.max(0, ...sender.callbacks.admitted.map(([depth]) => depth)),
    rejected_overload: rejected.length,
    rejection_results: tally(rejected.map(([, delivery]) => `${delivery.depth}/${delivery.capacity}`)),
    rejection_callbacks: tally(sender.callbacks.rejected_overload.map(([depth, capacity]) => `${depth}/${capacity}`)),
    rejected_reached_exchange: reachedExchange,
    exchanges: sender.exchanges.length,
    ingress_requests: ingress.records.length,
    stored: stored(ingress),
  };
}

function planned(phase) {
  return phase.occurrences + phase.after_shutdown;
}

function withinDeadline({ sender, phase }) {
  const deadline = phase.composition.shutdown_deadline_ms;
  return sender.shutdown_elapsed_ms <= deadline + Math.max(DEADLINE_MARGIN.floor_ms, deadline * DEADLINE_MARGIN.ratio);
}

// The shutdown report, how every occurrence ended (including any that settled only after shutdown reported),
// the SDK results, and the accounting identity with overload and shutdown losses in the denominator.
function shutdownAccounting({ observed: { sender, ingress }, phase }) {
  const accounting = accountFor(accountingInputs({ sender, ingress, planned: planned(phase) }));
  return {
    shutdown_report: sender.shutdown_report, within_deadline: withinDeadline({ sender, phase }),
    deliveries: tally(statuses(sender)),
    settled_after_shutdown: tally(sender.delivery_log.filter((entry) => entry.after_shutdown).map((entry) => entry.status)),
    sdk: tally(sender.calls.map(sdkResult)),
    counts: accounting.counts, unexplained: accounting.unexplained.length,
    disagreements: tally(accounting.disagreements.map((entry) => entry.delivery)), accounting_holds: accounting.holds,
  };
}

// The `best_effort` class: one attempt each, every drop reported with the saturating loss count, the
// ceiling signal, the health signal and the guarantees the binding declares. It never retries, so only the
// accounting identity applies.
function loss({ observed: { sender, ingress }, phase }) {
  const accounting = accountFor(accountingInputs({ sender, ingress, planned: phase.occurrences }));
  return {
    results: tally(statuses(sender)), attempts: tally(Object.values(sender.deliveries).map((delivery) => delivery.attempts)),
    dropped_loss_counts: sender.callbacks.dropped.map(([, lossCount]) => lossCount),
    loss_ceiling_reached: sender.callbacks.loss_ceiling_reached.map(([lossCount]) => lossCount),
    health: sender.health, guarantees: sender.guarantees,
    exchanges: sender.exchanges.length, stored: stored(ingress), sdk: tally(sender.calls.map(sdkResult)),
    counts: accounting.counts, accounting_holds: accounting.holds,
  };
}

// A shutdown report accounts for everything admitted when it counts every submission made before shutdown
// started (the phase's occurrences) and splits them into completed and abandoned.
function accountsForAdmitted({ report, phase }) {
  return report.accepted === phase.occurrences && report.accepted === report.completed + report.abandoned;
}

function dropsCounted({ sender, dropped }) {
  return dropped.length === statuses(sender).filter((status) => status === "dropped").length;
}

// Planted defects on the run's own data (the first named phase is a burst, the second best_effort): a
// shutdown report that leaves one admitted operation out entirely, and a drop with no drop callback, must
// each fail its check; the same checks on the untouched data are the null controls.
function plantedControls({ observed, phases, names: [burst, effort] }) {
  const report = observed[burst].sender.shutdown_report;
  const effortSender = observed[effort].sender;
  const omitted = { ...report, accepted: report.accepted - 1, completed: report.completed - 1 };
  return {
    omitted_admission_detected: !accountsForAdmitted({ report: omitted, phase: phases[burst] }),
    uncounted_drop_detected: !dropsCounted({ sender: effortSender, dropped: effortSender.callbacks.dropped.slice(1) }),
    null_controls_hold: accountsForAdmitted({ report, phase: phases[burst] }) && dropsCounted({ sender: effortSender, dropped: effortSender.callbacks.dropped }),
  };
}

function alertsBeforeLoss({ sender }) {
  const { rejected, reachedExchange } = overloadRejections(sender);
  return rejected.length === sender.callbacks.rejected_overload.length
    && sender.callbacks.rejected_overload.every(([depth, capacity]) => depth === capacity)
    && reachedExchange === 0;
}

// Every drop has its callback, each callback carries the saturating count at that drop, and the count the
// drop's own result reported is the same one.
function dropsReported({ sender, phase }) {
  const ceiling = phase.composition.loss_ceiling;
  const saturating = sender.callbacks.dropped.every(([, lossCount], index) => lossCount === Math.min(index + 1, ceiling));
  const agreeing = sender.callbacks.dropped.every(([eventId, lossCount]) => sender.deliveries[eventId]?.loss_count === lossCount);
  return dropsCounted({ sender, dropped: sender.callbacks.dropped }) && saturating && agreeing;
}

function ceilingSignalled({ sender, phase }) {
  const reached = sender.callbacks.dropped.length >= phase.composition.loss_ceiling;
  return sender.callbacks.loss_ceiling_reached.length === (reached ? 1 : 0) && sender.health.lossCeilingReached === reached && sender.health.claimsDelivered === false;
}

// G4's predicates for the load cells (design.md, the G4 test), over every named phase of its kind: alert
// before silent loss (every overload rejection reported through its callback with depth and capacity, and
// none reaching the exchange); bounded flush (every shutdown report accounts for everything admitted, and a
// shutdown started mid-burst returns within its deadline; one started after settling has nothing to bound);
// no backlog (the ingress saw only admitted occurrences); and the best_effort row's bounded loss reporting
// (every drop reported with its saturating count, the ceiling signalled).
function g4Predicates({ observed, phases, names }) {
  const of = (kind) => names.filter((name) => phases[name].kind === kind).map((name) => ({ ...observed[name], phase: phases[name] }));
  const bursts = of("burst");
  const efforts = of("best_effort");
  return {
    alert_before_silent_loss: bursts.every(alertsBeforeLoss),
    bounded_flush: bursts.every(({ sender, phase }) => accountsForAdmitted({ report: sender.shutdown_report, phase }) && (phase.shutdown !== "after_admission" || withinDeadline({ sender, phase }))),
    no_backlog: bursts.every(({ sender, ingress }) => ingress.records.length === sender.callbacks.admitted.length),
    every_drop_reported: efforts.every(dropsReported),
    loss_ceiling_signalled: efforts.every(ceilingSignalled),
  };
}

function controlsByPhase({ observed, names }) {
  return Object.fromEntries(names.map((name) => [name, isolationControls(observed[name])]));
}

const single = (observer) => ({ observed, phases, names: [name] }) => observer({ observed: observed[name], phase: phases[name] });

export const OBSERVERS = Object.freeze({
  admission: single(admission),
  shutdown_accounting: single(shutdownAccounting),
  loss: single(loss),
  planted_controls: plantedControls,
  g4_predicates: g4Predicates,
  isolation_controls: controlsByPhase,
});

function observeCase({ entry, observations, expectations }) {
  if (observations === null) return null;
  const observed = Object.fromEntries(entry.phases.map((name) => [name, observations.phases[name] ?? null]));
  if (Object.values(observed).includes(null)) return null;
  const phases = Object.fromEntries(entry.phases.map((name) => [name, phaseOf(expectations, name)]));
  return OBSERVERS[entry.observer]({ observed, phases, names: entry.phases, expectations });
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
