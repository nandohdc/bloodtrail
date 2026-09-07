import assert from "node:assert/strict";
import test from "node:test";

import {
  CollectorIngress,
  DIAGNOSTIC_CODES,
  SUPPORTED_CONTRACT_VERSIONS,
  SyntheticFixtureAuthenticator,
  type IngressResult,
  type Submission,
} from "../dist/index.js";

// The nine arms (E1–E8 + N0) from the committed #107 plan. Every arm goes
// through the public submit() surface; E2's ordering assertion instruments
// the parse stage and measures runtime invocation, not code shape (F4).

const FIXTURE_TOKEN = "fixture-token-a";

const VALID_EVENT = Object.freeze({
  event: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "bloodtrail.audit.authentication.succeeded",
    category: "authentication",
    action: "authenticate",
    lifecycle_phase: "completed",
    outcome: "success",
    timestamp: "2026-09-06T12:00:00.000Z",
    observed_at: "2026-09-06T12:00:00.000Z",
    delivery_class: "security_significant",
  },
  schema: { name: "security-audit-event", version: "1.0.0" },
  producer: { name: "producer-fixture", version: "1.0.0" },
  environment: { name: "synthetic" },
  service: { name: "svc" },
  tenant: { scope: "tenant" },
  actor: { type: "service_account" },
  initiator: { type: "service", id: "init-1" },
  resource: { operation_type: "read" },
  correlation: { correlation_id: "c1", operation_id: "op1" },
  data: {
    classification: "internal",
    retention_class: "security_standard",
    field_policy_version: "1.0.0",
  },
});

function validBody(): string {
  return JSON.stringify(VALID_EVENT);
}

function ingressWithCountingParse(): { ingress: CollectorIngress; parseCalls: () => number } {
  let parseCalls = 0;
  const ingress = new CollectorIngress({
    authenticator: new SyntheticFixtureAuthenticator([FIXTURE_TOKEN]),
    parse: (text: string) => {
      parseCalls += 1;
      return JSON.parse(text) as unknown;
    },
  });
  return { ingress, parseCalls: () => parseCalls };
}

function authenticated(body: string): Submission {
  return { credentials: { credential: FIXTURE_TOKEN }, body };
}

function expectAdmission(result: IngressResult): asserts result is Extract<IngressResult, { kind: "admitted" }> {
  assert.equal(result.kind, "admitted");
}

test("E1 — authenticated, size-bounded, schema-valid, supported version is admitted", () => {
  const { ingress } = ingressWithCountingParse();
  const result = ingress.submit(authenticated(validBody()));
  expectAdmission(result);
  assert.equal(result.eventId, "00000000-0000-4000-8000-000000000001");
  assert.equal(result.senderIdentity, `synthetic:${FIXTURE_TOKEN}`);
  assert.equal(ingress.metrics().accepted, 1);
});

test("E2 — missing authentication is rejected before the parse stage runs", () => {
  const { ingress, parseCalls } = ingressWithCountingParse();
  const result = ingress.submit({ body: validBody() });
  assert.equal(result.kind, "rejected");
  if (result.kind !== "rejected") return;
  assert.equal(result.diagnostic.code, DIAGNOSTIC_CODES.AUTH_MISSING);
  assert.equal(result.diagnostic.category, "authentication");
  assert.equal(parseCalls(), 0, "parse must not run for an unauthenticated submission");
  assert.equal(ingress.metrics().rejectedAuthentication, 1);
  assert.equal(ingress.metrics().accepted, 0);
});

test("E3 — malformed authentication is rejected before the parse stage runs", () => {
  const { ingress, parseCalls } = ingressWithCountingParse();
  const result = ingress.submit({ credentials: 42, body: validBody() });
  assert.equal(result.kind, "rejected");
  if (result.kind !== "rejected") return;
  assert.equal(result.diagnostic.code, DIAGNOSTIC_CODES.AUTH_MALFORMED);
  assert.equal(parseCalls(), 0, "parse must not run for malformed authentication");
});

test("E4 — well-formed but wrong authentication is rejected before the parse stage runs", () => {
  const { ingress, parseCalls } = ingressWithCountingParse();
  const result = ingress.submit({ credentials: { credential: "wrong-token" }, body: validBody() });
  assert.equal(result.kind, "rejected");
  if (result.kind !== "rejected") return;
  assert.equal(result.diagnostic.code, DIAGNOSTIC_CODES.AUTH_REJECTED);
  assert.equal(parseCalls(), 0, "parse must not run for an invalid credential");
});

test("E5 — a body over the derived event_max_bytes bound is rejected before parse", () => {
  const { ingress, parseCalls } = ingressWithCountingParse();
  const oversized = "a".repeat(65_537);
  const result = ingress.submit(authenticated(oversized));
  assert.equal(result.kind, "rejected");
  if (result.kind !== "rejected") return;
  assert.equal(result.diagnostic.code, DIAGNOSTIC_CODES.SIZE_EXCEEDED);
  assert.equal(result.diagnostic.category, "size");
  assert.equal(parseCalls(), 0, "parse must not run for an oversized body");
  assert.equal(ingress.metrics().rejectedSize, 1);
});

test("E5b — a body exactly at the derived bound passes the size stage", () => {
  const { ingress } = ingressWithCountingParse();
  const padding = 65_536 - new TextEncoder().encode(validBody()).byteLength;
  assert.ok(padding > 0, "fixture must be smaller than the contract bound");
  const padded = validBody().replace(
    "security_standard",
    `security_standard${"x".repeat(padding)}`,
  );
  const result = ingress.submit(authenticated(padded));
  // The padded fixture is structurally invalid (string max), so this asserts
  // the size stage passed and the schema stage rejected it — the size stage
  // did not reject a body within the derived bound.
  assert.equal(result.kind, "rejected");
  if (result.kind !== "rejected") return;
  assert.notEqual(result.diagnostic.code, DIAGNOSTIC_CODES.SIZE_EXCEEDED);
});

test("E6 — schema-invalid body is rejected with the generated validator's bounded diagnostic", () => {
  const { ingress } = ingressWithCountingParse();
  const invalid = JSON.stringify({ ...VALID_EVENT, event: { ...VALID_EVENT.event, id: "not-a-uuid" } });
  const result = ingress.submit(authenticated(invalid));
  assert.equal(result.kind, "rejected");
  if (result.kind !== "rejected") return;
  assert.equal(result.diagnostic.code, DIAGNOSTIC_CODES.SCHEMA_INVALID);
  assert.equal(result.diagnostic.category, "validation");
  assert.ok(result.diagnostic.path.startsWith("#/"), "path must be the generated schema pointer");
  assert.ok(result.diagnostic.path.length <= 128);
  assert.equal(ingress.metrics().rejectedSchema, 1);
  assert.equal(ingress.metrics().accepted, 0);
});

test("E7 — an unsupported contract version is rejected distinctly from a schema rejection", () => {
  const { ingress } = ingressWithCountingParse();
  const unsupported = JSON.stringify({ ...VALID_EVENT, schema: { name: "security-audit-event", version: "2.0.0" } });
  const result = ingress.submit(authenticated(unsupported));
  assert.equal(result.kind, "rejected");
  if (result.kind !== "rejected") return;
  assert.equal(result.diagnostic.code, DIAGNOSTIC_CODES.VERSION_UNSUPPORTED);
  assert.equal(result.diagnostic.category, "version");
  assert.equal(result.diagnostic.path, "/schema/version");
  assert.notEqual(result.diagnostic.code, DIAGNOSTIC_CODES.SCHEMA_INVALID);
  assert.equal(ingress.metrics().rejectedVersion, 1);
});

test("E8 — diagnostics and metrics carry no secrets or payloads", () => {
  const { ingress } = ingressWithCountingParse();
  const marker = "SECRET_MARKER_7f3a";
  const secretEvent = {
    ...VALID_EVENT,
    event: { ...VALID_EVENT.event, outcome_reason: { message: marker } },
    producer: { name: `producer-${marker}`, version: "1.0.0" },
  };
  const submissions: Submission[] = [
    { body: validBody() }, // missing auth
    { credentials: 42, body: validBody() }, // malformed auth
    { credentials: { credential: "wrong" }, body: validBody() }, // invalid auth
    authenticated("a".repeat(65_537)), // oversized
    authenticated("{not json"), // parse failure
    authenticated(JSON.stringify({ ...VALID_EVENT, event: { ...VALID_EVENT.event, id: "bad" } })), // schema
    authenticated(JSON.stringify({ ...VALID_EVENT, schema: { name: "security-audit-event", version: "9.9.9" } })), // version
    authenticated(JSON.stringify(secretEvent)), // accepted but payload-derived strings exist
  ];
  for (const submission of submissions) {
    const result = ingress.submit(submission);
    if (result.kind === "rejected") {
      const serialized = JSON.stringify(result.diagnostic);
      assert.ok(!serialized.includes(marker), `diagnostic leaked submission material: ${serialized}`);
    }
  }
  const metrics = ingress.metrics();
  assert.equal(metrics.accepted, 1);
  const metricText = JSON.stringify(metrics);
  assert.ok(!metricText.includes(marker), "metric labels or values leaked submission material");
  assert.deepEqual(
    Object.keys(metrics).sort(),
    [
      "accepted",
      "rejectedAuthentication",
      "rejectedParse",
      "rejectedSchema",
      "rejectedSize",
      "rejectedVersion",
    ].sort(),
  );
});

test("N0 — null control: E1 repeated, accepted with no diagnostics", () => {
  const { ingress } = ingressWithCountingParse();
  const first = ingress.submit(authenticated(validBody()));
  const second = ingress.submit(authenticated(validBody()));
  expectAdmission(first);
  expectAdmission(second);
  assert.equal(ingress.metrics().accepted, 2);
  assert.equal(ingress.metrics().rejectedAuthentication, 0);
  assert.equal(ingress.metrics().rejectedSize, 0);
  assert.equal(ingress.metrics().rejectedParse, 0);
  assert.equal(ingress.metrics().rejectedSchema, 0);
  assert.equal(ingress.metrics().rejectedVersion, 0);
});

test("supported contract versions are exactly the derived canonical set", () => {
  assert.deepEqual(SUPPORTED_CONTRACT_VERSIONS, ["1.0.0"]);
});

test("admission makes no delivery or durability claim", () => {
  const { ingress } = ingressWithCountingParse();
  const result = ingress.submit(authenticated(validBody()));
  expectAdmission(result);
  const admission = result;
  assert.deepEqual(
    Object.keys(admission).sort(),
    ["eventId", "kind", "senderIdentity"].sort(),
  );
});
