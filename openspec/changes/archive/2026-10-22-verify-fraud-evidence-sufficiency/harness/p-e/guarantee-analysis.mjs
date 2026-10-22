import { judgment } from "./contract-columns.mjs";

// Parent-only row-local comparisons. These are bounded evidence statements,
// not production verdicts; source basis delivery-classes.ts:258-286,342-356.
const COMPARISONS = [
  { step_id: "P-E-2b/deliver", assess: beforeCommit },
  { step_id: "P-E-5/quiet", assess: callerRetry },
  { step_id: "P-E-7/b2-deliver", assess: freshInstance },
  { step_id: "P-E-8/deliver", assess: afterGateFailure },
  { step_id: "P-E-g/read", assess: publicSurfaces },
];

function beforeCommit(record, row) {
  const before = row.order.positions;
  return { facts: { failed_without_gate: record.raw.commitGateInvoked === false,
    business_already_committed: row.actual.business_commits === 1,
    commit_precedes_probe: before.commit >= 0 && before.commit < before.probe },
  columns: { business_failure_posture: judgment("vacuous", "Truthful order already committed before the probe-false refusal."),
    semantic: judgment("not provided", "Refusing after commit establishes no atomicity."),
    durability: judgment("not provided", "No audit durability attempt was made for the committed business row.") } };
}

function callerRetry(record, row) {
  return { facts: { quiet_no_attempt: record.counters.exchange === 0,
    one_observed_turn: record.raw.macrotask_turns === 1,
    four_caller_attempts: row.actual.exchange === 4 },
  columns: { retry: judgment("not provided", "Bounded quiet observation plus source inspection: no retry scheduler; caller retries run the pipeline again."),
    semantic: judgment("not provided", "claimsAtLeastOnce is not supplied by the binding alone."),
    outage: judgment("not provided", "The binding retains no durable record for downstream deferral.") } };
}

function freshInstance(record) {
  return { facts: { second_instance_succeeded: record.raw.status === "committed_and_durable",
    same_occurrence_twice: record.cross_instance.same_event_id,
    same_bytes_twice: record.cross_instance.identical_body_sha256,
    two_attempts: record.cross_instance.count === 2 },
  columns: { idempotency: judgment("not provided", "Pair-key dedupe is in-memory per instance, not across restarts."),
    semantic: judgment("SDK cannot detect", "Downstream deduplication/durability is outside this binding.") } };
}

function afterGateFailure(record) {
  return { facts: { failed_closed: record.raw.status === "failed_closed",
    gate_ran: record.raw.commitGateInvoked === true,
    durability_attempted: record.raw.durabilityAttempted === true,
    permanent_response: record.exchange_attempts[0].outcome.raw.status === 422 },
  columns: { business_failure_posture: judgment("misrepresents", "failsClosedBeforeCommit does not describe this failed_closed result after the commit gate ran."),
    semantic: judgment("not provided", "No acknowledgment after the commit; the declaration alone supplies no delivery guarantee."),
    retry: judgment("not provided", "Permanent and retryable failures collapse to the same binding code.") } };
}

function publicSurfaces(record) {
  const keys = record.raw.public_keys;
  return { facts: { only_guarantees_and_deliver: JSON.stringify(keys) === '["guarantees","deliver"]',
    frozen_guarantees: record.raw.guarantees_frozen === true },
  columns: { shutdown: judgment("not provided", "No shutdown/flush surface or durable backlog on this binding."),
    backpressure: judgment("not provided", "Gate ordering exists, but no backlog alert after commit is exposed.") } };
}

function unique(rows, predicate, label) {
  const matches = rows.filter(predicate);
  if (matches.length !== 1) throw new Error(`missing/duplicate ${label}`);
  return matches[0];
}

function compare(rule, { records, rows }) {
  try {
    const record = unique(records, (entry) => entry.step_id === rule.step_id, "comparison step");
    const row = unique(rows, (entry) => rule.step_id.startsWith(`${entry.case_id}/`), "comparison row");
    const assessed = rule.assess(record, row);
    const issues = Object.entries(assessed.facts).filter(([, value]) => value !== true).map(([name]) => `unsupported comparison fact: ${name}`);
    const columns = issues.length === 0 ? assessed.columns : inconclusiveColumns(assessed.columns);
    return { step_id: rule.step_id, ...assessed, columns, status: issues.length === 0 ? "observed" : "inconclusive", issues };
  } catch (error) {
    return { step_id: rule.step_id, status: "inconclusive", facts: {}, columns: {}, issues: [error.message] };
  }
}

function inconclusiveColumns(columns) {
  return Object.fromEntries(Object.keys(columns).map((column) => [column,
    judgment("SDK cannot detect", "The row-local comparison lacks its required observation facts.")]));
}

export function compareGuarantees(input) {
  return COMPARISONS.map((rule) => compare(rule, input));
}
