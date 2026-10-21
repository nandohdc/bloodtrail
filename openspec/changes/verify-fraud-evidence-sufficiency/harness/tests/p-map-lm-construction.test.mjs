import assert from "node:assert/strict";
import test from "node:test";
import { LOGOUT_CASES } from "../p-map/logout-cases.mjs";
import { MFA_CASES } from "../p-map/mfa-cases.mjs";
import { logoutWorkload } from "../p-map/logout-workload.mjs";
import { mfaWorkload } from "../p-map/mfa-workload.mjs";
import { LM_ORACLE, assertOracle } from "./p-map-lm-oracle.mjs";
import { lmFixture } from "./p-map-lm-fixtures.mjs";

const DENIAL_CASES = [
  { id: "L5a", path: "/operation/state", direct: undefined, sink: 0 },
  { id: "L5b", path: "/event/commit_state", direct: "not_committed", sink: 0 },
  { id: "L5c", path: undefined, direct: undefined, sink: 1 },
];

for (const item of DENIAL_CASES) test(`P-map ${item.id} explicitly constructs denied administrator revocation`, async () => {
  const { state, inputs } = lmFixture();
  await logoutWorkload(state, LOGOUT_CASES.filter((entry) => entry.case_id === item.id));
  const { input } = inputs[0];
  assert.equal(input.actor.type, "administrator");
  assert.equal(input.authorization.decision, "deny");
  assert.equal(input.event.outcome, "denied");
  assert.equal(input.event.commit_state, item.direct);
  assert.equal(state.records.at(-1).sink_count, item.sink);
  assert.equal(state.records.at(-1).diagnostic?.path, item.path);
  assertDenialHandle(state, input, item.id);
});

function assertDenialHandle(state, input, id) {
  if (id !== "L5c") return assert.equal(input.operation, undefined);
  assert.equal(input.operation.state, "not_committed");
  assert(state.calls.some((call) => call.label === "L5c:markNotCommitted"));
  assert(!state.calls.some((call) => call.label === "L5c:markCommitted"));
}

test("P-map L3 proves tenantless refusal leaves the same handle usable, with honest tenantless controls", async () => {
  const { state, inputs } = lmFixture();
  await logoutWorkload(state, LOGOUT_CASES.filter((entry) => entry.case_id === "L3"));
  const [refusal, retry, login, session] = inputs;
  assert.equal(refusal.input.tenant.scope, "tenantless");
  assert.equal(refusal.input.subject.tenant_id, undefined);
  assert.equal(refusal.input.resource.owning_tenant_id, undefined);
  assert.strictEqual(refusal.input.operation, retry.input.operation);
  assert.equal(retry.input.tenant.scope, "tenant");
  assert.equal(retry.input.operation.state, "committed");
  assert.equal(login.input.tenant.scope, "tenantless");
  assert.strictEqual(login.input.session, session.input.session);
  assert.equal(session.input.resource.id, retry.input.session.id);
  assert.equal(state.records.find((record) => record.step_id === "L3/usable-handle").occurrence.transaction_id_matches_handle, true);
});

test("P-map M4 distinguishes started transactional pending from explicit nontransactional evidence", async () => {
  const { state, inputs } = lmFixture();
  await mfaWorkload(state, MFA_CASES.filter((entry) => entry.case_id === "M4"));
  assert.deepEqual(inputs.map(({ input }) => input.operation.transactional), [true, false]);
  assert.deepEqual(inputs.map(({ input }) => input.operation.state), ["started", "started"]);
  const beginCalls = state.calls.filter((call) => call.label === "M4:beginOperation");
  assert.deepEqual(beginCalls.map((call) => call.raw.value.state), ["started", "started"]);
  assert.equal(state.records[1].sink_count, 0);
  assert.equal(state.records[3].occurrence.commit_state, "not_applicable");
});

test("P-map M1 preserves permitted second-factor reasons but sends no account carrier (G36)", async () => {
  const { state, inputs } = lmFixture();
  await mfaWorkload(state, [MFA_CASES[0]]);
  assert.deepEqual(inputs.map(({ input }) => input.tenant.scope), ["tenantless", "tenant"]);
  for (const { input } of inputs) {
    assert.equal(input.subject, undefined);
    assert.equal(input.credential.reference, undefined);
    assert.equal(input.actor.id, undefined);
    assert.equal(input.authentication.failure_reason, "mfa_failed");
    assert.equal(input.event.outcome_reason.code, "mfa_failed");
  }
});

test("P-map oracle checks dynamic occurrence and operation identities structurally, not as frozen values", async () => {
  for (const identityOffset of [0, 900]) {
    const { state } = lmFixture({ identityOffset });
    await logoutWorkload(state);
    await mfaWorkload(state);
    for (const row of LM_ORACLE) assertOracle(state.records.find((record) => record.step_id === row.step_id), row);
  }
});

test("P-map family containment never swallows sticky budget exhaustion", async () => {
  const { state } = lmFixture({ budget: 3 });
  await assert.rejects(logoutWorkload(state), /budget exhausted/);
  assert.equal(state.ledger.report().exhausted, true);
  assert.deepEqual(state.case_aborts, []);
  assert(!state.records.some((record) => record.step_id.startsWith("L2/")));
});
