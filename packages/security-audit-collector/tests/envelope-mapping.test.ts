import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CLAIM_MAX_RECORDS,
  ClientEvidenceIngress,
  InteractionClaimMapper,
  InteractionNonceLedger,
  validateStructural,
  type ClaimMapping,
  type ClientEvidenceReference,
} from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const envelopeContract = resolve(here, "../../../contracts/client-evidence-envelope");
const BINDING = "session-ref-alpha";

type Envelope = Record<string, unknown>;

function canonicalModeA(): Envelope {
  return JSON.parse(readFileSync(resolve(envelopeContract, "fixtures/canonical/positive-canonical-mode-a.json"), "utf8")) as Envelope;
}

// A server-only record, valid under contract 2.1.0, that a mapped reference is added to.
function auditRecord(): Record<string, unknown> {
  return {
    event: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "bloodtrail.audit.authentication.succeeded",
      category: "authentication",
      action: "authenticate",
      lifecycle_phase: "completed",
      outcome: "success",
      timestamp: "2026-09-11T12:00:00.000Z",
      observed_at: "2026-09-11T12:00:00.000Z",
      delivery_class: "security_significant",
    },
    schema: { name: "security-audit-event", version: "2.1.0" },
    producer: { name: "producer-fixture", version: "1.0.0" },
    environment: { name: "synthetic" },
    service: { name: "svc" },
    tenant: { scope: "tenant" },
    actor: { type: "service_account" },
    initiator: { type: "service", id: "init-1" },
    resource: { operation_type: "read" },
    correlation: { correlation_id: "c1", operation_id: "op1" },
    data: { classification: "internal", retention_class: "security_standard", field_policy_version: "2.1.0" },
  };
}

function admitOne(overrides: Envelope = {}, binding = BINDING): unknown {
  const nonces = new InteractionNonceLedger({ source: () => "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" });
  const issue = nonces.issue(binding);
  assert.equal(issue.kind, "issued");
  const nonce = issue.kind === "issued" ? issue.nonce : "";
  const ingress = new ClientEvidenceIngress({ nonces });
  const result = ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), ...overrides, nonce }), binding });
  assert.equal(result.kind, "admitted");
  return result;
}

function mappedReference(mapping: ClaimMapping): ClientEvidenceReference {
  assert.equal(mapping.kind, "mapped");
  if (mapping.kind !== "mapped") throw new Error("unreachable");
  return mapping.reference;
}

test("CM1 — an admitted envelope maps to a reference the contract validator accepts inside a record", () => {
  const admitted = admitOne();
  const reference = mappedReference(new InteractionClaimMapper().map(BINDING, [admitted]));
  assert.deepEqual(reference, {
    interaction_id: canonicalModeA().interaction_id,
    interaction_kind: canonicalModeA().interaction_kind,
    envelope_version: 1,
    provenance: {
      source: "client_reported",
      trust_level: "client_claim",
      platform: "web_browser",
      capture_scope: "interaction_ephemeral",
    },
  });

  const record = { ...auditRecord(), client_evidence: reference };
  assert.equal(validateStructural(record).valid, true);
  assert.equal(validateStructural(auditRecord()).valid, true, "absence stays valid and means nothing");
});

test("CM2 — the reference carries exactly the four approved members and no server-owned field", () => {
  const reference = mappedReference(new InteractionClaimMapper().map(BINDING, [admitOne()]));
  assert.deepEqual(Object.keys(reference).sort(), ["envelope_version", "interaction_id", "interaction_kind", "provenance"]);
  assert.deepEqual(Object.keys(reference.provenance).sort(), ["capture_scope", "platform", "source", "trust_level"]);
  for (const member of ["risk", "actor", "tenant", "authorization", "authentication", "session", "integrity"]) {
    assert.equal(Object.hasOwn(reference, member), false, member);
  }
  assert.ok(Object.isFrozen(reference) && Object.isFrozen(reference.provenance));
});

test("CM3 — a reference labelled server-derived or more trusted is rejected by the contract", () => {
  const reference = mappedReference(new InteractionClaimMapper().map(BINDING, [admitOne()]));
  for (const trust of ["derived_server", "authoritative_server", "verified_assertion", "observed_transport"]) {
    const mutated = { ...reference, provenance: { ...reference.provenance, trust_level: trust } };
    assert.equal(validateStructural({ ...auditRecord(), client_evidence: mutated }).valid, false, trust);
  }
  const relabelled = { ...reference, provenance: { ...reference.provenance, source: "server_observed" } };
  assert.equal(validateStructural({ ...auditRecord(), client_evidence: relabelled }).valid, false);
});

test("CM4 — a client value never reaches a server-owned field through a mapping", () => {
  const reference = mappedReference(new InteractionClaimMapper().map(BINDING, [admitOne()]));
  const record: Record<string, unknown> = { ...auditRecord(), client_evidence: reference };
  const server = auditRecord();
  for (const [member, value] of Object.entries(server)) {
    assert.deepEqual(record[member], value, `${member} is untouched by the mapping`);
  }
  // A risk model may list the reference as a material input. The collector's stage is
  // structural by ratified design, so the derived-field trust floor over that input is proven
  // where it is enforced: the contract validator and the producer SDK's semantic kernel
  // (packages/security-audit-sdk-core/tests/pass2.test.ts).
  const derived = {
    ...record,
    risk: { level: "low", score: 1, reason_codes: ["policy_baseline"], model: { name: "m", version: "1.0.0", provenance: { trust_level: "client_claim", derived_from: ["client_evidence.interaction_id", "event.name"] } } },
  };
  assert.equal(validateStructural(derived).valid, true);
});

test("CM5 — missing, ambiguous, unadmitted, and unsupported-platform correlation map nothing", () => {
  const mapper = new InteractionClaimMapper();
  assert.deepEqual(mapper.map(BINDING, []), { kind: "unmapped", reason: "absent" });
  assert.deepEqual(mapper.map(BINDING, [admitOne(), admitOne()]), { kind: "unmapped", reason: "ambiguous" });
  const admitted = admitOne();
  for (const forged of [{ ...(admitted as object) }, structuredClone(admitted), { kind: "admitted", interactionId: "x", interactionKind: "input", envelopeVersion: 1, platform: "web_browser" }]) {
    assert.deepEqual(mapper.map(BINDING, [forged]), { kind: "unmapped", reason: "unadmitted" });
  }
  assert.deepEqual(mapper.map("", [admitted]), { kind: "unmapped", reason: "unadmitted" });
  const nativePlatform = admitOne({ provenance: { ...(canonicalModeA().provenance as object), platform: "react_native" } });
  assert.deepEqual(mapper.map(BINDING, [nativePlatform]), { kind: "unmapped", reason: "unsupported_platform" });
});

test("CM6 — a conflicting claim for one interaction maps nothing, and a repeat of the same claim still maps", () => {
  const mapper = new InteractionClaimMapper();
  const first = admitOne({ interaction_kind: "form_submit" });
  assert.equal(mapper.map(BINDING, [first]).kind, "mapped");
  assert.equal(mapper.map(BINDING, [admitOne({ interaction_kind: "form_submit" })]).kind, "mapped");
  assert.deepEqual(mapper.map(BINDING, [admitOne({ interaction_kind: "button_click" })]), { kind: "unmapped", reason: "conflict" });
  // The same identifier under a different server context is an independent claim (#122).
  assert.equal(mapper.map("session-ref-beta", [admitOne({ interaction_kind: "button_click" }, "session-ref-beta")]).kind, "mapped");
});

test("CM7 — the claim ledger is bounded, expires, and fails closed at capacity", () => {
  let clock = 1_000;
  const mapper = new InteractionClaimMapper({ now: () => clock });
  for (let index = 0; index < CLAIM_MAX_RECORDS; index += 1) {
    const id = `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
    assert.equal(mapper.map(BINDING, [admitOne({ interaction_id: id })]).kind, "mapped");
  }
  assert.deepEqual(mapper.map(BINDING, [admitOne({ interaction_id: "11111111-1111-4111-8111-111111111111" })]), { kind: "unmapped", reason: "capacity" });
  clock += 60_001;
  assert.equal(mapper.map(BINDING, [admitOne({ interaction_id: "11111111-1111-4111-8111-111111111111" })]).kind, "mapped");
});

test("CM8 — a later request of an admitted interaction recalls the same reference, and nothing else does", () => {
  let clock = 1_000;
  const mapper = new InteractionClaimMapper({ now: () => clock });
  const admitted = admitOne({ interaction_kind: "form_submit" });
  const first = mappedReference(mapper.map(BINDING, [admitted]));
  // A Mode A nonce is single-use, so later requests of one interaction carry only the identifier.
  const recalled = mappedReference(mapper.recall(BINDING, first.interaction_id));
  assert.deepEqual(recalled, first);
  assert.equal(validateStructural({ ...auditRecord(), client_evidence: recalled }).valid, true);

  // Only this context's admitted interactions recall.
  assert.deepEqual(mapper.recall("session-ref-beta", first.interaction_id), { kind: "unmapped", reason: "unadmitted" });
  assert.deepEqual(mapper.recall(BINDING, "a1b2c3d4-e5f6-4a1b-8c2d-000000000000"), { kind: "unmapped", reason: "unadmitted" });
  assert.deepEqual(mapper.recall("", first.interaction_id), { kind: "unmapped", reason: "unadmitted" });

  // An interaction that outlives its bound stops recalling rather than lingering.
  clock += 60_001;
  assert.deepEqual(mapper.recall(BINDING, first.interaction_id), { kind: "unmapped", reason: "unadmitted" });
});
