#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, "../source/envelope.source.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

export const BOUNDS = Object.freeze(source.bounds);
export const REGISTRIES = Object.freeze(source.registries);
export const ERROR_CODES = Object.freeze(source.error_codes);

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEX_NONCE_REGEX = /^[0-9a-f]{32,64}$/;
const CLAIM_NAME_REGEX = /^[a-z][a-z0-9_]{1,31}$/;

const ALLOWED_ROOT_FIELDS = new Set([
  "envelope_version",
  "interaction_id",
  "interaction_kind",
  "client_timestamp",
  "provenance",
  "nonce",
  "claims",
  "transform_history"
]);

const ALLOWED_PROVENANCE_FIELDS = new Set([
  "source",
  "trust_level",
  "platform",
  "capture_scope"
]);

const ALLOWED_CLAIM_FIELDS = new Set([
  "name",
  "trust_level",
  "value"
]);

const ALLOWED_TRANSFORM_FIELDS = new Set([
  "transform",
  "timestamp"
]);

const FORBIDDEN_CLAIMS_SET = new Set(REGISTRIES.forbidden_claim_names);
const INTERACTION_KINDS_SET = new Set(REGISTRIES.interaction_kinds);
const PLATFORMS_SET = new Set(REGISTRIES.platforms);

function isRecord(value) {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  return true;
}

// A parse failure must be distinguishable from a payload that parses to null, which is a
// well-formed JSON value and must still be rejected as a non-object with its own code.
const PARSE_FAILED = Symbol("parse-failed");

function parsePayload(input, fail) {
  if (typeof input !== "string" && !Buffer.isBuffer(input)) {
    return input;
  }
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  if (raw.byteLength > BOUNDS.max_envelope_bytes) {
    fail("ENVELOPE_TOO_LARGE", "$", "Serialized size exceeds bound");
    return PARSE_FAILED;
  }
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    fail("MALFORMED_JSON", "$", "Invalid JSON syntax");
    return PARSE_FAILED;
  }
}

function validateRootFields(envelope, fail) {
  for (const key of Object.keys(envelope)) {
    if (!ALLOWED_ROOT_FIELDS.has(key)) {
      fail("UNKNOWN_FIELD", `$.${key}`, `Unknown property "${key}"`);
    }
  }
}

function validateVersion(envelope, fail) {
  if (envelope.envelope_version !== 1) {
    fail("UNKNOWN_VERSION", "$.envelope_version", "Unsupported envelope version");
  }
}

function isInvalidId(id) {
  if (typeof id !== "string") return true;
  if (id.length !== BOUNDS.interaction_id_length) return true;
  return !UUID_V4_REGEX.test(id);
}

function validateInteractionId(envelope, fail) {
  if (isInvalidId(envelope.interaction_id)) {
    fail("INVALID_INTERACTION_ID", "$.interaction_id", "Invalid interaction ID");
  }
}

function validateInteractionKind(envelope, fail) {
  const kind = envelope.interaction_kind;
  if (typeof kind !== "string") {
    fail("UNKNOWN_INTERACTION_KIND", "$.interaction_kind", "Invalid interaction kind type");
    return;
  }
  if (!INTERACTION_KINDS_SET.has(kind)) {
    fail("UNKNOWN_INTERACTION_KIND", "$.interaction_kind", "Unknown interaction kind");
  }
}

function isInvalidTimestamp(ts) {
  if (typeof ts !== "number") return true;
  if (!Number.isInteger(ts)) return true;
  if (ts < BOUNDS.min_client_timestamp) return true;
  if (ts > BOUNDS.max_client_timestamp) return true;
  return false;
}

function validateTimestamp(envelope, fail) {
  if (isInvalidTimestamp(envelope.client_timestamp)) {
    fail("INVALID_TIMESTAMP", "$.client_timestamp", "Invalid client timestamp");
  }
}

function checkProvenanceFields(prov, fail) {
  for (const key of Object.keys(prov)) {
    if (!ALLOWED_PROVENANCE_FIELDS.has(key)) {
      fail("UNKNOWN_FIELD", `$.provenance.${key}`, "Unknown provenance property");
    }
  }
}

function checkProvenanceValues(prov, fail) {
  if (prov.source !== "client_reported") {
    fail("MALFORMED_PROVENANCE", "$.provenance.source", "Invalid source");
  }
  if (prov.trust_level !== "client_claim") {
    fail("TRUST_ESCALATION_ATTEMPT", "$.provenance.trust_level", "Invalid trust level");
  }
  if (!PLATFORMS_SET.has(prov.platform)) {
    fail("MALFORMED_PROVENANCE", "$.provenance.platform", "Invalid platform");
  }
  if (prov.capture_scope !== "interaction_ephemeral") {
    fail("MALFORMED_PROVENANCE", "$.provenance.capture_scope", "Invalid capture scope");
  }
}

function validateProvenance(envelope, fail) {
  const prov = envelope.provenance;
  if (!isRecord(prov)) {
    fail("MALFORMED_PROVENANCE", "$.provenance", "provenance must be an object");
    return;
  }
  checkProvenanceFields(prov, fail);
  checkProvenanceValues(prov, fail);
}

function isInvalidNonce(nonce) {
  if (typeof nonce !== "string") return true;
  if (nonce.length < BOUNDS.min_nonce_length) return true;
  if (nonce.length > BOUNDS.max_nonce_length) return true;
  return !HEX_NONCE_REGEX.test(nonce);
}

function validateNonce(envelope, fail) {
  if (envelope.nonce === undefined) return;
  if (isInvalidNonce(envelope.nonce)) {
    fail("INVALID_NONCE", "$.nonce", "Invalid nonce");
  }
}

function checkClaimProperties(claim, claimPath, fail) {
  for (const key of Object.keys(claim)) {
    if (!ALLOWED_CLAIM_FIELDS.has(key)) {
      fail("UNKNOWN_FIELD", `${claimPath}.${key}`, "Unknown claim property");
    }
  }
}

function checkClaimName(name, claimPath, fail) {
  if (typeof name !== "string") {
    fail("OVERSIZED_STRING", `${claimPath}.name`, "Invalid claim name");
    return;
  }
  if (name.length > BOUNDS.max_claim_name_length) {
    fail("OVERSIZED_STRING", `${claimPath}.name`, "Claim name too long");
    return;
  }
  if (!CLAIM_NAME_REGEX.test(name)) {
    fail("OVERSIZED_STRING", `${claimPath}.name`, "Invalid claim name format");
    return;
  }
  if (FORBIDDEN_CLAIMS_SET.has(name)) {
    fail("FORBIDDEN_CLAIM", `${claimPath}.name`, "Forbidden claim name");
  }
}

function checkClaimTrust(trust, claimPath, fail) {
  if (trust !== "client_claim") {
    fail("TRUST_ESCALATION_ATTEMPT", `${claimPath}.trust_level`, "Invalid claim trust");
  }
}

function checkClaimValue(value, claimPath, fail) {
  if (typeof value === "string") {
    if (value.length > BOUNDS.max_claim_value_length) {
      fail("OVERSIZED_STRING", `${claimPath}.value`, "Claim value too long");
    }
    return;
  }
  if (typeof value === "number") return;
  if (typeof value === "boolean") return;
  fail("MALFORMED_JSON", `${claimPath}.value`, "Invalid claim value type");
}

function validateSingleClaim(claim, claimPath, fail) {
  if (!isRecord(claim)) {
    fail("MALFORMED_JSON", claimPath, "Claim must be an object");
    return;
  }
  checkClaimProperties(claim, claimPath, fail);
  checkClaimName(claim.name, claimPath, fail);
  checkClaimTrust(claim.trust_level, claimPath, fail);
  checkClaimValue(claim.value, claimPath, fail);
}

function validateClaims(envelope, fail) {
  if (envelope.claims === undefined) return;
  if (!Array.isArray(envelope.claims)) {
    fail("MALFORMED_JSON", "$.claims", "claims must be an array");
    return;
  }
  if (envelope.claims.length > BOUNDS.max_claims) {
    fail("OVERSIZED_COLLECTION", "$.claims", "claims count exceeds bound");
    return;
  }
  for (let i = 0; i < envelope.claims.length; i++) {
    validateSingleClaim(envelope.claims[i], `$.claims[${i}]`, fail);
  }
}

function checkTransformProperties(item, itemPath, fail) {
  for (const key of Object.keys(item)) {
    if (!ALLOWED_TRANSFORM_FIELDS.has(key)) {
      fail("UNKNOWN_FIELD", `${itemPath}.${key}`, "Unknown transform property");
    }
  }
}

function checkTransformName(name, itemPath, fail) {
  if (typeof name !== "string") {
    fail("OVERSIZED_STRING", `${itemPath}.transform`, "Invalid transform name");
    return;
  }
  if (name.length > BOUNDS.max_transform_name_length) {
    fail("OVERSIZED_STRING", `${itemPath}.transform`, "Transform name too long");
  }
}

function checkTransformTimestamp(ts, itemPath, fail) {
  if (isInvalidTimestamp(ts)) {
    fail("INVALID_TIMESTAMP", `${itemPath}.timestamp`, "Invalid transform timestamp");
  }
}

function validateSingleTransform(item, itemPath, fail) {
  if (!isRecord(item)) {
    fail("MALFORMED_JSON", itemPath, "Transform must be an object");
    return;
  }
  checkTransformProperties(item, itemPath, fail);
  checkTransformName(item.transform, itemPath, fail);
  checkTransformTimestamp(item.timestamp, itemPath, fail);
}

function validateTransformHistory(envelope, fail) {
  if (envelope.transform_history === undefined) return;
  if (!Array.isArray(envelope.transform_history)) {
    fail("MALFORMED_JSON", "$.transform_history", "transform_history must be an array");
    return;
  }
  if (envelope.transform_history.length > BOUNDS.max_transforms) {
    fail("OVERSIZED_COLLECTION", "$.transform_history", "transform_history count exceeds bound");
    return;
  }
  for (let i = 0; i < envelope.transform_history.length; i++) {
    validateSingleTransform(envelope.transform_history[i], `$.transform_history[${i}]`, fail);
  }
}

/**
 * Validates a candidate ClientEvidenceEnvelope fail-closed.
 *
 * @param {unknown} input - Raw string, Buffer, or parsed JavaScript object
 * @returns {{ valid: boolean, errors: Array<{ code: string, message: string, path: string }> }}
 */
export function validateEnvelope(input) {
  const errors = [];

  function fail(code, path, message) {
    errors.push({
      code,
      path,
      message: message || ERROR_CODES[code] || "Validation failure"
    });
  }

  const envelope = parsePayload(input, fail);
  if (envelope === PARSE_FAILED) {
    return { valid: false, errors };
  }
  if (!isRecord(envelope)) {
    fail("MALFORMED_JSON", "$", "Envelope must be an object");
    return { valid: false, errors };
  }

  validateRootFields(envelope, fail);
  validateVersion(envelope, fail);
  validateInteractionId(envelope, fail);
  validateInteractionKind(envelope, fail);
  validateTimestamp(envelope, fail);
  validateProvenance(envelope, fail);
  validateNonce(envelope, fail);
  validateClaims(envelope, fail);
  validateTransformHistory(envelope, fail);

  return {
    valid: errors.length === 0,
    errors
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write("Usage: node validate-envelope.mjs <envelope.json>\n");
    process.exit(2);
  }
  const content = readFileSync(resolve(filePath), "utf8");
  const result = validateEnvelope(content);
  if (!result.valid) {
    process.stderr.write(`Validation failed with ${result.errors.length} error(s):\n`);
    for (const err of result.errors) {
      process.stderr.write(`  [${err.code}] ${err.path}: ${err.message}\n`);
    }
    process.exit(1);
  }
  process.stdout.write("Envelope is valid.\n");
  process.exit(0);
}
