import assert from "node:assert/strict";
import { test } from "node:test";
import { syntheticClock } from "../lib/clock.mjs";
import { chainsCore, createChainsNodeSecurityAuditSdk } from "./chains-fakes.mjs";
import { buildEventInput, generateWorkloadDefinition } from "../chains/workload.mjs";

function makeTestSdk(sinkEvents = []) {
  const sink = {
    emit: async (event) => {
      sinkEvents.push(event);
      return { status: "accepted" };
    },
  };
  const sdk = createChainsNodeSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "test-producer", version: "1.0.0" },
    service: { name: "test-service", version: "1.0.0" },
    environment: { name: "synthetic" },
    sink,
    clock: syntheticClock({ start: "2026-10-23T00:00:00.000Z", stepMs: 1000 }),
  });
  return { sdk, sinkEvents };
}

function makeHonestInput(method) {
  const core = chainsCore();
  const identity = {
    accountId: "syn-acc-1",
    tenantId: "syn-ten-1",
    credentialId: "syn-crd-1",
    sessionHandle: "syn-hdl-1",
    address: "203.0.113.10",
    requestId: "syn-req-1",
    causationId: "syn-evt-1",
    originalEventId: "syn-evt-0",
  };
  return buildEventInput({
    core,
    method,
    identity,
    at: "2026-10-23T00:00:00.000Z",
    sessionKey: "syn-key-840",
  });
}

function makeCommittedHandle(sdk, method) {
  const op = sdk.beginOperation({ boundEvent: method });
  op.value.markCommitted();
  return op.value;
}

function assertFailure(result, code, path) {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code);
  if (path !== undefined) {
    assert.equal(result.error.path, path);
  }
}

async function verifyTxBoundFailure({ sdk, method, honest, omittedField, expectedCode, expectedPath }) {
  const resNoOp = await sdk[method]({ ...honest });
  assertFailure(resNoOp, "PREMATURE_SUCCESS", "/operation/state");

  const handle = makeCommittedHandle(sdk, method);
  const modified = { ...honest, [omittedField]: undefined, operation: handle };
  const resField = await sdk[method](modified);
  assertFailure(resField, expectedCode, expectedPath);

  const resHonest = await sdk[method]({ ...honest, operation: handle });
  assert.equal(resHonest.ok, true);
}

test("Q219: authenticationSucceeded refuses missing required context, honest input passes", async () => {
  const { sdk } = makeTestSdk();
  const honest = makeHonestInput("authenticationSucceeded");

  const noCred = { ...honest, credential: undefined };
  const resCred = await sdk.authenticationSucceeded(noCred);
  assertFailure(resCred, "SDK_MISSING_EVENT_FIELD", "/credential");

  const noSess = { ...honest, session: undefined };
  const resSess = await sdk.authenticationSucceeded(noSess);
  assertFailure(resSess, "SDK_MISSING_EVENT_FIELD", "/session");

  const noSrc = { ...honest, source: undefined };
  const resSrc = await sdk.authenticationSucceeded(noSrc);
  assertFailure(resSrc, "SDK_MISSING_EVENT_FIELD", "/source");

  const noActor = { ...honest, actor: undefined };
  const resActor = await sdk.authenticationSucceeded(noActor);
  assertFailure(resActor, "MISSING_REQUIRED_ACTOR");

  const resHonest = await sdk.authenticationSucceeded(honest);
  assert.equal(resHonest.ok, true);
});

test("Q219: sessionCreated refuses missing required context, honest input passes", async () => {
  const { sdk } = makeTestSdk();
  const honest = makeHonestInput("sessionCreated");

  const noTenant = { ...honest, tenant: undefined };
  const resTenant = await sdk.sessionCreated(noTenant);
  assertFailure(resTenant, "MISSING_TENANT_CONTEXT");

  const noPrinc = { ...honest, authenticated_principal: undefined };
  const resPrinc = await sdk.sessionCreated(noPrinc);
  assertFailure(resPrinc, "SDK_MISSING_EVENT_FIELD", "/authenticated_principal");

  const resHonest = await sdk.sessionCreated(honest);
  assert.equal(resHonest.ok, true);
});

test("Q219: mfaRemoved refuses missing commit state or context, honest input passes", async () => {
  const { sdk } = makeTestSdk();
  const honest = makeHonestInput("mfaRemoved");

  const noOp = { ...honest };
  const resNoOp = await sdk.mfaRemoved(noOp);
  assertFailure(resNoOp, "PREMATURE_SUCCESS", "/operation/state");

  const uncommitted = sdk.beginOperation({ boundEvent: "mfaRemoved" }).value;
  const resUncommitted = await sdk.mfaRemoved({ ...honest, operation: uncommitted });
  assertFailure(resUncommitted, "PREMATURE_SUCCESS");

  const handle = makeCommittedHandle(sdk, "mfaRemoved");
  const noSubj = { ...honest, subject: undefined, operation: handle };
  const resSubj = await sdk.mfaRemoved(noSubj);
  assertFailure(resSubj, "SDK_MISSING_EVENT_FIELD", "/subject");

  const honestWithOp = { ...honest, operation: makeCommittedHandle(sdk, "mfaRemoved") };
  const resHonest = await sdk.mfaRemoved(honestWithOp);
  assert.equal(resHonest.ok, true);
});

test("Q219: passwordResetCompleted refuses missing commit state, causation, or context", async () => {
  const { sdk } = makeTestSdk();
  const honest = makeHonestInput("passwordResetCompleted");
  await verifyTxBoundFailure({
    sdk,
    method: "passwordResetCompleted",
    honest,
    omittedField: "correlation",
    expectedCode: "BAD_CAUSALITY",
    expectedPath: "/correlation",
  });
});

test("Q219: sessionRevoked refuses missing commit state or context, honest input passes", async () => {
  const { sdk } = makeTestSdk();
  const honest = makeHonestInput("sessionRevoked");
  await verifyTxBoundFailure({
    sdk,
    method: "sessionRevoked",
    honest,
    omittedField: "authorization",
    expectedCode: "SDK_MISSING_EVENT_FIELD",
    expectedPath: "/authorization",
  });
});

test("Q219, Q222, Q236: authenticationFailed enforces request context and real semantic rules", async () => {
  const { sdk } = makeTestSdk();
  const honest = makeHonestInput("authenticationFailed");

  const noReq = { ...honest, request: undefined };
  const resNoReq = await sdk.authenticationFailed(noReq);
  assertFailure(resNoReq, "SDK_MISSING_EVENT_FIELD", "/request");

  const withAccountSubject = { ...honest, subject: { type: "account", id: "syn-acc-1" } };
  const resSubj = await sdk.authenticationFailed(withAccountSubject);
  assertFailure(resSubj, "SDK_SEMANTIC_VALIDATION_FAILED", "/subject/type");

  const withCred = { ...honest, credential: { type: "password", reference: "syn-crd-1" } };
  const resCred = await sdk.authenticationFailed(withCred);
  assert.equal(resCred.ok, true);

  const withCredSubject = { ...honest, subject: { type: "credential", id: "syn-crd-1" } };
  const resCredSubj = await sdk.authenticationFailed(withCredSubject);
  assert.equal(resCredSubj.ok, true);

  const resHonest = await sdk.authenticationFailed(honest);
  assert.equal(resHonest.ok, true);
});

test("Q236: tenant-scoped event refuses conflicting resource owning_tenant_id", async () => {
  const { sdk } = makeTestSdk();
  const honest = makeHonestInput("mfaRemoved");
  const handle = makeCommittedHandle(sdk, "mfaRemoved");
  const conflicting = {
    ...honest,
    operation: handle,
    resource: {
      type: "credential",
      id: "syn-crd-1",
      owning_tenant_id: "syn-ten-conflicting",
    },
  };
  const res = await sdk.mfaRemoved(conflicting);
  assertFailure(res, "TENANT_RESOURCE_CONFLICT", "/resource/owning_tenant_id");
});

function buildRound1WorkloadStep(step, core, sessionKey) {
  const { identity, method, at } = step;
  const input = buildEventInput({ core, method, identity, at, sessionKey });

  if (method === "authenticationFailed") {
    const { request: _req, ...withoutRequest } = input;
    return { method, input: withoutRequest };
  }

  return { method, input };
}

test("Round 1 defect reproduction: fake SDK refuses 24 of 36 calls before reaching sink", async () => {
  const sinkEvents = [];
  const { sdk } = makeTestSdk(sinkEvents);
  const core = chainsCore();

  const workload = generateWorkloadDefinition({
    seed: 840001,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });

  const results = [];
  for (const step of workload.submissionSteps) {
    const { method, input } = buildRound1WorkloadStep(step, core, workload.sessionKey);
    const res = await sdk[method](input);
    results.push({ method, res });
  }

  assert.equal(results.length, 36, "workload must have 36 calls");

  const refused = results.filter((r) => !r.res.ok);
  const accepted = results.filter((r) => r.res.ok);

  assert.equal(refused.length, 24, "fake SDK must refuse exactly 24 of 36 calls on Round 1 input");
  assert.equal(accepted.length, 12, "fake SDK must accept exactly 12 of 36 calls on Round 1 input");
  assert.equal(sinkEvents.length, 12, "sink must only receive the 12 accepted events");

  const txBoundRefused = refused.filter((r) => ["mfaRemoved", "passwordResetCompleted", "sessionRevoked"].includes(r.method));
  assert.equal(txBoundRefused.length, 18, "all 18 transaction-bound calls must be refused");
  for (const item of txBoundRefused) {
    assert.equal(item.res.error.code, "PREMATURE_SUCCESS");
    assert.equal(item.res.error.path, "/operation/state");
  }

  const failedAuthRefused = refused.filter((r) => r.method === "authenticationFailed");
  assert.equal(failedAuthRefused.length, 6, "all 6 failed-authentication calls must be refused");
  for (const item of failedAuthRefused) {
    assert.equal(item.res.error.code, "SDK_MISSING_EVENT_FIELD");
    assert.equal(item.res.error.path, "/request");
  }
});
