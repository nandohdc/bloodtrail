import assert from "node:assert/strict";
import { test } from "node:test";
import { countsCore, createCountsSdk } from "./counts-fakes.mjs";
import { invalidBrand } from "./counts-fake-brands.mjs";
import { outboxCore, unbrandedPath } from "./outbox-fake-core.mjs";
import { transition } from "./counts-fake-operations.mjs";
import { inputFor, workloadFor } from "../counts/workload.mjs";
import { FROZEN } from "./counts-rehearsal.mjs";

test("shared branding keeps counts and outbox authority registries separate", () => {
  const countsActor = countsCore().authenticatedHumanActor({ id: "syn-counts", tenantId: "syn-tenant", source: "synthetic" });
  const outboxActor = outboxCore().administratorActor({ id: "syn-outbox", tenantId: "syn-tenant" });
  assert.equal(invalidBrand({ actor: outboxActor }), "actor");
  assert.equal(unbrandedPath({ actor: countsActor }), "/actor");
});

function fixture(method, sink = { emit: async () => ({ status: "accepted" }) }) {
  const core = countsCore();
  const workload = workloadFor(FROZEN, FROZEN.phases[0]);
  const step = workload.submissionSteps.find((item) => item.method === method);
  const input = inputFor({ core, step, sessionKey: workload.sessionKey });
  const sdk = createCountsSdk({
    sink, producer: { name: "stage-2-harness", version: "1.0.0" },
    service: { name: "stage-2-own-service", version: "1.0.0" }, environment: { name: "synthetic" },
  });
  return { sdk, input, core };
}

for (const method of ["authenticationSucceeded", "authenticationFailed", "sessionCreated", "mfaRemoved", "passwordResetCompleted", "sessionRevoked"]) {
  test(`producer constructs schema-valid ${method}`, async () => {
    const { sdk, input } = fixture(method);
    if (["mfaRemoved", "passwordResetCompleted", "sessionRevoked"].includes(method)) {
      input.operation = sdk.beginOperation({ boundEvent: method }).value;
      input.operation.markCommitted();
    }
    const result = await sdk[method](input);
    assert.equal(result.ok, true, JSON.stringify(result));
  });
}

for (const field of ["actor", "tenant", "authenticated_principal", "source", "session", "authentication", "credential"]) {
  test(`plain or cloned ${field} refuses at the real authority path`, async () => {
    const { sdk, input } = fixture("authenticationSucceeded");
    input[field] = structuredClone(input[field]);
    const result = await sdk.authenticationSucceeded(input);
    assert.equal(result.error.code, "AUTHORITY_ESCALATION");
    assert.equal(result.error.path, `/${field}`);
  });
}

const sinks = [
  ["rejected", async () => ({ status: "rejected" }), "SDK_SINK_REJECTED"],
  ["unknown", async () => ({ status: "unknown" }), "SDK_SINK_FAILURE"],
  ["acknowledged is not accepted", async () => ({ status: "acknowledged" }), "SDK_SINK_FAILURE"],
  ["sync throw", () => { throw new Error("sink broke"); }, "SDK_SINK_FAILURE"],
  ["promise rejection", async () => { throw new Error("sink rejected"); }, "SDK_SINK_FAILURE"],
];
for (const [name, emit, code] of sinks) {
  test(`sink ${name} resolves a refusal`, async () => {
    const { sdk, input } = fixture("authenticationSucceeded", { emit });
    const result = await sdk.authenticationSucceeded(input);
    assert.equal(result.error.code, code);
    assert.equal(result.error.path, "/sink");
  });
}

test("forged, foreign and bound-mismatched operation handles refuse with real codes", async () => {
  const { sdk, input } = fixture("mfaRemoved");
  const foreign = fixture("mfaRemoved").sdk.beginOperation({ boundEvent: "mfaRemoved" }).value;
  const wrongBound = sdk.beginOperation({ boundEvent: "sessionRevoked" }).value;
  wrongBound.markCommitted();
  const candidates = [
    [{ state: "committed", snapshot: () => ({ state: "committed" }) }, "SDK_INVALID_OPERATION_TRANSITION", "/operation"],
    [foreign, "SDK_INVALID_OPERATION_TRANSITION", "/operation"],
    [wrongBound, "SDK_OPERATION_EVENT_MISMATCH", "/operation/bound_event"],
  ];
  for (const [operation, code, path] of candidates) {
    const result = await sdk.mfaRemoved({ ...input, operation });
    assert.equal(result.error.code, code);
    assert.equal(result.error.path, path);
  }
});

const contextRefusals = [
  ["authenticationSucceeded", "credential", "SDK_MISSING_EVENT_FIELD", "/credential"],
  ["authenticationSucceeded", "actor", "MISSING_REQUIRED_ACTOR", "/actor"],
  ["sessionCreated", "tenant", "MISSING_TENANT_CONTEXT", "/tenant"],
  ["sessionCreated", "authenticated_principal", "SDK_MISSING_EVENT_FIELD", "/authenticated_principal"],
  ["authenticationFailed", "request", "SDK_MISSING_EVENT_FIELD", "/request"],
  ["mfaRemoved", "operation", "PREMATURE_SUCCESS", "/operation/state"],
  ["passwordResetCompleted", "correlation", "BAD_CAUSALITY", "/correlation"],
  ["sessionRevoked", "authorization", "SDK_MISSING_EVENT_FIELD", "/authorization"],
];
for (const [method, field, code, path] of contextRefusals) {
  test(`${method} refuses missing ${field} with ${code}`, async () => {
    const { sdk, input } = fixture(method);
    input.operation = sdk.beginOperation({ boundEvent: method }).value;
    input.operation.markCommitted();
    delete input[field];
    const result = await sdk[method](input);
    assert.equal(result.error.code, code);
    assert.equal(result.error.path, path);
  });
}

test("branded credential-only and tenant conflict refusals use the real semantic codes", async () => {
  const { sdk, input, core } = fixture("authenticationFailed");
  const failed = await sdk.authenticationFailed({ ...input, subject: core.authoritativeSubject({ type: "account", id: "syn-account-00000001" }) });
  assert.equal(failed.error.code, "SDK_SEMANTIC_VALIDATION_FAILED");
  assert.equal(failed.error.path, "/subject/type");
  const bound = fixture("mfaRemoved");
  bound.input.operation = bound.sdk.beginOperation({ boundEvent: "mfaRemoved" }).value;
  bound.input.operation.markCommitted();
  bound.input.resource = core.authoritativeResource({ ...bound.input.resource, owning_tenant_id: "syn-tenant-00000001" });
  const conflict = await bound.sdk.mfaRemoved(bound.input);
  assert.equal(conflict.error.code, "TENANT_RESOURCE_CONFLICT");
  assert.equal(conflict.error.path, "/resource/owning_tenant_id");
});

test("operation options cannot forge committed evidence", async () => {
  const { sdk, input } = fixture("mfaRemoved");
  input.operation = sdk.beginOperation({ boundEvent: "mfaRemoved", state: "committed" }).value;
  assert.equal(input.operation.state, "started");
  const result = await sdk.mfaRemoved(input);
  assert.equal(result.error.code, "PREMATURE_SUCCESS");
  assert.equal(result.error.path, "/operation/state");
});

const operationTransitions = [
  { method: "markCommitted", next: "committed", allowedFrom: ["started"], prepare: [], disallowed: ["markCancelled"] },
  { method: "markNotCommitted", next: "not_committed", allowedFrom: ["started"], prepare: [], disallowed: ["markCancelled"] },
  { method: "markPartiallyCommitted", next: "partially_committed", allowedFrom: ["started"], prepare: [], disallowed: ["markCancelled"] },
  { method: "markCancelled", next: "cancelled", allowedFrom: ["started"], prepare: [], disallowed: ["markCommitted"] },
  { method: "markCompensated", next: "compensated", allowedFrom: ["committed"], prepare: ["markCommitted"], disallowed: [] },
];

function transitionCases(definition) {
  const { method, prepare, disallowed } = definition;
  return [
    { branch: "succeeds from an allowed state", marks: prepare },
    { branch: "returns an ok snapshot for the current state", marks: [...prepare, method] },
    { branch: "refuses a disallowed state at /operation/state", marks: disallowed, path: "/operation/state" },
    { branch: "refuses an unknown handle at /operation", marks: [...prepare, method], path: "/operation" },
  ].map((scenario) => ({ ...definition, ...scenario }));
}

function preparedOperation(marks) {
  const operation = fixture("mfaRemoved").sdk.beginOperation().value;
  for (const mark of marks) assert.equal(operation[mark]().ok, true);
  return operation;
}

for (const { method, next, allowedFrom, branch, marks, path } of operationTransitions.flatMap(transitionCases)) {
  test(`${method} ${branch}`, () => {
    const operation = preparedOperation(marks);
    const before = operation.snapshot();
    const result = path === "/operation"
      ? transition(new WeakMap(), operation, next, allowedFrom) : operation[method]();
    const expected = path
      ? { ok: false, error: { code: "SDK_INVALID_OPERATION_TRANSITION", path, category: "lifecycle" } }
      : { ok: true, value: { state: next } };
    assert.deepEqual(result, expected);
    assert.deepEqual(operation.snapshot(), path ? before : { state: next });
  });
}
