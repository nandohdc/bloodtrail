import assert from "node:assert/strict";
import test from "node:test";
import { ROTATION_CASES } from "../p-map/rotation-cases.mjs";
import { rotationWorkload } from "../p-map/rotation-workload.mjs";
import { capturedOriginal, rotationLinkFacts } from "../p-map/rotation-facts.mjs";
import { rotationFixture } from "./p-map-r-fixtures.mjs";

async function builtRotation() {
  const fixture = rotationFixture();
  await rotationWorkload(fixture.state);
  return fixture;
}

function recordFor(state, id) {
  return state.records.find((row) => row.step_id === id);
}

test("P-map R1 has genuine handle/commit and all required contexts but neither causality field", async () => {
  const { inputs, state } = await builtRotation();
  const { input } = inputs.find((row) => row.case_id === "R1");
  for (const field of ["actor", "subject", "tenant", "authentication", "session", "resource", "authorization", "operation"]) assert(input[field]);
  assert.equal(input.correlation, undefined);
  assert.equal(input.operation.state, "committed");
  assert.equal(input.resource.type, "credential");
  assert.equal(input.resource.operation_type, "update");
  const record = recordFor(state, "R1/unlinked");
  assert.equal(record.sink_count, 0);
  assert.deepEqual(record.diagnostic, { code: "BAD_CAUSALITY", category: "validation", path: "/correlation" });
  assert.match(ROTATION_CASES[0].consistency_analysis, /#812.*#797/);
});

test("P-map R2 gets both event links from the captured request, preserving shared operation without a request handle", async () => {
  const { inputs, state } = await builtRotation();
  const [request, completion] = inputs.filter((row) => row.case_id === "R2");
  const original = recordFor(state, "R2/pair-request");
  const completed = recordFor(state, "R2/pair-completed");
  const id = original.captures[0].event.event.id;
  assert.equal(original.raw.value.id, undefined);
  assert.equal(request.input.operation, undefined);
  assert.equal(request.input.correlation.operation_id, completion.input.operation.operationId);
  assert.equal(request.input.correlation.correlation_id, completion.input.operation.correlationId);
  assert.deepEqual(completion.input.correlation, { causation_id: id, original_event_id: id });
  assert.equal(request.sdk, completion.sdk);
  assert.equal(completed.causality.shared_operation_id, true);
  assert.equal(original.occurrence.event_name, "bloodtrail.audit.account.password_reset.requested");
  assert.equal(completion.input.authorization.decision, "allow");
  assert.equal(completion.input.authorization.enforcement_point, "credential-handler");
  const begin = state.records.findIndex((row) => row.step_id === "R2/pair-begin");
  const emission = state.records.indexOf(original);
  const mark = state.records.findIndex((row) => row.step_id === "R2/pair-mark");
  assert(begin < emission && emission < mark && mark < state.records.indexOf(completed));
  assert.equal(state.records[mark].synthetic_business_committed, true);
});

test("P-map R3 records a real login link as accepted semantic misrepresentation, not missing causality", async () => {
  const { inputs, state } = await builtRotation();
  const [login, completion] = inputs.filter((row) => row.case_id === "R3");
  const capturedLogin = recordFor(state, "R3/login");
  assert.equal(login.method, "authenticationSucceeded");
  assert.equal(login.input.tenant.scope, "tenantless");
  assert.equal(completion.input.correlation.original_event_id, capturedLogin.captures[0].event.event.id);
  assert.equal(completion.input.correlation.causation_id, completion.input.correlation.original_event_id);
  assert.equal(recordFor(state, "R3/completed").accepted, true);
  assert.equal(capturedLogin.occurrence.event_name, "bloodtrail.audit.authentication.succeeded");
  assert.equal(ROTATION_CASES.find((row) => row.case_id === "R3").candidate_verdict, "MISREPRESENTS");
});

test("P-map R2 owner-review reset-only reading cannot be hidden by API credential or MFA factor coverage", () => {
  const plan = ROTATION_CASES.find((row) => row.case_id === "R2");
  assert.equal(plan.decision_source, "implementer default");
  assert.equal(plan.owner_review_required, true);
  assert.equal(plan.candidate_verdict, "STRAINED");
  assert.match(plan.rubric_reasons.join(" "), /Authenticated actor and takeover\/credential lifecycle/);
  assert.equal(plan.alternative_verdict.verdict, "MISREPRESENTS");
  assert.match(plan.alternative_verdict.condition, /Reset only.*authenticated password change/);
  assert.match(plan.alternative_verdict.consequence, /Criterion 2 fails on password-change/);
  assert.deepEqual(plan.coverage, { password: "R2", api_other: "R4", mfa_factor: "C5", substitutes_for_password: false });
});

test("P-map R4 human/service variants rotate an API credential honestly; R5 retains wrong resource meaning", async () => {
  const { inputs } = await builtRotation();
  const rotations = inputs.filter((row) => row.case_id === "R4");
  assert.deepEqual(rotations.map((row) => row.input.actor.type), ["authenticated_human", "service_account", "authenticated_human"]);
  assert.equal(new Set(rotations.map((row) => row.input.operation)).size, 3);
  for (const { input } of rotations) {
    assert.equal(input.resource.type, "credential");
    assert.equal(input.credential.type, "api_credential");
    assert.equal(input.authorization.capability, "credential.rotate");
    assert.deepEqual(input.resource.change_categories, ["rotation"]);
  }
  const roles = inputs.filter((row) => row.method === "roleAssigned");
  assert.deepEqual(roles.map((row) => row.input.actor.type), ["authenticated_human", "administrator"]);
  assert(roles.every((row) => row.input.resource.type === "role" && row.input.resource.id === rotations[0].input.resource.id));
  assert(roles.every((row) => row.input.event.outcome_reason.code === "completed"));
  assert.equal(ROTATION_CASES.find((row) => row.case_id === "R5b").candidate_verdict, "MISREPRESENTS");
});

test("P-map R2/R4 tenantless refusals retain valid causal/commit inputs, not spurious missing contexts", async () => {
  const { inputs, state } = await builtRotation();
  const variants = inputs.filter((row) => row.input.tenant.scope === "tenantless" && row.method !== "authenticationSucceeded");
  for (const { input } of variants) {
    assert.equal(input.subject?.tenant_id, undefined);
    assert.equal(input.resource?.owning_tenant_id, undefined);
  }
  for (const id of ["R2/tenantless-completed", "R4/tenantless"]) {
    assert.equal(recordFor(state, id).sink_count, 0);
    assert.equal(recordFor(state, id).diagnostic.path, "/tenant/scope");
  }
  const completion = variants.find((row) => row.method === "passwordResetCompleted");
  assert.equal(completion.input.operation.state, "committed");
  assert.equal(typeof completion.input.correlation.original_event_id, "string");
  assert.equal(recordFor(state, "R2/tenantless-request").accepted, true);
});

test("P-map R causal facts distinguish absent captures, missing links and changed timestamps without freezing IDs", async () => {
  const { state } = await builtRotation();
  const first = recordFor(state, "R2/pair-request");
  const completed = structuredClone(recordFor(state, "R2/pair-completed"));
  const expected = completed.causality;
  completed.captures[0].event.event.timestamp = "2026-10-21T00:00:00.000Z";
  assert.deepEqual(rotationLinkFacts(first, completed), expected);
  for (const field of ["causation_id", "original_event_id"]) {
    const missing = structuredClone(completed);
    delete missing.captures[0].event.correlation[field];
    const facts = rotationLinkFacts(first, missing);
    assert.equal(facts.complete, true);
    assert.equal(facts[field === "causation_id" ? "causation_matches_original" : "original_event_matches_original"], false);
  }
  assert.deepEqual(rotationLinkFacts(undefined, completed), { complete: false });
  assert.deepEqual(rotationLinkFacts(first, { captures: [] }), { complete: false });
  assert.throws(() => capturedOriginal({ accepted: false, captures: [] }), /precursor prerequisite failed/);
  assert.throws(() => capturedOriginal({ accepted: true, captures: [{ event: { event: { id: "" } } }] }), /no event ID/);
});
