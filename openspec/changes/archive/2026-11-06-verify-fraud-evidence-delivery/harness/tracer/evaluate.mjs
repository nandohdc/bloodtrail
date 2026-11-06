// Compares the tracer's raw observations with its frozen expectations. A mismatch is reported, never
// corrected: each case records what was expected, what was observed, and whether they are equal.
import { isDeepStrictEqual } from "node:util";
import { identities } from "../lib/accounting.mjs";
import { isolationControls } from "../lib/evaluation.mjs";

function storedCount(ingress) {
  return ingress.read_back.filter((entry) => entry.persisted).length;
}

function onlyDelivery(sender) {
  const [entry] = Object.values(sender.deliveries);
  return entry ?? { status: "missing", attempts: 0 };
}

function callbackCounts(callbacks) {
  return Object.fromEntries(Object.entries(callbacks).map(([name, calls]) => [name, calls.length]));
}

// Byte identity is claimed only when every boundary holds a copy: a boundary with no hash (for example
// nothing stored) would otherwise let the remaining boundaries agree vacuously.
function byteIdentical({ sender, ingress }) {
  const boundaries = [
    sender.exchanges.map((entry) => entry.body_sha256),
    ingress.records.map((entry) => entry.body_sha256),
    ingress.read_back.filter((entry) => entry.persisted).map((entry) => entry.stored_body_sha256),
  ];
  if (boundaries.some((hashes) => hashes.length === 0)) return false;
  return new Set(boundaries.flat()).size === 1;
}

const OBSERVERS = {
  "T-01": ({ sender }) => ({ calls: sender.calls.length, ok: sender.calls[0]?.ok === true, status: sender.calls[0]?.value?.status ?? null }),
  // The denominator is the frozen workload, not what reached the sink, so an occurrence lost before the
  // composition is counted as unexplained rather than vanishing from the identity.
  "T-02": ({ sender, ingress }, expectations) => {
    const { accounting, delays } = identities({ sender, ingress, planned: expectations.workload.occurrences });
    return {
      counts: accounting.counts, missing: accounting.missing, unexplained: accounting.unexplained, disagreements: accounting.disagreements,
      accounting_holds: accounting.holds, scheduled_delays: delays.scheduled, delay_identity_holds: delays.holds,
    };
  },
  "T-03": ({ sender }) => {
    const delivery = onlyDelivery(sender);
    return { delivery: delivery.status, attempts: delivery.attempts, exchange_attempts: sender.exchanges.map((entry) => entry.attempt), callbacks: callbackCounts(sender.callbacks) };
  },
  "T-04": ({ ingress }) => {
    const [record] = ingress.records;
    return {
      requests: ingress.records.length, occurrence: record?.occurrence ?? null, attempt: record?.attempt ?? null, action: record?.action ?? null,
      status: record?.status ?? null, outcome: record?.outcome?.kind ?? null, read_back_persisted: storedCount(ingress),
    };
  },
  "T-05": (observations) => ({ byte_identical: byteIdentical(observations) }),
  "T-06": ({ sender }) => ({ shutdown_report: sender.shutdown_report }),
  "T-07": isolationControls,
};

export function evaluateCases({ observations, expectations }) {
  const evaluations = expectations.cases.map((entry) => {
    const observed = observations === null ? null : OBSERVERS[entry.case_id](observations, expectations);
    return { case_id: entry.case_id, expected: entry.expected, observed, matched: isDeepStrictEqual(observed, entry.expected) };
  });
  const matched = evaluations.filter((entry) => entry.matched).length;
  return { evaluations, verdict: { matched, mismatched: evaluations.length - matched } };
}
