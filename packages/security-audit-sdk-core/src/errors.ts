import { SDK_ERROR_CODES } from "./generated/contract.generated.js";
import type { AuditErrorCode, SdkGeneratedErrorCode } from "./generated/contract.generated.js";
import { boundedPath, deepFreeze } from "./internal.js";

export type AuditErrorCategory = "configuration" | "validation" | "authority" | "privacy" | "lifecycle" | "sink";
export type SdkErrorCode = SdkGeneratedErrorCode;

export interface SafeAuditError {
  readonly code: AuditErrorCode | string;
  readonly category: AuditErrorCategory;
  readonly path?: string;
  readonly eventName?: string;
  readonly eventId?: string;
}

export type AuditResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SafeAuditError };

export class SecurityAuditSdkError extends Error {
  readonly code: AuditErrorCode | string;
  readonly category: AuditErrorCategory;
  readonly path: string | undefined;

  constructor(code: AuditErrorCode | string, category: AuditErrorCategory, path?: string) {
    super(code);
    this.name = "SecurityAuditSdkError";
    this.code = code;
    this.category = category;
    this.path = path;
  }

  toJSON(): SafeAuditError {
    return this.path === undefined
      ? { code: this.code, category: this.category }
      : { code: this.code, category: this.category, path: boundedPath(this.path) };
  }
}

export function failure(
  code: AuditErrorCode | string,
  category: AuditErrorCategory,
  path?: string,
  metadata?: { readonly eventName?: string; readonly eventId?: string },
): AuditResult<never> {
  const error: SafeAuditError = path === undefined ? { code, category } : { code, category, path: boundedPath(path) };
  if (metadata?.eventName !== undefined || metadata?.eventId !== undefined) {
    return {
      ok: false,
      error: {
        ...error,
        ...(metadata.eventName === undefined ? {} : { eventName: boundedPath(metadata.eventName) }),
        ...(metadata.eventId === undefined ? {} : { eventId: boundedPath(metadata.eventId) }),
      },
    };
  }
  return { ok: false, error };
}

export { SDK_ERROR_CODES };

export interface NormalizedCanonicalInput<T> {
  readonly value: Readonly<T>;
  readonly serialized: string;
  readonly bytes: number;
}

/** Safely inspect, snapshot, serialize, and measure caller-owned canonical value data. */
export function normalizeCanonicalInput<T>(value: T, path = "/"): AuditResult<NormalizedCanonicalInput<T>> {
  const inspected = inspectSupportedValue(value, path, new WeakSet<object>());
  if (!inspected.ok) return inspected;
  let snapshot: T;
  try { snapshot = structuredClone(value); }
  catch { return failure("SDK_INVALID_INPUT", "validation", path); }
  let serialized: string | undefined;
  try { serialized = JSON.stringify(snapshot); }
  catch { return failure("FIELD_SERIALIZATION_FAILED", "validation", path); }
  if (serialized === undefined) return failure("FIELD_SERIALIZATION_FAILED", "validation", path);
  return {
    ok: true,
    value: { value: deepFreeze(snapshot) as Readonly<T>, serialized, bytes: Buffer.byteLength(serialized, "utf8") },
  };
}

export function normalizeCanonicalInputOrThrow<T>(value: T, path = "/"): Readonly<T> {
  const normalized = normalizeCanonicalInput(value, path);
  if (!normalized.ok) throw new SecurityAuditSdkError(normalized.error.code, normalized.error.category, normalized.error.path);
  return normalized.value.value;
}

function inspectSupportedValue(value: unknown, path: string, ancestors: WeakSet<object>): AuditResult<void> {
  switch (typeof value) {
    case "string":
    case "boolean": return { ok: true, value: undefined };
    case "number": return Number.isFinite(value) ? { ok: true, value: undefined } : failure("SDK_INVALID_INPUT", "validation", path);
    case "bigint": return failure("FIELD_SERIALIZATION_FAILED", "validation", path);
    case "undefined": return { ok: true, value: undefined };
    case "symbol":
    case "function": return failure("SDK_INVALID_INPUT", "validation", path);
    case "object": break;
  }
  if (value === null) return { ok: true, value: undefined };
  let prototype: object | null;
  try { prototype = Object.getPrototypeOf(value); }
  catch { return failure("SDK_INVALID_INPUT", "validation", path); }
  const array = Array.isArray(value);
  if (!array && prototype !== Object.prototype && prototype !== null) return failure("SDK_INVALID_INPUT", "validation", path);
  if (ancestors.has(value)) return failure("FIELD_SERIALIZATION_FAILED", "validation", path);
  ancestors.add(value);
  try { return array ? inspectArray(value, path, ancestors) : inspectRecord(value as Record<string, unknown>, path, ancestors); }
  finally { ancestors.delete(value); }
}

function inspectArray(value: readonly unknown[], path: string, ancestors: WeakSet<object>): AuditResult<void> {
  let length: number;
  try { length = value.length; }
  catch { return failure("SDK_INVALID_INPUT", "validation", path); }
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); }
    catch { return failure("SDK_INVALID_INPUT", "validation", path); }
    if (!descriptor || !("value" in descriptor)) return failure("SDK_INVALID_INPUT", "validation", path);
    const child = inspectSupportedValue(descriptor.value, path, ancestors);
    if (!child.ok) return child;
  }
  return { ok: true, value: undefined };
}

function inspectRecord(value: Record<string, unknown>, path: string, ancestors: WeakSet<object>): AuditResult<void> {
  let keys: readonly PropertyKey[];
  try { keys = Reflect.ownKeys(value); }
  catch { return failure("SDK_INVALID_INPUT", "validation", path); }
  for (const key of keys) {
    if (typeof key !== "string") return failure("SDK_INVALID_INPUT", "validation", path);
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); }
    catch { return failure("SDK_INVALID_INPUT", "validation", path); }
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return failure("SDK_INVALID_INPUT", "validation", path);
    const child = inspectSupportedValue(descriptor.value, path, ancestors);
    if (!child.ok) return child;
  }
  return { ok: true, value: undefined };
}
