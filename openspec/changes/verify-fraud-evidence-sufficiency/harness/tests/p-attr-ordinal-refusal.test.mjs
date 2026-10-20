import assert from "node:assert/strict";
import test from "node:test";
import { createState } from "../p-attr/runtime.mjs";
import { carrierVariant, setupRefusal } from "../p-attr/carrier-workload.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";

const OUTER = { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" };
const INNER = { code: "SDK_UNSUPPORTED_HOOK_RESULT", category: "privacy", path: "/transformations" };
const HOOK_RESULTS = [
  ["returned", (state) => state.call("hook", () => "fixture-keyed-value")],
  ["thrown", (state) => {
    try { state.call("hook", () => { throw Object.assign(new Error("fixture-inner"), INNER); }); }
    catch { /* Public-shape factory contains the hook failure. */ }
  }],
];
function noHook() {}
const PLAN = { family: "AF", prepare: noHook, builders: new Map([["fixture", noHook]]), existencePeer: () => undefined };

function fixtureState(hook) {
  const state = createState({ core: { CONTRACT_VERSION: "2.1.0" },
    testing: { createCapturingAuditSink: () => ({ events: [] }) },
    node: { createNodeSecurityAuditSdk() {
      hook(state);
      throw Object.assign(new Error("fixture-outer"), OUTER);
    } }, ledger: occurrenceLedger({ budget: 20 }),
  });
  return state;
}

for (const [kind, hook] of HOOK_RESULTS) {
  test(`setup refusal belongs to the outer factory ordinal, not its ${kind} hook`, async () => {
    const state = fixtureState(hook);
    const record = await carrierVariant({ state, plan: PLAN,
      entry: { case_id: "AF-fixture", hook_mode: "none", scenario: "fixture" },
      variant: { variant_id: "main", predicted_calls: 3 }, keying: {},
    });
    assert.deepEqual(record.diagnostic, OUTER);
    assert.equal(record.raw.message, "fixture-outer");
    assert.equal(record.kind, "thrown");
    assert.equal(record.sink_count, 0);
    assert.deepEqual(state.ledger.report().calls.map(({ ordinal }) => ordinal), [1, 2, 3]);
    assert.deepEqual(record.public_calls.map(({ label }) => label), [
      "AF-fixture:createCapturingAuditSink", "AF-fixture:createNodeSecurityAuditSdk", "AF-fixture:hook",
    ]);
    assert.equal(record.public_calls[2].kind, kind);
    assert.deepEqual(record.public_calls[1].diagnostic, OUTER);
    assert(!Object.hasOwn(record.public_calls[1], "ordinal"), "ordinal metadata stays out of historical call shapes");
  });
}

test("propagating the same thrown object through a hook assigns its outer invocation", () => {
  const state = fixtureState(noHook);
  const error = Object.assign(new Error("fixture-propagated"), OUTER);
  try { state.call("outer", () => state.call("inner", () => { throw error; })); }
  catch (caught) {
    assert.equal(caught, error);
    assert.equal(state.thrownCall(caught).label, "setup:outer");
    assert.deepEqual(setupRefusal({ state, error: caught, stepId: "AF-fixture/main" }).diagnostic, OUTER);
  }
  assert.equal(state.records.length, 1);
});

test("an uncounted failure cannot borrow an earlier diagnostic", () => {
  const state = fixtureState(noHook);
  const error = new TypeError("fixture-uncounted");
  assert.throws(() => state.call("counted", () => { throw Object.assign(new Error("fixture-prior"), INNER); }));
  assert.throws(() => setupRefusal({ state, error, stepId: "AF-fixture/main" }), (caught) => caught === error);
  assert.deepEqual(state.records, []);
});

test("overlapping asynchronous refusals keep their own ordinals after another call completes", async () => {
  const state = fixtureState(noHook);
  const error = Object.assign(new Error("fixture-async"), OUTER);
  let release;
  const parked = new Promise((resolve) => { release = resolve; });
  const pending = state.call("outer", async () => { await parked; throw error; });
  assert.throws(() => state.call("later", () => { throw Object.assign(new Error("fixture-later"), INNER); }));
  release();
  await assert.rejects(pending, (caught) => caught === error);
  const record = setupRefusal({ state, error, stepId: "AF-fixture/main" });
  assert.deepEqual(record.diagnostic, OUTER);
  assert.deepEqual(state.calls.map(({ label }) => label), ["setup:outer", "setup:later"]);
});
