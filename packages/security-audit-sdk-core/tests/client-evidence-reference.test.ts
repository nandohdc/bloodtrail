import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  authoritativeActor,
  authoritativeTenant,
  createSecurityAuditSdk,
  observedSource,
  validateSecurityAuditEvent,
  type AuditEventSink,
  type SecurityAuditEvent,
} from "../dist/index.js";

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");

// The reference a validated client envelope maps to (#127). The SDK carries it; it never
// builds one, and nothing about it is server evidence.
const REFERENCE = Object.freeze({
  interaction_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
  interaction_kind: "form_submit",
  envelope_version: 1,
  provenance: Object.freeze({
    source: "client_reported",
    trust_level: "client_claim",
    platform: "web_browser",
    capture_scope: "interaction_ephemeral",
  }),
}) as NonNullable<SecurityAuditEvent["client_evidence"]>;

const RELABELLED: Readonly<Record<string, unknown>> = Object.freeze({
  "escalated trust": { ...REFERENCE, provenance: { ...REFERENCE.provenance, trust_level: "derived_server" } },
  "server-observed source": { ...REFERENCE, provenance: { ...REFERENCE.provenance, source: "server_observed" } },
  "server-owned member": { ...REFERENCE, risk: { level: "high" } },
  "unknown envelope version": { ...REFERENCE, envelope_version: 2 },
  "unapproved platform": { ...REFERENCE, provenance: { ...REFERENCE.provenance, platform: "react_native" } },
});

async function serverOnlyEvent(): Promise<SecurityAuditEvent> {
  const events = JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
  const event = events.find((candidate) => candidate.client_evidence === undefined);
  assert.ok(event, "a server-only canonical fixture exists");
  return structuredClone(event);
}

function capturingSink(captured: SecurityAuditEvent[]): AuditEventSink {
  return {
    async emit(event) {
      captured.push(event);
      return { status: "accepted" };
    },
  };
}

function testSdk(captured: SecurityAuditEvent[]) {
  return createSecurityAuditSdk({
    contractVersion: "2.1.0",
    producer: { name: "client-evidence-test-producer", version: "1.0.0" },
    service: { name: "client-evidence-test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink: capturingSink(captured),
  });
}

test("a record carrying the mapped reference validates, and its absence carries no meaning", async () => {
  const event = await serverOnlyEvent();
  assert.equal(validateSecurityAuditEvent(event).ok, true);
  assert.equal(validateSecurityAuditEvent({ ...event, client_evidence: REFERENCE }).ok, true);
});

test("a relabelled reference is refused with the contract's own code", async () => {
  const event = await serverOnlyEvent();
  for (const [label, reference] of Object.entries(RELABELLED)) {
    const result = validateSecurityAuditEvent({ ...event, client_evidence: reference } as SecurityAuditEvent);
    assert.equal(result.ok, false, label);
    if (!result.ok) assert.equal(result.error.code, "UNKNOWN_CATALOG_VALUE", label);
  }
});

test("the derived-field trust floor bounds any result that reads the reference", async () => {
  const event = await serverOnlyEvent();
  const withReference = { ...event, client_evidence: REFERENCE } as SecurityAuditEvent;
  const derived = (trust: string): SecurityAuditEvent => ({
    ...withReference,
    risk: {
      level: "low",
      score: 1,
      reason_codes: ["policy_baseline"],
      model: { name: "m", version: "1.0.0", provenance: { trust_level: trust, derived_from: ["client_evidence.interaction_id", "event.name"] } },
    },
  } as SecurityAuditEvent);
  assert.equal(validateSecurityAuditEvent(derived("client_claim")).ok, true);
  const refused = validateSecurityAuditEvent(derived("derived_server"));
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.error.code, "DERIVED_FROM_TRUST_FLOOR_EXCEEDED");
});

test("a named event method carries a supplied reference and emits it frozen", async () => {
  const captured: SecurityAuditEvent[] = [];
  const sdk = testSdk(captured);
  const input = {
    actor: authoritativeActor({ type: "authenticated_human", id: "actor-1", tenant_id: "tenant_alpha" }),
    tenant: authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_alpha", effective_tenant_id: "tenant_alpha", resource_tenant_id: "tenant_alpha" }),
    source: observedSource({ observed: { address: "203.0.113.10" } }),
    request: { id: "request-1" },
    correlation: { correlation_id: "corr-1", operation_id: "op-1" },
  };

  const carried = await sdk.accountRegistrationAttempted({ ...input, client_evidence: REFERENCE });
  assert.equal(carried.ok, true, carried.ok ? "" : JSON.stringify((carried as { error: unknown }).error));
  assert.deepEqual(captured[0]?.client_evidence, REFERENCE);
  assert.equal(Object.isFrozen(captured[0]?.client_evidence), true);

  const omitted = await sdk.accountRegistrationAttempted(input);
  assert.equal(omitted.ok, true);
  assert.equal(captured[1]?.client_evidence, undefined);

  const relabelled = await sdk.accountRegistrationAttempted({
    ...input,
    client_evidence: RELABELLED["escalated trust"] as NonNullable<SecurityAuditEvent["client_evidence"]>,
  });
  assert.equal(relabelled.ok, false);
  assert.equal(captured.length, 2, "a refused event never reaches the sink");
});
