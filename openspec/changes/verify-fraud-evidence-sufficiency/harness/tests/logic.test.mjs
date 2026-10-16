import assert from "node:assert/strict";
import test from "node:test";
import { compareIds, distinctIds } from "../lib/metrics.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { jsonFile } from "../lib/io.mjs";
import { validateExpectations } from "../lib/expectations.mjs";
import { ROLES } from "../p-ids/roles.mjs";

const EXPECTATIONS = new URL("../expectations/p-ids.v1.json", import.meta.url);
const BAD_PLANS = [
  { processes: { a: 5001 }, total: 5001 },
  { processes: { a: 3000, b: 2001 }, total: 5001 },
  { processes: { a: 2 }, total: 1 },
  { processes: { a: -1 }, total: -1 },
];

test("metrics distinguish positional equality, set intersection and pooled distinctness", () => {
  assert.deepEqual(compareIds({ left: ["a", "b", "a"], right: ["b", "a", "a"] }), { positional_equality: 1, intersection: 2 });
  assert.deepEqual(compareIds({ left: [], right: ["a"] }), { positional_equality: 0, intersection: 0 });
  assert.deepEqual(distinctIds({ arrays: [["a", "b"], ["a"]] }), { count: 3, distinct: 2, all_distinct: false });
});

test("budget counts every accepted/refused call and refuses before the next invocation", () => {
  const ledger = occurrenceLedger({ budget: 2 });
  ledger.take("factory.accepted");
  ledger.take("method.refused");
  assert.throws(() => ledger.take("provider.extra"), /exhausted/);
  assert.equal(ledger.report().occurrence_count, 2);
  for (const plan of BAD_PLANS) assert.throws(() => planBudget(plan));
});

test("frozen expectations have twelve ordered cases, corrections, owner decisions and reproducible budgets", () => {
  const value = validateExpectations(jsonFile(EXPECTATIONS));
  assert.equal(planBudget(value.planned_occurrence_budget).total, 1393);
  assert.deepEqual(Object.keys(value.planned_occurrence_budget.processes), ROLES.map((role) => role.role));
  const missingCorrection = structuredClone(value);
  delete missingCorrection.cases[1].corrected_from;
  assert.throws(() => validateExpectations(missingCorrection));
  const duplicateCase = structuredClone(value);
  duplicateCase.cases[2].case_id = duplicateCase.cases[1].case_id;
  assert.throws(() => validateExpectations(duplicateCase));
});
