import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateExpectations } from "../p-attr/expectations-validate.mjs";
import { compareLinkageExpectations } from "../p-attr/linkage-expectations.mjs";

const FROZEN = JSON.parse(readFileSync(new URL("../expectations/p-attr.v1.json", import.meta.url), "utf8"));
const STAGES = ["L1", "L2", "L3"];
const MALFORMED = [
  ["declared_pair", undefined], ["declared_pair", false], ["declared_pair", []],
  ["declared_pair", {}], ["declared_pair", { from_family: "AF", from: "actor.id", to_family: "AS" }],
  ["declared_pair", { from_family: "AF", from: 7, to_family: "AS", to: "actor.id" }],
  ["honesty", undefined], ["honesty", null], ["honesty", []], ["honesty", {}],
  ["honesty", { honest: "false", reason: "fixture" }],
  ["honesty", { honest: false, reason: 7 }], ["honesty", { honest: false, reason: "" }],
];
const PAIR = { from_family: "AF", from: "actor.id", to_family: "AS", to: "actor.id" };

// Independent public row shapes: metrics and honesty are aggregates, not
// generated observations or per-run identities. Source: linkage-expectations
// declaredPairIssues/honestyIssues; expectations-validate validateLinkageRow.
function target() {
  return { attempts: 1, accepted: 1, target_coverage: { numerator: 0, denominator: 1 },
    linkage: { numerator: 0, denominator: 1 }, groups: [] };
}
function plannedRow(from) {
  return { from, to: "AS-B/main", ex: target(), nx: target(), declared_pair: PAIR,
    honesty: { honest: false, reason: "independent fixture" } };
}
function observedRow(planned, joined) {
  return { ...structuredClone(planned), declared_pair: joined ? [PAIR] : [] };
}
function malformed(row, field, value) {
  if (value === undefined) delete row[field];
  else row[field] = structuredClone(value);
}

for (const [field, value] of MALFORMED) {
  for (const stage of STAGES) {
    test(`${stage} intentionally rejects ${field}=${JSON.stringify(value)} on every row`, () => {
      for (let index = 0; index < FROZEN.linkage_expectations[stage].length; index += 1) {
        const expectations = structuredClone(FROZEN);
        malformed(expectations.linkage_expectations[stage][index], field, value);
        assert.throws(() => validateExpectations(expectations), {
          code: "ERR_ASSERTION", message: new RegExp(`malformed linkage row:.*${field}`),
        });
      }
    });
  }
  test(`direct comparison contains malformed ${field}=${JSON.stringify(value)}`, () => {
    for (const joined of [false, true]) {
      const row = plannedRow("AF-C1/main");
      const other = plannedRow("AF-C4/main");
      const linkage = { L1: [observedRow(row, joined), observedRow(other, joined)] };
      malformed(row, field, value);
      const result = compareLinkageExpectations({ linkage, expectations: { L1: [row, other] } });
      assert.equal(result.rows[0].matched, false);
      assert(result.rows[0].issues.some((issue) => issue.includes(field)));
      assert.equal(result.rows[1].matched, true, "unrelated row remains conclusive");
    }
  });
}

test("explicit null pair and shaped honesty remain valid without a join", () => {
  const row = plannedRow("AF-B/main");
  row.declared_pair = null;
  const result = compareLinkageExpectations({ linkage: { L1: [observedRow(row, false)] }, expectations: { L1: [row] } });
  assert.equal(result.rows[0].matched, true);
  assert.equal(validateExpectations(FROZEN), FROZEN);
});
