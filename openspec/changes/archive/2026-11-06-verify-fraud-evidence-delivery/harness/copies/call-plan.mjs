// Pure workload call plan per phase for the Stage 2 copies probe (#839).
// Defines the ordered steps the sender executes and bounds planned call budget.

function identitiesPlan() {
  return [
    { label: "clean_submission", step: "new", identity: 0 },
    { label: "duplicate_submission", step: "duplicate", identity: 0 },
    { label: "conflict_submission", step: "conflict", identity: 0 },
    { label: "re_execution_submission", step: "re_execution", identity: 0 },
    { label: "retry_redelivery_submission", step: "retry_target", identity: 2 },
  ];
}

function collectorRestartPlan() {
  return [
    { label: "before_restart_submission", step: "new", identity: 0 },
    { step: "ingress_restart" },
    { label: "duplicate_across_restart_submission", step: "duplicate", identity: 0 },
    { label: "fresh_after_restart_submission", step: "new", identity: 1 },
  ];
}

function consumerRestartPlan(phase) {
  const count = phase.occurrences;
  const initial = [];
  for (let i = 0; i < count; i += 1) {
    const isRetry = Array.isArray(phase.schedule) && phase.schedule[i] === "retry_once";
    initial.push({
      label: `consumer_restart_call_${i}`,
      step: isRetry ? "retry_target" : "new",
      identity: i,
    });
  }
  const redeliveries = [];
  for (let i = 0; i < count; i += 1) {
    redeliveries.push({
      label: `consumer_restart_redelivery_${i}`,
      step: "redelivery",
      identity: i,
    });
  }
  return [...initial, ...redeliveries];
}

function storageLessPlan(phase) {
  const steps = [];
  for (let i = 0; i < phase.occurrences; i += 1) {
    steps.push({
      label: `storage_less_call_${i}`,
      step: "new",
      identity: i,
    });
  }
  return steps;
}

function duplicatesVolumePlan(phase) {
  const count = phase.occurrences;
  const initial = [];
  for (let i = 0; i < count; i += 1) {
    initial.push({
      label: `vol_first_${i}`,
      step: "new",
      identity: i,
    });
  }
  const duplicates = [];
  for (let i = 0; i < count; i += 1) {
    duplicates.push({
      label: `vol_duplicate_${i}`,
      step: "duplicate",
      identity: i,
    });
  }
  return [...initial, ...duplicates];
}

export function phaseCallPlan(phase) {
  if (phase.kind === "identities") return identitiesPlan();
  if (phase.kind === "collector_restart") return collectorRestartPlan();
  if (phase.kind === "consumer_restart") return consumerRestartPlan(phase);
  if (phase.kind === "storage_less") return storageLessPlan(phase);
  if (phase.kind === "duplicates_volume") return duplicatesVolumePlan(phase);
  throw new Error(`unknown phase kind: ${phase.kind}`);
}
