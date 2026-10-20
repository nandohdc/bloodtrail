import assert from "node:assert/strict";
import test from "node:test";
import { counted } from "../lib/counted.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";

// Q9: one shared wrapper serves P-D (stepIds, raw dropped) and P-attr (keepRaw,
// assertAfter). Nested calls drain with their own ledger ordinal and are
// inserted in ledger-take order, so a provider hook callback is never
// attributed to the wrong ordinal.
function nestedScenario(create) {
  const ledger = occurrenceLedger({ budget: 100 });
  const calls = [];
  const invoke = create({ ledger, calls });
  const result = invoke({ label: "outer", fn: () => {
    invoke({ label: "inner", fn: () => "inner-value" });
    return "outer-value";
  } });
  return { result, calls, ledger: ledger.report() };
}

test("shared wrapper: P-D shape keeps step ids, drops raw and orders nested calls by ledger ordinal", () => {
  const create = ({ ledger, calls }) => counted({ ledger, calls, stepIds: true, keepRaw: false });
  const { result, calls, ledger } = nestedScenario(create);
  assert.equal(result, "outer-value");
  // The inner hook finishes first, yet the outer call stays first in the array.
  assert.deepEqual(calls.map((call) => call.step_id), ["outer/1", "inner/2"]);
  assert.deepEqual(calls.map((call) => call.label), ["outer", "inner"]);
  assert.deepEqual(calls.map((call) => call.raw ?? null), [null, null]);
  assert.equal(calls[0].label, "outer");
  assert.equal(calls[1].label, "inner");
  assert.deepEqual(ledger.calls.map((call) => call.label), ["outer", "inner"]);
});

test("shared wrapper: P-attr shape keeps raw results and nested order matches the ledger", () => {
  const create = ({ ledger, calls }) => counted({ ledger, calls, keepRaw: true, assertAfter: true });
  const { result, calls } = nestedScenario(create);
  assert.equal(result, "outer-value");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].label, "outer");
  assert.equal(calls[1].label, "inner");
  assert.equal(calls[0].raw, "outer-value");
  assert.equal(calls[1].raw, "inner-value");
});

test("shared wrapper: budget exhaustion is sticky and the raw outer outcome survives", () => {
  const ledger = occurrenceLedger({ budget: 1 });
  const calls = [];
  const invoke = counted({ ledger, calls, keepRaw: true, assertAfter: true });
  assert.throws(() => invoke({ label: "outer", fn: () => invoke({ label: "inner", fn: () => "inner-value" }) }), /budget/);
  assert.equal(ledger.report().exhausted, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].label, "outer");
});

test("shared wrapper: sync throws propagate with onThrow side effects, keeping evidence", () => {
  const ledger = occurrenceLedger({ budget: 10 });
  const calls = [];
  const seen = [];
  const invoke = counted({ ledger, calls, onThrow: (error) => seen.push(error.message), keepRaw: true });
  assert.throws(() => invoke({ label: "throwing", fn: () => { throw new TypeError("fixture burst"); } }), /fixture burst/);
  assert.deepEqual(seen, ["fixture burst"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "thrown");
});
