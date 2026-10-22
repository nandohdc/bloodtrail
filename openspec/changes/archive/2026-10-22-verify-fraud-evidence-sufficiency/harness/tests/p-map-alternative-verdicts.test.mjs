import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { evaluationFixture } from "./p-map-evaluation-fixtures.mjs";
import { ALTERNATIVE_ORACLE } from "./p-map-evaluation-oracle.mjs";

const fixture = await evaluationFixture();
const CASES = [{ id: "K2a", signal: "S-LOCK" }, { id: "R2", signal: "S-ROTATE" }];

for (const { id, signal } of CASES) {
  test(`P-map ${id} case, signal and criterion report both conditional owner-review readings`, () => {
    const result = evaluateProbe(fixture);
    const row = result.evaluations.find((entry) => entry.case_id === id);
    assert.equal(row.owner_review_required, true);
    assert.equal(row.default_verdict, "STRAINED");
    assert(row.default_condition.length > 0);
    assert.deepEqual(row.alternative_verdict, ALTERNATIVE_ORACLE[id]);
    const aggregate = result.verdicts.find((entry) => entry.case_id === signal);
    assert.equal(aggregate.owner_review_required, true);
    const alternative = aggregate.alternative_verdicts.find((reading) => reading.case_id === id);
    assert.equal(alternative.verdict, "MISREPRESENTS");
    assert.equal(alternative.condition, ALTERNATIVE_ORACLE[id].condition);
    assert.equal(alternative.default_verdict, "STRAINED");
    const criterion = result.verdicts.find((entry) => entry.case_id === "S-CRIT2");
    const consequence = criterion.alternative_verdicts.find((reading) => reading.case_id === id);
    assert.equal(consequence.criterion_2, "FAIL");
    assert.deepEqual(consequence.misfits, [signal]);
  });

  test(`P-map ${id} alternative reading changes the measured best candidate and fails criterion 2`, () => {
    const result = evaluateProbe({ ...fixture, readings: { [id]: "alternative" } });
    const aggregate = result.verdicts.find((entry) => entry.case_id === signal);
    assert.equal(aggregate.verdict, "MISREPRESENTS");
    assert.equal(aggregate.catalog_addition_nominated, true);
    assert(aggregate.rubric_reasons.includes(ALTERNATIVE_ORACLE[id].condition));
    assert.match(aggregate.rubric_clause, /trust\/authority/);
    const criterion = result.verdicts.find((entry) => entry.case_id === "S-CRIT2");
    assert.equal(criterion.verdict, "FAIL");
    assert.deepEqual(criterion.misfits, [signal]);
    assert.equal(result.evaluations.find((entry) => entry.case_id === id).matched, true);
  });
}

test("P-map both owner alternatives name both misfits without substituting API/factor rotation", () => {
  const result = evaluateProbe({ ...fixture, readings: { K2a: "alternative", R2: "alternative" } });
  const criterion = result.verdicts.find((entry) => entry.case_id === "S-CRIT2");
  assert.deepEqual(criterion.misfits, ["S-LOCK", "S-ROTATE"]);
  const rotation = result.verdicts.find((entry) => entry.case_id === "S-ROTATE");
  assert.deepEqual(rotation.components.map((part) => part.verdict), ["MISREPRESENTS", "STRAINED", "FITS"]);
});
