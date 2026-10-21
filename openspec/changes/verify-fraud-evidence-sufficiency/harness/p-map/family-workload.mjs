import { runCase } from "./case-steps.mjs";

async function variantStep(state, { entry, id, work, rows }) {
  const plan = entry.variants.find((candidate) => candidate.id === id);
  const before = state.ledger.report().occurrence_count;
  const start = state.records.length;
  try { return await work(); }
  finally {
    rows.push({ variant_id: id, predicted_calls: plan.predicted_calls,
      public_calls: state.ledger.report().occurrence_count - before,
      steps: state.records.slice(start).map((record) => record.step_id) });
  }
}

async function plannedCase(state, { entry, runner }) {
  const rows = [];
  const variant = (id, work) => variantStep(state, { entry, id, work, rows });
  try {
    await runCase(state, entry, () => {
      if (entry.variants.length === 1) return variant(entry.variants[0].id, () => runner(state));
      return runner(state, variant);
    });
  } finally {
    // runCase always appends the owning accounting row, even on exhaustion.
    state.accounting.at(-1).variants = rows;
  }
}

export async function familyWorkload(state, { cases, runners }) {
  for (const entry of cases) await plannedCase(state, { entry, runner: runners[entry.case_id] });
}
