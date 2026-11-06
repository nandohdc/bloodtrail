// Focused refusals modeled from context.ts, operations.ts, sdk.ts and validation/semantic.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { syntheticClock } from "../lib/clock.mjs";
import { buildEventInput, generateWorkloadDefinition } from "../outbox/workload.mjs";
import { outboxCore, createOutboxNodeSecurityAuditSdk } from "./outbox-fakes.mjs";

const CORE = outboxCore();
function fixture(method, sink = { emit: async () => ({ status: "accepted" }) }) {
  const sdk = createOutboxNodeSecurityAuditSdk({
    contractVersion: "2.1.0", producer: { name: "test", version: "1.0.0" },
    service: { name: "test", version: "1.0.0" }, environment: { name: "synthetic" },
    sink, clock: syntheticClock({ start: "2026-10-23T00:00:00.000Z", stepMs: 1000 }),
  });
  const item = generateWorkloadDefinition({ count: 2 }).items.find((item) => item.method === method);
  const input = buildEventInput({ core: CORE, ...item });
  const handle = sdk.beginOperation({ boundEvent: method, transactionId: item.identity.transactionId }).value;
  handle.markCommitted();
  return { sdk, input: { ...input, operation: handle } };
}

function assertFailure(result, code, path) {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code);
  assert.equal(result.error.path, path);
}

const OMITTED = [
  ["actor", "MISSING_REQUIRED_ACTOR", "/actor"],
  ["tenant", "MISSING_TENANT_CONTEXT", "/tenant"],
  ["authorization", "SDK_MISSING_EVENT_FIELD", "/authorization"],
  ["operation", "PREMATURE_SUCCESS", "/operation/state"],
];

for (const method of ["roleAssigned", "sensitiveResourceModified"]) {
  test(`${method}: honest catalog-built event passes schema and sink`, async () => {
    const { sdk, input } = fixture(method);
    assert.equal((await sdk[method](input)).ok, true);
  });
  for (const [field, code, path] of OMITTED) {
    test(`${method}: missing ${field} is refused`, async () => {
      const { sdk, input } = fixture(method);
      assertFailure(await sdk[method]({ ...input, [field]: undefined }), code, path);
    });
  }
  for (const field of ["actor", "tenant", "resource", "authorization", "subject"]) {
    const irrelevant = method === "sensitiveResourceModified" && field === "subject";
    if (irrelevant) continue;
    test(`${method}: unbranded ${field} is AUTHORITY_ESCALATION at /${field}`, async () => {
      const { sdk, input } = fixture(method);
      assertFailure(await sdk[method]({ ...input, [field]: { ...input[field] } }), "AUTHORITY_ESCALATION", `/${field}`);
    });
  }
  test(`${method}: forged and bound-event mismatched handles are refused`, async () => {
    const { sdk, input } = fixture(method);
    const forged = { ...input.operation };
    assertFailure(await sdk[method]({ ...input, operation: forged }), "SDK_INVALID_OPERATION_TRANSITION", "/operation");
    const otherMethod = method === "roleAssigned" ? "sensitiveResourceModified" : "roleAssigned";
    const handle = sdk.beginOperation({ boundEvent: otherMethod }).value;
    handle.markCommitted();
    assertFailure(await sdk[method]({ ...input, operation: handle }), "SDK_OPERATION_EVENT_MISMATCH", "/operation/bound_event");
  });
  test(`${method}: a started handle is premature success`, async () => {
    const { sdk, input } = fixture(method);
    const handle = sdk.beginOperation({ boundEvent: method }).value;
    assertFailure(await sdk[method]({ ...input, operation: handle }), "PREMATURE_SUCCESS", "/operation/state");
  });
}

const SINK_CASES = [
  ["rejected", () => ({ status: "rejected", code: "test" }), "SDK_SINK_REJECTED"],
  ["unknown", () => ({ status: "unknown", code: "test" }), "SDK_SINK_FAILURE"],
  ["throw", () => { throw new Error("sink failed"); }, "SDK_SINK_FAILURE"],
  ["rejection", () => Promise.reject(new Error("sink rejected")), "SDK_SINK_FAILURE"],
];
for (const [name, emit, code] of SINK_CASES) {
  test(`sink ${name} settles as a result, never a rejected SDK promise`, async () => {
    const { sdk, input } = fixture("roleAssigned", { emit });
    assertFailure(await sdk.roleAssigned(input), code, "/sink");
  });
}

const CONTEXT_CASES = [
  ["roleAssigned", (input) => { input.actor = CORE.authenticatedHumanActor({ id: "syn-actor-00000001" }); }, "MISSING_REQUIRED_ACTOR", "/actor/type"],
  ["roleAssigned", (input) => { delete input.subject; }, "SDK_MISSING_EVENT_FIELD", "/subject"],
  ["roleAssigned", (input) => { delete input.resource; }, "SDK_MISSING_EVENT_FIELD", "/resource"],
  ["sensitiveResourceModified", (input) => { delete input.resource; }, "SDK_MISSING_EVENT_FIELD", "/resource/type"],
  ["sensitiveResourceModified", (input) => { input.resource = CORE.authoritativeResource({ ...input.resource, change_categories: [] }); }, "SDK_MISSING_EVENT_FIELD", "/resource/change_categories"],
  ["sensitiveResourceModified", (input) => { input.resource = CORE.authoritativeResource({ ...input.resource, owning_tenant_id: "syn-ten-ffffffff" }); }, "TENANT_RESOURCE_CONFLICT", "/resource/owning_tenant_id"],
  ["roleAssigned", (input) => { delete input.event.outcome_reason; }, "SDK_MISSING_EVENT_FIELD", "/event/outcome_reason/code"],
];
for (const [method, mutate, code, path] of CONTEXT_CASES) {
  test(`${method} enforces ${code} at ${path}`, async () => {
    const { sdk, input } = fixture(method);
    mutate(input);
    assertFailure(await sdk[method](input), code, path);
  });
}
