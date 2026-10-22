import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCases } from "../p-d/evaluate.mjs";
import { validateExpectations } from "../p-d/expectations.mjs";
import { EXPECTATIONS, observationFixture, positiveRecords } from "./pd-fixtures.mjs";

const MUTATIONS = [
  ["A metadata", "PD-A1/tenant", (record) => { record.diagnostic.eventName = "unwanted"; }],
  ["B surface", "PD-B1/main", (record) => { record.surface = "thrown-sdk"; }],
  ["C diagnostic path", "PD-C2/main", (record) => { record.diagnostic.path = "/event/commit_state"; }],
  ["D unexpected acceptance", "PD-D1/main", (record) => { record.surface = "accepted"; }],
  ["E event", "PD-E1/main", (record) => { record.events[0].source.observed.address = "192.0.2.99"; }],
  ["F getter", "PD-F6/accessor", (record) => { record.facts.getters = 1; }],
  ["thrown JSON", "PD-A5/main", (record) => { record.json.category = "validation"; }],
  ["sink count", "PD-01/main", (record) => { record.sink_count = 0; }],
  ["frozen", "PD-00/main", (record) => { record.frozen = [false]; }],
  ["raw message", "PD-C11/getter", (record) => { record.message = "fixture wrong wording"; }],
  ["retry correlation", "PD-C13/1", (record) => { record.events[0].correlation.transaction_id = "other"; }],
];

test("P-D frozen schema, 66 cases and all positive step fixtures match", () => {
  assert.equal(validateExpectations(EXPECTATIONS), EXPECTATIONS);
  const evaluated = evaluateCases(observationFixture());
  assert.equal(evaluated.length, 66);
  assert(evaluated.every((entry) => entry.matched), JSON.stringify(evaluated.filter((entry) => !entry.matched)));
});

for (const [label, stepId, mutate] of MUTATIONS) {
  test(`P-D evaluator rejects ${label} with observed and expected explanations`, () => {
    const records = positiveRecords();
    mutate(records.find((record) => record.step_id === stepId));
    const result = evaluateCases(observationFixture(records)).find((entry) => entry.case_id === stepId.split("/")[0]);
    assert.equal(result.matched, false);
    assert(result.notes.some((note) => note.includes("observed") && note.includes("expected")));
  });
}

const MEMBERSHIP = [
  ["missing", (records) => records.slice(1)],
  ["duplicate", (records) => [...records, records[0]]],
  ["unknown", (records) => [...records, { ...records[0], step_id: "PD-Z1/unknown" }]],
];
for (const [label, mutate] of MEMBERSHIP) {
  test(`P-D evaluator explains ${label} records`, () => {
    const results = evaluateCases(observationFixture(mutate(positiveRecords())));
    assert(results.some((entry) => !entry.matched && entry.notes.some((note) => note.includes("expected"))));
  });
}
