import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { atPath, keys, list, object, pathParts, text } from "./shape.mjs";

const FORMATS = {
  opaque_id: (value) => typeof value === "string" && value.length > 0,
  sha256: (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value),
  utc: (value) => typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)),
  finite: (value) => Number.isFinite(value),
};
const VALUE_OPS = new Set(["equal", "not_equal"]);
const REF_OPS = new Set(["same", "different", "before"]);
const DYNAMIC_PATH = /(?:^|\.)(?:id|event_id|original_event_id|transaction_id|operation_id|correlation_id|operationId|transactionId|correlationId|timestamp|at_ms|body_sha256)$/;
const VOLATILE_TEXT = /^(?:[a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|\d{4}-\d\d-\d\dT.*Z)$/;

function stable(value) {
  if (typeof value === "string") assert(!VOLATILE_TEXT.test(value), "runtime literal must be structural");
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert(!DYNAMIC_PATH.test(key), "nested runtime identity must be structural");
    stable(item);
  }
}

export function validateAssertion(rule) {
  object(rule, "assertion");
  pathParts(rule.path);
  assert(!rule.path.split(".").includes("public_calls"), "public-call prediction deviations are notes only");
  if (VALUE_OPS.has(rule.op)) {
    keys(rule, ["path", "op", "value"]);
    assert(!DYNAMIC_PATH.test(rule.path), "runtime identity must use a format or peer reference");
    stable(rule.value);
    return;
  }
  if (REF_OPS.has(rule.op)) {
    keys(rule, ["path", "op", "peer"]);
    keys(rule.peer, ["step_id", "path"]);
    text(rule.peer.step_id, "peer.step_id");
    pathParts(rule.peer.path);
    return;
  }
  validateUnary(rule);
}

function validateUnary(rule) {
  if (rule.op === "format") {
    keys(rule, ["path", "op", "format"]);
    assert(Object.hasOwn(FORMATS, rule.format), "unknown structural format");
    return;
  }
  assert(["present", "absent"].includes(rule.op), "unknown assertion operator");
  keys(rule, ["path", "op"]);
}

export function validateAssertions(value) {
  for (const rule of list(value, "assertions")) validateAssertion(rule);
}

function peerValue(rule, records) {
  const peers = records.filter((record) => record?.step_id === rule.peer.step_id);
  assert.equal(peers.length, 1, `missing/duplicate relation peer ${rule.peer.step_id}`);
  const peer = atPath(peers[0], rule.peer.path);
  assert.notEqual(peer, undefined, `absent relation peer field ${rule.peer.path}`);
  return peer;
}

const COMPARATORS = {
  equal: (actual, rule) => isDeepStrictEqual(actual, rule.value),
  not_equal: (actual, rule) => actual !== undefined && !isDeepStrictEqual(actual, rule.value),
  present: (actual) => actual !== undefined,
  absent: (actual) => actual === undefined,
  format: (actual, rule) => FORMATS[rule.format](actual),
  same: (actual, rule, records) => isDeepStrictEqual(actual, peerValue(rule, records)),
  different: (actual, rule, records) => actual !== undefined && !isDeepStrictEqual(actual, peerValue(rule, records)),
  before: beforePeer,
};

function beforePeer(actual, rule, records) {
  const peer = peerValue(rule, records);
  return Number.isFinite(actual) && Number.isFinite(peer) && actual < peer;
}

// Each malformed assertion is a local mismatch, even in direct unvalidated calls.
export function assertionIssues({ assertions, actual, records }) {
  try { validateAssertions(assertions); }
  catch (error) { return [`malformed assertions: ${error.message}`]; }
  return assertions.flatMap((rule) => {
    try {
      return COMPARATORS[rule.op](atPath(actual, rule.path), rule, records) ? [] : [`assertion ${rule.path} ${rule.op} failed`];
    } catch (error) { return [`assertion ${rule.path}: ${error.message}`]; }
  });
}
