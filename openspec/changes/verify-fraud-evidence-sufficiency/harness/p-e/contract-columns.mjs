// Pinned contract.source.json:595-604, transcribed as analytical claims only.
// No contract/policy file reads in the child and no production verdict.
export const TRANSACTION_ROW = Object.freeze({
  semantic: "Audit durability atomic with successful business commit; downstream at-least-once.",
  durability: "transactional outbox or equivalent behavior, product not selected",
  idempotency: "dedupe by event id and transaction id",
  retry: "persistent retry after commit",
  backpressure: "commit gate before durability point; backlog alert after commit",
  shutdown: "durable handoff required",
  outage: "defer downstream delivery from durable record",
  business_failure_posture: "fail_closed before business commit if audit durability cannot be reached",
});

export function judgment(classification, reason) {
  return { classification, reason };
}

export function contractColumns(overrides = {}) {
  return Object.fromEntries(Object.entries(TRANSACTION_ROW).map(([column, claim]) => [column,
    { claim, ...judgment("vacuous", "This isolated step does not establish or refute this obligation."), ...overrides[column] }]));
}

// Every planned step gets all eight columns, including missing observations.
// Inconclusiveness is row-local; it never removes a peer row's comparison.
export function tabulateSteps({ rows, records, comparisons = [] }) {
  return rows.flatMap((row) => row.steps.map((step) => {
    const stepId = `${row.case_id}/${step}`;
    const matches = records.filter((record) => record.step_id === stepId);
    const related = comparisons.filter((comparison) => comparison.step_id === stepId);
    const overrides = Object.assign({}, ...related.map((comparison) => comparison.columns));
    return { case_id: row.case_id, step_id: stepId,
      issues: matches.length === 1 ? [] : ["missing/duplicate planned step"], columns: contractColumns(overrides) };
  }));
}
