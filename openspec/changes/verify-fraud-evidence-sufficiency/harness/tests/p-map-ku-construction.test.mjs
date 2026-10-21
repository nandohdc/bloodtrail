import assert from "node:assert/strict";
import test from "node:test";
import { LOCKOUT_CASES, UNLOCK_CASES } from "../p-map/lock-cases.mjs";
import { lockoutWorkload } from "../p-map/lockout-workload.mjs";
import { unlockWorkload } from "../p-map/unlock-workload.mjs";
import { compensationFacts } from "../p-map/lock-facts.mjs";
import { kuFixture } from "./p-map-ku-fixtures.mjs";

async function builtFixture() {
  const fixture = kuFixture();
  const lock = await lockoutWorkload(fixture.state);
  await unlockWorkload(fixture.state, lock);
  return { ...fixture, lock };
}

function recordFor(state, id) {
  return state.records.find((row) => row.step_id === id);
}

test("P-map K1 G36 failure remains targetless; K4 attaches an account through authorization instead", async () => {
  const { inputs } = await builtFixture();
  const failure = inputs.find((row) => row.case_id === "K1").input;
  assert.equal(failure.actor.type, "anonymous");
  assert.equal(failure.actor.id, undefined);
  assert.equal(failure.subject, undefined);
  assert.equal(failure.credential.reference, undefined);
  assert.equal(failure.resource, undefined);
  assert.equal(failure.authentication.failure_reason, "rate_limited");
  const denial = inputs.find((row) => row.case_id === "K4").input;
  assert.equal(denial.resource.id, "pmap-acct-0001");
  assert.equal(denial.authorization.decision, "deny");
  assert.equal(denial.operation, undefined);
});

test("P-map policy allow and accepted not_applicable remain different semantic candidates", async () => {
  const { inputs } = await builtFixture();
  const policy = inputs.find((row) => row.case_id === "K2a").input;
  const bypass = inputs.find((row) => row.case_id === "K2b").input;
  assert.equal(policy.authorization.decision, "allow");
  assert.equal(policy.authorization.policy_id, "pmap-pol-lockout-0001");
  assert.equal(policy.authorization.enforcement_point, "authn-svc");
  assert.equal(bypass.authorization.decision, "not_applicable");
  assert.notEqual(policy.operation, bypass.operation);
  const plan = LOCKOUT_CASES.find((row) => row.case_id === "K2a");
  assert.equal(plan.decision_source, "implementer default");
  assert.equal(plan.candidate_verdict, "STRAINED");
  assert.equal(plan.owner_review_required, true);
  assert.equal(plan.alternative_verdict.verdict, "MISREPRESENTS");
  assert.match(plan.alternative_verdict.condition, /not a genuine authorization decision/);
  assert.match(plan.alternative_verdict.consequence, /Criterion 2 fails on lockout/);
  assert.equal(LOCKOUT_CASES.find((row) => row.case_id === "K2b").candidate_verdict, "MISREPRESENTS");
});

test("P-map K3 does not disguise account relabelling as an honest configuration change", async () => {
  const { inputs } = await builtFixture();
  const variants = inputs.filter((row) => row.case_id === "K3");
  assert.deepEqual(variants.map((row) => row.input.resource.type), ["account", "security_configuration"]);
  assert.deepEqual(variants.map((row) => row.input.resource.id), ["pmap-acct-0001", "pmap-acct-0001"]);
  assert(variants.every((row) => row.input.actor.type === "workload_identity"));
  assert.equal(LOCKOUT_CASES.find((row) => row.case_id === "K3").candidate_verdict, "MISREPRESENTS");
});

test("P-map genuine K1/K2a linkage derives join facts without an extra signal emission", async () => {
  const { state, inputs } = await builtFixture();
  const failure = recordFor(state, "K1/attempt");
  const lock = recordFor(state, "K2a/policy");
  const first = failure.captures[0].event;
  const second = lock.captures[0].event;
  assert.equal(first.correlation.correlation_id, second.correlation.correlation_id);
  assert.equal(first.correlation.request_id, second.correlation.request_id);
  assert.equal(first.request.id, second.request.id);
  assert.equal(inputs.length, 15);
  assert(!state.calls.some((call) => call.label.startsWith("S-")));
  assert.equal(lock.join, undefined, "host linkage is a signal finding, not a K2a step assertion");
  assert.match(LOCKOUT_CASES.find((row) => row.case_id === "K2a").finding, /#806/);
});

test("P-map U1 scheduled and administrator unlocks each have their own explicit synthetic commit; lazy TTL is analysis only", async () => {
  const { state, inputs, lock } = await builtFixture();
  const releases = inputs.filter((row) => row.case_id === "U1");
  assert.deepEqual(releases.map((row) => row.input.actor.type), ["administrator", "scheduled_process", "administrator"]);
  assert.equal(new Set(releases.map((row) => row.input.operation)).size, 3);
  assert(releases.every((row) => row.input.operation !== lock.handle));
  for (const variant of ["administrator", "scheduled"]) {
    const mark = recordFor(state, `U1/${variant}-mark`);
    assert.equal(mark.synthetic_business_committed, true);
    assert.equal(mark.handle.state, "committed");
  }
  assert.equal(UNLOCK_CASES[0].lazy_expiry.emission, false);
  assert.match(UNLOCK_CASES[0].lazy_expiry.analysis, /no commit point/);
  assert(!state.records.some((row) => row.step_id.includes("lazy")));
});

test("P-map U2 reuses K2a SDK/handle, not another lock; #812 retains default partial compensation", async () => {
  const { state, inputs, lock } = await builtFixture();
  const [same, foreign, copied] = inputs.filter((row) => row.case_id === "U2");
  assert.equal(same.sdk, lock.target.sdk);
  assert.equal(same.input.operation, lock.handle);
  assert.equal(foreign.input.operation, lock.handle);
  assert.notEqual(foreign.sdk, same.sdk);
  assert.equal(copied.sdk, same.sdk);
  assert.notEqual(copied.input.operation, lock.handle);
  assert.deepEqual(copied.input.operation, {});
  const original = inputs.find((row) => row.case_id === "K2a").input;
  assert.deepEqual(same.input.authorization, original.authorization);
  assert.equal(same.input.actor.type, "service_account");
  assert.equal(same.input.event.lifecycle_phase, "compensating");
  assert.equal(same.input.event.outcome, undefined);
  assert.equal(same.input.event.outcome_reason, undefined);
  const release = recordFor(state, "U2/same-instance");
  assert.equal(release.occurrence.outcome, "partial");
  assert.equal(release.compensation.shared_transaction_id, true);
  assert.equal(lock.record.captures[0].event.event.commit_state, "committed");
  assert.equal(recordFor(state, "U2/compensate").synthetic_business_committed, false);
  assert.deepEqual(compensationFacts(lock.record, { captures: [] }), { complete: false });
  const unrelated = structuredClone(release);
  unrelated.captures[0].event.correlation.transaction_id = "pmap-unrelated-transaction";
  assert.equal(compensationFacts(lock.record, unrelated).shared_transaction_id, false);
  assert.match(UNLOCK_CASES[1].consistency_analysis, /#812.*default partial/);
});

test("P-map tenantless K/U controls remove all subject/resource tenant IDs without losing opaque account IDs", async () => {
  const { inputs, state } = await builtFixture();
  for (const id of ["K2a", "K2b", "K4", "U1"]) {
    const row = inputs.find((item) => item.case_id === id && item.input.tenant.scope === "tenantless");
    assert.equal(row.input.resource.owning_tenant_id, undefined);
    assert.equal(row.input.subject?.tenant_id, undefined);
    assert.equal(row.input.resource.id, "pmap-acct-0001");
    assert.equal(recordFor(state, `${id}/tenantless`).sink_count, 0);
  }
});
