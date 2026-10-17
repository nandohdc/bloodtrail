import assert from "node:assert/strict";
import test from "node:test";
import { AS_CASES, AS_MIRROR_PAIRS } from "../p-attr/as-cases.mjs";
import { AF_CASES } from "../p-attr/af-cases.mjs";
import { afWorkload, asVariant, asWorkload } from "../p-attr/carrier-workload.mjs";
import { joinFacts } from "../p-attr/comparison.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { asFixtureState, asFixtures } from "./p-attr-as-fixtures.mjs";
import { recordAt } from "./p-attr-af-fixtures.mjs";

const HOOK_FACT = { path: "actor.id", purpose: "authentication_succeeded", tenant_id: undefined, key_id: "k-run-01" };
const MIRRORS = [
  ["AF-C1/ex", "AS-X2/ex-0001"], ["AF-X1/ex", "AS-X2/ex-0001"], ["AF-X2/ex", "AS-X2/ex-0001"],
  ["AF-C3/ex", "AS-C3/ex"], ["AF-C4/ex", "AS-C4/ex"],
  ["AF-CR/ex", "AS-CR/ex"], ["AF-C6/ex", "AS-C6/ex"],
];
const REFUSAL = { code: "DUPLICATE_AUTHORITY", category: "authority", path: "/actor" };

function hookCases() {
  return AS_CASES.filter((entry) => entry.case_id === "AS-C2");
}

function asSide(record) {
  return { family: record.family, account: record.account, event: record.events[0] };
}

test("individual AS variant API preserves explicit account ground truth for later linkage workloads", async () => {
  const state = asFixtureState();
  const entry = AS_CASES.find((item) => item.case_id === "AS-X2");
  const record = await asVariant({ state, keying: memoryKeying(), entry, variant: entry.variants[1] });
  assert.equal(record.step_id, "AS-X2/ex-0002");
  assert.equal(record.account, "acct-0002");
  assert.equal(record.events[0].actor.id, "pid-ex-0002");
  assert.equal(record.events[0].authenticated_principal.id, "acct-0002");
  assert.equal(record.public_calls.length, 11);
});

test("AS-C2 hook executes before returned authority refusal and honest control only transforms actor.id", async () => {
  const state = asFixtureState();
  const keying = memoryKeying();
  await asWorkload({ state, keying, cases: hookCases() });
  const refused = recordAt(state, "AS-C2/ex");
  const honest = recordAt(state, "AS-C2/honest-control");
  for (const record of [refused, honest]) {
    assert.deepEqual(record.hook_facts, [HOOK_FACT]);
    assert.equal(record.public_calls.at(-2).label, "AS-C2:authenticationSucceeded");
    assert.equal(record.public_calls.at(-1).label, "AS-C2:actor.id hook");
    assert.equal(record.public_calls.at(-1).kind, "returned");
  }
  assert.equal(refused.accepted, false);
  assert.deepEqual(refused.public_calls.at(-2).raw, refused.raw);
  assert.equal(refused.public_calls.at(-1).raw.value, keying.transform({ content: { value: "pid-ex-0001", origin: "CP" }, scope: "authentication_succeeded|platform-login" }).value);
  assert.equal(honest.events[0].actor.id, keying.transform({ content: { value: "acct-0001", origin: "SR" }, scope: "authentication_succeeded|platform-login" }).value);
  assert.equal(honest.events[0].authenticated_principal.id, "acct-0001");
  assert.equal(honest.captured_origins[0]["actor.id"], "SR");
  assert.equal(honest.events[0].credential.key_id, undefined);
  assert(!JSON.stringify(honest.events).includes("k-run-01"));
});

test("AS-X2 supplies C1/X1/X2 raw mirrors; C4 requires its explicit skeptic pair and C2 cannot mirror", async () => {
  const state = asFixtureState();
  const keying = memoryKeying();
  const afIds = new Set(["AF-C1", "AF-C2", "AF-C3", "AF-C4", "AF-CR", "AF-C6", "AF-X1", "AF-X2"]);
  await afWorkload({ state, keying, cases: AF_CASES.filter((entry) => afIds.has(entry.case_id)) });
  assert.equal(recordAt(state, "AF-C1/nx").account, undefined);
  assert.equal(recordAt(state, "AF-C1/ex").account, "acct-0001");
  await asWorkload({ state, keying });
  for (const [fromId, toId] of MIRRORS) {
    const from = asSide(recordAt(state, fromId));
    const to = asSide(recordAt(state, toId));
    assert.equal(joinFacts({ from, to, pairs: [] }).length, 0);
    assert.equal(joinFacts({ from, to, pairs: AS_MIRROR_PAIRS }).length, 1, fromId);
  }
  const from = asSide(recordAt(state, "AF-C2/ex"));
  const to = asSide(recordAt(state, "AS-C2/honest-control"));
  assert.equal(joinFacts({ from, to, pairs: AS_MIRROR_PAIRS }).length, 0);
  const withoutSubjectPair = AS_MIRROR_PAIRS.filter((pair) => pair.to !== "subject.id");
  assert.equal(joinFacts({ from: asSide(recordAt(state, "AF-C4/ex")), to: asSide(recordAt(state, "AS-C4/ex")), pairs: withoutSubjectPair }).length, 0);
});

test("AS workload executes baseline first independently of comment order; refused baseline stops all observations", async () => {
  const state = asFixtureState({ mutate(observed) { observed.raw = { ok: false, error: REFUSAL }; } });
  await asWorkload({ state, keying: memoryKeying(), cases: [...AS_CASES].reverse() });
  assert.deepEqual(state.records.map((record) => record.step_id), ["AS-B/ex"]);
  assert.match(state.invalidations[0].message, /precondition failed.*AS cases stopped/);
});

function unexpectedRefusal(observed) {
  if (observed.event.subject === undefined) return;
  observed.raw = { ok: false, error: REFUSAL };
}

function unexpectedAcceptance(observed) {
  observed.raw = { ok: true, value: { status: "accepted" } };
}

const CONTINUATION = [["unexpected refusal", unexpectedRefusal], ["unexpected acceptance", unexpectedAcceptance]];
for (const [label, mutate] of CONTINUATION) {
  test(`AS nonbaseline ${label} is an observation, never a precondition invalidation`, async () => {
    const state = await asFixtures({ mutate });
    assert.equal(state.records.length, 21);
    assert.deepEqual(state.invalidations, []);
    assert(recordAt(state, "AS-X2/ex-0003").accepted);
    assert.equal(AS_CASES.find((entry) => entry.case_id === "AS-C0").variants[0].source_outcome.accepted, false);
  });
}

test("AS captured events are detached before mutation; live factories have opaque snapshots", async () => {
  const state = await asFixtures();
  const record = recordAt(state, "AS-X2/ex-0001");
  record.events[0].actor.id = "pid-altered-0001";
  const ctor = record.public_calls.filter((call) => call.label.endsWith(":authenticatedHumanActor")).at(-1);
  assert.equal(ctor.raw.id, "pid-ex-0001");
  const factory = record.public_calls.find((call) => call.label.endsWith(":createNodeSecurityAuditSdk"));
  assert.deepEqual(factory.raw, { representation: "opaque public return" });
});

test("AS callback budget exhaustion cannot be swallowed into a returned SDK refusal", async () => {
  const state = asFixtureState({ budget: 11 });
  const create = state.node.createNodeSecurityAuditSdk;
  state.node.createNodeSecurityAuditSdk = (config) => {
    const sdk = create(config);
    return { authenticationSucceeded: async (input) => {
      try { return await sdk.authenticationSucceeded(input); }
      catch { return { ok: false, error: { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" } }; }
    } };
  };
  await assert.rejects(asWorkload({ state, keying: memoryKeying(), cases: hookCases() }), /budget/i);
  assert.equal(state.ledger.report().exhausted, true);
});
