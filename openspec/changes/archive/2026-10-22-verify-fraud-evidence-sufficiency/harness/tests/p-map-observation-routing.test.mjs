import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { evaluationFixture } from "./p-map-evaluation-fixtures.mjs";

const fixture = await evaluationFixture();
const baseline = evaluateProbe(fixture);
const OWNED_MUTATIONS = [
  ["extra record", (process, id) => process.records.push({ step_id: `${id}/extra`, kind: "returned", accepted: true })],
  ["accounting without calls", (process, id) => process.accounting.push({ case_id: id, public_calls: 0, steps: [] })],
  ["accounting with calls", (process, id) => process.accounting.push({ case_id: id, public_calls: 1, steps: [`${id}/extra`] })],
  ["abort and accounting", (process, id) => {
    process.records.push({ step_id: `${id}/aborted`, variant: "case_aborted", message: "fixture-fault" });
    process.accounting.push({ case_id: id, public_calls: 1, case_aborted: true, steps: [`${id}/aborted`] });
  }],
];

function decision(row) {
  return { case_id: row.case_id, matched: row.matched, mismatches: row.mismatches, actual: row.actual, notes: row.notes };
}

function assertIndependent(result, owner) {
  const expected = baseline.evaluations.filter((row) => row.case_id !== owner).map(decision);
  assert.deepEqual(result.evaluations.filter((row) => row.case_id !== owner).map(decision), expected);
  assert.deepEqual(result.verdicts, baseline.verdicts);
}

for (const id of ["S-LOGOUT", "S-CRIT2"]) for (const [name, mutate] of OWNED_MUTATIONS) {
  test(`P-map ${id} owns unexpected ${name} without losing dependency evidence`, () => {
    const input = structuredClone(fixture);
    mutate(input.observations[0], id);
    const result = evaluateProbe(input);
    const actual = result.evaluations.find((row) => row.case_id === id);
    const previous = baseline.evaluations.find((row) => row.case_id === id);
    assert.equal(actual.matched, false);
    assert(actual.mismatches.some((note) => note.includes("aggregate must not emit records or accounting")));
    assert.deepEqual(actual.raw, [...previous.raw, ...input.observations[0].records.filter((row) => row.step_id.startsWith(`${id}/`))]);
    assert.deepEqual(actual.accounting, [...previous.accounting, ...input.observations[0].accounting.filter((row) => row.case_id === id)]);
    assert.strictEqual(result.observations, input.observations);
    assertIndependent(result, id);
  });
}

const MALFORMED_PROCESSES = [
  ["null", null], ["array", []], ["number", 1], ["string", "fixture-process"], ["missing containers", {}],
  ["both non-arrays", { records: "not-an-array", accounting: "not-an-array" }],
  ["records null", { records: null, accounting: [] }],
  ["records object", { records: {}, accounting: [] }],
  ["missing accounting", { records: [] }],
  ["accounting null", { records: [], accounting: null }],
  ["accounting object", { records: [], accounting: {} }],
  ["accounting string", { records: [], accounting: "not-an-array" }],
];
for (const [name, process] of MALFORMED_PROCESSES) test(`P-map malformed process ${name} is retained, not silently discarded`, () => {
  const input = structuredClone(fixture);
  input.observations.push(structuredClone(process));
  const result = evaluateProbe(input);
  const failure = result.evaluations.find((row) => row.case_id === "P-map");
  assert.equal(failure.matched, false);
  assert.equal(failure.process_index, input.observations.length - 1);
  assert.deepEqual(failure.raw, [process]);
  assert(failure.mismatches.some((note) => note.includes("malformed observation process")));
  assert.strictEqual(result.observations, input.observations);
  assertIndependent(result, "P-map");
});

for (const observations of [null, false, 1, "fixture-processes", {}]) {
  test(`P-map malformed process collection ${JSON.stringify(observations)} retains original container`, () => {
    const input = { expectations: fixture.expectations, observations };
    const result = evaluateProbe(input);
    const failure = result.evaluations.find((row) => row.case_id === "P-map");
    assert.equal(failure.matched, false);
    assert.deepEqual(failure.raw, [observations]);
    assert(failure.mismatches.some((note) => note.includes("observations must be an array")));
    assert.strictEqual(result.observations, observations);
  });
}
