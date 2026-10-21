import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { evaluationFixture } from "./p-map-evaluation-fixtures.mjs";

const fixture = await evaluationFixture();
const ID = "L1/not-applicable";
function target(input) { return input.observations[0].records.find((row) => row.step_id === ID); }
function plan(input) { return input.expectations.cases.find((row) => row.case_id === "L1"); }
const MUTATIONS = [
  ["malformed planned step", (input) => { plan(input).expected[2] = null; }],
  ["malformed planned row", (input) => { plan(input).expected = null; }],
  ["missing step", (input) => { input.observations[0].records = input.observations[0].records.filter((row) => row.step_id !== ID); }],
  ["duplicate step", (input) => { input.observations[0].records.push(structuredClone(target(input))); }],
  ["wrong surface", (input) => { target(input).kind = "thrown"; }],
  ["malformed captures", (input) => { target(input).captures = null; }],
  ["bad capture count", (input) => { target(input).captures = []; }],
  ["nonfrozen capture", (input) => { target(input).captures[0].frozen = false; }],
  ["malformed canonical array", (input) => { target(input).captures[0].event = []; }],
  ["missing canonical metadata", (input) => { target(input).captures[0].event = {}; }],
  ["malformed public result", (input) => { target(input).raw = null; }],
  ["contradictory acceptance", (input) => { target(input).raw.ok = false; }],
  ["owned extra", (input) => { input.observations[0].records.push({ step_id: "L1/extra", accepted: true }); }],
  ["owned abort", (input) => { input.observations[0].records.push({ step_id: "L1/aborted", variant: "case_aborted", message: "fixture-case-fault" }); }],
  ["missing accounting", (input) => { input.observations[0].accounting.shift(); }],
  ["duplicate accounting", (input) => { input.observations[0].accounting.push(input.observations[0].accounting[0]); }],
  ["malformed accounting", (input) => { input.observations[0].accounting[0].steps = {}; }],
  ["duplicate planned case", (input) => { input.expectations.cases.push(plan(input)); }],
];

for (const [name, mutate] of MUTATIONS) test(`P-map ${name}: local mismatch, complete raw retention, no spurious unknown owner`, () => {
  const input = structuredClone(fixture);
  mutate(input);
  const result = evaluateProbe(input);
  const actual = result.evaluations.find((row) => row.case_id === "L1");
  assert.equal(actual.matched, false);
  assert(actual.mismatches.length > 0);
  assert.deepEqual(actual.raw, input.observations[0].records.filter((row) => row.step_id.startsWith("L1/")));
  assert.deepEqual(actual.accounting, input.observations[0].accounting.filter((row) => row.case_id === "L1"));
  assert(!result.evaluations.some((row) => row.mismatches.some((note) => note.includes("unknown step"))));
  assert.equal(result.evaluations.find((row) => row.case_id === "M1").matched, true);
  assert.equal(result.verdicts.find((row) => row.case_id === "S-MFA").verdict, "FITS");
  assert.strictEqual(result.observations[0], input.observations[0]);
});

const TOP_LEVEL = [null, false, 1, "fixture", [], {}, { expectations: null, observations: [null] },
  { expectations: { cases: [null, 1, [], {}] }, observations: [{ records: [null, false, 1, "fixture"], accounting: [null] }] }];
for (const input of TOP_LEVEL) test(`P-map malformed JSON input ${JSON.stringify(input)} never throws or loses input`, () => {
  let result;
  assert.doesNotThrow(() => { result = evaluateProbe(input); });
  assert(Array.isArray(result.evaluations));
  assert(result.evaluations.every((row) => row.matched === false));
  assert.strictEqual(result.observations?.[0], input?.observations?.[0]);
});

test("P-map records owned by no planned row alone receive unknown step/unowned accounting", () => {
  const input = structuredClone(fixture);
  const stray = { step_id: "unplanned/emit" };
  const malformed = null;
  const accounting = { case_id: "unplanned", public_calls: 1 };
  input.observations[0].records.push(stray, malformed);
  input.observations[0].accounting.push(accounting);
  const result = evaluateProbe(input);
  const unknown = result.evaluations.filter((row) => row.mismatches.some((note) => note.startsWith("unknown step")));
  assert.deepEqual(unknown.flatMap((row) => row.raw), [stray, malformed]);
  assert(result.evaluations.some((row) => row.accounting?.[0] === accounting));
});

test("P-map public refusal snapshot contradicting projected diagnostic is a mismatch", () => {
  const input = structuredClone(fixture);
  input.observations[0].records.find((row) => row.step_id === "L5a/denied-no-handle").raw.error.path = "/fixture-wrong";
  const row = evaluateProbe(input).evaluations.find((entry) => entry.case_id === "L5a");
  assert.equal(row.matched, false);
  assert(row.mismatches.some((note) => note.includes("raw refusal")));
});

test("P-map in-allowance public-call deviation is a note, not an unmatched row", () => {
  const input = structuredClone(fixture);
  input.observations[0].accounting[0].public_calls += 1;
  const row = evaluateProbe(input).evaluations.find((entry) => entry.case_id === "L1");
  assert.equal(row.matched, true);
  assert(row.notes.some((note) => note.includes("deviation is a note")));
});
