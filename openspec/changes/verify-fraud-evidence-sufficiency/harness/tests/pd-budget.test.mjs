import assert from "node:assert/strict";
import { test } from "node:test";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { runSession } from "../lib/orchestrate.mjs";
import { createState } from "../p-d/runtime.mjs";
import { measure } from "../p-d/workload.mjs";
import { CASES, PLANNED_TOTAL } from "../p-d/cases.mjs";
import { evaluateCases } from "../p-d/evaluate.mjs";
import { validateExpectations } from "../p-d/expectations.mjs";
import { EXPECTATIONS } from "./pd-fixtures.mjs";
import { publicDoubles } from "./pd-public-doubles.mjs";

const CHANGED_BUDGETS = [
  ["prediction", (budget) => { budget.predicted_total += 1; }],
  ["case prediction", (budget) => { budget.calls_by_case["PD-A1"] += 1; }],
  ["allowance", (budget) => { budget.processes.integrity = budget.total = 371; }],
];
for (const [label, patch] of CHANGED_BUDGETS) {
  test(`P-D validator independently checks ${label}`, () => {
    const expected = structuredClone(EXPECTATIONS);
    patch(expected.planned_occurrence_budget);
    assert.throws(() => validateExpectations(expected));
  });
}

test("one extra counted public-shape call is a mismatch note, not a run invalidation", async () => {
  const doubles = publicDoubles();
  const state = createState({ ...doubles, ledger: occurrenceLedger({ budget: 742 }) });
  doubles.attach(state);
  const cases = CASES.map((entry) => ({ ...entry, run: async (s, target) => {
    await entry.run(s, target);
    if (entry.case_id === "PD-A1") s.c("anonymousActor");
  } }));
  const observed = await measure({ state, cases });
  assert.equal(observed.ledger.occurrence_count, PLANNED_TOTAL + 1);
  assert.equal(observed.ledger.exhausted, false);
  assert.deepEqual(observed.invalidations, []);
  let evaluated;
  const session = await runSession({ probe: "P-D", ticket: 801, roles: [{ role: "integrity" }], expectations: EXPECTATIONS,
    pipeline: async (consume) => ({ invalidations: [], observations: await consume({}) }),
    prepare: () => () => observed,
    write: ({ observations, invalidations }) => {
      assert.deepEqual(invalidations, []);
      evaluated = evaluateCases({ observations, expectations: EXPECTATIONS });
    },
  });
  assert.equal(session.exitCode, 0);
  const result = evaluated.find((entry) => entry.case_id === "PD-A1");
  assert.equal(result.matched, false);
  assert.deepEqual(result.calls, { predicted: 5, observed: 6 });
  assert(result.notes.some((note) => note.includes("calls: observed 6; predicted 5")));
});
