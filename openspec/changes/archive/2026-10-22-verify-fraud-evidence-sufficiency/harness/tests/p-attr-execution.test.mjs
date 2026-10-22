import assert from "node:assert/strict";
import test from "node:test";
import { measure, accounting } from "../p-attr/workload.mjs";
import { P_ATTR_BUDGET } from "../p-attr/linkage-cases.mjs";
import { planBudget } from "../lib/ledger.mjs";
import { requestFixtureState, L1_TABLE, OTHER_COUNTS } from "./p-attr-request-fixtures.mjs";
import { FIXTURE_METHODS, deepFreeze } from "./p-attr-foundation-fixtures.mjs";
import { evaluateProbe } from "../p-attr/evaluate.mjs";
import { DECLARED_PAIRS } from "../p-attr/linkage-cases.mjs";
import { serializeResults } from "../lib/results.mjs";
import { jsonFile } from "../lib/io.mjs";

// Independent hand-counts: context.ts:139-323; events.ts:287-352;
// semantic.ts:271-316,371-405 at cc4fdf5. Per-variant oracles for ALL
// matrix cases already live in AF/AS/request matrix tests, not expectations.
const FAMILY_COUNTS = [["AF", 512], ["AS", 233], ["PR", 227], ["RA", 227]];
const BASELINE_IDS = ["AF-B/ex", "AF-B/nx", "AS-B/ex", "PR-B/ex", "PR-B/nx", "RA-B/ex", "RA-B/nx"];
const REFUSAL = { ok: false, error: { code: "FIXTURE_REFUSED", category: "validation", path: "/fixture" } };
const ACCEPTANCE = { ok: true, value: { status: "accepted" } };
function scriptedState({ intercept, budget = 4610 }) {
  const state = requestFixtureState({ budget });
  const create = state.node.createNodeSecurityAuditSdk;
  state.node.createNodeSecurityAuditSdk = (config) => {
    const sdk = create(config);
    return Object.fromEntries(FIXTURE_METHODS.map(([method]) => [method, async (input) =>
      intercept({ state, config, method, input, invoke: () => sdk[method](input) })]));
  };
  return state;
}
const fullState = requestFixtureState({ budget: 4610 });
const full = await measure({ state: fullState });
const EXPECTATIONS = jsonFile(new URL("../expectations/p-attr.v1.json", import.meta.url));
test("F3: all 950 offline records match the complete frozen matrix and linkage plan", () => {
  const evaluated = evaluateProbe({ observations: [full], expectations: EXPECTATIONS });
  assert.equal(evaluated.evaluations.length, 73);
  for (const entry of evaluated.evaluations) {
    assert.equal(entry.matched, true, entry.case_id);
    assert.deepEqual(entry.mismatches, [], entry.case_id);
    assert.deepEqual(entry.notes, [], entry.case_id);
  }
  assert.equal(evaluated.verdict.criterion_1.status, "failed");
  assert.equal(evaluated.verdict.linkage_expectations.valid, true);
});
test("one sequential process: all four baselines first, complete matrix/linkage, explicit allowance", () => {
  assert.deepEqual(full.records.slice(0, 7).map((record) => record.step_id), BASELINE_IDS);
  assert.equal(full.records.length, 950);
  assert.deepEqual(full.invalidations, []);
  assert.equal(full.ledger.occurrence_count, 2305);
  assert.equal(full.ledger.budget, 4610);
  assert.equal(full.ledger.exhausted, false);
  assert.equal(planBudget(P_ATTR_BUDGET).total, 2 * full.ledger.occurrence_count);
  assert(P_ATTR_BUDGET.total <= 5000);
  assert(full.accounting.per_case.every((row) => row.actual === row.predicted));
});
for (const [family, predicted] of FAMILY_COUNTS) {
  test(`independent full-process ${family} call prediction`, () => {
    assert.equal(full.public_calls.filter((call) => call.label.startsWith(`${family}-`)).length, predicted);
  });
}
for (const [id, ...counts] of [...L1_TABLE, ...OTHER_COUNTS]) {
  test(`integrated linkage prediction ${id}`, () => {
    assert.equal(full.linkage_datasets.find((dataset) => dataset.dataset_id === id).public_calls.length, counts.at(-1));
  });
}
const BASELINE_FAILURES = [
  ["refusal", async () => REFUSAL],
  ["throw", async () => { throw new TypeError("fixture method throw"); }],
  ["absent capture", async ({ invoke, config }) => { const raw = await invoke(); config.sink.events.pop(); return raw; }],
];
for (const family of ["AF", "AS", "PR", "RA"]) {
  for (const [label, fail] of BASELINE_FAILURES) {
    test(`${family} baseline ${label} stops the ENTIRE workload`, async () => {
      const state = scriptedState({ intercept: (context) => context.state.current === `${family}-B` ? fail(context) : context.invoke() });
      const result = await measure({ state });
      assert.equal(result.invalidations.length, 1);
      assert.match(result.invalidations[0].message, /precondition failed/);
      assert.equal(result.records.at(-1).step_id.split("/")[0], `${family}-B`);
      assert(result.records.every((record) => record.step_id.split("/")[0].endsWith("-B")));
      assert.deepEqual(result.linkage_datasets, []);
    });
  }
}
const ORDINARY = [
  ["unexpected refusal", () => REFUSAL, "returned", false],
  ["unexpected throw", () => { throw new TypeError("fixture public throw"); }, "thrown", false],
  ["unexpected acceptance", ({ config }) => {
    config.sink.events.push(deepFreeze({ actor: { type: "anonymous" }, correlation: {} }));
    return ACCEPTANCE;
  }, "returned", true],
];
for (const [label, intercept, kind, accepted] of ORDINARY) {
  test(`${label} is an observation, not a stop`, async () => {
    const state = scriptedState({ intercept: (context) => context.state.current === "AF-C8" ? intercept(context) : context.invoke() });
    const result = await measure({ state });
    assert.equal(result.records.length, 950);
    assert.deepEqual(result.invalidations, []);
    const record = result.records.find((row) => row.step_id === "AF-C8/ex");
    assert.equal(record.kind, kind);
    assert.equal(record.accepted, accepted);
    const evaluated = evaluateProbe({ observations: [result], expectations: { cases: [{ case_id: "AF-C8", predicted_calls: 16,
      expected: [{ step_id: "AF-C8/ex", kind: "returned", accepted: false,
        diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" },
        sink_count: 0, frozen: [], axes: {}, assertions: {} }] }], declared_join_pairs: DECLARED_PAIRS } });
    assert.equal(evaluated.evaluations[0].matched, false);
    assert(evaluated.evaluations[0].raw.length > 0);
  });
}
test("deliberate hook preconditions remain observations and missing callbacks are accounting notes only", () => {
  const hooks = full.records.filter((record) => /^AF-C2(h-t|-async)\//.test(record.step_id));
  assert.deepEqual(hooks.map((record) => record.diagnostic.code), ["SDK_HOOK_FAILURE", "SDK_HOOK_FAILURE", "SDK_UNSUPPORTED_HOOK_RESULT", "SDK_UNSUPPORTED_HOOK_RESULT"]);
  assert(hooks.every((record) => !record.accepted && record.sink_count === 0));
  const calls = [...fullState.calls, { label: "AF-C1:fixture-extra" }];
  const notes = accounting({ ...fullState, calls });
  assert.equal(notes.per_case.find((row) => row.label === "AF-C1").notes.length, 1);
  assert.deepEqual(full.invalidations, []);
});
test("provider-hook containment cannot swallow sticky exhaustion; partial raw outer outcome survives", async () => {
  const state = scriptedState({ budget: 88, intercept: (context) => {
    if (context.state.current !== "AF-C2") return context.invoke();
    try { context.state.call("contained callback", () => "unreachable"); }
    catch { return { ok: false, error: { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" } }; }
    return context.invoke();
  } });
  const observed = await measure({ state });
  assert(observed.ledger.exhausted);
  assert.equal(observed.invalidations[0].attribution, "harness_fault");
  assert.match(observed.invalidations[0].message, /budget exhausted/);
  assert(observed.public_calls.some((call) => call.attribution === "harness_fault"));
  assert(observed.records.length < 950);
  assert.doesNotThrow(() => serializeResults(observed));
});
test("harness faults stop, captures/raw calls/axes/ledger survive deterministic serialization", async () => {
  const state = scriptedState({ intercept: ({ state: current, invoke }) => {
    if (current.current === "AF-C1") current.records.push(null);
    return invoke();
  } });
  const observed = await measure({ state });
  assert.equal(observed.invalidations[0].attribution, "harness_fault");
  assert(observed.records.length < 950);
  const serialized = JSON.parse(serializeResults(full));
  assert.deepEqual(serialized.ledger, full.ledger);
  assert.equal(serialized.public_calls.length, 2305);
  assert.equal(serialized.linkage_calls.length, 1106);
  assert.equal(serialized.records[0].analysis.axes.provenance_ambiguity, false);
  assert.deepEqual(serialized.records[0].events, full.records[0].events);
  assert.deepEqual(serialized.keying, { key_id: "k-run-01", purpose: "synthetic Stage P target-carrier comparison" });
});
test("parent evaluation is independent of workload-attached analyses (analyze:false === analyze:true)", async () => {
  const expectations = EXPECTATIONS;
  const cold = await measure({ state: requestFixtureState({ budget: 4610 }), analyze: false });
  const warm = await measure({ state: requestFixtureState({ budget: 4610 }) });
  assert.equal(cold.records.filter((record) => "analysis" in record).length, 0, "analyze:false attaches no record.analysis");
  assert(warm.records.every((record) => "analysis" in record), "analyze:true keeps the offline analysis contract");
  const shape = (evaluated) => ({
    evaluations: evaluated.evaluations.map((entry) => ({ case_id: entry.case_id, matched: entry.matched, notes: entry.notes })),
    criterion_1: evaluated.verdict.criterion_1.status,
    linkage_valid: evaluated.verdict.linkage_expectations.valid,
  });
  const coldView = shape(evaluateProbe({ observations: [cold], expectations }));
  const warmView = shape(evaluateProbe({ observations: [warm], expectations }));
  assert.deepEqual(coldView, warmView, "the parent computes every analysis itself via analysisFor");
});

test("F7: one shared analysisFor cache analyzes each record at most once per evaluateProbe pass", () => {
  const expectations = EXPECTATIONS;
  const tallies = new WeakMap();
  const counted = (record) => new Proxy(record, { get(target, key) {
    if (key !== "existence_peer" && key !== "raw") return Reflect.get(target, key);
    const tally = tallies.get(target) ?? { peer: 0, raw: 0 };
    if (key === "existence_peer") tally.peer += 1; else tally.raw += 1;
    tallies.set(target, tally);
    return Reflect.get(target, key);
  } });
  const records = full.records.map(counted);
  const evaluated = evaluateProbe({ observations: [{ records, public_calls: full.public_calls }], expectations });
  assert.equal(evaluated.evaluations.length, 73);
  for (const record of full.records) {
    const tally = tallies.get(record);
    // disclosureFor reads existence_peer once per analyzeRecord call (accepted
    // records only); shapeIssues reads raw once per call (refused "returned"
    // records). Slot inventory shape-checks read raw once for refused linkage
    // records, so a second analysis is the only way any tally exceeds one.
    if (record.accepted) assert.equal(tally.peer, 1, `${record.step_id}: expected exactly one analysis`);
    else assert.equal(tally.raw, 1, `${record.step_id}: expected exactly one analysis`);
  }
});
