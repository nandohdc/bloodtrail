import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { validateEnvelope, REGISTRIES } from "../scripts/validate-envelope.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relPath) {
  const content = await readFile(resolve(root, relPath), "utf8");
  return JSON.parse(content);
}

test("generated artifacts are current and drift-free", async () => {
  await execFileAsync("node", ["scripts/generate-artifacts.mjs", "--check"], { cwd: root });
});

test("source and schema declare strict Draft 2020-12 boundaries and v1 discriminator", async () => {
  const source = await readJson("source/envelope.source.json");
  const schema = await readJson("schema/client-evidence-envelope.schema.json");

  assert.equal(source.authoritative_source, true);
  assert.equal(source.metadata.envelope_version, 1);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.unevaluatedProperties, false);
  assert.equal(schema.properties.envelope_version.const, 1);
  assert.equal(schema.properties.interaction_id.maxLength, 36);
  assert.equal(schema.properties.provenance.additionalProperties, false);
  assert.equal(schema.properties.claims.maxItems, 8);
  assert.equal(schema.properties.transform_history.maxItems, 4);
});

test("positive canonical fixtures pass validation and claims carry client_claim trust", async () => {
  const canonical = await readJson("fixtures/canonical/positive-canonical-envelope.json");
  const modeA = await readJson("fixtures/canonical/positive-canonical-mode-a.json");

  const res1 = validateEnvelope(canonical);
  assert.equal(res1.valid, true, `Validation failed: ${JSON.stringify(res1.errors)}`);
  assert.equal(canonical.provenance.trust_level, "client_claim");
  for (const claim of canonical.claims || []) {
    assert.equal(claim.trust_level, "client_claim");
  }

  const res2 = validateEnvelope(modeA);
  assert.equal(res2.valid, true, `Mode A validation failed: ${JSON.stringify(res2.errors)}`);
  assert.equal(modeA.provenance.trust_level, "client_claim");
  for (const claim of modeA.claims || []) {
    assert.equal(claim.trust_level, "client_claim");
  }
});

test("negative fixture unknown-version deterministically fails with UNKNOWN_VERSION", async () => {
  const fixture = await readJson("fixtures/negative/unknown-version.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "UNKNOWN_VERSION"), "Expected UNKNOWN_VERSION error");
});

test("negative fixture oversized-collection deterministically fails with OVERSIZED_COLLECTION", async () => {
  const fixture = await readJson("fixtures/negative/oversized-collection.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "OVERSIZED_COLLECTION"), "Expected OVERSIZED_COLLECTION error");
});

test("negative fixture malformed-provenance deterministically fails with TRUST_ESCALATION_ATTEMPT", async () => {
  const fixture = await readJson("fixtures/negative/malformed-provenance.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "TRUST_ESCALATION_ATTEMPT"), "Expected TRUST_ESCALATION_ATTEMPT error");
});

test("negative fixture forbidden-claim deterministically fails with FORBIDDEN_CLAIM", async () => {
  const fixture = await readJson("fixtures/negative/forbidden-claim.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "FORBIDDEN_CLAIM"), "Expected FORBIDDEN_CLAIM error");
});

test("negative fixture oversized-string deterministically fails with OVERSIZED_STRING", async () => {
  const fixture = await readJson("fixtures/negative/oversized-string.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "OVERSIZED_STRING"), "Expected OVERSIZED_STRING error");
});

test("negative fixture invalid-interaction-id deterministically fails with INVALID_INTERACTION_ID", async () => {
  const fixture = await readJson("fixtures/negative/invalid-interaction-id.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "INVALID_INTERACTION_ID"), "Expected INVALID_INTERACTION_ID error");
});

test("negative fixture unknown-interaction-kind deterministically fails with UNKNOWN_INTERACTION_KIND", async () => {
  const fixture = await readJson("fixtures/negative/unknown-interaction-kind.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "UNKNOWN_INTERACTION_KIND"), "Expected UNKNOWN_INTERACTION_KIND error");
});

test("negative fixture unknown-field deterministically fails with UNKNOWN_FIELD", async () => {
  const fixture = await readJson("fixtures/negative/unknown-field.json");
  const res = validateEnvelope(fixture);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "UNKNOWN_FIELD"), "Expected UNKNOWN_FIELD error");
});

test("oversized payload (> 4096 bytes) fails closed with ENVELOPE_TOO_LARGE", async () => {
  const canonical = await readJson("fixtures/canonical/positive-canonical-envelope.json");
  // Expand payload beyond 4096 bytes by repeating padding in an oversized envelope string
  const oversizedRaw = JSON.stringify(canonical) + " ".repeat(4097);
  const res = validateEnvelope(oversizedRaw);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "ENVELOPE_TOO_LARGE"), "Expected ENVELOPE_TOO_LARGE error");
});

test("malformed JSON fails with MALFORMED_JSON", async () => {
  const res = validateEnvelope("not valid json { [");
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "MALFORMED_JSON"), "Expected MALFORMED_JSON error");
});

test("interaction_kind closed vocabulary contains exactly <= 8 values", () => {
  assert.ok(REGISTRIES.interaction_kinds.length <= 8, "Vocabulary must not exceed 8 values");
  assert.equal(REGISTRIES.interaction_kinds.length, 8);
  const kinds = new Set(REGISTRIES.interaction_kinds);
  assert.ok(kinds.has("navigation"));
  assert.ok(kinds.has("form_submit"));
  assert.ok(kinds.has("button_click"));
  assert.ok(kinds.has("input"));
  assert.ok(kinds.has("dialog_action"));
  assert.ok(kinds.has("tab_switch"));
  assert.ok(kinds.has("refresh"));
  assert.ok(kinds.has("custom"));
});

test("all forbidden claim names from privacy/fingerprinting inventory are rejected", async () => {
  const canonical = await readJson("fixtures/canonical/positive-canonical-envelope.json");
  for (const forbidden of REGISTRIES.forbidden_claim_names) {
    const mutated = structuredClone(canonical);
    mutated.claims = [{ name: forbidden, trust_level: "client_claim", value: "test" }];
    const res = validateEnvelope(mutated);
    assert.equal(res.valid, false, `Forbidden claim "${forbidden}" should fail validation`);
    assert.ok(res.errors.some((e) => e.code === "FORBIDDEN_CLAIM"), `Expected FORBIDDEN_CLAIM for "${forbidden}"`);
  }
});

test("nonce validation enforces hex pattern and length constraints", async () => {
  const canonical = await readJson("fixtures/canonical/positive-canonical-envelope.json");

  // Non-hex characters
  const nonHex = structuredClone(canonical);
  nonHex.nonce = "g".repeat(32);
  const res1 = validateEnvelope(nonHex);
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.code === "INVALID_NONCE"));

  // Too short (< 32)
  const tooShort = structuredClone(canonical);
  tooShort.nonce = "a".repeat(31);
  const res2 = validateEnvelope(tooShort);
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some((e) => e.code === "INVALID_NONCE"));

  // Too long (> 64)
  const tooLong = structuredClone(canonical);
  tooLong.nonce = "a".repeat(65);
  const res3 = validateEnvelope(tooLong);
  assert.equal(res3.valid, false);
  assert.ok(res3.errors.some((e) => e.code === "INVALID_NONCE"));
});

test("rejection is fail-closed: oversized data is never truncated or repaired", async () => {
  const canonical = await readJson("fixtures/canonical/positive-canonical-envelope.json");
  const mutated = structuredClone(canonical);
  mutated.claims = [
    { name: "test_seq", trust_level: "client_claim", value: "x".repeat(200) }
  ];
  const res = validateEnvelope(mutated);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "OVERSIZED_STRING"));
});
