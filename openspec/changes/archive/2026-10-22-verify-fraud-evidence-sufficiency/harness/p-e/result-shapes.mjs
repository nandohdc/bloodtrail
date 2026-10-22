import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { keys, object, text } from "./shape.mjs";

const BINDING_SUCCESS = new Set(["committed_and_durable", "already_delivered"]);
const BINDING_REFUSALS = ["delivery_class_mismatch", "transaction_id_required", "duplicate_transaction_delivery"];
const CLOSED_CODES = ["audit_durability_unreachable", "business_commit_declined"];
const SIMPLE = new Set(["accepted", "sdk_value", "observation", "thrown", "acknowledged", ...BINDING_SUCCESS]);

export function validateResult(plan) {
  object(plan, "result");
  if (SIMPLE.has(plan.variant)) return keys(plan, ["variant"]);
  if (plan.variant === "sdk_refusal") {
    keys(plan, ["variant", "diagnostic"]);
    keys(plan.diagnostic, ["code", "category", "path"]);
    for (const value of Object.values(plan.diagnostic)) text(value, "diagnostic");
    return;
  }
  validateBindingRefusal(plan);
}

function validateBindingRefusal(plan) {
  if (plan.variant === "refused") {
    keys(plan, ["variant", "code"]);
    assert(BINDING_REFUSALS.includes(plan.code), "invalid admission refusal code");
    return;
  }
  assert.equal(plan.variant, "failed_closed", "unknown result variant");
  keys(plan, ["variant", "code", "commitGateInvoked", "durabilityAttempted"]);
  assert(CLOSED_CODES.includes(plan.code), "invalid failed_closed code");
  assert.equal(typeof plan.commitGateInvoked, "boolean");
  assert.equal(typeof plan.durabilityAttempted, "boolean");
  if (plan.durabilityAttempted) assert(plan.commitGateInvoked, "durability requires gate");
  if (plan.code === "business_commit_declined") {
    assert(plan.commitGateInvoked, "decline requires gate");
    assert.equal(plan.durabilityAttempted, false);
  }
}

function bindingRaw(plan, raw) {
  const expected = { status: plan.variant, event_id: raw.event_id };
  text(raw.event_id, "event_id");
  if (BINDING_SUCCESS.has(plan.variant)) {
    text(raw.transaction_id, "transaction_id");
    expected.transaction_id = raw.transaction_id;
  } else {
    expected.code = plan.code;
  }
  if (plan.variant === "failed_closed") {
    expected.commitGateInvoked = plan.commitGateInvoked;
    expected.durabilityAttempted = plan.durabilityAttempted;
  }
  assert.deepEqual(raw, expected, "binding result shape differs");
}

function sdkRaw(plan, raw) {
  if (plan.variant === "sdk_value") {
    keys(raw, ["ok", "value"]);
    assert.equal(raw.ok, true);
    object(raw.value, "SDK value");
    return;
  }
  if (plan.variant === "accepted") {
    assert.deepEqual(raw, { ok: true, value: { status: "accepted" } });
    return;
  }
  keys(raw, ["ok", "error"]);
  assert.equal(raw.ok, false);
  keys(raw.error, ["code", "category", "path"], ["eventName"]);
  if (Object.hasOwn(raw.error, "eventName")) text(raw.error.eventName, "eventName");
  const triple = Object.fromEntries(["code", "category", "path"].map((key) => [key, raw.error[key]]));
  assert(isDeepStrictEqual(triple, plan.diagnostic), "SDK diagnostic differs");
}

export function resultIssues(plan, record) {
  try {
    validateResult(plan);
    const thrown = plan.variant === "thrown";
    assert.equal(record.kind, thrown ? "thrown" : "returned", "result kind differs");
    const refused = ["sdk_refusal", "refused", "thrown"].includes(plan.variant);
    assert.equal(record.accepted, !refused, "acceptance differs");
    object(record.raw, "raw result");
    inspectRaw(plan, record.raw);
    diagnosticShape(plan, record);
    return [];
  } catch (error) { return [`result: ${error.message}`]; }
}

function diagnosticShape(plan, record) {
  if (plan.variant === "sdk_refusal") assert.deepEqual(record.diagnostic, plan.diagnostic, "record diagnostic differs");
  if (plan.variant === "refused") assert.deepEqual(record.diagnostic, { code: plan.code }, "binding diagnostic differs");
}

function inspectRaw(plan, raw) {
  if (plan.variant === "observation") return;
  if (plan.variant === "acknowledged") {
    text(raw.event_id, "handoff event_id");
    assert.deepEqual(raw, { status: "acknowledged", code: "acknowledged", event_id: raw.event_id, attempt: 0 });
    return;
  }
  if (plan.variant === "thrown") {
    text(raw.name, "thrown name");
    text(raw.message, "thrown message");
    return;
  }
  if (["sdk_refusal", "sdk_value", "accepted"].includes(plan.variant)) return sdkRaw(plan, raw);
  bindingRaw(plan, raw);
}
