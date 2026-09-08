// Bounded operational counters for the ingress. Counters are plain increments
// keyed by a closed vocabulary; no label carries caller data, payload content,
// credentials, or any submission-derived material (F6 of the #107 plan).

export interface IngressMetrics {
  readonly accepted: number;
  readonly deduplicated: number;
  readonly rejectedAuthentication: number;
  readonly rejectedDeduplicationCapacity: number;
  readonly rejectedDuplicateConflict: number;
  readonly rejectedSize: number;
  readonly rejectedParse: number;
  readonly rejectedSchema: number;
  readonly rejectedVersion: number;
}

export type MetricKey = keyof IngressMetrics;

const METRIC_KEYS: readonly MetricKey[] = Object.freeze([
  "accepted",
  "deduplicated",
  "rejectedAuthentication",
  "rejectedDeduplicationCapacity",
  "rejectedDuplicateConflict",
  "rejectedSize",
  "rejectedParse",
  "rejectedSchema",
  "rejectedVersion",
]);

function zeroCounters(): Record<MetricKey, number> {
  const counters = {} as Record<MetricKey, number>;
  for (const key of METRIC_KEYS) {
    counters[key] = 0;
  }
  return counters;
}

export class MetricsRecorder {
  readonly #counters: Record<MetricKey, number> = zeroCounters();

  increment(key: MetricKey): void {
    this.#counters[key] += 1;
  }

  snapshot(): Readonly<IngressMetrics> {
    return { ...this.#counters };
  }
}
