// Probe-channel control (issue #79) — the diagnostic-only sibling probe must
// never become a crash surface or an acceptance path. This file runs in its
// own process (node --test isolates each verification file), because a lying
// foreign predicate registered in-process would poison the authority-scope
// arms that assert AUTHORITY_ESCALATION for forged values.
//
// Each case pushes a hostile foreign predicate onto the append-only channel
// under the well-known Symbol.for key — exactly what arbitrary in-process
// code could do — and proves the recorded assurance limitation: the probe can
// at most soften the operator-facing wording; the value is still rejected,
// the bounded shape is preserved, and acceptance is never granted.
import assert from "node:assert/strict";
import test from "node:test";

import * as sdk from "../../dist/index.js";
import { createCapturingAuditSink } from "../../dist/testing.js";

const COPY_PROBE_KEY = Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1");

function copyProbeChannel() {
  const existing = globalThis[COPY_PROBE_KEY];
  if (Array.isArray(existing)) return existing;
  const channel = [];
  globalThis[COPY_PROBE_KEY] = channel;
  return channel;
}

function createInstance() {
  return sdk.createSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "probe-channel-control", version: "1.0.0" },
    service: { name: "probe-channel" },
    environment: { name: "verification" },
    sink: createCapturingAuditSink(),
  });
}

function rejectActor(value) {
  const instance = createInstance();
  try {
    instance.runWithContext({ actor: value }, () => {});
  } catch (error) {
    return error;
  }
  throw new Error("foreign value was accepted: the probe granted acceptance");
}

test("probe-channel control: a throwing foreign predicate never crashes the rejection site", () => {
  copyProbeChannel().push({ predicate: () => { throw new Error("hostile predicate"); } });
  const rejection = rejectActor({ type: "administrator", id: "probe-throwing" });
  assert.equal(rejection.name, "SecurityAuditSdkError");
  assert.equal(rejection.code, "AUTHORITY_ESCALATION");
  assert.equal(rejection.category, "authority");
  assert.equal(rejection.path, "/actor");
});

test("probe-channel control: non-boolean answers are coerced to boolean", () => {
  copyProbeChannel().push({ predicate: () => null });
  const falsyRejection = rejectActor({ type: "administrator", id: "probe-falsy" });
  assert.equal(falsyRejection.code, "AUTHORITY_ESCALATION", "a non-boolean falsy answer must coerce to false");

  copyProbeChannel().push({ predicate: () => "yes" });
  const truthyRejection = rejectActor({ type: "administrator", id: "probe-truthy" });
  assert.equal(truthyRejection.code, "DUPLICATE_AUTHORITY", "a non-boolean truthy answer must coerce to true");
  assert.equal(truthyRejection.category, "authority");
  assert.equal(truthyRejection.path, "/actor");
});

test("probe-channel control: a lying foreign predicate softens wording but never grants acceptance", () => {
  copyProbeChannel().push({ predicate: () => true });
  const rejection = rejectActor({ type: "administrator", id: "probe-liar" });
  assert.equal(rejection.name, "SecurityAuditSdkError");
  assert.equal(rejection.code, "DUPLICATE_AUTHORITY");
  assert.equal(rejection.category, "authority");
  assert.equal(rejection.path, "/actor");
  assert.ok(rejection.message.includes("Core resolves to exactly one module instance in any supported consumer graph"));
  assert.match(rejection.message, /deduplicate/i);
  const serialized = JSON.stringify(rejection.toJSON());
  assert.ok(!serialized.includes("probe-liar"), "bounded diagnostic must never carry caller data");
  assert.ok(serialized.length < 512, "bounded diagnostic must stay bounded");

  // The probe can never grant or block authority: a same-copy branded value
  // is still accepted because the local registry — not the probe — decides.
  const instance = createInstance();
  const actor = sdk.authoritativeActor({ type: "administrator", id: "probe-own" });
  let accepted = false;
  instance.runWithContext({ actor }, () => { accepted = true; });
  assert.equal(accepted, true, "same-copy value was rejected under a lying foreign predicate");
});
