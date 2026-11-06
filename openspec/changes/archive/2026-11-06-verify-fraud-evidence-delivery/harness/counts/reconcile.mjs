import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { CHAIN_METHODS, CHAIN_EVENTS } from "../chains/workload.mjs";
import { codePointCompare } from "./order.mjs";
import { category, signature, workloadFor } from "./workload.mjs";

const METHODS = new Map(CHAIN_EVENTS.map((name, index) => [name, CHAIN_METHODS[index]]));
METHODS.set("bloodtrail.audit.authentication.failed", "authenticationFailed");
const REPORTED = new Set(["exhausted", "non_retryable", "protocol_error", "rejected_overload", "rejected_shutting_down", "abandoned"]);

function bodySignature(body) {
  return JSON.stringify([METHODS.get(body.event.name), body.source.observed.address, body.event.timestamp, body.correlation?.retry_attempt ?? 0]);
}

function emissionsBySignature(observed) {
  const emissions = observed.sender.emissions;
  assert(Array.isArray(emissions), "missing emissions");
  emissions.forEach((entry) => assert.equal(typeof entry.result.ok, "boolean", "missing SDK result"));
  const ids = emissions.map((entry) => entry.event_id).filter((id) => typeof id === "string");
  assert.equal(new Set(ids).size, ids.length, "event.id reused across ground-truth occurrences");
  const bySignature = new Map(emissions.map((entry) => [entry.signature, entry]));
  assert.equal(bySignature.size, emissions.length, "repeated ground-truth occurrence");
  return bySignature;
}

function storedBySignature({ raw, emissions, truth }) {
  const stored = new Map();
  for (const body of raw) {
    const key = bodySignature(body);
    assert(truth.has(key), "persisted outside ground truth");
    assert.equal(emissions.get(key).event_id, body.event.id, "persisted id not emitted for occurrence");
    if (!stored.has(key)) stored.set(key, []);
    stored.get(key).push(body);
  }
  return stored;
}

function reasonFor(observed, emission) {
  const ownReports = observed.sender.delivery_reports.filter((report) => sameDelivery(report, emission));
  const failed = ownReports.find((report) => REPORTED.has(report.status));
  return failed?.status ?? null;
}

function sameDelivery(report, emission) {
  return report.event_id === emission.event_id && report.body_sha256 === emission.body_sha256;
}

function countStored(bodies, counter) {
  if (counter === "raw") return bodies.length;
  return new Set(bodies.map((body) => body.event.id)).size;
}

function classifyStep({ step, emission, bodies, context }) {
  const reason = reasonFor(context.observed, emission);
  const detail = { signature: signature(step), event_id: emission.event_id, source: step.identity.address, category: category(step.method), reason };
  if (bodies.length > 0) {
    if (reason) context.persisted_despite_failure_report.push(detail);
    return countStored(bodies, context.counter);
  }
  if (reason) {
    context.reported_undelivered.push(detail);
    return 1;
  }
  context.unexplained.push(detail);
  return 0;
}

function sortedDetails(details) {
  return [...details].sort((left, right) => codePointCompare(left.signature, right.signature));
}

function remainderByReason(details) {
  const sources = {};
  for (const detail of details) {
    if (!sources[detail.source]) sources[detail.source] = {};
    const reasons = sources[detail.source];
    if (!reasons[detail.reason]) reasons[detail.reason] = [];
    reasons[detail.reason].push(detail.event_id);
  }
  return sources;
}

export function reconcilePhase({ expectations, phase, observed, counter = "distinct" }) {
  const steps = workloadFor(expectations, phase).submissionSteps;
  const truth = new Map(steps.map((step) => [signature(step), step]));
  const emissions = emissionsBySignature(observed);
  assert.deepEqual([...emissions.keys()].sort(codePointCompare), [...truth.keys()].sort(codePointCompare));
  const raw = observed.ingress.raw_persisted_bodies;
  assert(Array.isArray(raw), "missing persisted storage observations");
  const stored = storedBySignature({ raw, emissions, truth });
  const counted = {};
  const context = { observed, counter, reported_undelivered: [], persisted_despite_failure_report: [], unexplained: [] };
  for (const step of steps) {
    const source = step.identity.address;
    if (!counted[source]) counted[source] = { successful: 0, failed: 0, other: 0 };
    const key = signature(step);
    const count = classifyStep({ step, emission: emissions.get(key), bodies: stored.get(key) ?? [], context });
    counted[source][category(step.method)] += count;
  }
  const frozen = expectations.ground_truth[phase.name];
  const categories = Object.fromEntries(["successful", "failed", "other"].map((kind) => [kind, categoryMatches({ counted, frozen, kind })]));
  return {
    ...categories, counts: counted, denominator: phase.occurrences,
    accounted: Object.values(counted).reduce((sum, row) => sum + row.successful + row.failed + row.other, 0),
    raw_persisted: raw.length, persisted_distinct: new Set(raw.map((body) => body.event.id)).size,
    reported_undelivered: sortedDetails(context.reported_undelivered),
    persisted_despite_failure_report: sortedDetails(context.persisted_despite_failure_report),
    unexplained: sortedDetails(context.unexplained), remainder: remainderByReason(context.reported_undelivered),
  };
}

function categoryMatches({ counted, frozen, kind }) {
  const select = (rows) => Object.fromEntries(Object.entries(rows).map(([source, counts]) => [source, counts[kind]]));
  return isDeepStrictEqual(select(counted), select(frozen));
}
