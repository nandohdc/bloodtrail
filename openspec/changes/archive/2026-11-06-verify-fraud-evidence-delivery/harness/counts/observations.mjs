// Observations have no service levels. Empty acknowledgment samples are explicit nulls, never zeroes.
export const OBSERVATION_CONTRACT = Object.freeze({
  ingress_throughput: { measured_at: "collector", unit: "persisted_events_per_second", numerator: "distinct persisted event.id", window: "collector role initialization through final ingress quiescence" },
  delivery_latency: { measured_at: "sender", unit: "milliseconds", from: "SDK emit or redeliver call", to: "persisted acknowledgment", quantiles: ["p50", "p95", "maximum"], empty_samples: "null quantiles with samples = 0" },
  environment_fields: ["node", "platform", "cpu_count"],
});

export function latencyObservation(samples) {
  const ordered = [...samples].sort((left, right) => left - right);
  const percentile = (fraction) => ordered[Math.ceil(ordered.length * fraction) - 1];
  if (ordered.length === 0) return { samples: 0, p50_ms: null, p95_ms: null, maximum_ms: null };
  return { samples: ordered.length, p50_ms: percentile(0.5), p95_ms: percentile(0.95), maximum_ms: ordered.at(-1) };
}

export function isNonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function labelled(label) {
  if (!label) return false;
  const strings = [label.node, label.platform].every((value) => typeof value === "string");
  const count = Number.isSafeInteger(label.cpu_count) && label.cpu_count > 0;
  return strings && count;
}

function latencyShape(latency) {
  if (!latency) return false;
  if (!Number.isSafeInteger(latency.samples)) return false;
  if (latency.samples < 0) return false;
  const values = [latency.p50_ms, latency.p95_ms, latency.maximum_ms];
  if (latency.samples === 0) return values.every((value) => value === null);
  return values.every(isNonnegative);
}

export function observationsHold(observed) {
  if (!observed) return false;
  const ingress = observed.ingress.observation;
  const sender = observed.sender.observation;
  if (!ingress) return false;
  if (!sender) return false;
  const labels = [ingress.environment, sender.environment].every(labelled);
  const roles = ingress.measured_at === "collector" && sender.measured_at === "sender";
  const shapes = isNonnegative(ingress.persisted_events_per_second) && latencyShape(sender.delivery_latency);
  return [labels, roles, shapes].every(Boolean);
}
