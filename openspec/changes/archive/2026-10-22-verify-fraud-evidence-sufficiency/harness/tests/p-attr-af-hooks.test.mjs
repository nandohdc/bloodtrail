import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { evaluateCases } from "../p-attr/evaluate.mjs";
import { AF_CASES } from "../p-attr/af-cases.mjs";
import { afWorkload, asWorkload, requestWorkload } from "../p-attr/carrier-workload.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { afFixtureState, afFixtures, recordAt } from "./p-attr-af-fixtures.mjs";
import { requestFixtureState } from "./p-attr-request-fixtures.mjs";
import { linkageWorkload } from "../p-attr/linkage-workload.mjs";

const HOOK_CASES = AF_CASES.filter((entry) => entry.group === "hook");
const HOOK_FACTS = [{ path: "actor.id", purpose: "authentication_failed", tenant_id: undefined, key_id: "k-run-01" }];
const HOOK_MUTATIONS = [
  ["purpose", (records) => { records[0].hook_facts[0].purpose = "authentication_succeeded"; }],
  ["extra callback", (records) => { records[0].hook_facts.push({ ...HOOK_FACTS[0] }); }],
];

test("AF-C2 supplied semantic purpose, absent effective tenant, synchronous transform and dropped key id", async () => {
  const state = afFixtureState();
  const keying = memoryKeying();
  await afWorkload({ state, keying, cases: HOOK_CASES });
  const record = recordAt(state, "AF-C2/ex");
  assert.deepEqual(record.hook_facts, HOOK_FACTS);
  const expected = keying.transform({ content: { value: "pid-ex-0001", origin: "CP" }, scope: "authentication_failed|platform-login" });
  assert.equal(record.events[0].actor.id, expected.value);
  assert.equal(record.captured_origins[0]["actor.id"], "CP");
  assert.equal(record.events[0].actor.provenance.trust_level, "client_claim");
  assert(!JSON.stringify(record.events).includes("k-run-01"));
  assert.equal(record.public_calls.filter((call) => call.label.endsWith(":actor.id hook")).length, 1);
  assert.deepEqual(recordAt(state, "AF-C2/absent-ex").hook_facts, []);
  assert.equal(recordAt(state, "AF-C2/absent-ex").public_calls.length, 7);
  assert.deepEqual(state.invalidations, []);
});

const DIAGNOSTICS = [
  ["AF-C2h-t/ex", "SDK_HOOK_FAILURE", 0],
  ["AF-C2-async/ex", "SDK_UNSUPPORTED_HOOK_RESULT", 1],
];
for (const [id, code, count] of DIAGNOSTICS) {
  test(`${id}: deliberate hook refusal remains an observation and continues`, async () => {
    const state = await afFixtures();
    const record = recordAt(state, id);
    assert.deepEqual(record.diagnostic, { code, category: "privacy", path: "/actor/id" });
    assert.equal(record.sink_count, 0);
    assert.equal(record.hook_facts.length, count);
    assert(recordAt(state, "AF-F4/nx").accepted);
    assert.deepEqual(state.invalidations, []);
  });
}

test("evaluator rejects hook purpose and extra-callback mutations against independent hook assertions", async () => {
  const state = await afFixtures();
  const records = [recordAt(state, "AF-C2/ex"), recordAt(state, "AF-C2/nx")];
  // Axis correctness has its own handwritten source oracle. This regression
  // isolates hook facts: evaluator assertions must not silently ignore them.
  const expected = records.map(({ step_id, analysis }) => ({ step_id, kind: "returned", accepted: true,
    diagnostic: undefined, sink_count: 1, frozen: [true], axes: analysis.axes, assertions: { hook_facts: HOOK_FACTS } }));
  const expectations = { cases: [{ case_id: "AF-C2", predicted_calls: 18, expected }] };
  assert.equal(evaluateCases({ records, expectations })[0].matched, true);
  for (const [label, mutate] of HOOK_MUTATIONS) {
    const changed = structuredClone(records);
    mutate(changed);
    const result = evaluateCases({ records: changed, expectations })[0];
    assert.equal(result.matched, false, label);
    assert(result.mismatches.some((issue) => issue.includes("hook_facts")), label);
  }
});

test("baseline refusal stops immediately; nonbaseline refusal does not invalidate", async () => {
  const state = await afFixtures({ mutate(observed) {
    observed.raw = { ok: false, error: { code: "DUPLICATE_AUTHORITY", category: "authority", path: "/actor" } };
  } });
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].step_id, "AF-B/ex");
  assert.match(state.invalidations[0].message, /precondition failed.*stopped/);
});

test("unexpected acceptance of an escalation negative is observed, not rewritten or invalidated", async () => {
  const state = await afFixtures({ mutate(observed) {
    if (observed.raw.ok) return;
    if (observed.raw.error.path !== "/actor/provenance/trust_level") return;
    observed.raw = { ok: true, value: { status: "accepted" } };
  } });
  assert.equal(recordAt(state, "AF-C8/ex").accepted, true);
  const entry = AF_CASES.find((item) => item.case_id === "AF-C8");
  assert.equal(entry.variants[0].source_outcome.accepted, false);
  assert(recordAt(state, "AF-F4/nx").accepted);
  assert.deepEqual(state.invalidations, []);
});

test("malformed baseline capture stops; sink captures remain detached from observations", async () => {
  const state = await afFixtures({ mutate(observed) { observed.raw.value.status = "altered"; } });
  assert.equal(state.records.length, 1);
  assert.match(state.invalidations[0].issues[0], /accepted result/);
  const complete = await afFixtures();
  const first = recordAt(complete, "AF-C1/ex");
  first.events[0].actor.id = "pid-mutated-0001";
  const constructor = first.public_calls.find((call) => call.label.endsWith(":claimedActor"));
  assert.equal(constructor.raw.id, "pid-ex-0001");
});

test("all families and linkage serialize only independent key id/purpose, never key material", async (t) => {
  // Deterministic synthetic entropy is injected only in this isolated test.
  const entropy = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
  t.mock.method(crypto, "randomBytes", () => entropy);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const keying = memoryKeying();
  assert.deepEqual(Object.keys(keying).sort(), ["metadata", "recompute", "transform"]);
  assert.equal(JSON.stringify(keying), JSON.stringify({ metadata: keying.metadata }));
  const state = requestFixtureState({ budget: 5000 });
  await afWorkload({ state, keying });
  await asWorkload({ state, keying });
  for (const family of ["PR", "RA"]) await requestWorkload({ family, state, keying });
  await linkageWorkload({ state, keying });
  const serialized = JSON.stringify({ calls: state.calls, records: state.records, datasets: state.linkage_datasets, linkage_calls: state.linkage_calls, keying });
  assert(!serialized.includes("Buffer"));
  assert(!serialized.includes("key_bytes"));
  assert.match(serialized, /k-run-01/);
  const representations = [entropy.toString("hex"), entropy.toString("base64"), [...entropy].join(",")];
  for (const encoded of representations) assert.equal(serialized.includes(encoded), false);
  assert.equal(Buffer.from(serialized).includes(entropy), false);
});

test("unexpected public factory throws remain observations; unknown workload faults propagate", async () => {
  const state = afFixtureState();
  const create = state.node.createNodeSecurityAuditSdk;
  state.node.createNodeSecurityAuditSdk = (config) => {
    if (state.current === "AF-C4") throw Object.assign(new Error("synthetic configuration refusal"), { code: "SDK_INVALID_CONFIGURATION", category: "configuration", path: "/sink" });
    return create(config);
  };
  await afWorkload({ state, keying: memoryKeying() });
  const record = recordAt(state, "AF-C4/ex");
  assert.equal(record.kind, "thrown");
  assert.equal(record.public_calls.at(-1).raw.code, "SDK_INVALID_CONFIGURATION");
  assert(recordAt(state, "AF-F4/nx").accepted);
  const unknown = { ...AF_CASES[1], scenario: "unknown" };
  await assert.rejects(afWorkload({ state: afFixtureState(), keying: memoryKeying(), cases: [unknown] }), /not a function/);
});

test("AF hook ledger exhaustion stays sticky even across the named-call boundary", async () => {
  const state = afFixtureState({ budget: 8 });
  const entry = AF_CASES.find((item) => item.case_id === "AF-C2");
  await assert.rejects(afWorkload({ state, keying: memoryKeying(), cases: [{ ...entry, variants: entry.variants.slice(0, 1) }] }), /budget/i);
  assert.equal(state.ledger.report().exhausted, true);
});
