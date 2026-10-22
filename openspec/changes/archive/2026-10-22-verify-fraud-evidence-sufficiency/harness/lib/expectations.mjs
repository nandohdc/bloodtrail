import assert from "node:assert/strict";
import { planBudget } from "./ledger.mjs";

const BASE = "101d083636044fe86cc019d1f1228f7feb021e39";
const CASE_KEYS = ["case_id", "setup", "expected", "basis", "classification", "confidence"];
const CORRECTED = [0, 1, 2, 3, 4, 5, 6, 8, 9, 11];

export function validateExpectations(value) {
  assert.equal(value.probe, "P-ids");
  assert.equal(value.version, 1);
  assert.equal(value.corrected_at, BASE);
  assert.equal(value.drafted_from.commit, "5d931ad");
  assert.equal(value.definitions.N, 100);
  assert.equal(value.definitions.M, 10);
  assert.equal(value.cases.length, 12);
  planBudget(value.planned_occurrence_budget);
  value.cases.forEach((entry, index) => {
    assert.equal(entry.case_id, `P-ids-${String(index).padStart(2, "0")}`);
    for (const key of CASE_KEYS) assert(Object.hasOwn(entry, key), `missing ${key}`);
    assert(entry.setup.length > 0 && entry.classification.length > 0 && entry.confidence.length > 0);
    assert.equal(typeof entry.expected, "object");
    assert(entry.basis.length > 0);
    for (const citation of entry.basis) assert.match(citation, /^packages\/.+:[0-9]+(?:[-,][0-9]+)*$/);
    if (CORRECTED.includes(index)) {
      assert(entry.corrected_from.old_text.length > 0);
      assert(entry.corrected_from.reason.length > 0);
    }
  });
  for (const id of ["P-ids-04", "P-ids-09", "P-ids-11"]) assert(value.owner_decisions[id].includes("owner decision, 2026-10-16"));
  assert.equal(value.cases[11].expected.execution, "not executed: Stage 2 (G22)");
  assert(!/\bU[0-8]\b/.test(JSON.stringify(value)), "obsolete fixed-seed predictions refused");
  return value;
}
