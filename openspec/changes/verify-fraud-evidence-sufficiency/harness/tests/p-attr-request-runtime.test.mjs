import assert from "node:assert/strict";
import test from "node:test";
import { AS_CASES } from "../p-attr/as-cases.mjs";
import { asWorkload, requestVariant, requestWorkload } from "../p-attr/carrier-workload.mjs";
import { PR_CASES, RA_CASES, REQUEST_JOIN_PAIRS } from "../p-attr/request-cases.mjs";
import { joinFacts } from "../p-attr/comparison.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { recordAt } from "./p-attr-af-fixtures.mjs";
import { REQUEST_FAMILIES, requestFixtureState, requestFixtures } from "./p-attr-request-fixtures.mjs";

const CASES = new Map([["PR", PR_CASES], ["RA", RA_CASES]]);
const REFUSAL = { ok: false, error: { code: "DUPLICATE_AUTHORITY", category: "authority", path: "/actor" } };
const TENANT = { scope: "tenant", actor_tenant_id: "tnt-a01", effective_tenant_id: "tnt-a01", resource_tenant_id: "tnt-a01" };
const PEERS = ["subject", "resource"];
const CONTINUATION = [
  ["unexpected refusal", (observed) => { if (observed.event.subject !== undefined) observed.raw = REFUSAL; }],
  ["unexpected acceptance", (observed) => { observed.raw = { ok: true, value: { status: "accepted" } }; }],
];
function hookEntry(family) {
  return CASES.get(family).find((entry) => entry.case_id === `${family}-C2`);
}
function joinSide(record) {
  return { family: record.family, account: record.account, event: record.events[0] };
}
async function hookFixture({ row, tenant }) {
  const state = requestFixtureState();
  if (tenant !== undefined) state.core.authoritativeTenant = () => ({ ...tenant });
  const keying = memoryKeying();
  const entry = hookEntry(row.family);
  const record = await requestVariant({ family: row.family, state, keying, entry, variant: entry.variants[0] });
  return { state, keying, record };
}
function hookCheck({ row, record, keying, tenant }) {
  const fact = { path: "actor.id", purpose: row.purpose, tenant_id: tenant, key_id: "k-run-01" };
  assert.deepEqual(record.hook_facts, [fact]);
  const scope = `${row.purpose}|${tenant ?? "platform-login"}`;
  const transformed = keying.transform({ content: { value: "pid-ex-0001", origin: "CP" }, scope });
  assert.equal(record.events[0].actor.id, transformed.value);
  assert.equal(record.captured_origins[0]["actor.id"], "CP");
  assert.equal(record.events[0].actor.provenance.trust_level, "client_claim");
  assert(!JSON.stringify(record.events).includes("k-run-01"));
  assert.equal(record.public_calls.at(-2).label, `${row.family}-C2:${row.method}`);
  assert.equal(record.public_calls.at(-1).label, `${row.family}-C2:actor.id hook`);
  assert.equal(record.public_calls.length, 8);
}

for (const row of REQUEST_FAMILIES) {
  const { family } = row;
  for (const tenant of [undefined, TENANT]) {
    test(`${family} hook uses supplied purpose/effective tenant (${tenant === undefined ? "absent" : "resolved"}) without promoting CP`, async () => {
      const { record, keying } = await hookFixture({ row, tenant });
      hookCheck({ row, record, keying, tenant: tenant?.effective_tenant_id });
    });
  }
  test(`${family} safely resolved C5 subject AND resource join by SR account, never an nx account`, async () => {
    const state = requestFixtureState();
    const keying = memoryKeying();
    await requestWorkload({ family, state, keying });
    await asWorkload({ state, keying, cases: AS_CASES.filter((entry) => entry.case_id === "AS-B") });
    const to = joinSide(recordAt(state, "AS-B/ex"));
    for (const mode of PEERS) checkResolvedPair({ family, state, to, mode });
  });
  test(`${family} baseline refusal stops reordered plan, even before the second baseline variant`, async () => {
    const state = requestFixtureState({ mutate(observed) { observed.raw = REFUSAL; } });
    await requestWorkload({ family, state, keying: memoryKeying(), cases: [...CASES.get(family)].reverse() });
    assert.deepEqual(state.records.map((record) => record.step_id), [`${family}-B/ex`]);
    assert.match(state.invalidations[0].message, /precondition failed.*cases stopped/);
  });
  for (const [label, mutate] of CONTINUATION) {
    test(`${family} nonbaseline ${label} continues as observation`, async () => {
      const state = await requestFixtures({ family, mutate });
      assert.equal(state.records.length, 32);
      assert.deepEqual(state.invalidations, []);
      assert(recordAt(state, `${family}-X2/nx`).accepted);
    });
  }
  test(`${family} hook exhaustion remains sticky through SDK containment`, async () => {
    const state = requestFixtureState({ budget: 7 });
    const create = state.node.createNodeSecurityAuditSdk;
    state.node.createNodeSecurityAuditSdk = (config) => ({ [row.method]: async (input) => {
      try { return await create(config)[row.method](input); }
      catch { return { ok: false, error: { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" } }; }
    } });
    const entry = hookEntry(family);
    await assert.rejects(requestVariant({ family, state, keying: memoryKeying(), entry, variant: entry.variants[0] }), /budget/i);
    assert.equal(state.ledger.report().exhausted, true);
  });
}

function checkResolvedPair({ family, state, to, mode }) {
  const ex = recordAt(state, `${family}-C5/${mode}-ex`);
  const nx = recordAt(state, `${family}-C5/${mode}-nx`);
  assert.equal(ex.accepted, true);
  assert.equal(nx.accepted, true);
  assert.equal(ex.analysis.axes.discloses_existence, true);
  assert.equal(nx.account, undefined);
  assert.equal(nx.events[0].subject, undefined);
  assert.equal(nx.events[0].resource.id, undefined);
  assert.equal(joinFacts({ from: joinSide(ex), to, pairs: [] }).length, 0);
  const facts = joinFacts({ from: joinSide(ex), to, pairs: REQUEST_JOIN_PAIRS });
  assert.equal(facts.length, 1);
  assert.equal(facts[0].value, "acct-0001");
  assert.equal(facts[0].from, `${mode}.id`);
  assert.equal(joinFacts({ from: joinSide(nx), to, pairs: REQUEST_JOIN_PAIRS }).length, 0);
}

test("PR/RA hook domains differ under one memory-only key; host mirror domains do not change", async () => {
  const state = requestFixtureState();
  const keying = memoryKeying();
  for (const { family } of REQUEST_FAMILIES) await requestWorkload({ family, state, keying });
  const record = (family, suffix) => recordAt(state, `${family}-${suffix}/ex`).events[0];
  assert.notEqual(record("PR", "C2").actor.id, record("RA", "C2").actor.id);
  assert.equal(record("PR", "CR").resource.id, record("RA", "CR").resource.id);
  assert.equal(record("PR", "C6").credential.reference, record("RA", "C6").credential.reference);
});

test("request workload rejects unknown family before any public call", () => {
  const state = requestFixtureState();
  assert.throws(() => requestWorkload({ family: "unknown", state, keying: memoryKeying() }), /unsupported request family/);
  assert.deepEqual(state.calls, []);
});
