import assert from "node:assert/strict";
import test from "node:test";
import { CONTACT_CASES } from "../p-map/contact-cases.mjs";
import { brandWorkload, contactWorkload } from "../p-map/contact-workload.mjs";
import { replacementFacts } from "../p-map/contact-facts.mjs";
import { assertOracle } from "./p-map-lm-oracle.mjs";
import { CX_ORACLE } from "./p-map-cx-oracle.mjs";
import { cxFixture } from "./p-map-cx-fixtures.mjs";

async function contactCase(case_id, options) {
  const fixture = cxFixture(options);
  await contactWorkload(fixture.state, CONTACT_CASES.filter((entry) => entry.case_id === case_id));
  assert.deepEqual(fixture.state.case_aborts, []);
  return fixture;
}

const FRESH_FIELDS = ["actor", "tenant", "authorization", "subject", "resource", "source", "authentication", "credential"];
function assertFreshContexts(inputs) {
  for (const field of FRESH_FIELDS) {
    const values = inputs.map(({ input }) => input[field]).filter((value) => value !== undefined);
    assert.equal(new Set(values).size, values.length, `fresh ${field} per emission`);
  }
}

test("P-map C1 email and non-factor phone use only opaque categories, fresh handles and constructors", async () => {
  const { inputs } = await contactCase("C1");
  assertFreshContexts(inputs);
  assert.deepEqual(inputs.map(({ input }) => input.resource.change_categories), [["contact_email"], ["contact_phone"]]);
  assert.notStrictEqual(inputs[0].input.operation, inputs[1].input.operation);
  for (const { input } of inputs) {
    assert.equal(input.resource.type, "account");
    assert.equal(input.credential, undefined);
    assert.equal(input.authorization.decision, "allow");
    assert.equal(input.operation.state, "committed");
  }
});

test("P-map C2a copies all four accepted category values unchanged into recursively frozen captures", async () => {
  const { state, inputs } = await contactCase("C2a");
  assertFreshContexts(inputs);
  const records = state.records.filter((row) => row.sink_count === 1);
  assert.equal(records.length, 4);
  for (const [index, row] of records.entries()) {
    const categories = row.captures[0].event.resource.change_categories;
    assert.deepEqual(categories, inputs[index].input.resource.change_categories);
    assert(Object.isFrozen(categories));
    assert.notStrictEqual(categories, inputs[index].input.resource.change_categories);
  }
  assert(Object.isFrozen(records[1].captures[0].event.resource.change_categories[0]));
  assert(Object.isFrozen(records[2].captures[0].event.resource.change_categories[0]));
  assert.equal(Buffer.byteLength(inputs[3].input.resource.change_categories[0]), 4000);
  assert.equal(Buffer.byteLength(inputs[4].input.resource.change_categories[0]), 8193);
  assert.equal(state.records.at(-1).sink_count, 0);
});

test("P-map C2b supplies seventeen distinct short items, separating schema count from scan caps", async () => {
  const { state, inputs } = await contactCase("C2b");
  const categories = inputs[0].input.resource.change_categories;
  assert.equal(categories.length, 17);
  assert.equal(new Set(categories).size, 17);
  assert(categories.every((value) => Buffer.byteLength(value) < 8192));
  assert.equal(state.records.at(-1).diagnostic.path, "/resource/change_categories");
  assert.equal(state.records.at(-1).sink_count, 0);
});

test("P-map C3 and C4 retain accepted meaning misuses instead of treating acceptance as honest fit", async () => {
  const smuggled = await contactCase("C3");
  assert.deepEqual(smuggled.inputs[0].input.resource.change_categories, ["contact_email", "after-val-0001"]);
  assert.deepEqual(smuggled.state.records.at(-1).signal.change_categories, ["contact_email", "after-val-0001"]);
  const configuration = await contactCase("C4");
  const { input, method } = configuration.inputs[0];
  assert.equal(method, "securityConfigurationChanged");
  assert.equal(input.actor.type, "authenticated_human");
  assert.equal(input.resource.type, "account");
  assert.equal(input.resource.operation_type, "configure");
  assert.equal(input.operation.state, "committed");
});

test("P-map C5 shares only its committed handle, completes two names and reuses structural evidence for rotation", async () => {
  const { state, inputs, configs } = await contactCase("C5");
  assert.equal(configs.length, 1);
  assertFreshContexts(inputs);
  assert.deepEqual(inputs.map(({ method }) => method), ["mfaRemoved", "mfaEnrolled"]);
  const [removed, enrolled] = inputs.map(({ input }) => input);
  assert.strictEqual(removed.operation, enrolled.operation);
  assert.equal(removed.operation.state, "committed");
  assert.equal(removed.operation.boundEvent, undefined);
  assert.deepEqual([removed.resource.operation_type, enrolled.resource.operation_type], ["delete", "create"]);
  assert.notEqual(removed.resource.id, enrolled.resource.id);
  for (const { input } of inputs) {
    assert.equal(input.resource.type, "credential");
    assert.equal(input.credential.type, "mfa_factor");
    assert.equal(input.authorization.capability, "account.mfa.update");
  }
  assert.equal(state.records.at(-1).replacement.shared_transaction_id, true);
  assert.equal(state.calls.filter((call) => call.label === "C5:beginOperation").length, 1);
});

test("P-map C6 omits tenant IDs but keeps resource ID for tenantless refusal", async () => {
  const { inputs } = await contactCase("C6");
  const { input } = inputs[0];
  assert.equal(input.tenant.scope, "tenantless");
  assert.equal(input.subject.tenant_id, undefined);
  assert.equal(input.resource.owning_tenant_id, undefined);
  assert.equal(input.resource.id, "pmap-acct-0001");
});

test("P-map X1 intentionally spreads one constructor, without a second core or foreign context", async () => {
  const { state, inputs, identities } = cxFixture();
  await brandWorkload(state);
  assert.deepEqual(state.case_aborts, []);
  assert.equal(identities.has(inputs[0].input.resource), false);
  assert.equal(identities.has(inputs[0].input.actor), true);
  assert.equal(state.calls.filter((call) => call.label === "X1:authoritativeResource").length, 1);
  assert.equal(state.records.at(-1).diagnostic.code, "AUTHORITY_ESCALATION");
});

test("P-map C5 identity facts survive unrelated dynamic IDs and remain locally incomplete on missing capture", async () => {
  for (const identityOffset of [0, 700]) {
    const { state } = await contactCase("C5", { identityOffset });
    for (const row of CX_ORACLE.filter((item) => item.step_id.startsWith("C5/"))) {
      assertOracle(state.records.find((item) => item.step_id === row.step_id), row);
    }
    assert.deepEqual(replacementFacts({ captures: [] }, state.records.at(-1)), { complete: false });
    assert.deepEqual(replacementFacts(state.records.at(-2), { captures: [] }), { complete: false });
  }
});

test("P-map contact containment never hides sticky public-call budget exhaustion", async () => {
  const { state } = cxFixture({ budget: 3 });
  await assert.rejects(contactWorkload(state), /budget exhausted/);
  assert.equal(state.ledger.report().exhausted, true);
  assert.deepEqual(state.case_aborts, []);
  assert(!state.records.some((row) => row.step_id.startsWith("C2a/")));
});
