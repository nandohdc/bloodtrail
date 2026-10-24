// Compares the load probe's raw observations with its frozen expectations. A mismatch is reported, never
// corrected. Each frozen case names its pass, its observer and the phases it reads, so the code does not
// depend on case positions. Event ids are random, so every observer reports counts and tallies.
import { isDeepStrictEqual } from "node:util";
import { accountFor, accountingInputs } from "../lib/accounting.mjs";
import { isolationControls } from "../lib/evaluation.mjs";
import { retryDelay, seededJitter } from "../lib/clock.mjs";

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

export function withinDeadline({ sender, phase }) {
  const deadline = phase.composition.shutdown_deadline_ms;
  return Number.isFinite(sender.shutdown_elapsed_ms) && sender.shutdown_elapsed_ms >= 0 && sender.shutdown_elapsed_ms <= deadline;
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
    disagreements: tally(accounting.disagreements.map((entry) => entry.delivery)), accounting_holds: accounting.holds, denominator: accounting.denominator,
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
    counts: accounting.counts, accounting_holds: accounting.holds, denominator: accounting.denominator,
  };
}

// A shutdown report accounts for everything admitted when it counts every submission made before shutdown
// started (the phase's occurrences) and splits them into completed and abandoned.
export function accountsForAdmitted({ report, phase }) {
  return report.accepted === phase.occurrences && report.accepted === report.completed + report.abandoned;
}

function dropsCounted({ sender, dropped }) {
  const ids = dropped.map(([eventId]) => eventId);
  return dropped.length === statuses(sender).filter((status) => status === "dropped").length
    && new Set(ids).size === ids.length && ids.every((eventId) => sender.deliveries[eventId]?.status === "dropped");
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

export function alertsBeforeLoss({ sender }) {
  const { rejected, reachedExchange } = overloadRejections(sender);
  const trace = sender.trace ?? [];
  const ordered = trace.every((entry, index) => entry.sequence === index + 1);
  const attributed = rejected.every(([eventId, delivery]) => {
    const entries = trace.filter((entry) => entry.event_id === eventId);
    const callbacks = entries.filter((entry) => entry.kind === "rejected_overload");
    const results = entries.filter((entry) => entry.kind === "result" && entry.status === "rejected_overload");
    return callbacks.length === 1 && results.length === 1 && callbacks[0].sequence < results[0].sequence
      && callbacks[0].values[0] === delivery.depth && callbacks[0].values[1] === delivery.capacity
      && !entries.some((entry) => entry.kind === "operation_started" || entry.kind === "exchange");
  });
  return rejected.length === sender.callbacks.rejected_overload.length
    && sender.callbacks.rejected_overload.every(([depth, capacity]) => depth === capacity)
    && reachedExchange === 0 && ordered && attributed;
}

// Every drop has its callback, each callback carries the saturating count at that drop, and the count the
// drop's own result reported is the same one.
export function dropsReported({ sender, phase }) {
  const ceiling = phase.composition.loss_ceiling;
  const saturating = sender.callbacks.dropped.every(([, lossCount], index) => lossCount === Math.min(index + 1, ceiling));
  const agreeing = sender.callbacks.dropped.every(([eventId, lossCount]) => sender.deliveries[eventId]?.status === "dropped" && sender.deliveries[eventId].loss_count === lossCount);
  return dropsCounted({ sender, dropped: sender.callbacks.dropped }) && saturating && agreeing;
}

function noBacklog({ sender, ingress }) {
  const starts = (sender.trace ?? []).filter((entry) => entry.kind === "operation_started").map((entry) => entry.event_id);
  const allowed = new Set(starts);
  const attemptKey = (entry) => JSON.stringify([entry.event_id, entry.attempt]);
  return starts.length === allowed.size && starts.length === sender.callbacks.admitted.length
    && sender.exchanges.every((entry) => allowed.has(entry.event_id))
    && isDeepStrictEqual(sender.exchanges.map(attemptKey).sort(), ingress.records.map(attemptKey).sort());
}

// In the combined case, delayed retries remain pending at report time and are then allowed to finish.
// Late exhaustion is read from the log: the primary delivery map preserves the shutdown's abandonment.
export function retryAccounting({ observed: { sender, ingress }, phase }) {
  const scheduled = sender.trace.filter((entry) => entry.kind === "scheduled");
  const exhausted = sender.trace.filter((entry) => entry.kind === "exhausted");
  const retried = sender.trace.filter((entry) => entry.kind === "exchange" && entry.attempt > 0);
  const late = sender.delivery_log.filter((entry) => entry.after_shutdown && entry.status === "exhausted");
  const lateIds = new Set(late.map((entry) => entry.event_id));
  const report = sender.trace.find((entry) => entry.kind === "shutdown_report");
  const key = (id, ordinal) => JSON.stringify([id, ordinal]);
  const draws = seededJitter(phase.composition.jitter_seed);
  const attempts = new Map();
  for (const entry of sender.exchanges) attempts.set(entry.event_id, [...attempts.get(entry.event_id) ?? [], entry.attempt]);
  return {
    scheduled: scheduled.length, retry_exchanges: retried.length, exhausted: exhausted.length,
    pending_at_shutdown: scheduled.filter((entry) => entry.sequence < report?.sequence
      && retried.some((attempt) => attempt.event_id === entry.event_id && attempt.attempt === entry.values[0] && attempt.sequence > report.sequence)).length,
    late_exhausted: late.length,
    unpersisted: ingress.read_back.filter((entry) => lateIds.has(entry.event_id) && entry.persisted === false && entry.storage_result === "not_found").length,
    every_delay_reported: isDeepStrictEqual(scheduled.map((entry) => entry.values), sender.callbacks.scheduled)
      && isDeepStrictEqual(scheduled.map((entry) => key(entry.event_id, entry.values[0])).sort(), retried.map((entry) => key(entry.event_id, entry.attempt)).sort()),
    every_exhaustion_reported: lateIds.size === late.length && exhausted.length === late.length
      && new Set(exhausted.map((entry) => entry.event_id)).size === exhausted.length
      && exhausted.every((entry) => lateIds.has(entry.event_id) && entry.values[0] === phase.composition.max_attempts)
      && isDeepStrictEqual(exhausted.map((entry) => entry.values), sender.callbacks.exhausted),
    bounded_attempts: attempts.size === sender.callbacks.admitted.length && [...attempts.values()].every((ordinals) =>
      isDeepStrictEqual(ordinals, Array.from({ length: phase.composition.max_attempts }, (_, index) => index)))
      && late.every((entry) => entry.attempts === phase.composition.max_attempts),
    seeded_delays_hold: scheduled.every((entry) => entry.values[1] === retryDelay({ composition: phase.composition, next: entry.values[0], draw: draws })),
  };
}

export function ceilingSignalled({ sender, phase }) {
  const reached = sender.callbacks.dropped.length >= phase.composition.loss_ceiling;
  const signals = (sender.trace ?? []).filter((entry) => entry.kind === "loss_ceiling_reached");
  const first = sender.callbacks.dropped[phase.composition.loss_ceiling - 1]?.[0];
  const signal = signals[0];
  const event = (sender.trace ?? []).filter((entry) => entry.event_id === first);
  const exchange = event.find((entry) => entry.kind === "exchange");
  const result = event.find((entry) => entry.kind === "result" && entry.status === "dropped");
  const atCeiling = !reached || (signal?.event_id === first && signal.loss_count === phase.composition.loss_ceiling
    && exchange?.sequence < signal.sequence && signal.sequence < result?.sequence);
  return sender.callbacks.loss_ceiling_reached.length === (reached ? 1 : 0) && signals.length === (reached ? 1 : 0)
    && sender.health.lossCeilingReached === reached && sender.health.claimsDelivered === false && atCeiling;
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
    bounded_flush: bursts.every(({ sender, phase }) => accountsForAdmitted({ report: sender.shutdown_report, phase }) && (phase.shutdown === "after_settle" || withinDeadline({ sender, phase }))),
    no_backlog: bursts.every(noBacklog),
    every_drop_reported: efforts.every(dropsReported),
    loss_ceiling_signalled: efforts.every(ceilingSignalled),
  };
}

function controlsByPhase({ observed, names }) {
  return Object.fromEntries(names.map((name) => {
    const phase = observed[name];
    return [name, { ...isolationControls(phase), accounting_pretraffic: phase.sender.controls.accounting_checks?.holds === true,
      final_quiescent: phase.ingress.quiescent === true,
      role_closure_confirmed: phase.role_closure?.sender?.code === 0 && phase.role_closure?.ingress?.code === 0 }];
  }));
}

const single = (observer) => ({ observed, phases, names: [name] }) => observer({ observed: observed[name], phase: phases[name] });

export const OBSERVERS = Object.freeze({
  admission: single(admission),
  shutdown_accounting: single(shutdownAccounting),
  retry_accounting: single(retryAccounting),
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
