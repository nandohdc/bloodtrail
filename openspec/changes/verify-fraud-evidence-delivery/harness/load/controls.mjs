// Pure planted/null controls over the actual evaluation predicates. Every live load sender executes these
// before constructing its SDK or emitting an occurrence. They spend no SDK calls and use no kit code.
import { accountFor } from "../lib/accounting.mjs";
import { accountsForAdmitted, alertsBeforeLoss, ceilingSignalled, dropsReported, retryAccounting, withinDeadline } from "./evaluate.mjs";

function retryFixture() {
  return {
    phase: { composition: { max_attempts: 2, jitter_seed: 838, base_delay_ms: 20, max_delay_ms: 160 } },
    observed: {
      sender: {
        callbacks: { scheduled: [[1, 14]], exhausted: [[2]], admitted: [[1, 1]] },
        exchanges: [{ event_id: "retry", attempt: 0 }, { event_id: "retry", attempt: 1 }],
        delivery_log: [{ event_id: "retry", status: "exhausted", attempts: 2, after_shutdown: true }],
        trace: [
          { sequence: 1, event_id: "retry", kind: "exchange", attempt: 0 },
          { sequence: 2, event_id: "retry", kind: "scheduled", values: [1, 14] },
          { sequence: 3, event_id: null, kind: "shutdown_report" },
          { sequence: 4, event_id: "retry", kind: "exchange", attempt: 1 },
          { sequence: 5, event_id: "retry", kind: "exhausted", values: [2] },
        ],
      },
      ingress: { read_back: [{ event_id: "retry", persisted: false, storage_result: "not_found" }] },
    },
  };
}

function retryControls() {
  const clean = retryFixture();
  const delay = retryFixture();
  delay.observed.sender.callbacks.scheduled = [];
  const exhaustion = retryFixture();
  exhaustion.observed.sender.callbacks.exhausted = [];
  const absent = retryFixture();
  absent.observed.ingress.read_back[0].storage_result = "unknown";
  const nullResult = retryAccounting(clean);
  return {
    retry_delay_missing_detected: !retryAccounting(delay).every_delay_reported,
    retry_exhaustion_missing_detected: !retryAccounting(exhaustion).every_exhaustion_reported,
    storage_absence_missing_detected: retryAccounting(absent).unpersisted !== 1,
    retry_null_control_holds: Object.values(nullResult).every((value) => typeof value === "boolean" ? value : value === 1),
  };
}

export function accountingControls() {
  const phase = { occurrences: 2, composition: { loss_ceiling: 2, shutdown_deadline_ms: 200 } };
  const report = { accepted: 2, completed: 1, abandoned: 1 };
  const sender = {
    deliveries: { a: { status: "dropped", loss_count: 1 }, b: { status: "dropped", loss_count: 2 }, c: { status: "dropped", loss_count: 2 } },
    callbacks: { dropped: [["a", 1], ["b", 2], ["c", 2]], loss_ceiling_reached: [[2]] },
    health: { lossCeilingReached: true, claimsDelivered: false },
    trace: [{ sequence: 1, event_id: "b", kind: "exchange" }, { sequence: 2, event_id: "b", kind: "loss_ceiling_reached", loss_count: 2 }, { sequence: 3, event_id: "b", kind: "result", status: "dropped" }],
  };
  const uncounted = structuredClone(sender);
  uncounted.callbacks.dropped.pop();
  const duplicate = structuredClone(sender);
  duplicate.callbacks.dropped.at(-1)[0] = "b";
  const silentCeiling = structuredClone(sender);
  silentCeiling.callbacks.loss_ceiling_reached = [];
  const lateCeiling = structuredClone(sender);
  lateCeiling.trace = [sender.trace[0], sender.trace[2], sender.trace[1]].map((entry, index) => ({ ...entry, sequence: index + 1 }));
  const accounting = { planned: 2, generated: ["persisted", "rejected"], deliveries: new Map([["persisted", "acknowledged"], ["rejected", "rejected_overload"]]), persisted: new Set(["persisted"]) };
  const missing = { ...accounting, persisted: new Set(), deliveries: new Map([["rejected", "rejected_overload"]]) };
  const rejection = {
    deliveries: { rejected: { status: "rejected_overload", depth: 1, capacity: 1 } }, callbacks: { rejected_overload: [[1, 1]] }, exchanges: [],
    trace: [{ sequence: 1, event_id: "rejected", kind: "rejected_overload", values: [1, 1] }, { sequence: 2, event_id: "rejected", kind: "result", status: "rejected_overload" }],
  };
  const late = { ...rejection, trace: [...rejection.trace].reverse().map((entry, index) => ({ ...entry, sequence: index + 1 })) };
  const checks = {
    ...retryControls(),
    omitted_admission_detected: !accountsForAdmitted({ report: { accepted: 1, completed: 0, abandoned: 1 }, phase }),
    uncounted_drop_detected: !dropsReported({ sender: uncounted, phase }),
    duplicate_drop_detected: !dropsReported({ sender: duplicate, phase }),
    silent_ceiling_detected: !ceilingSignalled({ sender: silentCeiling, phase }),
    late_ceiling_detected: !ceilingSignalled({ sender: lateCeiling, phase }),
    missing_occurrence_detected: !accountFor(missing).holds,
    deadline_overrun_detected: !withinDeadline({ sender: { shutdown_elapsed_ms: 200.001 }, phase }),
    late_rejection_alert_detected: !alertsBeforeLoss({ sender: late }),
    null_controls_hold: accountsForAdmitted({ report, phase }) && dropsReported({ sender, phase }) && ceilingSignalled({ sender, phase }) && accountFor(accounting).holds
      && withinDeadline({ sender: { shutdown_elapsed_ms: 200 }, phase }) && alertsBeforeLoss({ sender: rejection }),
  };
  return { ...checks, holds: Object.values(checks).every((value) => value === true) };
}
