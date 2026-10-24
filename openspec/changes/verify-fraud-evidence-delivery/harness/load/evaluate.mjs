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

const reachedOperation = (entry) => entry.kind === "operation_started" || entry.kind === "exchange";

// The one overload callback of an occurrence, when it is reported exactly once and before its result.
function orderedRejectionCallback(entries) {
  const callbacks = entries.filter((entry) => entry.kind === "rejected_overload");
  const results = entries.filter((entry) => entry.kind === "result" && entry.status === "rejected_overload");
  const single = callbacks.length === 1 && results.length === 1;
  return single && callbacks[0].sequence < results[0].sequence ? callbacks[0] : undefined;
}

function rejectionAttributed(trace, [eventId, delivery]) {
  const entries = trace.filter((entry) => entry.event_id === eventId);
  const callback = orderedRejectionCallback(entries);
  return callback !== undefined && callback.values[0] === delivery.depth && callback.values[1] === delivery.capacity
    && !entries.some(reachedOperation);
}

const sequentialTrace = (trace) => trace.every((entry, index) => entry.sequence === index + 1);
const saturatedRejections = (sender) => sender.callbacks.rejected_overload.every(([depth, capacity]) => depth === capacity);

export function alertsBeforeLoss({ sender }) {
  const { rejected, reachedExchange } = overloadRejections(sender);
  const trace = sender.trace ?? [];
  const attributed = rejected.every((rejection) => rejectionAttributed(trace, rejection));
  return rejected.length === sender.callbacks.rejected_overload.length
    && saturatedRejections(sender) && reachedExchange === 0 && sequentialTrace(trace) && attributed;
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

const retryKey = (eventId, ordinal) => JSON.stringify([eventId, ordinal]);

function retryTrace(sender) {
  const ofKind = (kind) => sender.trace.filter((entry) => entry.kind === kind);
  const late = sender.delivery_log.filter((entry) => entry.after_shutdown && entry.status === "exhausted");
  return {
    scheduled: ofKind("scheduled"),
    exhausted: ofKind("exhausted"),
    retried: ofKind("exchange").filter((entry) => entry.attempt > 0),
    late,
    lateIds: new Set(late.map((entry) => entry.event_id)),
    report: sender.trace.find((entry) => entry.kind === "shutdown_report"),
  };
}

function retryFollowsReport({ retried, report }, entry) {
  return retried.some((attempt) => attempt.event_id === entry.event_id && attempt.attempt === entry.values[0] && attempt.sequence > report.sequence);
}

function pendingAtShutdown(trace) {
  const { scheduled, report } = trace;
  return scheduled.filter((entry) => entry.sequence < report?.sequence && retryFollowsReport(trace, entry)).length;
}

function unpersistedLate({ ingress }, { lateIds }) {
  return ingress.read_back.filter((entry) => lateIds.has(entry.event_id) && entry.persisted === false && entry.storage_result === "not_found").length;
}

function everyDelayReported(sender, { scheduled, retried }) {
  const scheduledKeys = scheduled.map((entry) => retryKey(entry.event_id, entry.values[0])).sort();
  return isDeepStrictEqual(scheduled.map((entry) => entry.values), sender.callbacks.scheduled)
    && isDeepStrictEqual(scheduledKeys, retried.map((entry) => retryKey(entry.event_id, entry.attempt)).sort());
}

function exhaustionReported({ sender, composition }, { exhausted, late, lateIds }) {
  const reportedOnce = lateIds.size === late.length && exhausted.length === late.length
    && new Set(exhausted.map((entry) => entry.event_id)).size === exhausted.length;
  return reportedOnce && exhausted.every((entry) => lateIds.has(entry.event_id) && entry.values[0] === composition.max_attempts)
    && isDeepStrictEqual(exhausted.map((entry) => entry.values), sender.callbacks.exhausted);
}

function attemptsByEvent(sender) {
  const attempts = new Map();
  for (const entry of sender.exchanges) attempts.set(entry.event_id, [...attempts.get(entry.event_id) ?? [], entry.attempt]);
  return attempts;
}

function boundedAttempts({ sender, composition }, { late }) {
  const attempts = attemptsByEvent(sender);
  const expected = Array.from({ length: composition.max_attempts }, (_, index) => index);
  return attempts.size === sender.callbacks.admitted.length && [...attempts.values()].every((ordinals) => isDeepStrictEqual(ordinals, expected))
    && late.every((entry) => entry.attempts === composition.max_attempts);
}

function seededDelaysHold({ composition }, { scheduled }) {
  const draws = seededJitter(composition.jitter_seed);
  return scheduled.every((entry) => entry.values[1] === retryDelay({ composition, next: entry.values[0], draw: draws }));
}

// In the combined case, delayed retries remain pending at report time and are then allowed to finish.
// Late exhaustion is read from the log: the primary delivery map preserves the shutdown's abandonment.
export function retryAccounting({ observed: { sender, ingress }, phase }) {
  const trace = retryTrace(sender);
  const subject = { sender, composition: phase.composition };
  return {
    scheduled: trace.scheduled.length, retry_exchanges: trace.retried.length, exhausted: trace.exhausted.length,
    pending_at_shutdown: pendingAtShutdown(trace),
    late_exhausted: trace.late.length,
    unpersisted: unpersistedLate({ ingress }, trace),
    every_delay_reported: everyDelayReported(sender, trace),
    every_exhaustion_reported: exhaustionReported(subject, trace),
    bounded_attempts: boundedAttempts(subject, trace),
    seeded_delays_hold: seededDelaysHold(subject, trace),
  };
}

function ceilingEvidence({ sender, phase }) {
  const ceiling = phase.composition.loss_ceiling;
  const trace = sender.trace ?? [];
  const first = sender.callbacks.dropped[ceiling - 1]?.[0];
  const event = trace.filter((entry) => entry.event_id === first);
  return {
    ceiling, first,
    reached: sender.callbacks.dropped.length >= ceiling,
    signals: trace.filter((entry) => entry.kind === "loss_ceiling_reached"),
    exchange: event.find((entry) => entry.kind === "exchange"),
    result: event.find((entry) => entry.kind === "result" && entry.status === "dropped"),
  };
}

function signalledAtCeiling({ ceiling, first, signals, exchange, result }) {
  const signal = signals[0];
  return signal?.event_id === first && signal.loss_count === ceiling
    && exchange?.sequence < signal.sequence && signal.sequence < result?.sequence;
}

export function ceilingSignalled({ sender, phase }) {
  const evidence = ceilingEvidence({ sender, phase });
  const expected = evidence.reached ? 1 : 0;
  const atCeiling = !evidence.reached || signalledAtCeiling(evidence);
  return sender.callbacks.loss_ceiling_reached.length === expected && evidence.signals.length === expected
    && sender.health.lossCeilingReached === evidence.reached && sender.health.claimsDelivered === false && atCeiling;
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
