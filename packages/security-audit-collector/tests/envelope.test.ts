import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import {
  ClientEvidenceIngress,
  ENVELOPE_REJECTION_CLASSES,
  InteractionNonceLedger,
  NONCE_LIFETIME_MILLISECONDS,
  NONCE_MAX_RECORDS,
  isAdmittedEnvelope,
  type EnvelopeRejectionClass,
} from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const envelopeContract = resolve(here, "../../../contracts/client-evidence-envelope");
const BINDING = "session-ref-alpha";
const OTHER_BINDING = "session-ref-beta";
const NONCE = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

type Envelope = Record<string, unknown> & { provenance: Record<string, unknown>; claims?: Record<string, unknown>[] };
type ContractValidator = (input: string) => { valid: boolean; errors: { code: string }[] };

function fixture(kind: "canonical" | "negative", name: string): string {
  return readFileSync(resolve(envelopeContract, "fixtures", kind, name), "utf8");
}

function canonicalModeA(): Envelope {
  return JSON.parse(fixture("canonical", "positive-canonical-mode-a.json")) as Envelope;
}

function sequence(values: readonly string[]): () => string {
  let index = 0;
  return () => values[index++ % values.length] as string;
}

function stage(options: { nonces?: readonly string[]; now?: () => number } = {}) {
  const source = sequence(options.nonces ?? [NONCE]);
  const nonces = new InteractionNonceLedger(options.now === undefined ? { source } : { source, now: options.now });
  return { nonces, ingress: new ClientEvidenceIngress({ nonces }) };
}

function issued(ledger: InteractionNonceLedger, binding = BINDING): string {
  const result = ledger.issue(binding);
  assert.equal(result.kind, "issued");
  return result.kind === "issued" ? result.nonce : "";
}

function expectClass(result: ReturnType<ClientEvidenceIngress["admit"]>, rejectionClass: EnvelopeRejectionClass): void {
  assert.deepEqual(result, { kind: "rejected", rejectionClass });
}

async function contractValidator(): Promise<ContractValidator> {
  const module = (await import(pathToFileURL(resolve(envelopeContract, "scripts/validate-envelope.mjs")).href)) as { validateEnvelope: ContractValidator };
  return module.validateEnvelope;
}

// Mutations the parity corpus adds to the committed fixtures, one per validation rule.
const PARITY_MUTATIONS: Readonly<Record<string, (envelope: Envelope) => unknown>> = Object.freeze({
  "null payload": () => null,
  "array payload": () => [],
  "provenance not an object": (envelope) => ({ ...envelope, provenance: "web" }),
  "unknown provenance member": (envelope) => ({ ...envelope, provenance: { ...envelope.provenance, device: "x" } }),
  "non-hex nonce": (envelope) => ({ ...envelope, nonce: "Z".repeat(32) }),
  "short nonce": (envelope) => ({ ...envelope, nonce: "a".repeat(31) }),
  "claims not an array": (envelope) => ({ ...envelope, claims: {} }),
  "claim not an object": (envelope) => ({ ...envelope, claims: ["x"] }),
  "claim value object": (envelope) => ({ ...envelope, claims: [{ name: "sequence", trust_level: "client_claim", value: {} }] }),
  "claim trust escalated": (envelope) => ({ ...envelope, claims: [{ name: "sequence", trust_level: "derived_server", value: 1 }] }),
  "oversized transforms": (envelope) => ({ ...envelope, transform_history: Array.from({ length: 5 }, () => ({ transform: "t", timestamp: 1773244850000 })) }),
  "transform timestamp out of bounds": (envelope) => ({ ...envelope, transform_history: [{ transform: "t", timestamp: 1 }] }),
  "fractional client timestamp": (envelope) => ({ ...envelope, client_timestamp: 1773244850000.5 }),
  "several faults at once": (envelope) => ({ ...envelope, envelope_version: 2, interaction_kind: "hover", risk: "low" }),
});

test("CE1 — a canonical Mode A envelope with its issued nonce is admitted as a client claim only", () => {
  const { nonces, ingress } = stage();
  const nonce = issued(nonces);
  const envelope = canonicalModeA();
  const result = ingress.admit({ body: JSON.stringify({ ...envelope, nonce }), binding: BINDING });
  assert.deepEqual(result, {
    kind: "admitted",
    interactionId: envelope.interaction_id,
    interactionKind: envelope.interaction_kind,
    envelopeVersion: 1,
    platform: "web_browser",
  });
  assert.ok(Object.isFrozen(result));
  assert.ok(isAdmittedEnvelope(result));
  assert.equal(ingress.metrics().admitted, 1);
});

test("CE2 — the stage reports exactly the envelope contract validator's codes on every fixture and mutation", async () => {
  const validateEnvelope = await contractValidator();
  const { inspectEnvelope } = (await import(pathToFileURL(resolve(here, "../dist/envelope-validation.js")).href)) as {
    inspectEnvelope: (text: string) => { codes: readonly string[] };
  };
  const corpus: [string, string][] = [];
  for (const kind of ["canonical", "negative"] as const) {
    for (const name of readdirSync(resolve(envelopeContract, "fixtures", kind)).sort()) corpus.push([name, fixture(kind, name)]);
  }
  for (const [label, mutate] of Object.entries(PARITY_MUTATIONS)) corpus.push([label, JSON.stringify(mutate(canonicalModeA()))]);
  corpus.push(["malformed JSON", "{"], ["oversized envelope", " ".repeat(4097)]);
  for (const [label, text] of corpus) {
    const expected = validateEnvelope(text);
    const actual = inspectEnvelope(text).codes;
    assert.deepEqual(actual, expected.errors.map((error) => error.code), label);
    assert.equal(actual.length === 0, expected.valid, `${label}: validity agrees`);
  }
});

// One envelope per rejection class the validation stage can reach.
const REJECTION_CASES: readonly (readonly [EnvelopeRejectionClass, (envelope: Envelope) => unknown])[] = Object.freeze([
  ["version", (envelope) => ({ ...envelope, envelope_version: 2 })],
  ["bounds", (envelope) => ({ ...envelope, claims: Array.from({ length: 9 }, (_, i) => ({ name: `claim_${i}`, trust_level: "client_claim", value: i })) })],
  ["bounds", (envelope) => ({ ...envelope, claims: [{ name: "note", trust_level: "client_claim", value: "x".repeat(129) }] })],
  ["vocabulary", (envelope) => ({ ...envelope, interaction_kind: "keystroke" })],
  ["structure", (envelope) => ({ ...envelope, interaction_id: "not-a-uuid" })],
  ["structure", (envelope) => ({ ...envelope, provenance: { ...envelope.provenance, platform: "desktop" } })],
  ["fabrication", (envelope) => ({ ...envelope, claims: [{ name: "risk_score", trust_level: "client_claim", value: 1 }] })],
  ["fabrication", (envelope) => ({ ...envelope, provenance: { ...envelope.provenance, trust_level: "authoritative_server" } })],
  ["fabrication", (envelope) => ({ ...envelope, risk: { level: "low" } })],
  ["fabrication", (envelope) => ({ ...envelope, tenant: { effective_tenant_id: "tenant_x" }, envelope_version: 2 })],
]);

test("CE3 — every rejection class is reached deterministically and fails closed", () => {
  for (const [rejectionClass, mutate] of REJECTION_CASES) {
    const { nonces, ingress } = stage();
    const nonce = issued(nonces);
    expectClass(ingress.admit({ body: JSON.stringify(mutate({ ...canonicalModeA(), nonce })), binding: BINDING }), rejectionClass);
    assert.equal(ingress.metrics()[rejectionClass], 1);
    assert.equal(ingress.metrics().admitted, 0);
  }
  const { ingress } = stage();
  expectClass(ingress.admit({ body: "x".repeat(4097), binding: BINDING }), "bounds");
  expectClass(ingress.admit({ body: 42 as unknown as string, binding: BINDING }), "structure");
});

test("CE4 — a Mode A envelope without a nonce or a usable binding is unbound", () => {
  const { nonces, ingress } = stage();
  const { nonce: _unused, ...withoutNonce } = canonicalModeA();
  expectClass(ingress.admit({ body: JSON.stringify(withoutNonce), binding: BINDING }), "unbound");
  const nonce = issued(nonces);
  for (const binding of ["", "x".repeat(257), undefined]) {
    expectClass(ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), nonce }), binding: binding as string }), "unbound");
  }
  assert.equal(ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), nonce }), binding: BINDING }).kind, "admitted");
});

test("CE5 — a replayed, expired, or never-issued nonce is a replay and maps nothing", () => {
  let clock = 1_000;
  const { nonces, ingress } = stage({ nonces: [NONCE, "a".repeat(64)], now: () => clock });
  const first = issued(nonces);
  const body = JSON.stringify({ ...canonicalModeA(), nonce: first });
  assert.equal(ingress.admit({ body, binding: BINDING }).kind, "admitted");
  expectClass(ingress.admit({ body, binding: BINDING }), "replay");
  const second = issued(nonces);
  clock += NONCE_LIFETIME_MILLISECONDS;
  expectClass(ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), nonce: second }), binding: BINDING }), "replay");
  expectClass(ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), nonce: "b".repeat(32) }), binding: BINDING }), "replay");
  assert.equal(ingress.metrics().replay, 3);
});

test("CE6 — a nonce presented under another context is a substitution and is burned", () => {
  const { nonces, ingress } = stage();
  const nonce = issued(nonces, BINDING);
  const body = JSON.stringify({ ...canonicalModeA(), nonce });
  expectClass(ingress.admit({ body, binding: OTHER_BINDING }), "substitution");
  expectClass(ingress.admit({ body, binding: BINDING }), "replay");
});

test("CE7 — an invalid envelope does not spend its nonce", () => {
  const { nonces, ingress } = stage();
  const nonce = issued(nonces);
  expectClass(ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), nonce, interaction_kind: "hover" }), binding: BINDING }), "vocabulary");
  assert.equal(ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), nonce }), binding: BINDING }).kind, "admitted");
});

test("CE8 — a forged interaction identifier with a valid nonce is admitted, and only as a claim", () => {
  const { nonces, ingress } = stage();
  const nonce = issued(nonces);
  const forged = { ...canonicalModeA(), nonce, interaction_id: "00000000-0000-4000-8000-000000000000" };
  const result = ingress.admit({ body: JSON.stringify(forged), binding: BINDING });
  assert.equal(result.kind, "admitted");
  assert.deepEqual(Object.keys(result).sort(), ["envelopeVersion", "interactionId", "interactionKind", "kind", "platform"]);
});

test("CE9 — nonce issuance fails closed on capacity, an unusable binding, or an unusable source", () => {
  const counter = { next: 0 };
  const ledger = new InteractionNonceLedger({ source: () => (counter.next++).toString(16).padStart(32, "0"), now: () => 0 });
  for (let i = 0; i < NONCE_MAX_RECORDS; i += 1) assert.equal(ledger.issue(BINDING).kind, "issued");
  assert.deepEqual(ledger.issue(BINDING), { kind: "refused", reason: "capacity" });
  assert.deepEqual(new InteractionNonceLedger({ source: () => NONCE }).issue(""), { kind: "refused", reason: "binding" });
  for (const source of [() => "NOT-HEX", () => "ab", () => { throw new Error("entropy unavailable"); }]) {
    assert.deepEqual(new InteractionNonceLedger({ source }).issue(BINDING), { kind: "refused", reason: "source" });
  }
  const repeating = new InteractionNonceLedger({ source: () => NONCE });
  assert.equal(repeating.issue(BINDING).kind, "issued");
  assert.deepEqual(repeating.issue(BINDING), { kind: "refused", reason: "source" });
});

test("CE10 — counters and rejections carry no payload, identifier, nonce, or binding", () => {
  const { nonces, ingress } = stage();
  const nonce = issued(nonces);
  const base = canonicalModeA();
  const envelope = { ...base, nonce, claims: [{ name: "risk_score", trust_level: "client_claim", value: "PAYLOAD_MARKER" }] };
  const rejected = ingress.admit({ body: JSON.stringify(envelope), binding: BINDING });
  const observed = JSON.stringify([rejected, ingress.metrics()]);
  for (const secret of ["PAYLOAD_MARKER", nonce, BINDING, String(base.interaction_id), "risk_score"]) {
    assert.equal(observed.includes(secret), false, secret);
  }
  assert.deepEqual(Object.keys(ingress.metrics()), ["admitted", ...ENVELOPE_REJECTION_CLASSES]);
});

test("CE11 — only a value the stage admitted carries the admission brand", () => {
  const { nonces, ingress } = stage();
  const admitted = ingress.admit({ body: JSON.stringify({ ...canonicalModeA(), nonce: issued(nonces) }), binding: BINDING });
  assert.ok(isAdmittedEnvelope(admitted));
  for (const forged of [{ ...admitted }, structuredClone(admitted), JSON.parse(JSON.stringify(admitted)), null, "admitted"]) {
    assert.equal(isAdmittedEnvelope(forged), false);
  }
});
