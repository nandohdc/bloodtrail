import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { honest } from "../p-attr/axes.mjs";
import { analyzeLinkage } from "../p-attr/linkage-analysis.mjs";
import { criterionCandidate, evaluateVerdict } from "../p-attr/verdict.mjs";
import { linkageFixture } from "./p-attr-request-fixtures.mjs";

// Same strict predicate, independently tabulated from G33 / #795 criterion 1
// and #802's consumer-disclosure correction. Source violations remain a
// separate verdict check, not part of this predicate.
const HONEST = { provenance_ambiguity: false, meaning_misuse: false, resource_rule: "conforms",
  discloses_existence: false, per_target_grouping: true };
const DISQUALIFIERS = [
  ["provenance_ambiguity", true], ["meaning_misuse", true], ["resource_rule", "circumvents"],
  ["resource_rule", "violates"], ["discloses_existence", true], ["discloses_existence", "n/a"],
  ["per_target_grouping", false], ["per_target_grouping", 1], ["provenance_ambiguity", 0],
];
function imports(url) {
  const text = readFileSync(url, "utf8");
  return [...text.matchAll(/(?:import|export)\s+[^;]*?from\s+["'](\.[^"']+)["']/g)].map((match) => new URL(match[1], url));
}
function closure(url, seen = new Set()) {
  if (seen.has(url.href)) return seen;
  seen.add(url.href);
  for (const child of imports(url)) closure(child, seen);
  return seen;
}

test("honest remains strict and does not absorb the separate allowed-source verdict", () => {
  assert.equal(honest(HONEST), true);
  assert.equal(honest({ ...HONEST, allowed_source_violations: ["actor.id"] }), true);
  assert.equal(honest({}), false);
});
for (const [field, value] of DISQUALIFIERS) {
  test(`honesty rejects ${field}=${JSON.stringify(value)} without changing the criterion predicate`, () => {
    const axes = { ...HONEST, [field]: value };
    assert.equal(honest(axes), false);
    const row = { from: "fixture", issues: [], ex: { accepted: 15, target_coverage: { fraction: 1 } },
      nx: { accepted: 15, target_coverage: { fraction: 1 } }, axes: Array.from({ length: 30 }, () => axes) };
    assert.equal(criterionCandidate(row).qualifies, false);
    row.axes = Array.from({ length: 30 }, () => ({ ...HONEST }));
    assert.equal(criterionCandidate(row).qualifies, true);
  });
}

test("both consumers import honesty from axes; linkage analysis cannot reach verdict", () => {
  const analysis = new URL("../p-attr/linkage-analysis.mjs", import.meta.url);
  const verdict = new URL("../p-attr/verdict.mjs", import.meta.url);
  for (const url of [analysis, verdict]) {
    assert.match(readFileSync(url, "utf8"), /import \{ honest \} from "\.\/axes\.mjs";/);
  }
  assert(!closure(analysis).has(verdict.href), "no direct or transitive linkage-analysis/verdict cycle");
});

test("unchanged offline linkage fixtures retain per-row honesty, axes and failed criterion verdict", async () => {
  const { records } = await linkageFixture();
  const linkage = analyzeLinkage({ records });
  const verdict = evaluateVerdict({ records });
  assert.equal(linkage.valid, true);
  assert.deepEqual(linkage.issues, []);
  assert.deepEqual(verdict.linkage, linkage);
  assert.equal(verdict.criterion_1.status, "failed");
  assert.deepEqual(verdict.criterion_1.qualifying, []);
  for (const row of [...linkage.L1, ...linkage.L2, ...linkage.L3]) {
    assert.equal(row.honesty.honest, row.axes.length > 0 && row.axes.every(honest));
  }
});
