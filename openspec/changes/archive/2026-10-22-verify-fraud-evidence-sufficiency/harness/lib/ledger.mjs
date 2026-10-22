import assert from "node:assert/strict";

export function planBudget({ processes, total, limit = 5000 }) {
  const budgets = Object.values(processes);
  for (const value of budgets) assert(Number.isSafeInteger(value) && value > 0, "invalid process budget");
  const sum = budgets.reduce((left, right) => left + right, 0);
  assert.equal(sum, total, "planned total must be mechanically summed");
  assert(sum <= limit && limit <= 5000, "authorization cap exceeded");
  return { processes, total: sum, limit };
}

export function occurrenceLedger({ budget }) {
  assert(Number.isSafeInteger(budget) && budget > 0 && budget <= 5000, "invalid local budget");
  const calls = [];
  let exhausted = false;
  return {
    assertAvailable() {
      assert(!exhausted, "process occurrence budget exhausted in provider callback");
    },
    take(label) {
      if (calls.length >= budget) exhausted = true;
      assert(!exhausted, `process occurrence budget exhausted: ${budget}`);
      calls.push({ ordinal: calls.length + 1, label });
    },
    report() {
      return { budget, exhausted, occurrence_count: calls.length, calls: [...calls] };
    },
  };
}
