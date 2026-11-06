// Pure workload call plan per phase for the Stage 2 outbox probe (#842, Q245, Q247, Q252).
// Defines the ordered steps the sender executes and bounds the planned call budget.

export const TRANSACTION_METHODS = Object.freeze([
  "roleAssigned",
  "sensitiveResourceModified",
]);

export function methodForIndex(index) {
  return TRANSACTION_METHODS[index % TRANSACTION_METHODS.length];
}

function pushHostChangeSteps(steps, { phaseName, count }) {
  let callIndex = steps.length;
  for (let i = 0; i < count; i += 1) {
    const method = methodForIndex(i);
    steps.push({
      label: `${phaseName}_call_${callIndex}`,
      step: "begin_operation",
      index: i,
      method,
    });
    steps.push({
      label: `${phaseName}_call_${callIndex + 1}`,
      step: "mark_committed",
      index: i,
      method,
    });
    steps.push({
      label: `${phaseName}_call_${callIndex + 2}`,
      step: "emit",
      index: i,
      method,
    });
    callIndex += 3;
  }
}

function pushRelaySteps(steps, {
  phaseName,
  count,
  start = 0,
  step = "relay_deliver",
  firstStep = step,
}) {
  let callIndex = steps.length;
  for (let i = start; i < count; i += 1) {
    steps.push({
      label: `${phaseName}_call_${callIndex}`,
      step: i === start ? firstStep : step,
      index: i,
      method: methodForIndex(i),
    });
    callIndex += 1;
  }
}

export function controlCallPlan(phase, planted) {
  const steps = [];
  const phaseName = `${phase.name}_control_${planted}`;
  pushHostChangeSteps(steps, { phaseName, count: phase.change_count });
  pushRelaySteps(steps, { phaseName, count: phase.change_count + (planted ? -1 : 1) });
  return steps;
}

export function phaseCallPlan(phase) {
  const steps = [];
  const count = phase.change_count;
  pushHostChangeSteps(steps, { phaseName: phase.name, count });

  if (phase.kind === "commit_relay") {
    pushRelaySteps(steps, { phaseName: phase.name, count });
  } else if (phase.kind === "crash_restart") {
    const crashAfter = phase.crash_after_acknowledgment;
    pushRelaySteps(steps, {
      phaseName: phase.name,
      count: crashAfter,
      step: "relay_deliver_before_crash",
    });
    pushRelaySteps(steps, {
      phaseName: phase.name,
      count,
      start: crashAfter - 1,
      step: "relay_deliver_after_crash",
      firstStep: "relay_deliver_redelivery",
    });
    steps.unshift(...controlCallPlan(phase, true), ...controlCallPlan(phase, false));
  } else if (phase.kind === "outage_defer") {
    pushRelaySteps(steps, { phaseName: phase.name, count, step: "relay_deliver_outage" });
    pushRelaySteps(steps, { phaseName: phase.name, count, step: "relay_deliver_recovered" });
  }
  return steps;
}
