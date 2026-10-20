import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecord, byIdMap } from "../p-attr/observations.mjs";
import { analyzeLinkage } from "../p-attr/linkage-analysis.mjs";
import { evaluateVerdict } from "../p-attr/verdict.mjs";
import { capture, observation } from "./p-attr-analysis-fixtures.mjs";
import { linkageFixture, linkedRecord, rowAt } from "./p-attr-request-fixtures.mjs";

const MODES = ["uncached", "caller-cache"];
const PEER = "L1/AF-C5/main/nx-0001-1";
const OWNER = "L1/AF-C5/main/ex-0001-1";
const MUTATIONS = [
  ["duplicate", (records) => records.push(structuredClone(linkedRecord(records, PEER)))],
  ["slot-invalid", (records) => { linkedRecord(records, PEER).account = "acct-9999"; }],
];
const state = await linkageFixture();

// Implementer default: duplicate identifiers never resolve, including a third
// duplicate. Source: observations disclosureFor and linkage slotIssues.
for (const mode of MODES) {
  test(`duplicate peer is unavailable on ${mode} observation path`, () => {
    const record = observation({ id: "AF-C5", event: capture("AF") });
    const peer = observation({ id: "AF-B", event: capture("AF") });
    record.existence_peer = peer.step_id;
    const records = [record, peer, structuredClone(peer), structuredClone(peer)];
    const byId = mode === "caller-cache" ? byIdMap(records) : undefined;
    const result = analyzeRecord({ record, records, byId });
    assert.equal(result.axes.discloses_existence, "n/a");
    assert(result.issues.some((issue) => issue.includes("missing/duplicate existence peer")));
    assert.equal(byIdMap(records).has(peer.step_id), false);
  });
  for (const [label, mutate] of MUTATIONS) {
    test(`${label} linkage peer is unavailable on ${mode} path`, () => {
      const records = structuredClone(state.records);
      const owner = linkedRecord(records, OWNER);
      const byId = byIdMap(records);
      const analyses = new Map([[owner, analyzeRecord({ record: owner, records, byId })]]);
      assert.equal(analyses.get(owner).axes.discloses_existence, true);
      mutate(records);
      const options = mode === "caller-cache" ? { byId, analyses } : {};
      const result = analyzeLinkage({ records, ...options });
      const row = rowAt(result.L1, "AF-C5/main");
      assert.equal(result.valid, false);
      assert(row.issues.some((issue) => issue.includes(`${OWNER}: missing/duplicate existence peer ${PEER}`)));
      assert(row.axes.some((axes) => axes.discloses_existence === "n/a"));
      if (mode === "caller-cache") assert.equal(analyses.get(owner).axes.discloses_existence, "n/a");
      assert.deepEqual(rowAt(result.L1, "AF-C1/main").issues, []);
      const verdict = evaluateVerdict({ records, ...options });
      assert.equal(verdict.criterion_1.status, "failed", "an independently dishonest row cannot erase other conclusive failures");
    });
  }
}

test("valid linkage peers retain their source-derived disclosure", () => {
  const result = analyzeLinkage({ records: state.records });
  assert.equal(result.valid, true);
  const row = rowAt(result.L1, "AF-C5/main");
  assert.deepEqual(row.issues, []);
  assert(row.axes.every((axes) => axes.discloses_existence === true));
});
