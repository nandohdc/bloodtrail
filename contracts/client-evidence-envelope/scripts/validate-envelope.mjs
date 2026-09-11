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

  let envelope = input;

  if (typeof input === "string" || Buffer.isBuffer(input)) {
    const rawBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
    if (rawBuffer.byteLength > BOUNDS.max_envelope_bytes) {
      fail("ENVELOPE_TOO_LARGE", "$", `Serialized size ${rawBuffer.byteLength} exceeds maximum allowed ${BOUNDS.max_envelope_bytes} bytes`);
      return { valid: false, errors };
    }
    try {
      envelope = JSON.parse(rawBuffer.toString("utf8"));
    } catch (e) {
      fail("MALFORMED_JSON", "$", "Invalid JSON syntax: " + e.message);
      return { valid: false, errors };
    }
  }

  if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)) {
    fail("MALFORMED_JSON", "$", "Envelope must be a JSON object");
    return { valid: false, errors };
  }

  // Check unknown root fields
  for (const key of Object.keys(envelope)) {
    if (!ALLOWED_ROOT_FIELDS.has(key)) {
      fail("UNKNOWN_FIELD", `$.${key}`, `Unknown property "${key}" not permitted in closed schema`);
    }
  }

  // envelope_version
  if (envelope.envelope_version !== 1) {
    fail("UNKNOWN_VERSION", "$.envelope_version", `Unsupported envelope version: ${envelope.envelope_version}; must be 1`);
  }

  // interaction_id
  if (typeof envelope.interaction_id !== "string" ||
      envelope.interaction_id.length !== BOUNDS.interaction_id_length ||
      !UUID_V4_REGEX.test(envelope.interaction_id)) {
    fail("INVALID_INTERACTION_ID", "$.interaction_id", "interaction_id must be a lowercase RFC 4122 UUID v4 of length 36");
  }

  // interaction_kind
  if (typeof envelope.interaction_kind !== "string" || !INTERACTION_KINDS_SET.has(envelope.interaction_kind)) {
    fail("UNKNOWN_INTERACTION_KIND", "$.interaction_kind", `Unknown interaction_kind "${envelope.interaction_kind}"`);
  }

  // client_timestamp
  if (typeof envelope.client_timestamp !== "number" ||
      !Number.isInteger(envelope.client_timestamp) ||
      envelope.client_timestamp < BOUNDS.min_client_timestamp ||
      envelope.client_timestamp > BOUNDS.max_client_timestamp) {
    fail("INVALID_TIMESTAMP", "$.client_timestamp", "client_timestamp must be an integer millisecond epoch within allowed bounds");
  }

  // provenance
  const prov = envelope.provenance;
  if (!prov || typeof prov !== "object" || Array.isArray(prov)) {
    fail("MALFORMED_PROVENANCE", "$.provenance", "provenance must be a non-null object");
  } else {
    for (const key of Object.keys(prov)) {
      if (!ALLOWED_PROVENANCE_FIELDS.has(key)) {
        fail("UNKNOWN_FIELD", `$.provenance.${key}`, `Unknown provenance property "${key}"`);
      }
    }
    if (prov.source !== "client_reported") {
      fail("MALFORMED_PROVENANCE", "$.provenance.source", `source must be "client_reported", got "${prov.source}"`);
    }
    if (prov.trust_level !== "client_claim") {
      fail("TRUST_ESCALATION_ATTEMPT", "$.provenance.trust_level", `trust_level must be "client_claim", got "${prov.trust_level}"`);
    }
    if (typeof prov.platform !== "string" || !PLATFORMS_SET.has(prov.platform)) {
      fail("MALFORMED_PROVENANCE", "$.provenance.platform", `platform "${prov.platform}" not in approved platforms`);
    }
    if (prov.capture_scope !== "interaction_ephemeral") {
      fail("MALFORMED_PROVENANCE", "$.provenance.capture_scope", `capture_scope must be "interaction_ephemeral", got "${prov.capture_scope}"`);
    }
  }

  // nonce (optional Mode A)
  if (envelope.nonce !== undefined) {
    if (typeof envelope.nonce !== "string" ||
        envelope.nonce.length < BOUNDS.min_nonce_length ||
        envelope.nonce.length > BOUNDS.max_nonce_length ||
        !HEX_NONCE_REGEX.test(envelope.nonce)) {
      fail("INVALID_NONCE", "$.nonce", "nonce must be a lowercase hex string between 32 and 64 characters");
    }
  }

  // claims (optional collection)
  if (envelope.claims !== undefined) {
    if (!Array.isArray(envelope.claims)) {
      fail("MALFORMED_JSON", "$.claims", "claims must be an array");
    } else if (envelope.claims.length > BOUNDS.max_claims) {
      fail("OVERSIZED_COLLECTION", "$.claims", `claims count ${envelope.claims.length} exceeds maximum bound of ${BOUNDS.max_claims}`);
    } else {
      for (let i = 0; i < envelope.claims.length; i++) {
        const claim = envelope.claims[i];
        const claimPath = `$.claims[${i}]`;
        if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
          fail("MALFORMED_JSON", claimPath, "Each claim must be an object");
          continue;
        }
        for (const key of Object.keys(claim)) {
          if (!ALLOWED_CLAIM_FIELDS.has(key)) {
            fail("UNKNOWN_FIELD", `${claimPath}.${key}`, `Unknown property "${key}" in claim`);
          }
        }
        if (typeof claim.name !== "string" || !CLAIM_NAME_REGEX.test(claim.name) || claim.name.length > BOUNDS.max_claim_name_length) {
          fail("OVERSIZED_STRING", `${claimPath}.name`, `Claim name "${claim.name}" is invalid or exceeds ${BOUNDS.max_claim_name_length} chars`);
        } else if (FORBIDDEN_CLAIMS_SET.has(claim.name)) {
          fail("FORBIDDEN_CLAIM", `${claimPath}.name`, `Claim "${claim.name}" is forbidden under privacy/fingerprinting inventory`);
        }
        if (claim.trust_level !== "client_claim") {
          fail("TRUST_ESCALATION_ATTEMPT", `${claimPath}.trust_level`, `Claim trust_level must be "client_claim", got "${claim.trust_level}"`);
        }
        const valType = typeof claim.value;
        if (valType === "string") {
          if (claim.value.length > BOUNDS.max_claim_value_length) {
            fail("OVERSIZED_STRING", `${claimPath}.value`, `Claim value exceeds maximum length of ${BOUNDS.max_claim_value_length} chars`);
          }
        } else if (valType !== "number" && valType !== "boolean") {
          fail("MALFORMED_JSON", `${claimPath}.value`, "Claim value must be string, number, or boolean");
        }
      }
    }
  }

  // transform_history (optional collection)
  if (envelope.transform_history !== undefined) {
    if (!Array.isArray(envelope.transform_history)) {
      fail("MALFORMED_JSON", "$.transform_history", "transform_history must be an array");
    } else if (envelope.transform_history.length > BOUNDS.max_transforms) {
      fail("OVERSIZED_COLLECTION", "$.transform_history", `transform_history count ${envelope.transform_history.length} exceeds maximum bound of ${BOUNDS.max_transforms}`);
    } else {
      for (let i = 0; i < envelope.transform_history.length; i++) {
        const item = envelope.transform_history[i];
        const itemPath = `$.transform_history[${i}]`;
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          fail("MALFORMED_JSON", itemPath, "Each transform_history entry must be an object");
          continue;
        }
        for (const key of Object.keys(item)) {
          if (!ALLOWED_TRANSFORM_FIELDS.has(key)) {
            fail("UNKNOWN_FIELD", `${itemPath}.${key}`, `Unknown property "${key}" in transform_history`);
          }
        }
        if (typeof item.transform !== "string" || item.transform.length > BOUNDS.max_transform_name_length) {
          fail("OVERSIZED_STRING", `${itemPath}.transform`, `transform name exceeds ${BOUNDS.max_transform_name_length} chars`);
        }
        if (typeof item.timestamp !== "number" ||
            !Number.isInteger(item.timestamp) ||
            item.timestamp < BOUNDS.min_client_timestamp ||
            item.timestamp > BOUNDS.max_client_timestamp) {
          fail("INVALID_TIMESTAMP", `${itemPath}.timestamp`, "transform timestamp out of valid bounds");
        }
      }
    }
  }

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
