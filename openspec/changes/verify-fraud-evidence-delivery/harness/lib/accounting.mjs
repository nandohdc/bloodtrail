// The accounting identity (criterion 5): every generated occurrence ends in exactly one terminal bucket,
// and the unexplained bucket is empty. Buckets are assigned in a fixed priority order, so an occurrence
// that is persisted AND reported undelivered (a lost acknowledgment that exhausted retries) counts once,
// as persisted, and the disagreement is kept as an observation rather than hidden.
import assert from "node:assert/strict";

export const BUCKETS = Object.freeze(["persisted", "reported_undelivered", "admission_signal", "abandoned", "unexplained"]);

const UNDELIVERED = new Set(["non_retryable", "protocol_error", "exhausted"]);
const ADMISSION = new Set(["rejected_overload", "rejected_shutting_down"]);

export function bucketFor({ persisted, delivery }) {
  if (persisted) return "persisted";
  if (UNDELIVERED.has(delivery)) return "reported_undelivered";
  if (ADMISSION.has(delivery)) return "admission_signal";
  if (delivery === "abandoned") return "abandoned";
  return "unexplained";
}

function emptyCounts() {
  return Object.fromEntries(BUCKETS.map((bucket) => [bucket, 0]));
}

// planned: the occurrences the frozen workload plans, which is the denominator; generated: event ids that
// reached the composition, in workload order; deliveries: Map event id -> delivery status reported to the
// sender; persisted: Set of event ids read back from the collector's storage. A planned occurrence that
// never reached the composition (refused or dropped before the sink) has no event id and is unexplained.
export function accountFor({ planned, generated, deliveries, persisted }) {
  assert(Number.isSafeInteger(planned) && planned > 0, "planned occurrences must be a positive integer");
  assert.equal(new Set(generated).size, generated.length, "generated occurrences must have distinct event ids");
  const counts = emptyCounts();
  const unexplained = [];
  const disagreements = [];
  for (const eventId of generated) {
    const delivery = deliveries.get(eventId);
    const bucket = bucketFor({ persisted: persisted.has(eventId), delivery });
    counts[bucket] += 1;
    if (bucket === "unexplained") unexplained.push(eventId);
    if (bucket === "persisted" && delivery !== "acknowledged") disagreements.push({ event_id: eventId, delivery });
  }
  const missing = Math.max(0, planned - generated.length);
  counts.unexplained += missing;
  const total = BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0);
  return { denominator: planned, counts, total, missing, unexplained, disagreements, holds: total === planned && counts.unexplained === 0 };
}

// The status each occurrence's delivery reported to the sender, by event id.
export function deliveryStatuses(sender) {
  return new Map(Object.entries(sender.deliveries).map(([eventId, delivery]) => [eventId, delivery.status]));
}

// An occurrence counts as persisted only when storage holds a copy with bytes the sender sent for that
// event id. A conflicting copy (another tenant scope, other bytes) stored under the same id does not
// explain the sender's occurrence.
export function persistedCopies({ sender, ingress }) {
  const sent = new Set(sender.exchanges.map((entry) => `${entry.event_id}\n${entry.body_sha256}`));
  return new Set(ingress.read_back.filter((entry) => entry.persisted && sent.has(`${entry.event_id}\n${entry.stored_body_sha256}`)).map((entry) => entry.event_id));
}

// One pass's accounting inputs: the planned occurrences are the denominator, whatever reached the sink.
export function accountingInputs({ sender, ingress, planned }) {
  return { planned, generated: Object.keys(sender.deliveries), deliveries: deliveryStatuses(sender), persisted: persistedCopies({ sender, ingress }) };
}

// Both identities over one pass's observations: the accounting identity and the delay identity.
export function identities({ sender, ingress, planned }) {
  return {
    accounting: accountFor(accountingInputs({ sender, ingress, planned })),
    delays: delayIdentity({ scheduledDelays: sender.callbacks.scheduled.length, exchangeAttempts: sender.exchanges.map((entry) => entry.attempt) }),
  };
}

// The planted-defect control on live observations: a harness path that drops the first occurrence's
// result and stored copy must break the identity, and its null control, the same inputs untouched, must not.
export function droppedOccurrenceControl(inputs) {
  const [dropped] = inputs.generated;
  const deliveries = new Map(inputs.deliveries);
  const persisted = new Set(inputs.persisted);
  deliveries.delete(dropped);
  persisted.delete(dropped);
  const planted = accountFor({ ...inputs, deliveries, persisted });
  return { planted_breaks_identity: !planted.holds, planted_unexplained: planted.counts.unexplained, null_control_holds: accountFor(inputs).holds };
}

// Every scheduled retry delay is reported: the onAttemptScheduled count equals the retry attempts the
// exchange saw (every attempt ordinal after 0). Counting at the exchange keeps the attempts of repeat
// deliveries and of deliveries that threw or were abandoned. A retry scheduled but never sent (a shutdown
// while it waited) breaks the identity, and the probe that plans one must explain it.
export function delayIdentity({ scheduledDelays, exchangeAttempts }) {
  const expected = exchangeAttempts.filter((attempt) => attempt > 0).length;
  return { scheduled: scheduledDelays, expected, holds: scheduledDelays === expected };
}
