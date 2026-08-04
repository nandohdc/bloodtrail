import { PROHIBITED_DATA_KEYS } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { failure, normalizeCanonicalInput } from "../errors.js";
import { isPlainObject } from "../internal.js";

const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 32;
const MAX_EVENT_BYTES = 65_536;
const MAX_STRING_BYTES = 8_192;
const prohibitedKeyNeedles = PROHIBITED_DATA_KEYS.map((key) => key.toLowerCase());
const secretValuePattern = /\b(SECRET|TOKEN_SHOULD_NOT_APPEAR|SYNTHETIC_PROHIBITED_TOKEN|BEGIN PRIVATE KEY|PRIVATE KEY|Bearer\s+[A-Za-z0-9._-]{16,}|sk-[A-Za-z0-9]{16,})\b/i;

export function validateNoProhibitedData(value: unknown): AuditResult<void> {
  const normalized = normalizeCanonicalInput(value, "/");
  if (!normalized.ok) return normalized;
  return validateNormalizedNoProhibitedData(normalized.value.value, normalized.value.bytes);
}

export function validateNormalizedNoProhibitedData(value: unknown, serializedBytes?: number): AuditResult<void> {
  if (serializedBytes !== undefined && serializedBytes > MAX_EVENT_BYTES) return failure("FIELD_LIMIT_EXCEEDED", "validation", "/");
  const seen = new WeakSet<object>();
  const result = scan(value, "", 0, seen);
  return result.ok ? { ok: true, value: undefined } : result;
}

function scan(value: unknown, path: string, depth: number, seen: WeakSet<object>): AuditResult<void> {
  if (depth > MAX_DEPTH) return failure("FIELD_LIMIT_EXCEEDED", "validation", path || "/");
  switch (typeof value) {
    case "string": {
      if (byteLength(value) > MAX_STRING_BYTES) return failure("FIELD_LIMIT_EXCEEDED", "validation", path || "/");
      if (secretValuePattern.test(value)) return failure("PROHIBITED_DATA", "privacy", path || "/");
      return { ok: true, value: undefined };
    }
    case "number":
    case "boolean":
      return { ok: true, value: undefined };
    case "undefined":
      return { ok: true, value: undefined };
    case "bigint":
    case "symbol":
    case "function":
      return failure(typeof value === "bigint" ? "FIELD_SERIALIZATION_FAILED" : "SDK_INVALID_INPUT", "validation", path || "/");
    case "object":
      break;
  }
  if (value === null) return { ok: true, value: undefined };
  if (seen.has(value)) return failure("PROHIBITED_DATA", "privacy", path || "/");
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) return failure("FIELD_LIMIT_EXCEEDED", "validation", path || "/");
    for (let index = 0; index < value.length; index += 1) {
      const child = scan(value[index], `${path}/${index}`, depth + 1, seen);
      if (!child.ok) return child;
    }
    return { ok: true, value: undefined };
  }
  if (!isPlainObject(value)) return failure("PROHIBITED_DATA", "privacy", path || "/");
  for (const [key, item] of Object.entries(value)) {
    const childPath = `${path}/${escapePath(key)}`;
    if (isProhibitedKey(key)) return failure("PROHIBITED_DATA", "privacy", childPath);
    const child = scan(item, childPath, depth + 1, seen);
    if (!child.ok) return child;
  }
  return { ok: true, value: undefined };
}

function isProhibitedKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-\s]+/g, "_");
  return prohibitedKeyNeedles.some((needle) => normalized === needle || normalized.includes(`_${needle}`) || normalized.includes(`${needle}_`));
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function escapePath(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}
