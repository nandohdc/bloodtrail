import assert from "node:assert/strict";
import test from "node:test";
import { linkageFixture, L1_TABLE, OTHER_COUNTS } from "./p-attr-request-fixtures.mjs";
import { FAILURE_DATASETS, LINKAGE_PREDICTIONS, P_ATTR_BUDGET } from "../p-attr/linkage-cases.mjs";
import { AF_CASES } from "../p-attr/af-cases.mjs";
import { linkageWorkload } from "../p-attr/linkage-workload.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { requestFixtureState } from "./p-attr-request-fixtures.mjs";
import { planBudget } from "../lib/ledger.mjs";

const state = await linkageFixture();
const COUNTS = [...L1_TABLE.map(([id, , , , calls]) => [id, calls]), ...OTHER_COUNTS];
for (const [id, calls] of COUNTS) {
  test(`linkage hand-counted public calls ${id}`, () => {
    const dataset = state.linkage_datasets.find((item) => item.dataset_id === id);
    assert.equal(dataset.public_calls.length, calls);
    assert.equal(LINKAGE_PREDICTIONS.find((item) => item.dataset_id === id).predicted_calls, calls);
  });
}
test("full accepted AF source roster includes review additions and all accepted variants", () => {
  const source = AF_CASES.flatMap((entry) => entry.variants.filter((variant) => variant.source_outcome.accepted)
    .map((variant) => `${entry.case_id}/${variant.mode}`));
  assert.deepEqual(new Set(FAILURE_DATASETS.map((dataset) => dataset.dataset_id)), new Set(source));
  assert.equal(state.records.length, 801); // 25*30 AF + 9*3 AS + 4*6 requests
  assert.equal(new Set(state.records.map((record) => record.step_id)).size, 801);
  assert.equal(state.calls.length, 1106);
  assert.equal(P_ATTR_BUDGET.predicted_total, 2305);
  assert.equal(planBudget(P_ATTR_BUDGET).total, 4610);
});
test("immutable public contexts are prepared once, five attempts reuse them, captures stay isolated", () => {
  assert.equal(state.calls.filter((call) => call.label === "linkage-setup:anonymousActor").length, 3);
  const rows = state.records.filter((record) => record.step_id.startsWith("L1/AF-C4/main/ex-0001-"));
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map((record) => record.events[0].subject.id)).size, 1);
  rows[0].events[0].subject.id = "mutated-capture";
  assert.equal(rows[1].events[0].subject.id, "pid-ex-0001");
});
test("semantic hooks are counted per emission and keep independent purposes", () => {
  const facts = state.records.flatMap((record) => record.hook_facts);
  assert.equal(facts.length, 39);
  assert.deepEqual(new Set(facts.map((fact) => fact.purpose)), new Set(["authentication_failed", "authentication_succeeded"]));
  const refused = state.records.filter((record) => record.step_id.startsWith("L2/AS-C2/main/"));
  assert.equal(refused.length, 3);
  assert(refused.every((record) => record.hook_facts.length === 1 && record.accepted === false));
});
test("baseline invalidation stops before linkage setup; ordinary AS mirror refusals continue", async () => {
  const stopped = requestFixtureState();
  stopped.invalidations.push({ message: "baseline refused" });
  await linkageWorkload({ state: stopped, keying: memoryKeying() });
  assert.equal(stopped.calls.length, 0);
  assert.equal(state.records.at(-1).family, "RA");
  assert.equal(state.records.at(-1).accepted, true);
});
test("linkage exhaustion in a contained hook is sticky, not an observation continuation", async () => {
  await assert.rejects(linkageFixture({ budget: 165 }), /budget exhausted/);
});

const REFUSAL = { code: "SDK_INVALID_CONFIGURATION", category: "configuration", path: "/sink" };
function throwOnce({ owner, name, matches }) {
  const original = owner[name];
  let refused = false;
  owner[name] = (...args) => {
    if (!refused && matches(args)) {
      refused = true;
      throw Object.assign(new Error("synthetic public refusal"), REFUSAL);
    }
    return original(...args);
  };
}
function methodFailure(state) {
  const create = state.node.createNodeSecurityAuditSdk;
  state.node.createNodeSecurityAuditSdk = (config) => {
    const sdk = create(config);
    throwOnce({ owner: sdk, name: "authenticationFailed", matches: () => true });
    return sdk;
  };
}
test("shared-context refusal preserves its real surface without inventing later emissions", async () => {
  const fixture = requestFixtureState({ budget: 5000 });
  throwOnce({ owner: fixture.core, name: "anonymousActor", matches: () => true });
  await linkageWorkload({ state: fixture, keying: memoryKeying() });
  assert.equal(fixture.records.length, 1);
  assert.equal(fixture.records[0].kind, "thrown");
  assert.equal(fixture.records[0].family, "setup");
  assert.equal(fixture.records[0].events.length, 0);
  assert.deepEqual(fixture.records[0].diagnostic, REFUSAL);
  assert.equal(fixture.linkage_calls.length, 3);
  assert.deepEqual(fixture.invalidations, []);
});
const PUBLIC_FAILURES = [
  ["constructor", (fixture) => throwOnce({ owner: fixture.core, name: "authoritativeSubject", matches: () => true })],
  ["factory", (fixture) => throwOnce({ owner: fixture.node, name: "createNodeSecurityAuditSdk", matches: ([config]) => config.transformations !== undefined })],
  ["named method", methodFailure],
];
for (const [label, install] of PUBLIC_FAILURES) {
  test(`unexpected public ${label} throw is retained and later datasets continue`, async () => {
    const fixture = requestFixtureState({ budget: 5000 });
    install(fixture);
    await linkageWorkload({ state: fixture, keying: memoryKeying() });
    const thrown = fixture.records.filter((record) => record.kind === "thrown");
    assert(thrown.length > 0);
    assert(thrown.every((record) => record.sink_count === 0));
    assert.deepEqual(thrown[0].diagnostic, REFUSAL);
    assert(fixture.linkage_calls.some((call) => call.kind === "thrown"));
    assert.equal(fixture.records.at(-1).accepted, true);
    assert.equal(fixture.records.at(-1).family, "RA");
    assert.deepEqual(fixture.invalidations, []);
  });
}
