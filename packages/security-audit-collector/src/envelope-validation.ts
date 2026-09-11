// Structural validation of a ClientEvidenceEnvelope v1 at backend ingress (#126).
// This is a typed port of contracts/client-evidence-envelope/scripts/validate-envelope.mjs:
// it reports the same closed error codes in the same order, and tests/envelope.test.ts holds
// the two to parity over every envelope fixture. Every bound and vocabulary is generated
// from the envelope source. Validation never repairs, truncates, or coerces a value.

import {
  CAPTURE_SCOPES,
  ENVELOPE_VERSIONS,
  FORBIDDEN_CLAIM_NAMES,
  INTERACTION_ID_LENGTH,
  INTERACTION_KINDS,
  MAX_CLAIM_NAME_LENGTH,
  MAX_CLAIM_VALUE_LENGTH,
  MAX_CLAIMS,
  MAX_CLIENT_TIMESTAMP,
  MAX_ENVELOPE_BYTES,
  MAX_NONCE_LENGTH,
  MAX_TRANSFORM_NAME_LENGTH,
  MAX_TRANSFORMS,
  MIN_CLIENT_TIMESTAMP,
  MIN_NONCE_LENGTH,
  PLATFORMS,
  PROVENANCE_SOURCES,
  TRUST_LEVELS,
} from "./generated/envelope-rules.generated.js";

export type EnvelopeCode =
  | "ENVELOPE_TOO_LARGE"
  | "MALFORMED_JSON"
  | "UNKNOWN_FIELD"
  | "UNKNOWN_VERSION"
  | "INVALID_INTERACTION_ID"
  | "UNKNOWN_INTERACTION_KIND"
  | "INVALID_TIMESTAMP"
  | "MALFORMED_PROVENANCE"
  | "TRUST_ESCALATION_ATTEMPT"
  | "INVALID_NONCE"
  | "OVERSIZED_COLLECTION"
  | "OVERSIZED_STRING"
  | "FORBIDDEN_CLAIM";

export type EnvelopeRecord = Readonly<Record<string, unknown>>;

export interface EnvelopeInspection {
  readonly codes: readonly EnvelopeCode[];
  // The parsed envelope, or null when it could not be parsed into an object.
  readonly envelope: EnvelopeRecord | null;
}

type Fail = (code: EnvelopeCode) => void;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEX_NONCE = new RegExp(`^[0-9a-f]{${MIN_NONCE_LENGTH},${MAX_NONCE_LENGTH}}$`);
const CLAIM_NAME = /^[a-z][a-z0-9_]{1,31}$/;

const ROOT_FIELDS = new Set([
  "envelope_version",
  "interaction_id",
  "interaction_kind",
  "client_timestamp",
  "provenance",
  "nonce",
  "claims",
  "transform_history",
]);
const PROVENANCE_FIELDS = new Set(["source", "trust_level", "platform", "capture_scope"]);
const CLAIM_FIELDS = new Set(["name", "trust_level", "value"]);
const TRANSFORM_FIELDS = new Set(["transform", "timestamp"]);
const FORBIDDEN_CLAIMS = new Set(FORBIDDEN_CLAIM_NAMES);
const KINDS = new Set(INTERACTION_KINDS);
const PLATFORM_SET = new Set(PLATFORMS);

/** True for a lowercase hex nonce within the envelope's length bounds. */
export function isWellFormedNonce(value: unknown): value is string {
  return typeof value === "string" && HEX_NONCE.test(value);
}

export function isEnvelopeRecord(value: unknown): value is EnvelopeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parse(text: string, fail: Fail): unknown {
  if (new TextEncoder().encode(text).byteLength > MAX_ENVELOPE_BYTES) {
    fail("ENVELOPE_TOO_LARGE");
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    fail("MALFORMED_JSON");
    return undefined;
  }
}

function checkMembers(record: EnvelopeRecord, allowed: ReadonlySet<string>, fail: Fail): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail("UNKNOWN_FIELD");
  }
}

function isValidTimestamp(value: unknown): boolean {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  return value >= MIN_CLIENT_TIMESTAMP && value <= MAX_CLIENT_TIMESTAMP;
}

function isValidInteractionId(id: unknown): boolean {
  if (typeof id !== "string" || id.length !== INTERACTION_ID_LENGTH) return false;
  return UUID_V4.test(id);
}

function isApprovedKind(kind: unknown): boolean {
  return typeof kind === "string" && KINDS.has(kind);
}

function checkIdentity(envelope: EnvelopeRecord, fail: Fail): void {
  if (!ENVELOPE_VERSIONS.includes(envelope.envelope_version as number)) fail("UNKNOWN_VERSION");
  if (!isValidInteractionId(envelope.interaction_id)) fail("INVALID_INTERACTION_ID");
  if (!isApprovedKind(envelope.interaction_kind)) fail("UNKNOWN_INTERACTION_KIND");
  if (!isValidTimestamp(envelope.client_timestamp)) fail("INVALID_TIMESTAMP");
}

function checkProvenance(provenance: unknown, fail: Fail): void {
  if (!isEnvelopeRecord(provenance)) {
    fail("MALFORMED_PROVENANCE");
    return;
  }
  checkMembers(provenance, PROVENANCE_FIELDS, fail);
  if (!PROVENANCE_SOURCES.includes(provenance.source as string)) fail("MALFORMED_PROVENANCE");
  if (!TRUST_LEVELS.includes(provenance.trust_level as string)) fail("TRUST_ESCALATION_ATTEMPT");
  if (!PLATFORM_SET.has(provenance.platform as string)) fail("MALFORMED_PROVENANCE");
  if (!CAPTURE_SCOPES.includes(provenance.capture_scope as string)) fail("MALFORMED_PROVENANCE");
}

function checkNonce(nonce: unknown, fail: Fail): void {
  if (nonce === undefined) return;
  if (!isWellFormedNonce(nonce)) fail("INVALID_NONCE");
}

function isWellFormedClaimName(name: unknown): name is string {
  if (typeof name !== "string" || name.length > MAX_CLAIM_NAME_LENGTH) return false;
  return CLAIM_NAME.test(name);
}

function checkClaimName(name: unknown, fail: Fail): void {
  if (!isWellFormedClaimName(name)) {
    fail("OVERSIZED_STRING");
    return;
  }
  if (FORBIDDEN_CLAIMS.has(name)) fail("FORBIDDEN_CLAIM");
}

function checkClaimValue(value: unknown, fail: Fail): void {
  if (typeof value === "string") {
    if (value.length > MAX_CLAIM_VALUE_LENGTH) fail("OVERSIZED_STRING");
    return;
  }
  if (typeof value !== "number" && typeof value !== "boolean") fail("MALFORMED_JSON");
}

function checkClaim(claim: unknown, fail: Fail): void {
  if (!isEnvelopeRecord(claim)) {
    fail("MALFORMED_JSON");
    return;
  }
  checkMembers(claim, CLAIM_FIELDS, fail);
  checkClaimName(claim.name, fail);
  if (!TRUST_LEVELS.includes(claim.trust_level as string)) fail("TRUST_ESCALATION_ATTEMPT");
  checkClaimValue(claim.value, fail);
}

function checkTransform(item: unknown, fail: Fail): void {
  if (!isEnvelopeRecord(item)) {
    fail("MALFORMED_JSON");
    return;
  }
  checkMembers(item, TRANSFORM_FIELDS, fail);
  if (typeof item.transform !== "string" || item.transform.length > MAX_TRANSFORM_NAME_LENGTH) fail("OVERSIZED_STRING");
  if (!isValidTimestamp(item.timestamp)) fail("INVALID_TIMESTAMP");
}

function checkCollection(value: unknown, maximum: number, checkItem: (item: unknown, fail: Fail) => void, fail: Fail): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    fail("MALFORMED_JSON");
    return;
  }
  if (value.length > maximum) {
    fail("OVERSIZED_COLLECTION");
    return;
  }
  for (const item of value) checkItem(item, fail);
}

/** Inspects one serialized envelope, reporting every closed error code in validation order. */
export function inspectEnvelope(text: string): EnvelopeInspection {
  const codes: EnvelopeCode[] = [];
  const fail: Fail = (code) => {
    codes.push(code);
  };
  const parsed = parse(text, fail);
  if (codes.length > 0) return { codes, envelope: null };
  if (!isEnvelopeRecord(parsed)) {
    fail("MALFORMED_JSON");
    return { codes, envelope: null };
  }
  checkMembers(parsed, ROOT_FIELDS, fail);
  checkIdentity(parsed, fail);
  checkProvenance(parsed.provenance, fail);
  checkNonce(parsed.nonce, fail);
  checkCollection(parsed.claims, MAX_CLAIMS, checkClaim, fail);
  checkCollection(parsed.transform_history, MAX_TRANSFORMS, checkTransform, fail);
  return { codes, envelope: parsed };
}
