import assert from "node:assert/strict";
import test from "node:test";
import { BASELINES, baseline } from "../p-attr/baselines.mjs";
import { counted } from "../p-attr/runtime.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { fixtureState } from "./p-attr-foundation-fixtures.mjs";

const DIAGNOSTIC = { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" };
const refusal = async () => ({ ok: false, error: DIAGNOSTIC });
const sdkThrow = async () => { throw Object.assign(new Error("fixture-sdk"), DIAGNOSTIC); };
const rawThrow = async () => { throw new TypeError("fixture-reflection"); };
const SURFACES = [
  ["returned refusal", refusal, "returned", DIAGNOSTIC],
  ["structured throw", sdkThrow, "thrown", DIAGNOSTIC],
  ["raw throw", rawThrow, "thrown", {}],
];

for (const [label, behavior, kind, diagnostic] of SURFACES) {
  test(`raw surface: ${label}`, async () => {
    const state = fixtureState({ behavior });
    const { record } = await baseline(state, { entry: BASELINES[0] });
    assert.equal(record.kind, kind);
    assert.equal(record.accepted, false);
    assert.deepEqual(record.diagnostic, diagnostic);
    assert.equal(record.sink_count, 0);
    assert.deepEqual(state.calls.at(-1).raw, record.raw);
    assert.equal(state.ledger.report().occurrence_count, 7);
  });
}

test("counted constructors/frame helpers rethrow original errors and retain raw diagnostics", () => {
  const calls = [];
  const ledger = occurrenceLedger({ budget: 3 });
  const invoke = counted({ calls, ledger });
  const error = Object.assign(new Error("fixture-constructor"), DIAGNOSTIC);
  assert.throws(() => invoke({ label: "createAuditContextFrame", fn: () => { throw error; } }), (actual) => actual === error);
  assert.deepEqual(calls[0].diagnostic, DIAGNOSTIC);
  const frame = { actor: { type: "anonymous" } };
  assert.equal(invoke({ label: "frame helper", fn: () => frame }), frame);
  assert.equal(calls[1].raw, frame);
  assert.equal(ledger.report().occurrence_count, 2);
});

test("nested callbacks count before invocation and budget exhaustion stays sticky", () => {
  const ledger = occurrenceLedger({ budget: 2 });
  const calls = [];
  const invoke = counted({ ledger, calls });
  const nested = () => invoke({ label: "hook", fn: () => "keyed-fixture" });
  assert.equal(invoke({ label: "named", fn: nested }), "keyed-fixture");
  assert.deepEqual(ledger.report().calls.map(({ label }) => label), ["named", "hook"]);
  assert.deepEqual(calls.map(({ label }) => label), ["named", "hook"]);
  let invoked = false;
  assert.throws(() => invoke({ label: "over", fn: () => { invoked = true; } }), /budget exhausted/);
  assert.equal(invoked, false);
  assert.throws(() => ledger.assertAvailable(), /budget exhausted/);
});

test("SDK hook containment cannot turn budget exhaustion into an ordinary refusal", async () => {
  const state = fixtureState({ budget: 7, behavior: async () => {
    try { state.call("contained hook", () => "unreachable"); }
    catch { return { ok: false, error: { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" } }; }
  } });
  await assert.rejects(() => baseline(state, { entry: BASELINES[0] }), /budget exhausted/);
  assert.equal(state.records.length, 0);
  assert.equal(state.ledger.report().exhausted, true);
});
